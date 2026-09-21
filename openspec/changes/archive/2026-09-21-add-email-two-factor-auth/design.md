## Context

See proposal.md - Why for the motivation, and specs/two-factor-authentication/spec.md for the behavior contract. What shapes the approach is which parts already exist and two traps: one in the existing mail sender, one in what the frontend believes about it.

The password-reset flow is the working precedent for everything the code needs to do. `SendResetPasswordCode` (`backend/internal/features/users/services/user_services.go:497-610`) draws six digits from `crypto/rand`, stores them hashed with an expiry in `password_reset_codes` (`backend/internal/features/users/models/password_reset_code.go`), mails them, and validates them through `IsValid()`. Its controller guards the send with the scoped rate limiter, three attempts an hour per address (`backend/internal/features/users/controllers/user_controller.go:436-446`).

Sign-in today verifies the password and immediately issues a ten-year token (`user_services.go:136-198`), and the frontend stores whatever token comes back inside the API call itself (`frontend/src/entity/users/api/userApi.ts:46-58`). The global settings row already carries three authentication switches (`backend/internal/features/users/models/users_settings.go`), rendered on the settings screen at `frontend/src/features/settings/ui/SettingsComponent.tsx`, and the frontend reads a runtime flag `IS_EMAIL_CONFIGURED` (`frontend/src/constants.ts:37-39`) to decide whether to offer password recovery on the sign-in screen (`SignInComponent.tsx:172`).

The trap: `SendEmail` returns `nil` when SMTP is not configured, after logging a warning and sending nothing (`backend/internal/features/email/email.go:32-36`). Anything that treats a `nil` return as "the code is on its way" would hand the user a code-entry screen for a code that was never sent. The fail-closed requirement therefore cannot rest on that return value alone; see the decision below.

A second trap sits next to it. `IS_EMAIL_CONFIGURED` is not the backend's opinion: the container entrypoint sets it from `SMTP_HOST` and `DATABASUS_URL` (`docker/start.sh:144-149`), the backend sets its own flag from `SMTP_HOST` and `SMTP_PORT` (`backend/internal/features/email/di.go:13-22`), and `DATABASUS_URL` only decides whether an invitation message carries a link (`workspaces/services/membership_service.go:371-376`). The two disagree in both directions, so the settings screen cannot use the frontend flag to predict what the gate will do.

One thing the tests need does not exist yet. `MockEmailSender` (`backend/internal/features/users/testing/mocks.go:5-33`) records sent messages but cannot report itself as unconfigured, so this change adds the configured-state answer to it. The recording audit-log writer the assertions need arrived with `replace-seeded-admin-with-first-signup` and is already installed by the controller tests (`backend/internal/features/users/testing/audit_log_utils.go:12-77`, called from `controllers/e2e_test.go:181`). One detail of the mock shapes the send-failure tests: it appends the message before returning the failure `ShouldFail` asks for (`mocks.go:23-32`), so a failed send is proven by the absence of a usable pending sign-in rather than by an empty `SentEmails`.

This change is constrained by [`backend/AGENTS.md`](../../../../backend/AGENTS.md) for the migration and controller-test conventions, by [`frontend/AGENTS.md`](../../../../frontend/AGENTS.md) for the dictionary rule that keeps every user-facing string out of components, and by [`website/AGENTS.md`](../../../../website/AGENTS.md) and [`assets/readme/AGENTS.md`](../../../../assets/readme/AGENTS.md) for the six-language documentation.

## Goals / Non-Goals

**Goals:**

- Add the second step without changing how a token is minted or how long it lives.
- Make the failure modes loud: a refusal to enable, an explicit send failure, a console way out.
- Reuse the reset-code machinery rather than inventing a parallel one.

**Non-Goals:**

- A pluggable second-factor channel. Email is the only one, and the design does not pretend otherwise.
- Any change to the OAuth callbacks.
- Restructuring the settings screen beyond adding one row.

## Decisions

### Keep the pending sign-in in a table, not in a token

A new `two_factor_codes` table holds `user_id`, the hashed code, the account's password creation time, `expires_at`, `is_used`, a count of failed attempts and `created_at` - the reset-code shape plus the counter and the timestamp the verification step re-checks. One row is one issued code, so the response that issues a code carries that row's identifier, and the verify call is keyed on the identifier rather than on the address.

The rows are also the evidence the hourly cap counts, which is why they outlive the code they carry. A row is usable for ten minutes and kept for an hour; the retention decision below explains why the two numbers differ.

Alternatives rejected:

