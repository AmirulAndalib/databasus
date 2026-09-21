package users_services

import (
	"context"
	"fmt"
	"log/slog"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
)

const signInCodeCleanupJobName = "sign_in_code_cleanup"

const signInCodeCleanupInterval = 10 * time.Minute

// Both tables hold single-use codes that nobody comes back for, and neither was
// ever swept: password_reset_codes has had a cleanup method and no caller since
// it was written.
type SignInCodeBackgroundService struct {
	userService *UserService
	logger      *slog.Logger

	hasRun atomic.Bool
}

func (s *SignInCodeBackgroundService) Run(ctx context.Context) {
	if s.hasRun.Swap(true) {
		panic(fmt.Sprintf("%T.Run() called multiple times", s))
	}

	lifecycleLogger := s.logger.With("job_name", signInCodeCleanupJobName)

	lifecycleLogger.InfoContext(ctx, "sign-in code cleanup started")

	if ctx.Err() != nil {
		return
	}

	ticker := time.NewTicker(signInCodeCleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			lifecycleLogger.InfoContext(ctx, "sign-in code cleanup stopped")

			return
		case <-ticker.C:
			s.sweep(ctx)
		}
	}
}

func (s *SignInCodeBackgroundService) sweep(ctx context.Context) {
	logger := s.logger.With("job_id", uuid.New(), "job_name", signInCodeCleanupJobName)

	if err := s.userService.SweepPendingSignInsPastRetention(ctx); err != nil {
		logger.ErrorContext(ctx, "failed to delete pending sign-ins past their retention", "error", err)
	}

	if err := s.userService.SweepExpiredPasswordResetCodes(); err != nil {
		logger.ErrorContext(ctx, "failed to delete expired password reset codes", "error", err)
	}
}
