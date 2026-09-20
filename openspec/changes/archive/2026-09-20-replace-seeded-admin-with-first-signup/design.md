## Context

See proposal.md - Why for the motivation. What shapes the approach is how widely the literal string `admin` has spread as a stand-in for "this is the owner's account", and that the change has to serve two populations at once: instances that already hold the seeded account, and instances that will never have one.

The seeded account is created at startup by `CreateInitialAdmin`, called from `backend/cmd/main.go:109` and implemented at `backend/internal/features/users/repositories/user_repository.go:65-86`. It writes a row with `Email: "admin"`, a nil password, the ADMIN role and an active status. Seven code paths then decide something by comparing against that text:

- `user_repository.go:66` - the idempotence check that stops a second seeded account from being created on every restart.
- `user_services.go:300` (`IsRootAdminHasPassword`) - answers whether the instance is still unclaimed.
- `user_services.go:313` (`SetRootAdminPassword`) - the account the unauthenticated claim path writes a password to.
- `management_service.go:74` - only the root administrator may deactivate an ADMIN-role account.
- `management_service.go:108` - only the root administrator may reactivate one.
- `management_service.go:154` - only the root administrator may grant or revoke the ADMIN role.
- `user_services.go:468` - the refusal to change that account's address.

The first three disappear with the seeding and the claim path. The next three move onto the flag. The last is deleted.

An eighth site, `user_services.go:159`, is the sign-in hint naming the `admin` login. Two more live outside production code, both in `backend/internal/features/users/testing/user_utils.go`: `RecreateInitialAdmin` (`:67-79`) renames the current `admin` row to `admin-<uuid>` and calls `CreateInitialAdmin` again so each test starts from a fresh bootstrap account, and `RecreateInitAdminAndGetAccess` (`:50-65`) calls it and then reads the account back by address to mint a token.

The claim path is thinner than it looks. `AdminPasswordComponent` renders a disabled email field reading `admin` and one password field (`frontend/src/features/users/ui/AdminPasswordComponent.tsx:92-105`), posts it, then signs in with `email: 'admin'` (`:70`). `AuthPageComponent` chooses between that component and the ordinary authentication modes by asking `GET /users/admin/has-password` (`AuthPageComponent.tsx:28-40`). Registration already does everything that screen does, and asks for the address as well. The client even has the call for the question that replaces it: `userApi.isAnyUserExists` issues a GET to `/users/is-any-user-exist` and reads `{ isExist: boolean }` back (`frontend/src/entity/users/api/userApi.ts:62-74`), a route the backend never registered (`user_controller.go:26-41`), so the function is dead code today.

The frontend makes the address comparison independently in one more place. `ProfileComponent.tsx` disables the email input when `user.email === 'admin'` (`:234`), explains the lock with `users.profile.adminEmailReadOnly` (`:236-238`), skips validating the field (`:138`) and omits it from the update request (`:157`).

Two things the change does not have to build already exist. Uniqueness is enforced twice, by `users_email_idx` (`backend/migrations/20250605090323_init.sql:14`) and by the explicit check at `user_services.go:471-479`, and the address change is already written to the audit log at `user_services.go:486-506`.

One thing it does have to build. Email syntax is validated where an address enters through the profile update (`UpdateUserInfoRequestDTO`, `binding:"omitempty,email"`, `backend/internal/features/users/dto/dto.go:42`) and through an invitation (`InviteUserRequestDTO`, `binding:"required,email"`, `:47`), but registration binds its address as `required` alone (`:12`). Anyone can register today with `foo` in the email column, and after this change that address could belong to the administrator - which is the one thing the change exists to prevent.

Sessions survive a change of address. `GenerateAccessToken` puts the user id and the password creation time in the token and no email at all (`user_services.go:271-276`), and `GetUserFromToken` resolves the account by id (`:221-233`). An administrator who changes their address stays signed in.

This change is constrained by [`backend/AGENTS.md`](../../../backend/AGENTS.md) for the migration, repository and controller-test conventions, by [`frontend/AGENTS.md`](../../../frontend/AGENTS.md) for the authentication screens and the interface dictionaries, and by [`website/AGENTS.md`](../../../website/AGENTS.md) and [`assets/readme/AGENTS.md`](../../../assets/readme/AGENTS.md) for the six-language documentation rules. The root [`AGENTS.md`](../../../AGENTS.md) language rule applies as written: the console output, the flag name and its help text are English, and the only translated text is the website copy, the README translations and the interface dictionary entries it already permits.

