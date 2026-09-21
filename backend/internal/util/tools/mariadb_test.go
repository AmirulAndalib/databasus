package tools

import "testing"

func Test_ParseMariadbClientVersion_AcrossTheTwoOutputShapes_ReadsTheServerLine(t *testing.T) {
	cases := []struct {
		output, expected string
	}{
		// The 10.6 client prints its protocol version first; 10.19 is not a
		// MariaDB release.
		{"mariadb-dump  Ver 10.19 Distrib 10.6.28-MariaDB, for debian-linux-gnu (x86_64)", "10.6.28"},
		{"mariadb-dump from 12.3.3-MariaDB, client 10.20 for debian-linux-gnu (x86_64)", "12.3.3"},
		{"mariadb from 13.0.2-MariaDB, client 10.20 for debian-linux-gnu (x86_64)", "13.0.2"},
	}

	for _, c := range cases {
		got, err := parseMariadbClientVersion(c.output)
		if err != nil {
			t.Fatalf("parsing %q: %v", c.output, err)
		}

		if got != c.expected {
			t.Errorf("parsing %q: got %s, expected %s", c.output, got, c.expected)
		}
	}
}

func Test_ParseMariadbClientVersion_WithOutputCarryingNoVersion_ReturnsError(t *testing.T) {
	if _, err := parseMariadbClientVersion("mariadb-dump: command not found"); err == nil {
		t.Error("expected an error when the output carries no version")
	}
}

func Test_GetMariadbClientVersionForServer_AcrossTheThreeTiers_PicksTheDesignatedClient(t *testing.T) {
	cases := []struct {
		server MariadbVersion
		client MariadbClientVersion
	}{
		{MariadbVersion55, MariadbClientLegacy},
		{MariadbVersion101, MariadbClientLegacy},
		{MariadbVersion102, MariadbClientModern},
		{MariadbVersion1011, MariadbClientModern},
		{MariadbVersion120, MariadbClientModern},
		{MariadbVersion130, MariadbClient13},
	}

	for _, c := range cases {
		if got := GetMariadbClientVersionForServer(c.server); got != c.client {
			t.Errorf("server %s: got client %s, expected %s", c.server, got, c.client)
		}
	}
}

func Test_IsMariadbBackupVersionHigherThanRestoreVersion_AcrossTheThirteenLine_RefusesDowngrades(t *testing.T) {
	cases := []struct {
		backup, restore MariadbVersion
		isDowngrade     bool
	}{
		{MariadbVersion130, MariadbVersion120, true},
		{MariadbVersion130, MariadbVersion118, true},
		{MariadbVersion130, MariadbVersion130, false},
		{MariadbVersion120, MariadbVersion130, false},
		{MariadbVersion1011, MariadbVersion106, true},
		{MariadbVersion106, MariadbVersion1011, false},
	}

	for _, c := range cases {
		got, err := IsMariadbBackupVersionHigherThanRestoreVersion(c.backup, c.restore)
		if err != nil {
			t.Fatalf("ordering %s onto %s: %v", c.backup, c.restore, err)
		}

		if got != c.isDowngrade {
			t.Errorf("restoring a %s backup onto %s: got %v, expected %v",
				c.backup, c.restore, got, c.isDowngrade)
		}
	}
}

func Test_IsMariadbBackupVersionHigherThanRestoreVersion_WithAnIdentityItCannotRead_ReturnsError(t *testing.T) {
	if _, err := IsMariadbBackupVersionHigherThanRestoreVersion("", MariadbVersion130); err == nil {
		t.Error("an identity the guard cannot order must be an error, not a silent zero")
	}
}