- **A short-lived pre-authentication token carrying the user id.** No migration, but nowhere to put the attempt counter and nothing to mark as used, so the same token can be replayed until it expires and guesses cannot be bounded without a server-side store anyway. Adding that store is the table, arriving by a longer road.
- **Reusing `password_reset_codes` with a purpose column.** One table instead of two, but it entangles two flows with different lifetimes, different rate limits and different consequences for a bug. A wrong lookup would let a reset code complete a sign-in.
- **Keying verification on the email address, the way password reset does.** Then anyone who knows an address can burn another user's five attempts and force them back to the password step. The opaque identifier is only known to whoever supplied the correct password.

### Check that mail is configured explicitly, not through the send result

The sign-in path asks the mail sender whether it is configured before creating a pending sign-in, and treats "not configured" and "send failed" as the same explicit failure. This is what makes the fail-closed requirement real given `email.go:32-36`.

To ask the question, the `EmailSender` interface the users feature depends on (`backend/internal/features/users/interfaces/interfaces.go:13-15`) gains an `IsConfigured() bool` method, implemented by exposing the flag the sender already computes in `backend/internal/features/email/di.go:13-22`. `MockEmailSender` implements it from a field the tests set, so a test can produce an unconfigured sender without touching the environment.

The same answer is what the settings screen needs, so the settings response carries it as a field rather than leaving the screen to guess from `IS_EMAIL_CONFIGURED`. One question, asked in one place, answered by the component that owns it.

Alternatives rejected:

- **Reading the SMTP environment variables in the users feature.** It would duplicate the configured-ness rule that `di.go` already owns, and the two would drift.
- **Making `SendEmail` return an error when unconfigured.** Cleaner in the abstract, but every existing caller treats the unconfigured case as a silent skip - notifications, invitations, reset codes - and changing that is a behavior change well outside this change's scope.
- **Fixing `docker/start.sh` so the frontend flag matches the backend rule.** The right end state, but that flag also decides whether the sign-in screen offers password recovery (`SignInComponent.tsx:172`) and whether other email features appear, and the published configuration page states the current rule as documentation (`website/app/(en)/advanced-config/page.tsx:239-248`). Correcting it changes screens this change does not touch and six languages of documentation, so it belongs to its own change; the proposal records it as out of scope.

### The settings endpoints get their own request and response types

`GET` and `PUT /users/settings` currently send and receive the persisted model itself (`backend/internal/features/users/controllers/settings_controller.go:19-25`, `backend/internal/features/users/models/users_settings.go`), and the repository saves the object the service returns. The answer about the mail server is derived, not stored, so putting it on that model would let a client send it back and would ask the persistence layer to ignore a field it can see. A `SettingsResponseDTO` carries the four switches plus `isEmailConfigured`; an `UpdateSettingsRequestDTO` carries the four switches alone. The frontend already models settings without the stored identifier (`frontend/src/entity/users/model/UsersSettings.ts`), so the response it receives stays the shape it expects, with two fields added.

`GET` stays open to any authenticated caller, because members read `isMemberAllowedToCreateWorkspaces` from it. That makes the new switch and the mail-server answer readable by members, which is acceptable: a member learns whether the second factor is on by signing in.

Alternatives rejected:

- **Adding the derived field to the model with `gorm:"-"`.** It keeps one type for three jobs and relies on every future writer noticing the tag. The request would still accept a field the server computes.
- **A separate endpoint answering only whether mail is configured.** Two calls where the settings screen already makes one, and a second place for the same question to be answered differently.

### Gate the setting on real administrator addresses, using the same rule the API already enforces

Turning the setting on checks every active administrator's address with the same validation the profile update applies, so the settings gate and the profile form cannot disagree about what counts as an address. `UpdateUserInfoRequestDTO` binds `omitempty,email` (`backend/internal/features/users/dto/dto.go:40-43`), so the rule comes from the binding validator and the gate calls it directly rather than reimplementing a pattern.

Alternatives rejected:

- **Checking only the recorded bootstrap administrator.** Any other administrator could equally be holding an unusable address, and the point of the gate is that no administrator is locked out.
- **Checking every user, not only administrators.** A member with a broken address loses their own access, which password reset already handles; an administrator with a broken address can leave the instance with nobody able to turn the setting back off through the interface.
- **A regular expression in the settings service.** Two definitions of "valid address" in one codebase is how the gate and the form end up disagreeing.

### Re-check the account at the verification step