## Goals / Non-Goals

**Goals:**

- Let an instance reach its first administrator without ever storing an address nobody can deliver to.
- Identify that account by something that survives an address change.
- Keep every privilege and every screen the seeded account has today working after an upgrade and after its address changes.
- Give a locked-out owner a recovery path that does not depend on email delivery.

**Non-Goals:**

- Separating a login identifier from an email address. Sign-in stays keyed on the email column.
- Changing who may deactivate, reactivate, promote or demote an administrator. The rule stays "only the root administrator"; only the way that account is recognized changes.
- Emitting a confirmation message to a newly created administrator address.
- Narrowing who can reach an instance that has not been set up yet.

## Decisions

### The first account on an empty instance becomes the administrator

Account creation checks whether the instance holds any user. If it holds none, the account being created takes the ADMIN role and the bootstrap-administrator flag; otherwise nothing changes about how accounts are created. Both entry points ask the same question through the same decision, so registration (`user_services.go:50-135`) and a first external sign-in (`getOrCreateUserFromOAuth`, `:963-974`) answer it the same way. It ignores `IsAllowExternalRegistrations`, which defaults to true (`migrations/20251031143019_add_many_users_and_settings.sql:7`) and which nobody can have turned off on an instance with no administrator to turn it off.

Ignoring that setting is a question of where the count is asked, not of a flag handed further down. Both paths refuse a new account with `external registration is disabled` before they ever reach the insert - `user_services.go:110-111` for registration, `:951-952` for a first external sign-in - so asking the count inside the insert branch would be too late: on an empty instance whose setting happens to be off, the caller would get that refusal and the instance would have no way to gain an administrator at all. The count is therefore asked ahead of that refusal, and an empty instance skips it. Everything else about the two paths stays where it is.

Both entry points fork before they reach the branch that creates an account. `SignUp` completes an existing invited account first (`:66-101`) and `getOrCreateUserFromOAuth` links or activates an existing one (`:896-944`); the grant belongs only in the branch that inserts a new row (`:114-127` and `:963-976`). The distinction costs nothing to honor and keeps the rule readable: the account that takes the instance is one that did not exist a moment ago. Reaching either of the other branches on an instance with no users is impossible anyway, since both need an account to already be there.

Alternatives rejected:

- **Keep seeding the account and only let its address change.** This was the previous plan, and it leaves the placeholder address in the product forever: every new install still starts with an account no mail server can reach, and every piece of documentation still has to explain a login called `admin`. The address change alone treats the symptom.
- **Seed the account but ask for the address on the claim screen.** It keeps the claim path, the second unauthenticated write endpoint and a second screen that duplicates registration, to end up where registration already is.
- **Promote the first account only when it registers through the form, not through Google or GitHub.** An instance that has OAuth configured and no users would then hand its first visitor a member account and have no administrator at all, with no way to appoint one.

### Validate the registration address the way every other entry point does

`SignUpRequestDTO.Email` gains `email` beside `required`, so the binding validator rejects a value that is not an address before the service sees it, exactly as the invitation and the profile update already do.

This refuses input that was previously accepted, which is a break in the sign-up contract. It is a small one - a caller sending a non-address was creating an account that could never receive mail - and it is stated in the proposal rather than smuggled in.

Alternative rejected: validating only when the account being created is the administrator. Two rules for one field, and the member registered with `foo` still cannot be reached by password reset or by anything else the product mails.

### One flag, and a partial unique index that settles the race

`users.is_root_admin boolean not null default false` records the account, and `CREATE UNIQUE INDEX ... ON users (is_root_admin) WHERE is_root_admin` allows at most one row to carry it. Two people registering on the same empty instance both see no users and both try to insert a flagged account; the database admits one, and the loser retries as an ordinary registration under the open-registration policy. The outcome is deterministic without a lock or a serializable transaction.

