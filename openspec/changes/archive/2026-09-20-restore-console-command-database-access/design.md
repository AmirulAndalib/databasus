## Context

See proposal.md — Why for the motivation. The mechanics behind it:

`configure_application_database_dsn` (`docker/start.sh:528-534`) exports
`DATABASE_DSN` with the password generated a few steps earlier in
`configure_postgresql_database` (`docker/start.sh:466-483`). `main()` ends with
`exec gosu databasus ./main` (`docker/start.sh:595`), so the application
inherits that environment in the same process, which becomes PID 1.

A process started with `docker exec` is not a child of PID 1. The container
runtime builds its environment from the image configuration and the flags given
to `docker run`, not from the running process, so `DATABASE_DSN` is absent
there. Configuration loading then reaches `godotenv.Load`
(`backend/internal/config/config.go:126-133`), which reads `/.env`. That file is
`.env.example` baked into the image (`Dockerfile:193`), and its `DATABASE_DSN`
still carries the fixed password from before rotation (`.env.example:9`).
`godotenv.Load` does not overwrite variables already present in the
environment, so this fallback is invisible to PID 1 and decisive for every
other process.

The failure surfaces during migrations because a console command runs the full
startup path before reaching its own work: `resetPasswordIfRequested` is called
at `backend/cmd/main.go:115`, well after the database is opened.

Two constraints shape the options. The image runs PostgreSQL and the
application under one unprivileged account created in `Dockerfile:157-165`, and
`configure_runtime_identity` (`docker/start.sh:121-136`) can renumber that
account from `PUID`/`PGID` before the database is bootstrapped. Mounting a new
filesystem inside the container is unavailable: that needs `CAP_SYS_ADMIN`,
which an ordinary container does not have.

Module rules: the root `AGENTS.md` engineering philosophy and
`backend/AGENTS.md`, whose comment rule means the reason for reading a second
configuration source belongs in a short *why* comment or in a name, not in a
narration of the mechanism.

## Goals / Non-Goals

**Goals:**

- One credential resolution path, producing the same answer in the application
  and in a console command.
- The credential never outlives the container it belongs to, so it cannot go
  stale against a rotated password.
- A missing configuration fails with a message that names the missing
  configuration.

**Non-Goals:**

- Reworking how the password is generated or how often.
- Making `/.env` a supported way to point the container at an external
  metadata database. It never worked for PID 1, because the exported
  environment variable wins, and this design keeps that precedence.
- A general secret-sharing mechanism for other values.

## Decisions

### Publish the credential in a memory-backed file at `/dev/shm`

Startup writes the generated connection string to a file under `/dev/shm`, mode
`0600`, owned by the runtime account. Configuration loading reads it when the
environment does not already carry `DATABASE_DSN`.

`/dev/shm` is a tmpfs the container runtime always provides, so its contents
live in memory and disappear when the container stops. That lifetime is the
point: the password is regenerated on every start
(`docker/start.sh:466-483`), and a channel that dies with the container cannot
present yesterday's password to tomorrow's process. Ownership and mode confine
it to the account that already holds the database, which is also the account a
privileged `docker exec` runs as or above.

Alternatives rejected:

- **A file on the `/databasus-data` volume.** It survives restarts, so a start
  that fails between rotating the password and rewriting the file leaves a
  stale credential behind — the same class of failure being fixed here. It also
  puts the internal password on the operator's disk permanently.
- **Reading `/proc/1/environ`.** It needs no new artifact, but it only works
  while PID 1 is the application. Adding an init process or a supervisor to the
  entrypoint would silently break it, it is unavailable when the application
  has exited, and it cannot be exercised outside a container.
- **Mounting a dedicated tmpfs for the file.** Requires `CAP_SYS_ADMIN`, so it
  would force operators to grant the container privileges it does not otherwise
  need.
- **Baking a fixed password back into the image.** Reverts the security
  property established by the archived `protect-internal-postgresql-access`
  change.

### Resolution order: environment, then the published file, then the baked defaults

An explicit `DATABASE_DSN` in the process environment wins. Otherwise the
published file is used. Only then do the remaining baked defaults apply.

This mirrors what PID 1 already experiences. When the operator supplies a
connection string with `docker run -e`, it is part of the container
configuration, so `docker exec` inherits it too, and
`configure_application_database_dsn` (`docker/start.sh:529`) skips publishing
anything — both processes agree on the external database. When the operator
supplies nothing, both read the generated value.

