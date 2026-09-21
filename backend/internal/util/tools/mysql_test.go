package tools

import "testing"

func Test_ParseMysqlClientVersion_AcrossTheTwoOutputShapes_ReadsTheRelease(t *testing.T) {
	cases := []struct {
		output, expected string
	}{
		{"mysqldump  Ver 26.7.0 for Linux on x86_64 (MySQL Community Server - GPL)", "26.7.0"},
		{"mysql  Ver 9.7.2 for Linux on x86_64 (MySQL Community Server - GPL)", "9.7.2"},
		// 5.7 reports the tool's own version first and the server line behind
		// "Distrib", so the first number in the line is the wrong one.
		{"mysqldump  Ver 10.13 Distrib 5.7.44, for linux-glibc2.12 (x86_64)", "5.7.44"},
		{"mysql  Ver 14.14 Distrib 5.7.44, for linux-glibc2.12 (x86_64) using  EditLine wrapper", "5.7.44"},
	}

	for _, c := range cases {
		got, err := parseMysqlClientVersion(c.output)
		if err != nil {
			t.Fatalf("parsing %q: %v", c.output, err)
		}

		if got != c.expected {
			t.Errorf("parsing %q: got %s, expected %s", c.output, got, c.expected)
		}
	}
}

func Test_ParseMysqlClientVersion_WithOutputCarryingNoVersion_ReturnsError(t *testing.T) {
	if _, err := parseMysqlClientVersion("mysqldump: command not found"); err == nil {
		t.Error("expected an error when the output carries no version")
	}
}

func Test_IsMysqlBackupVersionHigherThanRestoreVersion_AcrossTheCalendarLine_RefusesDowngrades(t *testing.T) {
	cases := []struct {
		backup, restore MysqlVersion
		isDowngrade     bool
	}{
		{MysqlVersion26, MysqlVersion9, true},
		{MysqlVersion26, MysqlVersion80, true},
		{MysqlVersion26, MysqlVersion26, false},
		{MysqlVersion9, MysqlVersion26, false},
		{MysqlVersion84, MysqlVersion80, true},
		{MysqlVersion57, MysqlVersion80, false},
	}

	for _, c := range cases {
		got, err := IsMysqlBackupVersionHigherThanRestoreVersion(c.backup, c.restore)
		if err != nil {
			t.Fatalf("ordering %s onto %s: %v", c.backup, c.restore, err)
		}

		if got != c.isDowngrade {
			t.Errorf("restoring a %s backup onto %s: got %v, expected %v",
				c.backup, c.restore, got, c.isDowngrade)
		}
	}
}

func Test_IsMysqlBackupVersionHigherThanRestoreVersion_WithAnIdentityItCannotRead_ReturnsError(t *testing.T) {
	if _, err := IsMysqlBackupVersionHigherThanRestoreVersion("", MysqlVersion9); err == nil {
		t.Error("an identity the guard cannot order must be an error, not a silent zero")
	}
}
