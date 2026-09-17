// Adapted from wal-g/internal/databases/postgres/timeline.go.
// Copyright 2017 Citus Data Inc. Licensed under the Apache License, Version 2.0.

package walmath

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
)

var regexpTimelineAndLogSegNo = regexp.MustCompile(PatternTimelineAndLogSegNo)

func ParseWALFilename(name string) (timelineID uint32, logSegNo uint64, err error) {
	return ParseWALFilenameWithSize(name, WalSegmentSize)
}

// Unlike ParseWALFilename, this holds for a cluster whose WAL segment size differs
// from the configured one: the timeline field does not depend on it.
func ParseWALFilenameTimeline(name string) (uint32, error) {
	timelineID, _, err := parseWalSegmentFields(name)

	return timelineID, err
}

func ParseWALFilenameWithSize(name string, segmentSize uint64) (timelineID uint32, logSegNo uint64, err error) {
	timelineID, logSegmentFields, err := parseWalSegmentFields(name)
	if err != nil {
		return 0, 0, err
	}

	if segmentSize == 0 || 0x100000000%segmentSize != 0 {
		return 0, 0, IncorrectLogSegNoError{Filename: name}
	}

	logSegNoHi := logSegmentFields >> hexUint32Bits
	logSegNoLo := logSegmentFields & math.MaxUint32

	segmentsPerLogID := 0x100000000 / segmentSize
	if logSegNoLo >= segmentsPerLogID {
		return 0, 0, IncorrectLogSegNoError{Filename: name}
	}

	logSegNo = logSegNoHi*segmentsPerLogID + logSegNoLo

	return timelineID, logSegNo, nil
}

func parseWalSegmentFields(name string) (timelineID uint32, logSegmentFields uint64, err error) {
	if len(name) != walSegmentFilenameLength {
		return 0, 0, NotWalFilenameError{Filename: name}
	}

	parsedTimelineID, err := strconv.ParseUint(name[0:8], 0x10, hexUint32Bits)
	if err != nil {
		return 0, 0, NotWalFilenameError{Filename: name}
	}

	logSegmentFields, err = strconv.ParseUint(name[8:walSegmentFilenameLength], 0x10, hexUint64Bits)
	if err != nil {
		return 0, 0, NotWalFilenameError{Filename: name}
	}

	return uint32(parsedTimelineID), logSegmentFields, nil
}

func formatWALFileName(timeline uint32, logSegNo uint64) string {
	return fmt.Sprintf(walFileFormat, timeline, logSegNo/xLogSegmentsPerXLogID, logSegNo%xLogSegmentsPerXLogID)
}

func GetNextWalFilename(name string) (string, error) {
	timelineID, logSegNo, err := ParseWALFilename(name)
	if err != nil {
		return "", err
	}

	return formatWALFileName(timelineID, logSegNo+1), nil
}

func TryFetchTimelineAndLogSegNo(objectName string) (uint32, uint64, bool) {
	foundLsn := regexpTimelineAndLogSegNo.FindAllString(objectName, maxCountOfLSN)
	if len(foundLsn) > 0 {
		timelineID, logSegNo, err := ParseWALFilename(foundLsn[0])
		if err == nil {
			return timelineID, logSegNo, true
		}
	}

	return 0, 0, false
}

func IsWalFilename(filename string) bool {
	_, _, err := ParseWALFilename(filename)
	return err == nil
}
