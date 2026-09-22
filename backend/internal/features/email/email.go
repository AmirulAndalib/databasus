package email

import (
	"context"
	"log/slog"

	"databasus-backend/internal/util/smtp_transport"
)

type EmailSMTPSender struct {
	logger       *slog.Logger
	connection   smtp_transport.Connection
	from         string
	isConfigured bool
}

func (s *EmailSMTPSender) IsConfigured() bool {
	return s.isConfigured
}

func (s *EmailSMTPSender) SendEmail(ctx context.Context, to, subject, body string) error {
	if !s.isConfigured {
		s.logger.WarnContext(ctx, "skipping email send, SMTP is not configured", "to_email", to, "subject", subject)
		return nil
	}

	sender, err := smtp_transport.ResolveSender(s.from, s.connection.Username, s.connection.Host)
	if err != nil {
		return err
	}

	return smtp_transport.Send(ctx, s.connection, smtp_transport.Message{
		Sender:    sender,
		Recipient: to,
		Subject:   subject,
		HTMLBody:  body,
	})
}
