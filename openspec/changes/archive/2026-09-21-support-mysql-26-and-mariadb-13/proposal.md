## Why

Databasus refuses to add a MySQL 26.x or MariaDB 13.x database. The connection test fails with `unsupported MySQL major version: 26` (issue #786, reported against Oracle MySQL HeatWave, which already serves `26.7.0-cloud`) and `unsupported MariaDB major version: 13` (issue #795, MariaDB 13.0.2 in Docker). Both engines have released these versions, so anyone on a current server is locked out of backups entirely.

The same investigation surfaced a second problem that no issue reports yet: the client binaries we ship have drifted onto release lines that upstream no longer patches. The MySQL 9 bundle holds `mysqldump` 9.5.0, and the 9.5 line ended in January 2026; the MariaDB modern bundle holds 12.1.2, and the 12.1 line ended in February 2026. Every backup and restore runs through these binaries, so they should sit on lines that still receive fixes.

## What Changes

- Accept MySQL 26.x as a supported server version, mapped to a new bundled MySQL 26 client.
- Accept MariaDB 13.x as a supported server version, mapped to a new bundled MariaDB 13 client.
- Keep refusing a server the product ships no client for, and make that refusal honest: a version is supported when a client for that server's release line ships with it, on the architecture in use. A release line is the set of versions the vendor numbers together — `8.0` and `8.4` are separate lines, while every MySQL 26.x belongs to one and every MariaDB 13.x to another. Inside a line the bundled client may sit a minor behind the server, and that gap is closed by refreshing the bundle rather than by refusing the server. A line we ship no client for is refused outright: a MariaDB 14.1 server is rejected, while a MariaDB 13.2 server is accepted by the 13 bundle. A consequence worth stating: MySQL 5.7 on arm64 becomes an explicit refusal at the connection test, because upstream never shipped a 5.7 client for that architecture and the backup fails today when the path does not resolve.
- Keep the MySQL version identity as the name of its client directory, as today, since every MySQL line gets a client of its own. MariaDB keeps its existing split between server version and client version, because one modern client legitimately serves every line from 10.2 up.
- Refresh every MySQL and MariaDB client bundle onto the current patch of a line upstream still supports: MySQL 8.0.40 to 8.0.46, 8.4.3 to 8.4.11, 9.5.0 to 9.7.2; MariaDB legacy 10.6.21 to 10.6.28, and the modern bundle from 12.1.2 to 12.3.3, the long-term release of that era.
- Close three places where an unrecognised version currently changes behavior silently rather than failing: the restore downgrade guard reads a version-order map that returns zero for unknown keys, the MySQL network compression probe falls through to the deprecated `--compress` flag, and the frontend version label map renders an empty string for a version it does not list. The frontend map is removed rather than extended: every entry in it maps an identity to itself, so the view can render the identity directly.
- Make the startup check run each shipped client and compare the version it prints with the name of the bundle it sits in, rather than only checking that the file is present and executable. The current check would not notice a client that cannot start for want of a shared library, which is the failure mode a new bundle is most likely to introduce, nor a bundle holding a different version than its name claims, which is the state `assets/tools/arm/mariadb/mariadb-10.6/` is in today. The health endpoint keeps reporting that result without re-running the binaries on every probe.
- Fix the arm64 MariaDB legacy bundle, which holds a 10.11 client under the name `mariadb-10.6`. The legacy tier exists because the modern client queries `generation_expression`, a column MariaDB added in 10.2, so a 10.11 client cannot dump the 5.5 and 10.1 servers that tier is meant to serve. On arm64 those two versions are effectively unsupported today; the refresh in this change gives them a real 10.6 client, and new matrix cases cover them.
- Extend the MySQL and MariaDB test matrices with real `mysql:26.7` and `mariadb:13.0` containers so the new versions are covered by the same backup, restore, encryption, exclude-tables and read-only-user tests as the existing ones, and add `mariadb:5.5` and `mariadb:10.1` so the legacy client tier is exercised at all.
- Record how the bundles are built. `assets/tools/README.md` gains the provenance of every bundle and the runtime libraries the binaries need; a new `assets/tools/AGENTS.md` carries the checklist for adding a version and for refreshing a patch level.

No persisted data changes meaning: existing databases keep their stored version values, and no row is rewritten. Three behaviors do change for deployments that already run. MariaDB databases from 10.2 up are dumped by the refreshed modern client rather than by 12.1.2. MariaDB 5.5 and 10.1 databases on arm64 are dumped by a real 10.6 client instead of the 10.11 binary that bundle holds today, which is a fix rather than a regression. And a MySQL 5.7 database on an arm64 deployment stops passing its connection test, because `assets/tools/arm/mysql/` ships only 8.0, 8.4 and 9 — upstream never built a 5.7 client for that architecture. That database cannot be backed up on arm64 today either: the bundle path does not resolve and the backup fails when it runs. The change moves that failure to the connection test and names the architecture, and it does not restore the ability to back such a database up.

## Capabilities

### New Capabilities

- `database-version-support`: which MySQL and MariaDB server versions the system accepts, how a detected server version selects the client used to dump and restore it, and what the system does when it meets a version it does not recognise.
- `client-tool-bundles`: which database client binaries ship with the product, the guarantee they carry about the server versions they serve, what the health check reports when one is missing, and the libraries they require from the runtime image.

### Modified Capabilities

None. No existing spec under `openspec/specs/` describes version support or bundled client tools.

## Impact

Backend. `backend/internal/util/tools/mysql.go` and `mariadb.go` hold the version enums, the bundle lists the health check walks, the version-order maps behind the restore guard and the client selection for MariaDB. `backend/internal/util/tools/common.go` holds the bundle check itself. `backend/internal/features/databases/databases/mysql/model.go` and `mariadb/model.go` hold the version detection that rejects unknown majors. `backend/internal/features/backups/backups/usecases/logical/mysql/compression_probe.go` switches on the version enum. `backend/internal/features/restores/service.go` calls the two downgrade-guard functions, so it changes with their signatures.

Frontend. The version enums and label maps in `frontend/src/entity/databases/model/{mysql,mariadb}/` and `frontend/src/features/databases/ui/show/Show{MySql,MariaDb}SpecificDataComponent.tsx`.

Assets. New bundles under `assets/tools/{x64,arm}/mysql/` and `assets/tools/{x64,arm}/mariadb/`, plus refreshed contents of the existing ones. This adds roughly 100 MB to the repository, which ADR-0005 already accepts as the cost of vendoring clients instead of installing them at image build time.

Documentation. The supported-version lists in `README.md` and in all five copies under `assets/readme/`, the bundle tables in `assets/tools/README.md`, and the new `assets/tools/AGENTS.md`.

Website. The MySQL landing page states the supported versions in six languages: `website/app/(en)/mysql-backup/page.tsx` and the five copies under `website/app/[lang]/mysql-backup/content/`. They are public claims about what the product supports, so they move with the README.

Tests. `backend/internal/features/tests/logical/{mysql,mariadb}/backup_restore_test.go` and `backend/internal/features/databases/databases/{mysql,mariadb}/model_test.go` carry the version matrices.

Build and CI. `tools/refresh-mariadb-x64-libedit.sh` becomes the script that builds every MariaDB bundle. `backend/Makefile` gains the `libedit.so.2` shim for running the backend on a non-Debian host, now that the startup check executes the clients. `.github/workflows/ci-release.yml` may need more room freed for the four new database images.

The change answers to the root `AGENTS.md`, `backend/AGENTS.md`, `frontend/AGENTS.md`, `website/AGENTS.md` and `assets/readme/AGENTS.md`.

## Out of Scope

- Raising the runtime base image from `debian:bookworm-slim` to trixie. MariaDB's bookworm repository for 13.0 carries only `ppc64el`, but its Ubuntu jammy build satisfies the same library floor as the bundle we already ship on both architectures we run, so the base image does not need to move.
- PostgreSQL and MongoDB bundles. Their patch levels are current and recorded in `assets/tools/README.md`.
- Physical backups. MySQL and MariaDB are logical-only in Databasus.
- Supporting a release line before its client ships. Each upstream line that users adopt is a change of its own: its client bundle and its version identity land together, and until then the connection test refuses that server by design. A new minor inside a line we already serve is not that case — it needs a bundle refresh at most, and it keeps working in the meantime. `assets/tools/AGENTS.md` carries both procedures so the recurring cost stays small.
- Renaming the version identities already in use. `12.0` names the whole MariaDB 12 line and `9` the whole MySQL 9 line; both are stored in existing rows, and making them consistent with each other is a data migration this change does not need.
