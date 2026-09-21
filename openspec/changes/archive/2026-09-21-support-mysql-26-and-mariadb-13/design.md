## Context

See proposal.md — Why for the motivation.

Three facts about the current code shape every decision below.

First, MySQL has no separation between the server version and the client bundle. `backend/internal/util/tools/mysql.go:43-50` builds the bundle path by interpolating the stored version into `assets/tools/<arch>/mysql/mysql-<version>/bin`, so the enum value is simultaneously what the user sees and the name of a directory that must exist. MariaDB already separates the two: `MariadbVersion` names the server, `MariadbClientVersion` names the directory, and `GetMariadbClientVersionForServer` (`mariadb.go:57-64`) maps between them.

Second, three call sites read the version through a lookup that has no failure mode. The restore downgrade guard reads a map at `mysql.go:77-83` and `mariadb.go:110-123`, and `restores/service.go:270-293` compares the results, so an absent key yields zero and the comparison silently permits a downgrade. The MySQL compression probe switches on the enum at `backups/backups/usecases/logical/mysql/compression_probe.go:36-53`, and its `default` branch is the MySQL 5.7 path. The frontend label maps in `Show{MySql,MariaDb}SpecificDataComponent.tsx` render an empty string for an unknown key.

Third, a bundle's directory name is not checked against the binary inside it. `assets/tools/arm/mariadb/mariadb-10.6/bin/mariadb` reports `10.11.14-MariaDB`, while its x64 counterpart reports `10.6.21-MariaDB`. That bundle is the legacy tier, which exists precisely because the modern client cannot dump MariaDB 5.5 and 10.1, so on arm64 those two servers are served by a client that has the defect the tier was created to avoid. `checkBinDir` (`common.go:30-55`) cannot see this: it stats files.

Constraints from the module docs: `backend/AGENTS.md` and the root `AGENTS.md` require intent-revealing names, forbid issue numbers in production code outside tests that pin an issue's behavior, and forbid unrequested backward-compatibility shims. `frontend/AGENTS.md` keeps every user-visible string in the interface dictionaries. ADR-0005 fixes the vendoring approach for client binaries, so new clients are committed under `assets/` rather than installed during the image build.

The runtime image is `debian:bookworm-slim` with glibc 2.36 (`Dockerfile:100`), and it installs `ca-certificates gosu libncurses5 libncurses6 libmariadb3 libgnutls30` plus `postgresql-17` from the PostgreSQL project's repository.

## Goals / Non-Goals

**Goals:**

- No server dumped by a client from an older release line, on either engine. Inside one line the client may trail the server by a minor; the vendors keep a line compatible with itself, and a bundle refresh closes the gap when it matters.
- A server we cannot serve refused where the user sees it — at the connection test — rather than at the first backup.
- Every client bundle exercised against a real server that selects it, not only against a unit test of the mapping. That includes the legacy MariaDB tier, which no test reaches today.
- Adding the next release line reduced to a short, written procedure, so the recurring cost of this policy stays small.

**Non-Goals:**

- Recording the server's exact version. Identity stays at the release-line granularity the client choice needs, so MariaDB 13.0 and 13.2 record the same identity and use the same bundle, while MySQL 8.0 and 8.4 stay apart because they are separate lines.
- Any change to how PostgreSQL or MongoDB clients are chosen.
- Serving a release line we ship no client for. That is the case this design refuses; the client arrives with the next change.

## Decisions

### Keep the MySQL identity as its bundle name, and decide acceptance from the bundle present on this architecture

MySQL keeps one value that names both the server's release line and the directory its client lives in, as it does today. A new line means a new identity and a new directory with the same name. MariaDB keeps its existing pair of types, because several MariaDB lines legitimately share one client: 5.5 and 10.1 need the legacy client, and everything from 10.2 up is served by one modern client.

Introducing a client-version type for MySQL as well was considered and rejected. It exists to let one bundle serve several identities, and under the decision below every MySQL line gets its own bundle, so the second type would carry no information. If a future release does need one bundle to serve two MySQL lines, that is the change that should introduce the type.

Acceptance is decided per architecture, from the bundle actually present. This matters today: `assets/tools/arm/mysql/` has no 5.7 bundle, because upstream never shipped a 5.7 client for arm64, so a MySQL 5.7 server on an arm64 deployment resolves to a path that does not exist and fails when a backup runs. Under this decision it is refused at the connection test instead, with a message that names the architecture as the reason.

### Accept a server whose release line we ship a client for, refuse one we do not

A server is accepted when the product ships a client designated to serve that server's release line, and refused otherwise with a message naming the lines it does support. Designated does not mean built for that line: the modern MariaDB client is designated for every line from 10.2 up, and the legacy one for the lines it cannot dump. What the designation may never be is a client from a line older than the server's. Adding support for a new upstream line means adding its client bundle and its version identity together, in one change.

