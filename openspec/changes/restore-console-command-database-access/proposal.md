## Why

The console commands documented in the README, such as the password reset
`docker exec -it databasus ./main --new-password="..." --email="..."`, stopped
working once the container began generating a random password for its embedded
metadata database at every startup. Startup hands that password to the
application through the environment of the first container process, and
`docker exec` does not inherit that environment. A command started this way
falls back to the connection string baked into the image, which still carries
the previously published fixed password, and PostgreSQL rejects it with
`password authentication failed for user "postgres"`.

This breaks the documented recovery path for an operator locked out of their
own instance, and it breaks nightly pipelines that reset the password on a
fresh container. It was reported in issue #784 and affects every console
command, not only the password reset, because all of them read the metadata
database.

## What Changes

- Startup makes the generated connection string readable by any process in the
  container, instead of leaving it only in the first process's environment. The
  value lives in memory for the lifetime of the container and never reaches a
  mounted volume or the image.
- A console command started after the application resolves the connection
  string from that shared location when the operator has not supplied one
  explicitly.
- The stale connection string baked into the image as a default is deleted. A
  command that finds no connection string anywhere now fails with a message
  naming the missing configuration, rather than with an authentication error
  that points at the wrong cause.
- Precedence becomes explicit and identical for every process: an explicitly
  supplied connection string wins, then the value startup generated, then what
  remains of the baked defaults.

No BREAKING changes. The deleted default could not authenticate against the
embedded database in any supported configuration, so nothing that works today
stops working. An operator who points the container at an external metadata
database supplies that connection string as a container environment variable,
which `docker exec` already inherits; that path is unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `internal-postgresql-protection`: the requirement covering startup-generated
  internal credentials gains the obligation to make the credential reachable by
  later processes in the same container, states that the credential is never
  written to persistent storage, and fixes the precedence between an
  operator-supplied connection string and the generated one. A new requirement
  covers the console commands' own observable behavior: they reach the metadata
  database on a running container, and they report missing configuration
  distinguishably from rejected credentials.

## Impact

Affected code:

- `docker/start.sh`: the step that generates the password and exports the
  connection string also publishes it for the rest of the container.
- `backend/internal/config/config.go`: configuration loading gains the shared
  location as a source, ordered between the process environment and the baked
  defaults.
- `Dockerfile`: the baked default file no longer carries a metadata-database
  connection string.
- `.env.example`: keeps its local-development connection string, which the
  repository's Docker Compose stack still needs.

Affected behavior: the documented password-reset command works again on a
running container; the planned `--disable-2fa` command and the console command
from `replace-seeded-admin-with-first-signup` inherit the same fix rather than
shipping broken.

Module rules this change answers to: the root `AGENTS.md` and
`backend/AGENTS.md`.

### Out of scope

- Changing password rotation. The password keeps changing at every container
  start.
- Storing the credential on the data volume or anywhere else that survives a
  container restart.
- The other development values that reach the image through the same baked
  defaults file, such as the test mail server address. They are a separate
  problem with a separate fix.
- Adding, removing or renaming console commands, and changing the documented
  command syntax in the README translations.
- Operator-facing documentation stating that an external metadata database is
  supplied as a container environment variable and that a mounted `/.env` is
  not a supported place for it. That restriction predates this change and is
  unchanged by it, and documenting it means editing the English page plus five
  locale copies under the website's sync rule. It belongs in its own change.
- Publishing the embedded PostgreSQL port or relaxing any of its
  authentication rules.
