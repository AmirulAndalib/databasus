package mariadb

import (
	"strings"
	"testing"

	"databasus-backend/internal/util/tools"
)

func Test_ParseMariadbVersionString_AcrossTheSupportedLines_RecordsTheLineIdentity(t *testing.T) {
	cases := []struct {
		reported string
		expected tools.MariadbVersion
	}{
		{"5.5.68-MariaDB", tools.MariadbVersion55},
		{"10.1.48-MariaDB", tools.MariadbVersion101},
		{"10.11.14-MariaDB", tools.MariadbVersion1011},
		{"12.0.2-MariaDB", tools.MariadbVersion120},
		{"13.0.2-MariaDB-1:13.0.2+maria~ubu2204", tools.MariadbVersion130},
		// A minor later than the client we ship, still inside the 13 line.
		{"13.2.0-MariaDB", tools.MariadbVersion130},
	}

	for _, c := range cases {
		got, err := parseMariadbVersionString(c.reported)
		if err != nil {
			t.Fatalf("parsing %q: %v", c.reported, err)
		}

		if got != c.expected {
			t.Errorf("server %s: got identity %s, expected %s", c.reported, got, c.expected)
		}
	}
}

func Test_ParseMariadbVersionString_OnALineNoClientServes_NamesTheSupportedVersions(t *testing.T) {
	_, err := parseMariadbVersionString("14.1.0-MariaDB")
	if err == nil {
		t.Fatal("expected a server on an unserved line to be refused")
	}

	if !strings.Contains(err.Error(), "supported") {
		t.Errorf("the refusal should list the supported versions, got %q", err.Error())
	}
}

func Test_ParseMariadbVersionString_AgainstAMysqlServer_DirectsToTheMysqlType(t *testing.T) {
	_, err := parseMariadbVersionString("8.0.46")
	if err == nil {
		t.Fatal("expected a MySQL server under the MariaDB type to be refused")
	}

	if !strings.Contains(err.Error(), "MySQL") {
		t.Errorf("the refusal should direct the user to the MySQL type, got %q", err.Error())
	}
}
