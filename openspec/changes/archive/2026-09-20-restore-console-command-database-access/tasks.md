## 1. Resolve the credential inside the backend

- [x] 1.1 Add a resolution step in `backend/internal/config` that reads the published connection string when `DATABASE_DSN` is absent from the process environment, ordered before the `/.env` load at `backend/internal/config/config.go:126-133`; verify with a new test in `backend/internal/config/config_test.go` that the published value is used when the environment is empty
- [x] 1.2 Cover the precedence rule with a test asserting that a `DATABASE_DSN` already set in the environment wins over a published file holding a different value; verify with `cd backend && make test` for that package
- [x] 1.3 Cover the absent case with a test asserting that no published file and no environment value leaves `DatabaseDsn` empty, so the existing required-field diagnostic at `backend/internal/config/config.go:178` is what the operator sees; verify with `cd backend && make test` for that package
- [x] 1.4 Run `cd backend && make lint` and fix every finding in the touched files
- [x] 1.5 Exempt the `--test-storage` process from the missing-connection-string exit in `backend/internal/config`, because container startup runs it before the embedded database exists; verify with a test covering the flag forms and by starting a built container

## 2. Publish the credential at startup

- [x] 2.1 Extend `configure_application_database_dsn` (`docker/start.sh:528-534`) to write the generated connection string to the memory-backed location with mode `0600` owned by the runtime account, keeping the existing early return that preserves an operator-supplied value; verify by starting a built container and confirming the file exists with the expected owner and mode
- [x] 2.2 Confirm the ordering constraint holds by starting a container with `PUID` and `PGID` set to unused non-default ids and checking that the published file is owned by the renumbered account

## 3. Remove the stale default from the image

- [x] 3.1 Drop `DATABASE_DSN` from the copy of `.env.example` that lands at `/.env` during the build (`Dockerfile:189-193`), leaving `.env.example` itself untouched, and correct the comment above that copy (`Dockerfile:189-192`), which currently explains the baked defaults and the precedence rule without the new source; verify with `docker run --rm --entrypoint sh <image> -c 'grep -c DATABASE_DSN /.env'` returning no match
- [x] 3.2 Confirm local development still works after the change by running the backend against the repository Docker Compose stack

## 4. Verify the reported scenario end to end

- [x] 4.1 Build the image, start a fresh container with no `DATABASE_DSN` supplied, and run `docker exec <container> ./main --new-password="..." --email="..."`; verify the command completes without an authentication error and the new password signs in
- [x] 4.2 Restart that container and run the same command again; verify it succeeds with the rotated password rather than the one from the previous run
- [x] 4.3 Start a container with an explicit `DATABASE_DSN` pointing at an external metadata database, then run a console command; verify it connects to that external database and that no credential file was published
- [x] 4.4 Start a container whose startup published nothing and whose environment carries no connection string, then run a console command; verify the failure names the missing configuration instead of reporting an authentication failure

## 5. Guard against silent regression

- [x] 5.1 Add an automated check that runs a console command against a started container, so a future change that breaks publishing fails a check rather than only breaking `docker exec`; verify the check fails when the publishing step is removed and passes when it is restored

## 6. Review

- [x] 6.1 Complete the mandatory compliance review for the finished diff and resolve every CHANGES REQUIRED finding.
- [x] 6.2 Mark the completed tasks in this file so the status update is part of the same commit as the implementation
