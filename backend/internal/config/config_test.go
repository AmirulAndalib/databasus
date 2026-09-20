package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/ilyakaznacheev/cleanenv"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_IsTestProcess_UsesExecutableNameOnly(t *testing.T) {
	testCases := []struct {
		name      string
		arguments []string
		isTesting bool
	}{
		{
			name:      "Go test binary",
			arguments: []string{"/tmp/config.test", "-test.v"},
			isTesting: true,
		},
		{
			name:      "Windows Go test binary",
			arguments: []string{`C:\\Temp\\config.test.exe`, "-test.v"},
			isTesting: true,
		},
		{
			name:      "database cleanup command",
			arguments: []string{"/tmp/cleanup_test_db"},
			isTesting: true,
		},
		{
			name:      "storage command",
			arguments: []string{"/app/databasus", "--test-storage"},
			isTesting: false,
		},
		{
			name:      "unrelated argument containing test",
			arguments: []string{"/app/databasus", "contest"},
			isTesting: false,
		},
		{
			name:      "missing executable",
			arguments: nil,
			isTesting: false,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			isTesting := isTestProcess(testCase.arguments)
			assert.Equal(t, testCase.isTesting, isTesting)
		})
	}
}

const publishedTestDsn = "host=localhost user=postgres password=published dbname=databasus port=5437 sslmode=disable"

func Test_AdoptPublishedDatabaseDsnIfUnset_WhenEnvironmentHasNoDsn_UsesThePublishedOne(t *testing.T) {
	clearDatabaseDsnEnvVariable(t)
	publishedDsnPath := writePublishedDsn(t, publishedTestDsn+"\n")

	adoptPublishedDatabaseDsnIfUnset(publishedDsnPath)

	assert.Equal(t, publishedTestDsn, os.Getenv(databaseDsnEnvVariable))
}

func Test_AdoptPublishedDatabaseDsnIfUnset_WhenEnvironmentHasADsn_KeepsIt(t *testing.T) {
	const suppliedDsn = "host=external user=postgres password=supplied dbname=databasus port=5432 sslmode=require"

	t.Setenv(databaseDsnEnvVariable, suppliedDsn)
	publishedDsnPath := writePublishedDsn(t, publishedTestDsn)

	adoptPublishedDatabaseDsnIfUnset(publishedDsnPath)

	assert.Equal(t, suppliedDsn, os.Getenv(databaseDsnEnvVariable))
}

func Test_AdoptPublishedDatabaseDsnIfUnset_WhenNothingIsPublishedOrSupplied_LeavesTheDsnEmpty(
	t *testing.T,
) {
	clearDatabaseDsnEnvVariable(t)
	missingDsnPath := filepath.Join(t.TempDir(), "never-published")

	adoptPublishedDatabaseDsnIfUnset(missingDsnPath)

	assert.Empty(t, os.Getenv(databaseDsnEnvVariable))

	var environmentVariables EnvVariables
	require.NoError(t, cleanenv.ReadEnv(&environmentVariables))

	assert.Empty(t, environmentVariables.DatabaseDsn)
}

func clearDatabaseDsnEnvVariable(t *testing.T) {
	t.Helper()

	t.Setenv(databaseDsnEnvVariable, "")
	require.NoError(t, os.Unsetenv(databaseDsnEnvVariable))
}

func writePublishedDsn(t *testing.T, contents string) string {
	t.Helper()

	publishedDsnPath := filepath.Join(t.TempDir(), "databasus-database-dsn")
	require.NoError(t, os.WriteFile(publishedDsnPath, []byte(contents), 0o600))

	return publishedDsnPath
}

func Test_IsStorageProbeProcess_RecognisesOnlyTheStorageProbeFlag(t *testing.T) {
	testCases := []struct {
		name           string
		arguments      []string
		isStorageProbe bool
	}{
		{
			name:           "double dash flag",
			arguments:      []string{"/app/main", "--test-storage"},
			isStorageProbe: true,
		},
		{
			name:           "single dash flag",
			arguments:      []string{"/app/main", "-test-storage"},
			isStorageProbe: true,
		},
		{
			name:           "flag with explicit value",
			arguments:      []string{"/app/main", "--test-storage=true"},
			isStorageProbe: true,
		},
		{
			name:           "another command",
			arguments:      []string{"/app/main", "--list-admins"},
			isStorageProbe: false,
		},
		{
			name:           "flag name inside an attached value",
			arguments:      []string{"/app/main", "--email=test-storage"},
			isStorageProbe: false,
		},
		{
			name:           "flag name as a separate value",
			arguments:      []string{"/app/main", "--email", "test-storage"},
			isStorageProbe: false,
		},
		{
			name:           "no arguments",
			arguments:      nil,
			isStorageProbe: false,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			isStorageProbe := isStorageProbeProcess(testCase.arguments)
			assert.Equal(t, testCase.isStorageProbe, isStorageProbe)
		})
	}
}