The pending sign-in proves that a password was correct ten minutes ago, not that the account may be let in now. Before issuing the token, the verification step reloads the account and repeats the checks the first step made: the account exists, it is active (`user_services.go:162-166`), and its `PasswordCreationTime` still matches the value recorded when the pending sign-in was created. It also re-reads the setting, so a pending sign-in started while the second factor was on still completes after an operator has switched it off.

The password timestamp matters because `GenerateAccessToken` embeds it (`user_services.go:265-273`) and the change of a password is what invalidates issued tokens. Without the check, an owner who reacts to a stolen password by changing it would leave a ten-minute window in which the thief's pending sign-in still mints a valid token.

Alternative rejected: destroying every pending sign-in for an account whenever it is deactivated or its password changes. It spreads knowledge of the second factor into the deactivation and password paths; checking at the moment of use keeps it in one place and covers cases those paths do not know about.

### Cap issued codes, not only resends

A resend limit alone is bounded per pending sign-in, and nothing stops a caller from starting a new one. `SendResetPasswordCode` already meets the same problem with a count of recent rows for the account (`user_services.go:513-522`), and the second factor reuses that shape: five codes an hour per account, counted over the pending sign-in rows the instance still holds, refused before any mail is sent.

That count is the only hourly ceiling in the feature. The resend keeps a throttle of one a minute and no hourly number of its own, because a resend issues a code like every other path and is already counted. Two numbers for one quantity would eventually disagree, and the one a reader checks would not be the one enforced.

This bounds an annoyance rather than an attack, because a code is only issued after a correct password. What it protects is the mailbox of somebody whose password has leaked and the instance's SMTP quota. Two consequences follow, both settled below: the count is only as good as how long the rows survive, and an ordinary user must not spend the allowance by reloading a page.

Alternatives rejected:

- **Relying on the sign-in rate limiter** (ten attempts a minute per address, `user_controller.go:144-153`). It is scoped to protect password guessing and is far too generous for sending mail.
- **Counting through the scoped rate limiter instead of the rows.** Its counter lives in memory (`backend/internal/util/ratelimiter/global.go`, `backend/internal/util/cache/global.go`), so a restart would reset the ceiling with nothing to show for it, and the limiter is wired into controllers while the decision to send belongs to the service - a wrong password must never spend the allowance.

### The password step returns a pending sign-in that is already live

The pending identifier lives in the page, not in the address bar and not in storage, so a reload loses it and the user submits the password again. If every password step minted a code, five reloads would exhaust the hourly allowance of somebody who has done nothing wrong, and the instance would refuse to sign them in for the rest of the hour.

The password step therefore looks for a pending sign-in for that account that has not expired, has not been used, has not been destroyed by wrong guesses and was started with the password the account holds now, and returns it unchanged: same identifier, same code, no new message. The password condition matters because the verification step refuses a row whose password has changed: without it, an owner who changes a leaked password and signs in again would be handed the thief's pending sign-in, refused at the code step, sent back to the password step and handed it again until it expired.

The lookup, the hourly count and the insert run in one transaction that first locks the account's row in `users`. Two password steps arriving together would otherwise both find nothing live, both stay under the cap and both send a code. Somebody who never received the first message asks for a resend, which is throttled to one a minute and issues a code the cap counts.

A resend is the one thing that moves the identifier. Because the cap counts rows, a resent code is a new row, so the resend supersedes the pending sign-in it replaces: it issues the new row first, marks the previous one used once the message is on its way, and answers with the identifier of the new one. The caller keeps whichever identifier the instance handed it last, and a refused resend leaves it holding the code it already has.

Alternatives rejected:

- **Keeping the identifier in `sessionStorage`.** It survives a reload in one tab and nothing else - a second device or a closed tab is the same situation again - and it puts a sign-in secret where every script on the page can read it.
- **Minting a new code on every password step and raising the cap to absorb reloads.** The cap exists to bound how much mail one mailbox receives; raising it to make room for reloads gives up the thing being bounded.
- **Invalidating the live pending sign-in and sending a fresh code.** The same mail volume as minting, and it breaks the user who is at that moment typing the code from the first message.

### Claim an attempt before comparing the code

The verification step spends one of the five attempts with a conditional `UPDATE ... RETURNING` before it compares the code, and spends the code itself with a second conditional update that succeeds only while the row is still unused. Counting after the comparison would let a burst of simultaneous guesses all be compared before the counter reached five, and an unconditional "mark used" would let two requests carrying the same correct code both receive a token. A correct code spends an attempt as well, which changes nothing, because the row is spent with it.

