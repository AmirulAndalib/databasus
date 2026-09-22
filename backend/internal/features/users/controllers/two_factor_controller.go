package users_controllers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	user_dto "databasus-backend/internal/features/users/dto"
	"databasus-backend/internal/util/ratelimiter"
)

const (
	signInCodeVerificationScope  = "signin-code-verification"
	signInCodeVerificationLimit  = 10
	signInCodeVerificationWindow = time.Minute
)

// VerifySignInCode
// @Summary Finish a two-step sign-in
// @Description Exchange a pending sign-in and the code sent by email for an access token
// @Tags users
// @Accept json
// @Produce json
// @Param request body users_dto.VerifySignInCodeRequestDTO true "Pending sign-in and code"
// @Success 200 {object} users_dto.SignInResponseDTO
// @Failure 400 {object} map[string]string "The code is incorrect"
// @Failure 410 {object} map[string]string "The pending sign-in can no longer be completed"
// @Failure 429 {object} map[string]string "Rate limit exceeded"
// @Router /users/verify-signin-code [post]
func (c *UserController) VerifySignInCode(ctx *gin.Context) {
	var request user_dto.VerifySignInCodeRequestDTO
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	if !verifyTurnstileOrRespond(ctx, request.CloudflareTurnstileToken) {
		return
	}

	if !checkRateLimitOrRespond(ctx, c.rateLimiter, c.logger, ratelimiter.Attempt{
		Scope:      signInCodeVerificationScope,
		Identifier: request.PendingSignInID.String(),
		Limit:      signInCodeVerificationLimit,
		Window:     signInCodeVerificationWindow,
	}) {
		return
	}

	response, err := c.userService.VerifyTwoFactorCode(
		ctx.Request.Context(),
		request.PendingSignInID,
		request.Code,
	)
	if err != nil {
		respondToSignInError(ctx, err)
		return
	}

	ctx.JSON(http.StatusOK, response)
}

// ResendSignInCode
// @Summary Send another sign-in code
// @Description Replace the code of a pending sign-in with a fresh one
// @Tags users
// @Accept json
// @Produce json
// @Param request body users_dto.ResendSignInCodeRequestDTO true "Pending sign-in"
// @Success 200 {object} users_dto.PendingSignInResponseDTO
// @Failure 400 {object} map[string]string
// @Failure 410 {object} map[string]string "The pending sign-in can no longer be completed"
// @Failure 429 {object} map[string]string "Rate limit exceeded"
// @Failure 503 {object} map[string]string "The code could not be sent"
// @Router /users/resend-signin-code [post]
func (c *UserController) ResendSignInCode(ctx *gin.Context) {
	var request user_dto.ResendSignInCodeRequestDTO
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	if !verifyTurnstileOrRespond(ctx, request.CloudflareTurnstileToken) {
		return
	}

	response, err := c.userService.ResendTwoFactorCode(ctx.Request.Context(), request.PendingSignInID)
	if err != nil {
		respondToSignInError(ctx, err)
		return
	}

	ctx.JSON(http.StatusOK, response)
}
