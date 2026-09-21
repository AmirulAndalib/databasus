package tools

import "testing"

func Test_CompareReleaseLines_WithIdentitiesOfDifferentDepth_OrdersByNumbers(t *testing.T) {
	cases := []struct {
		left, right string
		isLeftNewer bool
	}{
		{"26", "9", true},
		{"9", "8.4", true},
		{"8.4", "8.0", true},
		{"13.0", "12.0", true},
		{"12.0", "11.8", true},
		{"10.11", "10.6", true},
		{"5.7", "8.0", false},
		{"10.6", "10.11", false},
	}

	for _, c := range cases {
		order, err := compareReleaseLines(c.left, c.right)
		if err != nil {
			t.Fatalf("comparing %s and %s: %v", c.left, c.right, err)
		}

		if (order > 0) != c.isLeftNewer {
			t.Errorf("comparing %s and %s: got order %d, expected isLeftNewer=%v",
				c.left, c.right, order, c.isLeftNewer)
		}
	}
}

func Test_CompareReleaseLines_WithEqualIdentities_ReportsNoDifference(t *testing.T) {
	order, err := compareReleaseLines("13.0", "13.0")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if order != 0 {
		t.Errorf("got order %d, expected 0", order)
	}
}

func Test_CompareReleaseLines_WithAnUnparseableIdentity_ReturnsError(t *testing.T) {
	if _, err := compareReleaseLines("13.0", "next"); err == nil {
		t.Error("expected an error for an identity that is not a dotted number")
	}

	if _, err := compareReleaseLines("", "13.0"); err == nil {
		t.Error("expected an error for an empty identity")
	}
}

func Test_IsVersionOnReleaseLine_WithAVersionInsideTheLine_ReportsTrue(t *testing.T) {
	cases := []struct {
		reported, line string
		isOnLine       bool
	}{
		{"26.7.0", "26", true},
		{"26.10.1", "26", true},
		{"13.0.2", "13.0", true},
		{"13.2.0", "13.0", false},
		{"10.6.28", "10.6", true},
		{"10.11.14", "10.6", false},
		{"12.3.3", "12.3", true},
		{"9.7.2", "9", true},
		{"5.7.44", "5.7", true},
		{"17.10", "17", true},
		{"10.6", "10.6.28", false},
		{"not-a-version", "10.6", false},
	}

	for _, c := range cases {
		if got := isVersionOnReleaseLine(c.reported, c.line); got != c.isOnLine {
			t.Errorf("version %s on line %s: got %v, expected %v",
				c.reported, c.line, got, c.isOnLine)
		}
	}
}
