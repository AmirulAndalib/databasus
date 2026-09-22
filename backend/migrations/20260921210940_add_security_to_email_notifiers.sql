-- +goose Up
-- +goose StatementBegin

-- Every existing channel gets the mode its port implied before: implicit TLS on 465 and
-- STARTTLS elsewhere, now mandatory rather than optional.
ALTER TABLE email_notifiers
    ADD COLUMN security VARCHAR(16) NOT NULL DEFAULT 'starttls';

UPDATE email_notifiers
    SET security = 'tls'
    WHERE smtp_port = 465;

ALTER TABLE email_notifiers
    ALTER COLUMN security DROP DEFAULT;

ALTER TABLE email_notifiers
    ADD CONSTRAINT ck_email_notifiers_security
    CHECK (security IN ('tls', 'starttls', 'none'));

ALTER TABLE email_notifiers
    ADD COLUMN helo_name VARCHAR(255) NOT NULL DEFAULT '';

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE email_notifiers
    DROP CONSTRAINT IF EXISTS ck_email_notifiers_security;

ALTER TABLE email_notifiers
    DROP COLUMN IF EXISTS helo_name;

ALTER TABLE email_notifiers
    DROP COLUMN IF EXISTS security;

-- +goose StatementEnd
