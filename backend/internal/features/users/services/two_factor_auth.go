package users_services

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	audit_logs_models "databasus-backend/internal/features/audit_logs/models"
	users_dto "databasus-backend/internal/features/users/dto"
	users_errors "databasus-backend/internal/features/users/errors"
	users_models "databasus-backend/internal/features/users/models"
	users_repositories "databasus-backend/internal/features/users/repositories"
	"databasus-backend/internal/util/ratelimiter"
)

const (
	twoFactorCodeLifetime = 10 * time.Minute

	// A row is counted for an hour and swept once it is older, so the window the
	// cap reads over and the window the rows survive are the same hour.
	twoFactorCodeRetention = time.Hour

	maxTwoFactorCodesPerHour int64 = 5

	twoFactorResendScope  = "signin-code-resend"
	twoFactorResendWindow = time.Minute
)

// StartTwoFactorSignIn is reached only once the password has been accepted. A
// pending sign-in that is still live is handed back unchanged, so reloading the
// code screen neither sends a second message nor spends the hourly allowance.
func (s *UserService) StartTwoFactorSignIn(
	ctx context.Context,
	user *users_models.User,
) (*users_dto.PendingSignInResponseDTO, error) {
	return s.issueTwoFactorCode(ctx, user, true)
}

func (s *UserService) VerifyTwoFactorCode(
	ctx context.Context,
	pendingSignInID uuid.UUID,
	code string,
) (*users_dto.SignInResponseDTO, error) {
	pendingCode, user, err := s.loadUsablePendingSignIn(ctx, pendingSignInID)
	if err != nil {
		return nil, err
	}

	attemptCount, isAttemptClaimed, err := s.twoFactorRepository.ClaimAttempt(ctx, pendingCode.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to count the sign-in attempt: %w", err)
	}

	if !isAttemptClaimed {
		return nil, users_errors.ErrPendingSignInNotUsable
	}

	if bcrypt.CompareHashAndPassword([]byte(pendingCode.HashedCode), []byte(code)) != nil {
		return nil, s.refuseWrongTwoFactorCode(ctx, attemptCount, user)
	}

	isSpent, err := s.twoFactorRepository.SpendCode(ctx, pendingCode.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to spend the sign-in code: %w", err)
	}

	if !isSpent {
		return nil, users_errors.ErrPendingSignInNotUsable
	}

	return s.completeSignIn(ctx, user)
}