Alternative rejected: **file first, environment second.** It would let the
embedded credential override an operator's deliberate choice of an external
metadata database, inverting the precedence the current startup already
guarantees.

### Exempt the storage probe from the metadata-database requirement

`prepare_and_verify_storage` (`docker/start.sh:343-352`) ends with
`gosu databasus /app/main --test-storage`, and it runs before
`bootstrap_postgresql`, so the generated password does not exist yet. Once the
baked default is gone, that probe is refused for a connection string that
cannot be available at that point, and the container never starts. The probe
itself only needs `TempFolder` and `DataFolder`, both derived from paths.

Configuration loading therefore recognises the `--test-storage` process from
`os.Args` and skips the missing-connection-string exit for it, the way it
already recognises a test binary. The flag is read inside
`backend/internal/config` rather than passed in from `main`, because
package-level dependency wiring such as `backend/internal/features/email/di.go:9`
calls `GetEnv` during program initialisation, before `main` runs.

Alternatives rejected:

- **Running the probe after `bootstrap_postgresql`.** The permission checks
  around it exist to fail early with the documentation URL; an operator with a
  broken `/databasus-data` would instead first see `initdb` fail.
- **Handing the probe a placeholder connection string from `start.sh`.**
  Reinstates the fake credential this change deletes, and it is the value the
  probe would connect with if it ever grew a database dependency.

### Delete `DATABASE_DSN` from the baked `/.env`, keep it in `.env.example`

`.env.example` stays as it is, because the repository's Docker Compose stack
and local backend runs depend on it. The copy that reaches the image
(`Dockerfile:189-193`) has the `DATABASE_DSN` line removed during the build.

Leaving it would keep a connection string that cannot authenticate as the last
fallback, which is precisely what turns "nothing configured" into "password
authentication failed" and sent the reporter of the issue looking in the wrong
place. `DatabaseDsn` is already `required:"true"`
(`backend/internal/config/config.go:49`), so removing the line produces the
existing empty-value diagnostic (`backend/internal/config/config.go:178`)
instead of an authentication error.

Alternatives rejected:

- **Removing `DATABASE_DSN` from `.env.example` itself.** Breaks local
  development, which has no startup script to publish a credential.
- **Maintaining a separate container-only example file.** A second file to keep
  in sync for the sake of one line.

## Risks / Trade-offs

- **`--ipc=host` shares the host's `/dev/shm`** → The published file would land
  in a namespace the host and other containers with that flag can read. This
  only applies to a deliberate, uncommon flag, and anyone with host root can
  already read the application's environment. Documenting it is enough; a
  startup check that refuses to publish is available later if it proves
  necessary.
- **tmpfs pages can be swapped to disk by the host** → The password could touch
  the host's swap. The same is true of the application's own memory, where the
  connection string lives regardless.
- **A container image that changes its entrypoint or runtime account** → The
  file's owner is resolved from the account after `configure_runtime_identity`
  (`docker/start.sh:121-136`) has applied `PUID`/`PGID`, so publishing must stay
  ordered after it. `bootstrap_postgresql` already runs later in `main()`
  (`docker/start.sh:586-595`), so the required order is the existing one.
- **Who writes and who reads the published file** → The application reads it as
  the runtime account (`docker/start.sh:605` ends with
  `exec gosu databasus ./main`), so that account must own it. Startup runs as
  root, and writing into a `0600` file owned by another account was refused on
  the host this was verified on, so startup creates the file with `install` and
  fills it through `gosu databasus tee`, the idiom the script already uses for
  `pg_hba.conf`. The image declares no `USER`, so the documented
  `docker exec <container> ./main ...` runs as root; root reading that file
  worked on the same host, and a deployment that drops `CAP_DAC_OVERRIDE` would
  lose the documented recovery command.
- **Silent regression** → The failure is invisible to normal startup: PID 1
  keeps working even when publishing is broken. An automated check that runs a
  console command against a started container is the only thing that catches
  it, which is why it belongs in the task list rather than in manual testing.

## Migration Plan

No data migration and no operator action. A container built from the new image
publishes the credential at its next start, and the console commands work from
that moment. Rolling back to the previous image restores the previous
behavior, including the broken console commands.