Which violation was refused has to be read from the constraint, not from the fact that a unique index fired. `users` carries two of them: `users_email_idx` (`migrations/20250605090323_init.sql:14`) and the new partial one. Retrying on any unique violation would turn a registration for an address that is already taken into a second insert that fails the same way, and the caller would get an error naming the wrong thing. The retry is therefore conditional on `pgconn.PgError.ConstraintName` matching the bootstrap index; every other violation propagates as it does today, and the duplicate-address message registration already returns stays what it is. Unwrapping a driver error with `errors.As` into `*pgconn.PgError` is how the repository already reads PostgreSQL error codes (`internal/features/databases/service.go:335`, `backups/usecases/physical/postgresql/wal_rotation.go:167`).

Alternatives rejected:

- **Keep matching on the string `admin`.** It is what blocks the address change, and after this change there is no `admin` row on a new install for it to match.
- **Take the oldest account holding the ADMIN role.** Needs no column, but the answer drifts the moment that account is demoted, and the instance would silently promote a different account into the bootstrap role. A stored flag cannot drift this way. The migration uses this rule once, as a backfill fallback, where drift cannot happen because it runs once.
- **Count users inside a serializable transaction instead of the index.** It moves a database-level guarantee into application code and into every future caller that creates a user.

### The flag is stored, not served

`User` carries a `json` tag on every field (`models/user.go:11-22`), which reads like a wire format, but no handler serializes it. `GET /users/me` answers with `UserProfileResponseDTO` built in `GetCurrentUserProfile` (`user_controller.go:301`, `user_services.go:441-453`), and the user list builds the same DTO per row (`management_controller.go:91-101`). Nothing in the codebase hands the model to a client, so no response shape changes when the column lands, and no client work is needed either way.

The field still gets `json:"-"`, for the same reason `HashedPassword` and the two OAuth ids already carry it (`models/user.go:14-20`): the tag is what keeps a fact out of the wire if some later handler does return the model directly, and which account owns the instance is exactly the kind of fact that should not travel by accident. Nothing on the client asks the question anyway - the whole point of the change is that the profile screen stops caring - and the three privilege checks that do ask run on the server with the model in hand.

Alternative rejected: **tagging it `json:"isRootAdmin"` now because a later screen might mark the account in the user list.** That screen does not exist, and adding the field when it does is one tag.

### Delete the claim path rather than keep it for upgraded instances

`GET /users/admin/has-password` and `POST /users/admin/set-password` exist to let the first visitor set a password on the seeded account. With no account seeded, the first is always false for a new install and the second has nothing to write to. Keeping them for upgraded instances would mean keeping an unauthenticated password-setting endpoint alive for a row the migration has already resolved: claimed, and therefore not eligible for the claim path anyway; never claimed and alone, and therefore deleted; or never claimed beside other accounts, and therefore flagged, with the reset command as its way in.

The authentication screen asks `GET /users/is-any-user-exist` instead, which is the question it actually needs and the call the client already makes.

Alternative rejected: **leaving the endpoints in place and unused.** The repository's rule on backward compatibility is explicit, and an unauthenticated write endpoint that nothing calls is the worst kind of dead code.

### Resolve the seeded account in the migration, not at startup

The up step does three things in order: add the column and its index; delete the seeded row when it was never claimed - no password and no linked Google or GitHub identity - **and it is the only row in `users`**; set the flag on the remaining `admin` row, or, when none exists, on the oldest ADMIN-role account.

Deleting an unclaimed row is safe because nobody could ever have acted as it. Sign-in requires a password hash, the claim path is the only way it could have got one, and the OAuth columns are empty by construction. Nothing can reference it: every foreign key into `users` either cascades or nulls (`audit_logs` sets null, `workspace_memberships`, `databases`, `download_tokens` and `password_reset_codes` cascade), and all of them are written by an authenticated caller.

It is only safe while that row is alone, though, and it need not be. `POST /users/signup` answers regardless of what the authentication screen offers, and open registration is on by default (`migrations/20251031143019_add_many_users_and_settings.sql:7`), so an instance can hold ordinary members while its seeded account was never claimed. There the seeded row is the only ADMIN-role account - promoting anybody requires being the root administrator, and nobody could act as that account - so deleting it would leave members behind with no administrator and no route back: the first-account rule cannot fire, because the instance is not empty. On that shape the row is kept and flagged. It still has no password, which the reset command the README already documents can give it (`main.go:167-190`), and from there its owner moves it to a real address like any other administrator. That is why the condition is "unclaimed **and** alone" rather than "unclaimed".