// The previous code is invalidated only once the replacement is on its way, so a
// refused resend leaves the user with the code they already have.
func (s *UserService) ResendTwoFactorCode(
	ctx context.Context,
	pendingSignInID uuid.UUID,
) (*users_dto.PendingSignInResponseDTO, error) {
	pendingCode, user, err := s.loadUsablePendingSignIn(ctx, pendingSignInID)
	if err != nil {
		return nil, err
	}

	isAllowed, err := s.rateLimiter.RecordAttemptAndCheckIsAllowed(ctx, ratelimiter.Attempt{
		Scope:      twoFactorResendScope,
		Identifier: user.ID.String(),
		Limit:      1,
		Window:     twoFactorResendWindow,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to evaluate the sign-in code resend limit: %w", err)
	}

	if !isAllowed {
		return nil, users_errors.ErrSignInCodeResentTooSoon
	}

	pendingSignIn, err := s.issueTwoFactorCode(ctx, user, false)
	if err != nil {
		return nil, err
	}

	if err := s.twoFactorRepository.MarkCodeAsUsed(ctx, pendingCode.ID); err != nil {
		return nil, fmt.Errorf("failed to invalidate the previous sign-in code: %w", err)
	}

	return pendingSignIn, nil
}

func (s *UserService) SweepPendingSignInsPastRetention(ctx context.Context) error {
	return s.twoFactorRepository.DeleteCodesCreatedBefore(
		ctx,
		time.Now().UTC().Add(-twoFactorCodeRetention),
	)
}

func (s *UserService) SweepExpiredPasswordResetCodes() error {
	return s.passwordResetRepository.DeleteExpiredCodes()
}

// The pending sign-in proves that a password was correct minutes ago, not that
// the account may be let in now, so the checks the password step made are made
// again. The second-factor setting is deliberately not among them: switching it
// off must not strand somebody holding a code.
func (s *UserService) loadUsablePendingSignIn(
	ctx context.Context,
	pendingSignInID uuid.UUID,
) (*users_models.TwoFactorCode, *users_models.User, error) {
	pendingCode, err := s.twoFactorRepository.GetCodeByID(ctx, pendingSignInID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to load the pending sign-in: %w", err)
	}

	if pendingCode == nil || !pendingCode.IsValid() {
		return nil, nil, users_errors.ErrPendingSignInNotUsable
	}

	user, err := s.userRepository.GetUserByID(ctx, pendingCode.UserID)
	if err != nil || user == nil {
		return nil, nil, users_errors.ErrPendingSignInNotUsable
	}

	if !user.IsActiveUser() {
		return nil, nil, users_errors.ErrPendingSignInNotUsable
	}

	if !user.PasswordCreationTime.Truncate(time.Microsecond).
		Equal(pendingCode.PasswordCreationTime.Truncate(time.Microsecond)) {
		return nil, nil, users_errors.ErrPendingSignInNotUsable
	}

	return pendingCode, user, nil
}

func (s *UserService) refuseWrongTwoFactorCode(
	ctx context.Context,
	attemptCount int,
	user *users_models.User,
) error {
	if attemptCount < users_models.MaxTwoFactorCodeAttempts {
		return users_errors.ErrSignInCodeIncorrect
	}

	s.writeAuditLog(ctx, audit_logs_models.AuditEntry{
		Message: fmt.Sprintf(
			"Two-factor sign-in abandoned after too many incorrect codes: %s",
			user.Email,
		),
		UserID:      &user.ID,
		WorkspaceID: nil,
	})

	return users_errors.ErrPendingSignInNotUsable
}

// Nothing is created before the instance has said it can deliver, and a send
// that fails leaves the row it counted behind while making it unusable, so the
// caller never sees a code screen for a message that will not arrive. A resend
// replaces the live code, so only the password step hands a live one back.
func (s *UserService) issueTwoFactorCode(
	ctx context.Context,
	user *users_models.User,
	shouldReuseLiveCode bool,
) (*users_dto.PendingSignInResponseDTO, error) {
	if s.emailSender == nil || !s.emailSender.IsConfigured() {
		s.logger.ErrorContext(ctx, "sign-in code not sent: the instance has no mail server",
			"user_id", user.ID)

		return nil, users_errors.ErrSignInCodeNotSent
	}

	code, err := generateSixDigitCode()
	if err != nil {
		return nil, err
	}

	hashedCode, err := bcrypt.GenerateFromPassword([]byte(code), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash the sign-in code: %w", err)
	}

	now := time.Now().UTC()
	pendingCode := &users_models.TwoFactorCode{
		ID:                   uuid.New(),
		UserID:               user.ID,
		HashedCode:           string(hashedCode),
		PasswordCreationTime: user.PasswordCreationTime,
		ExpiresAt:            now.Add(twoFactorCodeLifetime),
		IsUsed:               false,
		FailedAttemptCount:   0,
		CreatedAt:            now,
	}
	countedSince := now.Add(-twoFactorCodeRetention)

	if shouldReuseLiveCode {
		liveCode, err := s.twoFactorRepository.CreateCodeUnlessLive(
			ctx, pendingCode, countedSince, maxTwoFactorCodesPerHour,
		)
		if err != nil {
			return nil, toIssueError(err)
		}

		if liveCode != nil {
			return &users_dto.PendingSignInResponseDTO{
				PendingSignInID: liveCode.ID,
				Email:           user.Email,
			}, nil
		}
	} else {
		err := s.twoFactorRepository.CreateCodeWithinHourlyCap(
			ctx, pendingCode, countedSince, maxTwoFactorCodesPerHour,
		)
		if err != nil {
			return nil, toIssueError(err)
		}
	}

	if err := s.emailSender.SendEmail(ctx, user.Email, twoFactorCodeSubject, twoFactorCodeBody(code)); err != nil {
		s.logger.ErrorContext(ctx, "failed to send the sign-in code", "user_id", user.ID, "error", err)

		if markErr := s.twoFactorRepository.MarkCodeAsUsed(ctx, pendingCode.ID); markErr != nil {
			s.logger.ErrorContext(ctx, "failed to discard an unsent pending sign-in",
				"user_id", user.ID, "error", markErr)
		}

		return nil, users_errors.ErrSignInCodeNotSent
	}

	return &users_dto.PendingSignInResponseDTO{
		PendingSignInID: pendingCode.ID,
		Email:           user.Email,
	}, nil
}

func toIssueError(err error) error {
	if errors.Is(err, users_repositories.ErrHourlyCodeCapReached) {
		return users_errors.ErrTooManySignInCodes
	}

	return fmt.Errorf("failed to create the pending sign-in: %w", err)
}

func generateSixDigitCode() (string, error) {
	randomBytes := make([]byte, 4)
	if _, err := io.ReadFull(rand.Reader, randomBytes); err != nil {
		return "", fmt.Errorf("failed to generate the sign-in code: %w", err)
	}

	return fmt.Sprintf("%06d", binary.BigEndian.Uint32(randomBytes)%1000000), nil
}