**The line is the unit, not the patch and not the minor.** A line is the set of versions the vendor numbers together, which is what the existing identities already encode: MySQL 8 is two lines, `8.0` and `8.4`; MariaDB 10 is several, down to `10.6` and `10.11`; MySQL 9 and 26 are one line each, and so is MariaDB 12 and MariaDB 13. Inside a line the bundled client may trail the server:

- MariaDB 13.0.2 client, MariaDB 13.2 server → accepted. Same line, and the bundle is refreshed to 13.2 when there is a reason to.
- MariaDB 13.4 client, MariaDB 14.1 server → refused. There is no MariaDB 14 bundle, so the connection test fails and names the lines we serve.
- MySQL 26.7.0 client, MySQL 26.10 server → accepted, for the same reason as the first case.

Refusing a minor inside a served line was considered and rejected. It would turn every quarterly rolling release into a hard outage for users who upgrade before we ship, in exchange for a guarantee the vendors already give inside a line: a 13.x client understands 13.x syntax. The failure this design actually guards against is a *line* boundary, where the server has features the client's generation never saw.

The alternative at the other end is forward compatibility across lines: accept a major above the newest client and dump it with the newest client we have. It was measured and it works on the cases tested — the bundled 9.5.0 client dumped a MySQL 26.7.0 server and the dump restored cleanly, and the bundled 12.1.2 client did the same against MariaDB 13.0.2 — but measurement on a sample schema is not the guarantee a backup product needs. Neither vendor supports a client older than the server's line, so a feature introduced after the client would be dumped by a program that has never heard of it, and the result is a backup that looks successful and restores wrong. A refusal at the connection test costs the user a wait for the next release; a silently incomplete dump costs them the data they thought they had.

Pull request #787 sits at the far end of that trade: it maps every major from 9 upward onto the identity `9`, so a 26.7 server is dumped by the 9.x client, displayed as MySQL 9, and treated as equal to 9 by the downgrade guard.

Minor mapping inside the older majors is left exactly as it is (`mapMysql8xVersion`, `mapMariadb10xVersion`, `mapMariadb11xVersion`): each falls through to the newest line of that major. Those majors are closed — 8.4, 10.11 and 11.8 are the last lines their majors will have — so the fallthrough has nothing left to mis-route, and rewriting it would be churn.

The cost of this decision is a recurring one, and it is accepted deliberately: each upstream line that users adopt needs a change here, and users on that line see an error until it ships. `assets/tools/AGENTS.md` carries the checklist for it, and the cheaper case — a new minor inside a line we serve — needs nothing at all until we choose to refresh.

### Bundle a MariaDB 13 client from the vendor's Ubuntu jammy build

MariaDB's 13.0 repository for Debian bookworm carries only `ppc64el` (its `dists/bookworm/Release` lists no other architecture), and the 13.0 packages for amd64 and arm64 appear under trixie. The architecture-independent tarball exists only for x86_64. The vendor's Ubuntu repository does publish 13.0.2 for jammy and noble on both amd64 and arm64: `dists/jammy/Release` lists `amd64 arm64 ppc64el s390x`, and `mariadb-dump` ships in `mariadb-client`, `mariadb` in `mariadb-client-core`.

The jammy arm64 build of `mariadb-dump` needs at most glibc 2.34 and links exactly the libraries the arm64 MariaDB 12.1 client we already ship links: `libssl.so.3`, `libcrypto.so.3`, `libz.so.1`, `libstdc++.so.6`, `libgcc_s.so.1`, `libc.so.6`. The runtime image provides all of them at glibc 2.36, so this build runs where the current one runs.

Alternatives: the trixie packages need glibc 2.41 and would not start in the runtime image; building from source in a bookworm container works but adds a source build to the release path for no benefit over an official binary; AlmaLinux 8 aarch64 RPMs are a viable fallback, recorded in the documentation, because their glibc floor is older still.

### Move the modern MariaDB client to 12.3 and make the tiers three

Replace the 12.1 bundle with 12.3, the long-term release of that era — the vendor's `lts` tag points at 12.3 — and add 13.0 as a third tier. Servers on 5.5 and 10.1 keep the legacy client, servers from 10.2 through 12.x get 12.3, and servers on 13.x get 13.0.

Keeping 12.1 was rejected because its line stopped receiving patches in February 2026. Collapsing 13.x onto the 12.3 client was rejected because a client for 13 is available for both architectures, so there is no reason to accept a client from an older line here while insisting on a matching one for MySQL.

