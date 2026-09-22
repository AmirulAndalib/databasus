package users_controllers

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	users_dto "databasus-backend/internal/features/users/dto"
	user_enums "databasus-backend/internal/features/users/enums"
	users_errors "databasus-backend/internal/features/users/errors"
	user_middleware "databasus-backend/internal/features/users/middleware"
	users_services "databasus-backend/internal/features/users/services"
	"databasus-backend/internal/util/ratelimiter"
)

const (
	testEmailRateLimitScope  = "test-email"
	testEmailRateLimit       = 5
	testEmailRateLimitWindow = 10 * time.Minute
)

type SettingsController struct {
	settingsService *users_services.SettingsService
	rateLimiter     ratelimiter.Counter
	logger          *slog.Logger
}

func (c *SettingsController) RegisterRoutes(router *gin.RouterGroup) {
	router.GET("/users/settings", c.GetUsersSettings)
	router.PUT(
		"/users/settings",
		user_middleware.RequireRole(user_enums.UserRoleAdmin),
		c.UpdateUsersSettings,
	)
	router.POST(
		"/users/settings/test-email",
		user_middleware.RequireRole(user_enums.UserRoleAdmin),
		c.SendTestEmail,
	)
}

// GetUsersSettings
// @Summary Get users settings
// @Description Get global users settings. Every signed-in user can read them, because the main screen and the workspace dialogs depend on them
// @Tags settings
// @Produce json
// @Security BearerAuth
// @Success 200 {object} users_dto.SettingsResponseDTO
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Forbidden"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /users/settings [get]
func (c *SettingsController) GetUsersSettings(ctx *gin.Context) {
	settings, err := c.settingsService.GetSettingsResponse(ctx.Request.Context())
	if err != nil {
		_ = ctx.Error(err)

		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get settings"})
		return
	}

	ctx.JSON(http.StatusOK, settings)
}

// UpdateUsersSettings
// @Summary Update users settings
// @Description Update global users settings (admin only)
// @Tags settings
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body users_dto.UpdateSettingsRequestDTO true "Settings update data"
// @Success 200 {object} users_dto.SettingsResponseDTO
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Forbidden"
// @Router /users/settings [put]
func (c *SettingsController) UpdateUsersSettings(ctx *gin.Context) {
	user, ok := user_middleware.GetUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var request users_dto.UpdateSettingsRequestDTO
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	settings, err := c.settingsService.UpdateSettings(ctx.Request.Context(), request, user)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, settings)
}

// SendTestEmail
// @Summary Send a test email
// @Description Send a test message through the instance mail server to the signed-in administrator's own address (admin only). A failed delivery answers 400 with the mail server's error and no code
// @Tags settings
// @Produce json
// @Security BearerAuth
// @Success 200 {object} users_dto.SendTestEmailResponseDTO
// @Failure 400 {object} map[string]string "Mail server not configured, no usable address, or delivery failed"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Forbidden"
// @Failure 429 {object} map[string]string "Rate limit exceeded"
// @Router /users/settings/test-email [post]
func (c *SettingsController) SendTestEmail(ctx *gin.Context) {
	user, ok := user_middleware.GetUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	if !checkRateLimitOrRespond(ctx, c.rateLimiter, c.logger, ratelimiter.Attempt{
		Scope:      testEmailRateLimitScope,
		Identifier: user.ID.String(),
		Limit:      testEmailRateLimit,
		Window:     testEmailRateLimitWindow,
	}) {
		return
	}

	recipientEmail, err := c.settingsService.SendTestEmail(ctx.Request.Context(), user)

	switch {
	case errors.Is(err, users_errors.ErrEmailNotConfigured):
		respondWithCode(ctx, http.StatusBadRequest, err, "email_not_configured")
	case errors.Is(err, users_errors.ErrAdminEmailMissing):
		respondWithCode(ctx, http.StatusBadRequest, err, "admin_email_missing")
	case err != nil:
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		ctx.JSON(http.StatusOK, users_dto.SendTestEmailResponseDTO{RecipientEmail: recipientEmail})
	}
}