The fallback to the oldest ADMIN-role account covers an instance whose seeded row was renamed by hand. Such an instance still holds at least one ADMIN account: no code path deletes users, demoting an ADMIN requires being the root administrator, and that account may not act on its own role (`management_service.go:142`). The condition above is what keeps this true - the up step never deletes the last administrator out from under the fallback.

Alternatives rejected:

- **Resolve it at startup instead of in the migration.** Startup would then carry a one-time rule forever, and a deletion decided by application code is harder to review and to roll back than one statement in a migration.
- **Leave the unclaimed row in place and let the owner keep claiming it.** The claim path is what this change removes. An instance whose single account cannot sign in and cannot be claimed would be bricked.
- **Leave the unclaimed row and let the first registration take the flag from it.** The instance would then hold a second, useless ADMIN-role account with an undeliverable address, which is exactly what the change exists to remove, and `--list-admins` would report it forever.

### Move the three administrator-management privileges onto the flag in the same change

`UserManagementService` reserves three actions for the root administrator by comparing `changedBy.Email` (or `deactivatedBy` / `activatedBy`) against `"admin"`: deactivating an ADMIN account (`:74`), reactivating one (`:108`) and granting or revoking the ADMIN role (`:154`). Left alone, no account on a new install passes them, because none is called `admin`: nobody could appoint an administrator, ever. On an upgraded install they would break as soon as the owner set a real address.

Note what the guard rules give us once they read the flag. Demoting or deactivating an ADMIN-role account requires being the root administrator, and that account may act on neither its own role nor its own status, so the flagged account cannot be stripped of its role or deactivated by anyone. The flag therefore stays on exactly one live, active ADMIN-role account for the life of the instance, and the design does not need an extra guard to keep it there. It does need a test: the property holds by composition of three separate rules and nothing in the code states it, so a future edit to any one of them could remove it silently.

### Take the frontend lock down with the backend refusal

`ProfileComponent.tsx` decides read-only-ness by comparing the address. All four sites go: the `disabled` prop, the explanatory line, the skipped validation and the omitted request field. The profile screen then treats every user the same, which is the point - the flag exists so the backend can answer "who is the root administrator", and the profile screen no longer needs to ask.

`users.profile.adminEmailReadOnly` becomes unused and is deleted from `en`, `ru`, `es`, `pt`, `zh` and `fr`. No replacement string is introduced.

Alternative rejected: **expose `isRootAdmin` in the profile DTO and keep the field locked for that account.** It would carry the flag to the client just to reinstate the restriction this change exists to remove.

### The authentication screen opens on registration for an empty instance

`AuthPageComponent` keeps its four modes and its single route. What changes is the question it asks on mount and the branch it takes: with no account on the instance it opens on registration and shows copy saying this account will administer the instance. An instance that holds accounts keeps exactly the screen it opens on today - the same four modes, starting on registration (`AuthPageComponent.tsx:21-23`), reachable to sign-in from there - without that copy. Which screen a populated instance opens on is a separate question from this change, and it is left where it is rather than quietly switched to sign-in.

`AdminPasswordComponent` goes, with the dictionary keys `users.adminPassword.*` and `app.auth.adminPasswordCheckFailed`, its barrel export, and the client functions and types nothing else uses: `userApi.isAdminHasPassword`, `userApi.setAdminPassword`, `IsAdminHasPasswordResponse` and `SetAdminPasswordRequest` (`entity/users/index.ts:10-11`, `entity/users/api/userApi.ts:76-95`). Leaving the two client functions behind would keep dead callers of two deleted routes.

The copy matters more than it looks. Without it the first visitor sees an ordinary registration form and has no way to know that this particular registration is the one that owns the instance.

Alternative rejected: **a dedicated first-run screen.** It would be the registration form with different copy, which is what a mode already is.

### Rebuild the bootstrap-account test helper on the flag

`RecreateInitialAdmin` (`users/testing/user_utils.go:67-79`) relies on two things this change removes: the seeding function, and the idempotence check reading the address. It becomes a helper that retires whatever account currently holds the flag - selected by the flag - and creates a fresh flagged ADMIN account the way `CreateTestUser` already creates users (`:19-48`).

