-- +goose Up
-- +goose StatementBegin

-- The instance recognizes its bootstrap administrator by this flag rather than
-- by the text of an email address, so that account can be renamed freely.
ALTER TABLE users ADD COLUMN is_root_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- At most one account may carry the flag. This also settles the race between
-- two registrations arriving on an empty instance at the same moment: the
-- database admits one of them and refuses the other.
CREATE UNIQUE INDEX idx_users_is_root_admin ON users (is_root_admin) WHERE is_root_admin;

-- Drop the account previous versions seeded at startup when nobody ever signed
-- in as it - no password and no linked identity - and it is the only row the
-- instance holds. Such an instance is then indistinguishable from a fresh one,
-- and the first account created on it administers it.
--
-- The "only row" condition matters: an instance can hold ordinary members while
-- its seeded account was never claimed, because POST /users/signup answers
-- regardless of what the authentication screen offers. There the seeded row is
-- the only ADMIN-role account, so deleting it would leave those members with no
-- administrator and no way to appoint one. It is kept and flagged instead, and
-- its owner takes it over with the password-reset console command.
DELETE FROM users
WHERE email = 'admin'
  AND hashed_password IS NULL
  AND github_oauth_id IS NULL
  AND google_oauth_id IS NULL
  AND (SELECT COUNT(*) FROM users) = 1;

-- Carry the record onto the account the owner already signs in with: the seeded
-- row when it is still there, and otherwise the oldest administrator, which is
-- what an instance whose seeded row was renamed by hand looks like. An empty
-- database backfills nothing.
UPDATE users
SET is_root_admin = TRUE
WHERE id = (
    SELECT id
    FROM users
    WHERE role = 'ADMIN'
    ORDER BY (email = 'admin') DESC, created_at ASC
    LIMIT 1
);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

-- The seeded account the up step deleted is not restored: an instance that was
-- never claimed rolls back to a state where the old binary seeds it again at
-- startup, which is exactly where it was.
DROP INDEX IF EXISTS idx_users_is_root_admin;

ALTER TABLE users DROP COLUMN IF EXISTS is_root_admin;

-- +goose StatementEnd
