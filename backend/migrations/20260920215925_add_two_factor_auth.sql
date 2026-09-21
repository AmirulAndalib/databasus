-- +goose Up
-- +goose StatementBegin

ALTER TABLE users_settings
    ADD COLUMN is_two_factor_auth_required BOOLEAN NOT NULL DEFAULT FALSE;

-- One row is one code issued to one account: the password step created it, the
-- verification step spends it, and the hourly cap counts the rows an account
-- collected. That is why a row outlives the ten minutes its code works for.
CREATE TABLE two_factor_codes (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID        NOT NULL,
    hashed_code            TEXT        NOT NULL,
    -- The password the first step accepted. The second step refuses a row whose
    -- account has changed its password since, because that change is what
    -- invalidates tokens already issued.
    password_creation_time TIMESTAMPTZ NOT NULL,
    expires_at             TIMESTAMPTZ NOT NULL,
    is_used                BOOLEAN     NOT NULL DEFAULT FALSE,
    failed_attempt_count   INTEGER     NOT NULL DEFAULT 0,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE two_factor_codes
    ADD CONSTRAINT fk_two_factor_codes_user_id
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE;

ALTER TABLE two_factor_codes
    ADD CONSTRAINT ck_two_factor_codes_failed_attempt_count_not_negative CHECK (failed_attempt_count >= 0);

CREATE INDEX idx_two_factor_codes_user_id ON two_factor_codes (user_id);

-- The hourly cap and the sweep both read this column.
CREATE INDEX idx_two_factor_codes_created_at ON two_factor_codes (created_at);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS idx_two_factor_codes_created_at;
DROP INDEX IF EXISTS idx_two_factor_codes_user_id;

ALTER TABLE two_factor_codes
    DROP CONSTRAINT IF EXISTS ck_two_factor_codes_failed_attempt_count_not_negative;

ALTER TABLE two_factor_codes
    DROP CONSTRAINT IF EXISTS fk_two_factor_codes_user_id;

DROP TABLE IF EXISTS two_factor_codes;

ALTER TABLE users_settings
    DROP COLUMN IF EXISTS is_two_factor_auth_required;

-- +goose StatementEnd
