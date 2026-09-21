package users_services_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	users_services "databasus-backend/internal/features/users/services"
	users_testing "databasus-backend/internal/features/users/testing"
)

func Test_DisableTwoFactorAuth_WhenTheSettingIsAlreadyOff_ReportsNoChange(t *testing.T) {
	users_testing.ResetSettingsToDefaults(t.Context())

	recorder := users_testing.InstallAuditLogRecorder()
	users_services.GetSettingsService().SetAuditLogWriter(recorder)

	isChanged, err := users_services.GetSettingsService().DisableTwoFactorAuth(t.Context())

	require.NoError(t, err)
	assert.False(t, isChanged)
	assert.False(t, recorder.HasEntryContaining("isTwoFactorAuthRequired"))
}

func Test_DisableTwoFactorAuth_WhenTheSettingIsOn_SwitchesItOffAndLeavesATrace(t *testing.T) {
	users_testing.ResetSettingsToDefaults(t.Context())
	users_testing.EnableTwoFactorAuth(t.Context())
	t.Cleanup(func() { users_testing.ResetSettingsToDefaults(context.Background()) })

	recorder := users_testing.InstallAuditLogRecorder()
	users_services.GetSettingsService().SetAuditLogWriter(recorder)

	isChanged, err := users_services.GetSettingsService().DisableTwoFactorAuth(t.Context())
	require.NoError(t, err)
	assert.True(t, isChanged)

	settings, err := users_services.GetSettingsService().GetSettings(t.Context())
	require.NoError(t, err)
	assert.False(t, settings.IsTwoFactorAuthRequired)

	assert.True(
		t,
		recorder.HasEntryContaining("isTwoFactorAuthRequired: true -> false", "host console"),
	)
}
