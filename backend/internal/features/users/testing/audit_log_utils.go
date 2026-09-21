package users_testing

import (
	"context"
	"strings"
	"sync"

	audit_logs_models "databasus-backend/internal/features/audit_logs/models"
)

// A test asserts that an action was recorded instead of discarding it.
type RecordingAuditLogWriter struct {
	mutex   sync.Mutex
	entries []audit_logs_models.AuditEntry
}

func (w *RecordingAuditLogWriter) WriteAuditLog(_ context.Context, entry audit_logs_models.AuditEntry) {
	w.mutex.Lock()
	defer w.mutex.Unlock()

	w.entries = append(w.entries, entry)
}

func (w *RecordingAuditLogWriter) GetEntries() []audit_logs_models.AuditEntry {
	w.mutex.Lock()
	defer w.mutex.Unlock()

	return append([]audit_logs_models.AuditEntry(nil), w.entries...)
}

// Callers match fragments rather than the whole list because the setup a test
// needs first - creating an account, signing in - writes entries of its own.
func (w *RecordingAuditLogWriter) HasEntryContaining(fragments ...string) bool {
	for _, entry := range w.GetEntries() {
		if containsAll(entry.Message, fragments) {
			return true
		}
	}

	return false
}

func containsAll(message string, fragments []string) bool {
	for _, fragment := range fragments {
		if !strings.Contains(message, fragment) {
			return false
		}
	}

	return true
}

var (
	currentAuditLogRecorder      = &RecordingAuditLogWriter{}
	currentAuditLogRecorderMutex sync.Mutex
)

// InstallAuditLogRecorder hands out a fresh recorder and makes it the one
// GetAuditLogRecorder returns. Test routers install one each time they are built,
// so a test never reads the entries another test left behind.
func InstallAuditLogRecorder() *RecordingAuditLogWriter {
	recorder := &RecordingAuditLogWriter{}

	currentAuditLogRecorderMutex.Lock()
	defer currentAuditLogRecorderMutex.Unlock()

	currentAuditLogRecorder = recorder

	return recorder
}

func GetAuditLogRecorder() *RecordingAuditLogWriter {
	currentAuditLogRecorderMutex.Lock()
	defer currentAuditLogRecorderMutex.Unlock()

	return currentAuditLogRecorder
}