### Refusals carry a code, not only a status

Every refusal from the sign-in, verification and resend endpoints carries a machine-readable `code` beside the message: `sign_in_code_incorrect`, `pending_sign_in_not_usable`, `sign_in_code_not_sent`, `too_many_sign_in_codes`, `sign_in_code_resent_too_soon`, and `rate_limit_exceeded` from the shared limiter. The status alone does not identify the cause: a wrong code and a failed Turnstile challenge are both 400, and a resend inside its minute and an exhausted hourly cap are both 429 but ask the user to wait a minute and an hour respectively. The interface translates them through `translateApiError`, so the password step shows the same translated text as the code step, and it leaves the code step only on `pending_sign_in_not_usable`.

### Delete a pending sign-in an hour after it was created, not when its code expires

The pending sign-in table has two readers that want different lifetimes. The verification step needs a row while its code is usable, which is ten minutes. The hourly cap needs to count the rows an account collected over the last hour. Deleting a row when its code expires would empty that window six times over and leave the cap counting almost nothing, so the sixth, seventh and eighth code of an hour would all be sent.

The sweep therefore deletes a pending sign-in an hour after `created_at`, whatever state it is in. A row older than that can neither produce a token nor change a count, so nothing observable depends on it.

`password_reset_codes` shows what happens with no sweep at all: `DeleteExpiredCodes` (`password_reset_repository.go:43-47`) was written for exactly this and is called from nowhere, so the table has only ever grown. One background task registered with the others (`cmd/main.go:137`, `:345`) sweeps both tables on an interval. Reset codes expire after an hour and their own cap counts the same hour, so for them expiry and retention already coincide and `DeleteExpiredCodes` is adopted as it stands.

Alternatives rejected:

- **Deleting a pending sign-in as soon as its code expires.** It reads as the tidy choice and silently removes the hourly cap, which is the security property, not a housekeeping detail.
- **Deleting the pending sign-in inline at the moment it expires.** Nothing reads an expired row on its own, so nothing would trigger the deletion for the rows that matter - the ones nobody ever comes back for.
- **Keeping every row and filtering by date at query time.** That is the `password_reset_codes` situation this change is fixing.

### The new endpoints inherit the protections sign-in already has

`POST /users/signin` and `POST /users/send-reset-password-code` both verify Cloudflare Turnstile when it is enabled (`user_controller.go:122-142`, `:414-434`) and both pass through the scoped rate limiter. The verification and resend endpoints do the same: resend sends mail, and verification submits a guess. Leaving them unguarded would make the second step the softest part of the sign-in path.

Both requests name the pending sign-in by the identifier the instance returned last, from the password step or from a resend, and carry no email address. The limiter keys on the account the server resolves from the row, not on a value the caller supplies, so a stranger cannot spend another account's resend allowance by naming its address.

Alternative rejected: carrying the Turnstile result from the first step over to the second. The pending sign-in identifier already proves the first step happened, but a challenge answered once would then cover every later request that quotes the identifier, which is the thing the challenge is there to prevent.

### Move the audit trail to the point where access is actually granted

The "User signed in" audit entry (`user_services.go:191-195`) moves to the verification step, so the log records a completed sign-in rather than a correct password. A pending sign-in destroyed by five wrong codes gets its own entry, because that is the shape of an attack worth seeing in the log. The console command that switches the setting off writes one too: a security switch that can be moved from the host without a trace is a hole in the same log. All three are asserted through the recording audit writer the controller tests install (`backend/internal/features/users/testing/audit_log_utils.go:61-73`).

Alternative rejected: keeping the existing entry where it is and adding a second one for verification. The log would then show a sign-in for every attempt that never completed, which is exactly the signal the second factor is supposed to make visible.

### One flag, named for what people search for

The console command is `--disable-2fa`, parsed beside `--test-storage`, `--list-admins`, `--new-password` and `--email` in `backend/cmd/main.go:151-168` and dispatched from the same startup point as the password reset (`main.go:111`), after the database is ready. It flips the global setting off, reports whether anything changed, and exits. Like the password reset, it installs the audit-log dependencies first (`main.go:204`), so the switch it moves is recorded.

The name carries a digit, which the repository's other flags do not. That is deliberate: it is the term an owner in trouble will type and search for, and the alternative `--disable-two-factor-auth` optimizes for internal consistency at the expense of the person who needs it most.

Alternative rejected: an authenticated endpoint. The caller who needs this cannot sign in, which is the whole reason the command exists.

