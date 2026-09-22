package users_controllers

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"databasus-backend/internal/util/ratelimiter"
)

func checkRateLimitOrRespond(
	ctx *gin.Context,
	rateLimiter ratelimiter.Counter,
	logger *slog.Logger,
	attempt ratelimiter.Attempt,
) bool {
	isAllowed, err := rateLimiter.RecordAttemptAndCheckIsAllowed(ctx.Request.Context(), attempt)
	if err != nil {
		logger.ErrorContext(ctx.Request.Context(), "failed to evaluate a rate limit",
			"scope", attempt.Scope, "error", err)
	}

	if err != nil || !isAllowed {
		ctx.JSON(
			http.StatusTooManyRequests,
			gin.H{"error": "Rate limit exceeded. Please try again later.", "code": "rate_limit_exceeded"},
		)

		return false
	}

	return true
}
