package users_repositories

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	users_models "databasus-backend/internal/features/users/models"
	"databasus-backend/internal/storage"
)

// ErrHourlyCodeCapReached is how the repository refuses a code the account has
// no allowance left for.
var ErrHourlyCodeCapReached = errors.New("hourly sign-in code cap reached")

type TwoFactorRepository struct{}

// CreateCodeUnlessLive hands back the pending sign-in the account is already
// waiting on instead of creating a second one. The live row must carry the
// password the new one would, because a row issued before a password change
// can no longer be completed and would otherwise be handed back until it expired.
func (r *TwoFactorRepository) CreateCodeUnlessLive(
	ctx context.Context,
	code *users_models.TwoFactorCode,
	countedSince time.Time,
	maxCodesPerHour int64,
) (*users_models.TwoFactorCode, error) {
	var liveCode *users_models.TwoFactorCode

	err := storage.GetDb().WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockUserRow(tx, code.UserID); err != nil {
			return err
		}

		var existingCode users_models.TwoFactorCode

		err := tx.
			Where(
				"user_id = ? AND password_creation_time = ? AND is_used = ? "+
					"AND failed_attempt_count < ? AND expires_at > ?",
				code.UserID,
				code.PasswordCreationTime,
				false,
				users_models.MaxTwoFactorCodeAttempts,
				time.Now().UTC(),
			).
			Order("created_at DESC").
			First(&existingCode).Error
		if err == nil {
			liveCode = &existingCode

			return nil
		}

		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		return createCodeWithinHourlyCap(tx, code, countedSince, maxCodesPerHour)
	})
	if err != nil {
		return nil, err
	}

	return liveCode, nil
}

// CreateCodeWithinHourlyCap creates the code only while the account has fewer
// than maxCodesPerHour codes issued since countedSince, and answers
// ErrHourlyCodeCapReached otherwise.
func (r *TwoFactorRepository) CreateCodeWithinHourlyCap(
	ctx context.Context,
	code *users_models.TwoFactorCode,
	countedSince time.Time,
	maxCodesPerHour int64,
) error {
	return storage.GetDb().WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockUserRow(tx, code.UserID); err != nil {
			return err
		}

		return createCodeWithinHourlyCap(tx, code, countedSince, maxCodesPerHour)
	})
}

// A caller that hands over an identifier nobody issued gets no row and no error,
// because an unknown identifier is refused the same way an unusable one is.
func (r *TwoFactorRepository) GetCodeByID(
	ctx context.Context,
	codeID uuid.UUID,
) (*users_models.TwoFactorCode, error) {
	var code users_models.TwoFactorCode

	err := storage.GetDb().WithContext(ctx).Where("id = ?", codeID).First(&code).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}

		return nil, err
	}

	return &code, nil
}

// SpendCode marks the code used only if it is still usable, so two requests
// carrying the same correct code cannot both be let in.
func (r *TwoFactorRepository) SpendCode(ctx context.Context, codeID uuid.UUID) (bool, error) {
	result := storage.GetDb().WithContext(ctx).Model(&users_models.TwoFactorCode{}).
		Where("id = ? AND is_used = ? AND expires_at > ?", codeID, false, time.Now().UTC()).
		Update("is_used", true)

	return result.RowsAffected == 1, result.Error
}

func (r *TwoFactorRepository) MarkCodeAsUsed(ctx context.Context, codeID uuid.UUID) error {
	return storage.GetDb().WithContext(ctx).Model(&users_models.TwoFactorCode{}).
		Where("id = ?", codeID).
		Update("is_used", true).Error
}

// ClaimAttempt spends one of the pending sign-in's attempts before the code is
// compared, and answers false once none are left. Claiming first is what keeps
// a burst of simultaneous guesses at five: each guess needs a slot the database
// hands out one at a time. A correct code spends its slot too, which changes
// nothing, because the row is spent with it.
func (r *TwoFactorRepository) ClaimAttempt(
	ctx context.Context,
	codeID uuid.UUID,
) (int, bool, error) {
	var code users_models.TwoFactorCode

	result := storage.GetDb().WithContext(ctx).Model(&code).
		Clauses(clause.Returning{Columns: []clause.Column{{Name: "failed_attempt_count"}}}).
		Where(
			"id = ? AND is_used = ? AND failed_attempt_count < ? AND expires_at > ?",
			codeID,
			false,
			users_models.MaxTwoFactorCodeAttempts,
			time.Now().UTC(),
		).
		UpdateColumn("failed_attempt_count", gorm.Expr("failed_attempt_count + 1"))
	if result.Error != nil {
		return 0, false, result.Error
	}

	return code.FailedAttemptCount, result.RowsAffected == 1, nil
}

// The sweep goes by age rather than by expiry, because the hourly cap counts
// rows whose codes stopped working fifty minutes ago.
func (r *TwoFactorRepository) DeleteCodesCreatedBefore(ctx context.Context, cutoff time.Time) error {
	return storage.GetDb().WithContext(ctx).
		Where("created_at < ?", cutoff).
		Delete(&users_models.TwoFactorCode{}).Error
}

// Two password steps arriving together would otherwise both find no live row
// and both stay under the cap, and each would mail a code. Holding the account's
// row for the length of the transaction makes the second one wait and see the
// first one's code.
func lockUserRow(tx *gorm.DB, userID uuid.UUID) error {
	return tx.Exec("SELECT 1 FROM users WHERE id = ? FOR UPDATE", userID).Error
}

func createCodeWithinHourlyCap(
	tx *gorm.DB,
	code *users_models.TwoFactorCode,
	countedSince time.Time,
	maxCodesPerHour int64,
) error {
	var recentCodeCount int64

	err := tx.Model(&users_models.TwoFactorCode{}).
		Where("user_id = ? AND created_at > ?", code.UserID, countedSince).
		Count(&recentCodeCount).Error
	if err != nil {
		return err
	}

	if recentCodeCount >= maxCodesPerHour {
		return ErrHourlyCodeCapReached
	}

	if code.ID == uuid.Nil {
		code.ID = uuid.New()
	}

	return tx.Create(code).Error
}