`RecreateInitAdminAndGetAccess` (`:50-65`) is the caller that matters, since nine of the eleven call sites go through it. It reads the account back by address before minting a token, and that lookup answers `nil, nil` once nothing on the instance is called `admin`, so left alone it would hand a nil user to `GenerateAccessToken`. It returns the account the rebuilt helper just created instead, which also removes the second lookup.

Selecting the outgoing account by address would not work: `RenameUserEmailForTests` matches `Where("email = ?", "admin")` and treats zero affected rows as success (`user_repository.go:147-157`), so after any test that moves the address to a real one the flag would stay behind, and the next test in the package would get no bootstrap account. Since Go runs a package's tests in sequence against a shared database, that failure would land on whichever test came next, far from the one that caused it. The helper fails loudly instead, naming what it could not find.

Alternative rejected: keeping a seeding function in production code purely so tests can call it. Test support belongs in `users/testing`, and the helper is three statements.

### A test says what the instance holds, because the database will not

Everything this change adds is keyed on one question - does the instance hold any account - and no test can assume either answer. `cleanup_test_db` drops and recreates the per-slot metadata databases once per run (`backend/cmd/cleanup_test_db/main.go:64-97`), each test binary then claims a free slot with an advisory lock and releases it when the process exits (`internal/config/config.go:259-277`), so a later package inherits whatever the earlier one left in that slot. Around twenty packages outside `features/users` create accounts through `users_testing.CreateTestUser`, and nothing anywhere empties the `users` table. A test that needs an empty instance would therefore pass or fail on which package happened to run first.

`users/testing` gains a helper that empties the table, and the tests that need the empty state call it. The same fact runs the other way too: a test that asserts an ordinary member account now depends on the instance not being empty, so it creates an account first instead of trusting what a neighbour left behind. `Test_UserLifecycleE2E_CompletesSuccessfully` (`controllers/e2e_test.go:120`) is the live example - it registers and asserts the member role (`:172`), and it passes today only because the test above it seeds the bootstrap account. Under the new rule that is an order dependency, and it gets its own precondition.

Alternatives rejected:

- **Emptying the table in a `TestMain` for the package.** It fixes the state at package start, which is not where the problem is: the tests that need an empty instance run after other tests in the same package have created accounts.
- **Relying on the order tests happen to run in.** It is what makes the existing member assertion work, and it breaks under `-run` on a single test or under any reordering - the worst kind of failure, landing on a test that did nothing wrong.

### Guard the missing password hash on the sign-in path

`SignIn` reaches `bcrypt.CompareHashAndPassword([]byte(*user.HashedPassword), ...)` (`user_services.go:181`) after checking only the account's status. `hashed_password` became nullable so accounts could exist without one (`migrations/20251031143019_add_many_users_and_settings.sql:35-36`), and `getOrCreateUserFromOAuth` creates exactly such an account for a first Google or GitHub sign-in (`user_services.go:963-974`), so submitting the password form for one of those addresses dereferences a nil pointer and the recovery middleware turns it into a 500. `User.HasPassword()` already exists to ask the question properly (`models/user.go:56-58`).

The guard answers with the same refusal a wrong password gets, so an anonymous caller learns nothing new. This is a pre-existing crash rather than one the change introduces; it lands here because this change owns the account-creation paths that produce passwordless accounts and the spec that describes how an instance is entered.

Alternative rejected: refusing with a message that names the account as external ("this account signs in through Google"). It would tell an anonymous caller which accounts are linked to which provider.

### Record audit entries in tests instead of discarding them

The address change already writes an audit entry (`user_services.go:486-506`), and the controller tests install `AuditLogWriterStub`, whose `WriteAuditLog` has an empty body (`controllers/e2e_test.go:255-258`). No test in the users feature has ever asserted an audit entry, so the entries are effectively untested infrastructure.

`users/testing` gains a writer that appends entries to a slice, and the controller test routers use it. That makes the audit requirement in this spec testable and gives `add-email-two-factor-auth`, which moves the "User signed in" entry to the verification step, something to assert against.

Two mechanics decide how a test reaches it. The services are package-level singletons and `SetAuditLogWriter` mutates them (`services/di.go:10-28`), so a recorder installed while building a router replaces whichever one the previous test installed; since the four builders are called from about ninety sites across the feature's test files, they keep returning only the engine, and the recorder is reached through `users/testing` rather than through a changed signature. And an assertion looks for the entry it cares about among the entries recorded, not for a single entry: the setup leading up to it signs in and creates accounts, and those write entries of their own.

