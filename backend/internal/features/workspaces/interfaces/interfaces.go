package workspaces_interfaces

import (
	"context"

	"github.com/google/uuid"
)

type WorkspaceDeletionListener interface {
	OnBeforeWorkspaceDeletion(workspaceID uuid.UUID) error
}

type EmailSender interface {
	SendEmail(ctx context.Context, to, subject, body string) error
}
