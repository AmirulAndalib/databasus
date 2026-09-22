package users_interfaces

import (
	"context"

	audit_logs_models "databasus-backend/internal/features/audit_logs/models"
)

type AuditLogWriter interface {
	WriteAuditLog(ctx context.Context, entry audit_logs_models.AuditEntry)
}

type EmailSender interface {
	// SendEmail reports no error when the instance has no mail server, so a
	// caller that must not admit a silent skip asks this first.
	IsConfigured() bool
	SendEmail(ctx context.Context, to, subject, body string) error
}
