package mysql

import (
	"runtime"
	"strings"
	"testing"

	"databasus-backend/internal/util/tools"
)

func Test_ParseMysqlVersionString_AcrossTheSupportedLines_RecordsTheLineIdentity(t *testing.T) {
	cases := []struct {
		reported string
		expected tools.MysqlVersion
	}{
		{"8.0.46", tools.MysqlVersion80},
		{"8.4.11", tools.MysqlVersion84},
		{"9.7.2", tools.MysqlVersion9},
		{"26.7.0", tools.MysqlVersion26},
		// A release later than the client we ship, still inside the line.
		{"26.10.1", tools.MysqlVersion26},
	}

	for _, c := range cases {
		got, err := parseMysqlVersionString(c.reported)
		if err != nil {
			t.Fatalf("parsing %q: %v", c.reported, err)
		}

		if got != c.expected {
			t.Errorf("server %s: got identity %s, expected %s", c.reported, got, c.expected)
		}
	}
}

// Issue #786: Oracle MySQL HeatWave answers VERSION() with a vendor suffix.
func Test_ParseMysqlVersionString_WithAVendorSuffix_AcceptsTheServer(t *testing.T) {
	got, err := parseMysqlVersionString("26.7.0-cloud")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got != tools.MysqlVersion26 {
		t.Errorf("got identity %s, expected %s", got, tools.MysqlVersion26)
	}
}

func Test_ParseMysqlVersionString_OnALineNoClientServes_NamesTheSupportedVersions(t *testing.T) {
	_, err := parseMysqlVersionString("27.1.0")
	if err == nil {
		t.Fatal("expected a server on an unserved line to be refused")
	}

	if !strings.Contains(err.Error(), "supported") {
		t.Errorf("the refusal should list the supported versions, got %q", err.Error())
	}
}

func Test_ParseMysqlVersionString_WithAnUnreadableVersion_ReportsWhatItReceived(t *testing.T) {
	_, err := parseMysqlVersionString("unknown")
	if err == nil {
		t.Fatal("expected an unreadable version to be refused")
	}

	if !strings.Contains(err.Error(), "unknown") {
		t.Errorf("the refusal should report the value received, got %q", err.Error())
	}
}

func Test_ParseMysqlVersionString_OnAnArchitectureWithNoClient_NamesTheArchitecture(t *testing.T) {
	if runtime.GOARCH != "arm64" {
		t.Skip("MySQL 5.7 ships a client on amd64; only arm64 refuses it")
	}

	_, err := parseMysqlVersionString("5.7.44")
	if err == nil {
		t.Fatal("expected MySQL 5.7 to be refused on arm64")
	}

	if !strings.Contains(err.Error(), "arm") {
		t.Errorf("the refusal should name the architecture, got %q", err.Error())
	}
}