The legacy tier is rebuilt rather than left alone. It is the tier that exists because the modern client queries `generation_expression`, which MariaDB added in 10.2, and on arm64 it currently holds a 10.11 client — a binary with exactly the defect the tier avoids, so MariaDB 5.5 and 10.1 on arm64 are effectively unserved today. Refreshing both architectures to 10.6.28 from one source fixes that, and the new `mariadb:5.5` and `mariadb:10.1` matrix cases are what keep it fixed: without them the tier has no test at all, which is how the wrong binary went unnoticed.

### Render the version identity instead of looking it up

Display the recorded identity string directly in the database view and delete the label maps in `Show{MySql,MariaDb}SpecificDataComponent.tsx`.

The maps are pure indirection: every entry maps an identity to itself, so `'11.8'` is looked up to produce `'11.8'` (`ShowMariaDbSpecificDataComponent.tsx:15-27`). Their only effect is that an identity missing from the object renders as an empty string, which is how a forgotten entry becomes a blank version field instead of a build error.

Extending the maps with the two new identities was rejected because it keeps a structure whose sole behavior is to fail quietly when someone forgets it, in exchange for nothing. The enumeration of identities stays as the type of the field: the set of identities is closed, since one is added with each bundle, so the type can state it.

### Make the startup check run each client and compare what it prints with the bundle it sits in

Replace the file-existence and permission check in `checkBinDir` with an execution of each client's version flag, and compare the version string it prints against the name of the bundle directory, keeping the existing fatal and non-fatal tiers.

The present check would pass a client that cannot start. That is not hypothetical: the MariaDB clients built from distribution packages link `libedit.so.2`, which the runtime image does not install directly — it arrives only as a dependency of `postgresql-common`. Any change to the PostgreSQL packages would remove it, and the first symptom today would be a failed restore rather than a failed health check.

Nor would it notice a bundle holding the wrong version, which is the state `assets/tools/arm/mariadb/mariadb-10.6/` is in: a 10.11 client under a directory the code trusts to hold a 10.6 one. Comparing the printed version with the directory name costs one string check and turns that class of mistake into a startup failure. Every bundle name is a prefix of what its binaries print, so the rule is uniform even though the output formats are not:

| bundle | command output (first line) |
|---|---|
| `postgresql-17` | `psql (PostgreSQL) 17.10 (Debian 17.10-1.pgdg12+1)` |
| `mysql-9` | `mysqldump  Ver 9.5.0 for Linux on x86_64 (MySQL Community Server - GPL)` |
| `mariadb-12.1` | `... from 12.1.2-MariaDB, client 10.19 for debian-linux-gnu (x86_64)` |
| `mongodb` | `mongodump version: 100.16.1` |

The MariaDB line is the trap: it carries two numbers, and the one that matters is the server-line number before `-MariaDB`, not the `client 10.19` protocol version that follows. MongoDB has no version in its directory name, so it is checked for execution only.

**The health endpoint does not re-run the binaries.** `CheckAllClientTools` is called both at startup (`common.go:71`) and from the healthcheck (`healthcheck/service.go:46`), and the container probes that endpoint every 30 seconds with a 5 second timeout (`Dockerfile:204`). Executing every client on each probe means roughly 38 processes — 7 PostgreSQL bundles, two of them with five binaries, plus 5 MySQL, 3 MariaDB and MongoDB — spawned twice a minute, which is how a loaded host starts reporting an unhealthy container for no reason. Execution runs once per process and its verdict is cached; the health endpoint keeps stating that verdict and re-checks only that the files are still present, which is what catches a volume that vanished.

Caching the whole result, files included, was rejected: an unmounted `assets` volume is exactly the degradation the probe exists to surface, and stat is cheap. Running the binaries on a timer inside the process was rejected as well — a bundle cannot change under a running container, and a timer would reintroduce the cost it was meant to avoid.

### Order versions by comparing the numbers in the identity, not by table lookup

Compare two version identities by parsing the numbers they carry and comparing major then minor, and treat an identity whose numbers cannot be parsed as an error the caller must handle rather than as order zero.

The table's failure mode is the bug this closes. An identity absent from the map scores zero, so the comparison concludes the backup is not newer and permits the restore. That is not a hypothetical: the two identities this change adds would each have to be entered into two maps by hand, and nothing fails to compile when they are not.

Parsing the identity removes the table entirely. Every server identity in use — `5.7`, `8.0`, `8.4`, `9` and `26` for MySQL, `5.5` through `12.0` and `13.0` for MariaDB — carries its order in its own digits, and the next one added orders correctly with no further edit. MySQL's calendar majors compare above its 9 line numerically, which matches the release order. An identity with no minor, such as `9` or `26`, parses as minor zero.

