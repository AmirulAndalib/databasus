package users_models

import (
	"time"

	"github.com/google/uuid"
)

// The row stays behind once a pending sign-in is destroyed, because the hourly
// cap counts it.
const MaxTwoFactorCodeAttempts = 5

type TwoFactorCode struct {
	ID         uuid.UUID `json:"id"     gorm:"column:id"`
	UserID     uuid.UUID `json:"userId" gorm:"column:user_id"`
	HashedCode string    `json:"-"      gorm:"column:hashed_code"`
	// The password the first step accepted, so the second step can refuse a
	// pending sign-in whose account has changed its password since.
	PasswordCreationTime time.Time `json:"passwordCreationTime" gorm:"column:password_creation_time"`
	ExpiresAt            time.Time `json:"expiresAt"            gorm:"column:expires_at"`
	IsUsed               bool      `json:"isUsed"               gorm:"column:is_used"`
	FailedAttemptCount   int       `json:"failedAttemptCount"   gorm:"column:failed_attempt_count"`
	CreatedAt            time.Time `json:"createdAt"            gorm:"column:created_at"`
}

func (TwoFactorCode) TableName() string {
	return "two_factor_codes"
}

func (c *TwoFactorCode) IsValid() bool {
	return !c.IsUsed && !c.IsDestroyed() && time.Now().UTC().Before(c.ExpiresAt)
}

func (c *TwoFactorCode) IsDestroyed() bool {
	return c.FailedAttemptCount >= MaxTwoFactorCodeAttempts
}