Alternative rejected: reading the audit log back through its HTTP endpoint. It would pull the audit feature's storage, pagination and permissions into a test about one entry, and the stub the routers already install would still have to go.

### Delete the sign-in hint rather than reword it

`user_services.go:157-161` branches on `GetUsersCount() == 1` to answer an unknown address with `"user with this email does not exist, seems you need to sign in as \"admin\""`. The whole branch goes, leaving the generic response. `GetUsersCount` stays: the service method has a second caller in telemetry (`backend/internal/features/telemetry/service.go:102`), and the new account-creation rule asks it the same question.

Alternatives rejected:

- **Keep the hint and reword it to mention the console command.** It would still confirm to an anonymous caller that a single-user instance exists, which is the part worth removing.
- **Show the hint only to callers from a private network address.** Trusting a client address for a disclosure decision is a weaker control than not disclosing, and the owner already has a better recovery path on the host.

### Print the administrator list from the existing command-line entry point

`backend/cmd/main.go:154-166` parses flags with the standard library and `resetPasswordIfRequested` (`:167-190`) runs after the database is initialized and exits the process when it is done. `--list-admins` follows the same shape: a boolean flag, a handler invoked from the same place in startup, printing to the process log and exiting. Output carries the address, display name, creation date and active state of every ADMIN-role account and marks which one holds the flag, and nothing else. The active state earns its place: an administrator whose account was deactivated reads as a perfectly good address to sign in with, and the owner would have no way to see why it is refused.

The handler reads and prints; it writes no audit entry. That is a mechanical constraint as much as an editorial one. `UserService` dereferences its audit writer without a nil check (`user_services.go:128`), the writer is only installed once a feature calls `audit_logs.SetupDependencies()`, and that is exactly why `resetPasswordIfRequested` calls it before changing a password (`main.go:167-190`). A read-only listing needs no such setup, and it must not acquire a code path that assumes one.

What goes in `cmd` is the flag, the call and the print. Everything worth asserting - selecting the administrators, ordering them, marking the flagged one and rendering the lines - lives under `backend/internal/features/users/`, because `make test` and CI both run `go test ./internal/...` and nothing else (`backend/Makefile:16`, `.github/workflows/ci-release.yml:221,345`). The two test files already sitting in `cmd/` (`storage_command_test.go`, `healthcheck_test.go`) are never executed by either. A listing whose logic stayed in `cmd` would ship with tests that look like coverage and provide none.

This is the one place the change tests a service directly rather than through HTTP, which `backend/AGENTS.md` reserves for logic with no API surface. A recovery command for an owner who cannot sign in is exactly that: giving it an endpoint is the alternative rejected below.

That startup point sits after `runMigrations` (`main.go:87`), so on an unmigrated database the command migrates first. For a recovery command run by the instance's owner on the instance's own database this is acceptable. It is the deliberate opposite of `--test-storage`, which exits before migrations precisely so it can run against a database it must not touch. On an instance where nobody has registered yet the command prints nothing and says so, which is the correct answer.

The command is only usable once `restore-console-command-database-access` lands. A container that generates its metadata-database password at startup keeps that value in the environment of its first process, which `docker exec` does not inherit, so a console command started that way falls back to a stale baked-in connection string and fails with `password authentication failed for user "postgres"`. That is the defect the other change fixes for every console command. `--list-admins` inherits it, and so does the recovery path the documentation here points an owner at, which is why this change lands after it and why the task list verifies the command through `docker exec` against a running container rather than against a local database, where the defect is invisible.

Alternatives rejected:

- **A new subcommand argument in the style of `healthcheck` (`main.go:73`).** That path runs before configuration and the database are ready, which the listing needs.
- **An authenticated HTTP endpoint.** The caller who needs it is the one who cannot sign in.
- **Printing every user, not just administrators.** On a large instance the output becomes a user dump for a question that is only ever about administrators.

### Documentation goes where a locked-out owner already looks

The password page on the website (`website/app/(en)/password/page.tsx`, headings `reset-password`, `reset-password-command`, `parameters`) is already linked from `README.md:261` as the reset reference. Both commands are documented there and in the README's reset section rather than in a new page, and one home-page FAQ entry points at it.