Both guard functions gain an error return, so `validateVersionCompatibility` in `restores/service.go:253-293` changes with them: a restore request naming a version the backend cannot parse is refused rather than allowed through a zero comparison. That is the point of the change, and it is the only caller.

The alternative, adding the new identities to the existing maps, fixes this instance and leaves the next one to be found by a user restoring a backup onto an older server.

## Risks / Trade-offs

- A user on a release line newer than our newest client cannot add that database at all until we ship the client → The refusal names the lines we support, so the user knows the cause rather than guessing. A new minor inside a line we already serve does not hit this, which is the common case between our releases; the checklist in `assets/tools/AGENTS.md` keeps the work small for the case that does.
- MySQL 5.7 is refused on arm64, where upstream never shipped a client → This is already the effective state, since the backup fails when the path does not resolve. The refusal moves the failure to the connection test and names the architecture. The amd64 bundle is unaffected.
- A client can trail its server inside a line: identity `13.0` covers every 13.x and identity `26` every 26.x, while the bundles hold one patch each → Accepted deliberately, and it is the trade the decision above makes. MariaDB already has a 13.1 release candidate published, so the case is near-term rather than hypothetical. The bound on the exposure is that both clients and servers stay within one vendor generation, and the response is the bundle refresh in `assets/tools/AGENTS.md`. A user who needs a specific new feature dumped correctly needs the refresh, not a different design.
- The repository grows by roughly 100 MB → ADR-0005 already accepts vendoring as the cost of a reproducible, network-free build. The bundle refresh replaces bytes rather than adding them; only the two new bundles add net weight.
- Refreshing the MariaDB modern client changes the client for every MariaDB server from 10.2 up, not only for new ones → The matrix covers 10.6, 10.11, 11.4, 11.8 and 12.0 with backup, restore, encryption, exclude-tables and read-only-user cases. It does not boot a 10.2 through 10.5 server, so those identities are covered by the mapping test and by the neighbouring 10.6 case rather than end to end; four more containers on every run buy little against versions that resolve to the same client as 10.6.
- The legacy MariaDB tier had no test at all, and on arm64 it holds the wrong binary → This change adds `mariadb:5.5` and `mariadb:10.1` to both matrices, so the tier that exists to serve pre-10.2 servers is finally exercised, on the client the refresh installs.
- Four more database images join a CI run that already pre-pulls about 19 GB and frees space by deleting preinstalled toolchains (`.github/workflows/ci-release.yml:250-256`), and the repository they are checked out beside grows too → Task 1.11 measures both before the change is committed, and extends that cleanup step if the images no longer fit. The suite's own `-timeout 15m` (`backend/Makefile:16`) absorbs the same four container boots, which task 7.2 covers.
- Four architecture-and-source combinations now exist in the asset tree → Each bundle's source is recorded in `assets/tools/README.md`, and the startup check runs the binaries and compares their version with the bundle name, so a mismatched build fails at startup on the affected architecture.
- The arm64 MariaDB 13 client was verified by comparing its library and glibc requirements with the shipped 12.1 client, not by executing it, because the development host has no emulation for that architecture → The refreshed startup check runs it on a real arm64 build, and the release pipeline builds both architectures.
- Running the binaries makes the check sensitive to the host, not only to the image: on a Fedora host the bundled `mariadb` client fails to load `libedit.so.2` and the check would disable MariaDB support, even though `mariadb-dump` itself runs → PostgreSQL, the only fatal tier, links `libreadline.so.8` and starts there, so the process still boots. `backend/Makefile:19-29` already builds a `libedit.so.2` symlink for the test run; a `run-fedora` target gets the same shim, so local development on a non-Debian host is not degraded by a check meant to protect the image.

## Migration Plan

No data migration. Version identities already stored keep resolving to a client, and adding identities does not rewrite existing rows. Three behavior changes reach existing deployments: MariaDB servers from 10.2 up are dumped by the refreshed modern client; MariaDB 5.5 and 10.1 servers on arm64 are dumped by a real 10.6 client instead of the 10.11 binary that bundle holds today; and a MySQL 5.7 database on an arm64 deployment is now refused at the connection test instead of failing at backup time. An arm64 deployment that already stored a MySQL 5.7 database keeps the row — the refusal happens when the connection is tested or the version re-detected — and its backups fail with a message naming the architecture instead of a missing path. A rollback is a revert of the change; a database added on a newly supported version stops passing its connection test on the older build, which is that build's existing behavior for such a server.

## Open Questions

- Whether MySQL will designate a calendar release as long-term, which would make that release the bundle to carry for the line instead of 26.7. This does not change the approach, only which patch the 26 bundle holds, which is a refresh.
