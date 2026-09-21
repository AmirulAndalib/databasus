package users_controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	cloudflare_turnstile "databasus-backend/internal/util/cloudflare_turnstile"
)

func verifyTurnstileOrRespond(ctx *gin.Context, token *string) bool {
	turnstileService := cloudflare_turnstile.GetCloudflareTurnstileService()
	if !turnstileService.IsEnabled() {
		return true
	}

	if token == nil || *token == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Cloudflare Turnstile verification required"})

		return false
	}

	isValid, err := turnstileService.VerifyToken(*token, ctx.ClientIP())
	if err != nil || !isValid {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Cloudflare Turnstile verification failed"})

		return false
	}

	return true
}