The README example at `README.md:266` reads `--email="admin"`, with line 269 telling the reader to substitute the real address, and the website page repeats the same example (`password/page.tsx:41`) and offers `admin` as the first illustration of a valid value (`:141`). Leading with `admin` now teaches an address that no new install has, so both examples use a real-looking address, and the text explains that an upgraded instance which has never changed the address still uses `admin`.

The access-management page states that the system holds one user called `admin` (`website/app/(en)/access-management/page.tsx:220`, mirrored in five translations). That sentence is wrong for every new install, so it is rewritten to describe the first registered account.

## What the tests already cover, and what they do not

The users feature is well covered, which decides how much of the test work here is new and how much is a switch of the account the existing tests use.

Already covered, and expected to keep passing unchanged once the helpers move onto the flag:

- The full administrator-management matrix. `management_controller_test.go` pins the root administrator succeeding at all three privileges (`:574`, `:596`, `:618`, `:636`) and an ordinary ADMIN account being refused all three (`:486`, `:512`, `:538`, `:556`). Those tests take the bootstrap account from `RecreateInitAdminAndGetAccess`, so after this change they exercise an administrator whose address is an ordinary test address - which is the case that is impossible to construct today.
- The guarantee that the bootstrap account cannot be stripped: it may not change its own role (`:665`) or deactivate itself (`:686`), and no other administrator may demote it (`:512`) or deactivate it (`:538`). The spec requirement that the instance is never left without a bootstrap administrator rests on those four, and what is missing is only that none of them names the flagged account specifically.
- Registration: success, duplicate address, malformed body, binding failures (`user_controller_test.go:66-181`). Sign-in: valid credentials, wrong password, unknown address, rate limiting (`:182-277`, `:1216`). OAuth: a new account, linking by address and completing an invitation, for both providers; the missing-public-email fallback and the refusal when external registration is disabled exist for GitHub only (`:782-1215`). Profile update: name, address, address already taken (`:678-760`). Password reset end to end, including expiry, reuse, rate limiting and delivery failure (`password_reset_test.go`).

Not covered today, next to code this change edits:

- Password registration refused because external registration is disabled. Only the GitHub path has that test (`user_controller_test.go:1007`), even though `DisableExternalRegistrations` (`users/testing/settings_utils.go:21`) makes it a two-line setup. This change adds a deliberate bypass of that check, so the case it must not weaken needs pinning first.
- The two sign-in refusals above the password comparison: an account still in the invited state and a deactivated one (`user_services.go:168-179`). The change inserts a third refusal between them and the comparison.
- Audit entries. Every controller test installs a writer with an empty body, so nothing has ever been asserted about them.
- Anything that depends on how many accounts the instance holds. No test states that precondition today, because nothing depended on it; every behavior this change adds does, and the helper above is what lets a test state it.

Where a test is not the right instrument, and the task says so instead of pretending:

- The migration's backfill. Goose has already run against the test databases before `go test` starts (`backend/Makefile:11-16`), so a test cannot observe an instance in the pre-migration shape. The five shapes - claimed, unclaimed and alone, unclaimed beside other accounts, renamed by hand, and empty - are checked by hand with `make migration-up` and `make migration-down` against a scratch database.
- The authentication and profile screens. The frontend has 21 test files and all of them cover pure functions or dictionary parity - there is no component or page test in the repository, and this change is not where that convention gets introduced. The screens are verified by running the application; the locale edits are covered by `shared/i18n/dictionaries.test.ts`, which fails if the six files stop agreeing.

## Risks / Trade-offs