### The frontend stops trusting every sign-in response to carry a token

`userApi.signIn` currently saves the token and notifies listeners inside the call (`frontend/src/entity/users/api/userApi.ts:46-58`). It changes to return a result the caller discriminates: either a completed sign-in or a pending one carrying its identifier. Only the completed shape stores a token. The verification call stores the token on success.

`AuthPageComponent` gains a fifth authentication mode beside `signIn`, `signUp`, `requestReset` and `resetPassword` (`frontend/src/pages/AuthPageComponent.tsx:20-22`), holding the pending identifier and the address to display, and replacing the identifier with the one a resend hands back. The code-entry screen follows `ResetPasswordComponent` (`frontend/src/features/users/ui/ResetPasswordComponent.tsx`), which already validates a six-digit code, plus a resend control.

Alternative rejected: a separate route for the code step. The authentication screen is already a mode machine on one route, and a route would have to defend the pending identifier against a reload and a direct visit for no gain.

### Linking the toggle to the SMTP documentation

`WEBSITE_PAGES` (`frontend/src/shared/i18n/websitePages.ts`) gains an entry for the configuration page with the anchor `email-smtp`, which is the heading id the page already publishes (`website/app/(en)/advanced-config/page.tsx:237`). The path `advanced-config` is in `TRANSLATED_PATHS` (`website/app/i18n.ts:45`), so the entry is marked as translated and the link follows the interface language. `websitePages.test.ts` keeps the two lists in sync.

## Risks / Trade-offs

- **Fail-closed plus a dead mail server locks out the whole instance.** → This is the accepted cost of not letting a broken mail server silently downgrade authentication. `--disable-2fa` is the way back in, it ships in the same change, and it is documented on the same page as password recovery precisely because that is where a locked-out owner looks.
- **Whoever controls the instance's environment can remove the SMTP variables and then disable the second factor from the console.** → Both actions require shell access to the running container, which already grants control of the database and every stored credential. The second factor defends against a stolen password, not against an attacker who is already inside the host.
- **External identity providers bypass the second factor.** → Recorded in the specs as a deliberate exception rather than left implicit, and the interface copy must not claim coverage it does not have. An instance that wants the second factor to be total does not configure Google or GitHub sign-in.
- **Mail latency eats the ten-minute window.** → The window is measured from issuance, the resend is available after a minute, and a resend invalidates the previous code so a late-arriving message cannot be used afterwards.
- **A slow SMTP server makes the sign-in request slow.** The send is synchronous, because the response has to tell the user whether the code is coming. The sender's timeout is five seconds (`backend/internal/features/email/email.go:15`), which bounds it.
- **The ten-year token is untouched.** → Stated in the proposal's out-of-scope list rather than glossed over: a token stolen after a successful two-step sign-in is as durable as before.
- **Turning the setting on guards the next sign-in and ends nothing already running.** → Tokens issued before the switch keep working for their full ten years (`user_services.go:265-272`), so an owner reacting to a leaked password has to change that password, which is what invalidates them. The settings screen and the documentation say this, because a security switch that implies more than it does is worse than none.
- **Every signed-in user can read the settings response.** → `GET /users/settings` is open to any authenticated caller (`settings_controller.go:19`), because members read `isMemberAllowedToCreateWorkspaces` from it, so the new switch and the mail-server answer are visible to members as well as administrators. Neither is a secret: a member learns whether the second factor is on by signing in once.
- **The gate is checked when the setting is turned on, not afterwards.** -> Nothing re-checks it when an administrator is later appointed or SMTP is removed from the environment. An appointed administrator holds a validated address by construction, and a mail server that disappears is the fail-closed case `--disable-2fa` answers. Re-validating on every sign-in would make each sign-in depend on scanning the administrator list for no gain over failing closed.
- **The change edits documentation created by `replace-seeded-admin-with-first-signup`.** → The task list applies it after that change is in place, and the tasks say which existing section each edit extends.

## Migration Plan

One migration, with both directions as the repository requires: the up step adds the settings column with a `false` default and creates the pending-code table, with the foreign key and the lookup index as separate statements and `ON DELETE CASCADE` on the user reference, so deleting an account takes its pending sign-ins with it. The down step drops the table and the column. Since the default is off, deploying the change alters nothing about how anyone signs in until an administrator turns it on. Rolling the binary back with the setting off is uneventful; rolling it back with the setting on leaves a column the old code ignores, so sign-in silently reverts to one factor - worth stating in the completion notes, because it means a rollback is also an unannounced security downgrade.
