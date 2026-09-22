package users_services_test

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	users_services "databasus-backend/internal/features/users/services"
)

func Test_ChangeUserPasswordByEmail_WhenNoAccountHoldsTheAddress_ReturnsAnError(t *testing.T) {
	missingEmail := "missing-" + uuid.New().String() + "@example.com"

	err := users_services.GetUserService().ChangeUserPasswordByEmail(
		t.Context(),
		missingEmail,
		"AnyPassword123!",
	)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "does not exist")
}