- **An instance is published before its owner registers, and a stranger becomes the administrator.** -> The same window exists today, with the claim screen handing the same power to whoever arrives first; the change does not widen it, and the documentation says plainly that the first account owns the instance. Recovery is also the same: an operator with a shell can reset any account's password, and `--list-admins` shows which addresses hold the role.
- **An owner registers, then forgets which address they used.** -> The listing command reads the stored address directly from the database, so recovery needs no mail delivery. This is why the command ships in the same change.
- **The migration deletes an account.** -> Only a row with no password and no linked identity, which nobody could ever have signed in as, and only when it is the one row the instance holds. The alternative is an instance nobody can enter at all. The down step cannot bring it back, which the migration plan states.
- **The migration finds no row with the address `admin`.** -> It falls back to the oldest ADMIN-role account, which exists on any instance that still holds one, for the reasons above. An empty database backfills nothing, which is correct.
- **The migration meets an instance whose seeded account was never claimed, but which already holds members.** -> Deleting the row there would leave members with no administrator and no way to appoint one, so the row is kept and flagged instead, and its owner takes it over with the reset command. This is the shape the earlier plan got wrong, and it is reachable without anything unusual: `POST /users/signup` answers whether or not the claim screen offers registration.
- **The console command cannot reach the metadata database.** -> Every console command is affected today, not only this one, and `restore-console-command-database-access` fixes it. This change lands after it, and its verification runs the command through `docker exec` on a running container so the defect cannot hide behind a local database.
- **A test silently depends on how many accounts the instance holds.** -> Slot databases are shared across packages within a run and nothing empties the `users` table, so the precondition is stated explicitly: a test that needs an empty instance empties it, and a test that needs a populated one creates an account.
- **A privilege check is missed and the owner silently loses a power.** -> This is the change's main failure mode, and it is why the inventory above is exhaustive rather than illustrative and why the tasks cover each of the three management privileges with its own test. After the change, the literal `"admin"` should survive in backend production code only in the MongoDB feature, which means a database by it, and task 4.5 greps for exactly that. Two occurrences outside it are deliberate and stay: the sign-in form accepts `admin` as a login value (`SignInComponent.tsx:50`) because an upgraded instance still uses it, and the documentation names it as the address such an instance carries until its owner replaces it.
- **Two people register on an empty instance at the same moment.** -> The partial unique index admits one flagged account; the other registration proceeds as an ordinary one. The tasks cover it with a test that inserts the second flagged account directly and expects the database to refuse it.
- **An administrator sets an address that belongs to somebody else, and that somebody signs in through Google or GitHub.** `getOrCreateUserFromOAuth` (`user_services.go:891-900`) links an OAuth identity to an existing account by matching the email address. The behavior is unchanged by this change, but the bootstrap account was previously out of its reach, because no OAuth provider returns the address `admin`. A typo in the domain of an administrator address therefore hands the owner of that mailbox a route into the most privileged account on the instance. -> Not mitigated here: the same exposure already applies to every invited user, and narrowing it means changing how OAuth links accounts, which belongs in its own change. Recorded so that the change that narrows it knows this account is now in scope too.
- **Password reset by email starts working for the bootstrap account.** This is an intended consequence rather than a risk, but it is a behavior change: an account that could never be reset by email now can be, and the reset flow's own protections (active status only, three codes per hour, one-hour expiry, `user_services.go:557-571`) are what stands behind it.
- **The test helper and production code drift apart again.** -> The helper finds the bootstrap account by flag and fails with a clear message when it finds none, so the next divergence stops in the helper instead of appearing as an unrelated test failure later in the package.
- **Six-language documentation drifts.** -> The website and README translation rules already govern this; the tasks treat each language as its own slice rather than one bulk edit.

## Migration Plan

One goose migration, with both directions as the repository requires.

The up step adds `is_root_admin` with a `false` default and its partial unique index, deletes the seeded `admin` row when it holds no password and no linked identity and is the only row in `users`, and then sets the flag on the remaining `admin` row or, failing that, on the oldest ADMIN-role account. An unclaimed row on an instance that holds other accounts is kept and flagged, because deleting it would leave that instance with no administrator at all.

The down step drops the index and the column. It cannot restore a deleted unclaimed account, and it does not try: an instance that was never claimed rolls back to a state where the old binary seeds the account again at startup, which is exactly where it was.

Rolling the binary back on a claimed instance leaves an unused column behind, and the old code keeps matching on the address text - provided the address has not been changed in the meantime. An owner who has already moved to a real address and then rolls back is worse off: the old code looks the account up by the text `admin`, finds nothing, and `IsRootAdminHasPassword` fails. The authentication screen alerts and keeps its spinner without clearing the loading state (`frontend/src/pages/AuthPageComponent.tsx:28-40`), so nobody reaches the sign-in form, and the restored `Email != "admin"` privilege checks would freeze administrator management even if sign-in worked. It is a lockout rather than a takeover, since the claim path also finds no account to write a password to, and it is recoverable by rolling forward again or by setting the address back to `admin` in the database. The rollback window therefore closes the moment an owner changes the address, and the change's completion notes say so.
