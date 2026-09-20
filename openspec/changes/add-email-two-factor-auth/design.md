## Context

See proposal.md - Why for the motivation, and specs/two-factor-authentication/spec.md for the behavior contract. What shapes the approach is which parts already exist and two traps: one in the existing mail sender, one in what the frontend believes about it.

The password-reset flow is the working precedent for everything the code needs to do. `SendResetPasswordCode` (`backend/internal/features/users/services/user_services.go:545-660`) draws six digits from `crypto/rand`, stores them hashed with an expiry in `password_reset_codes` (`backend/internal/features/users/models/password_reset_code.go`), mails them, and validates them through `IsValid()`. Its controller guards the send with the scoped rate limiter, three attempts an hour per address (`backend/internal/features/users/controllers/user_controller.go:449-467`).

Sign-in today verifies the password and immediately issues a ten-year token (`user_services.go:180-200`), and the frontend stores whatever token comes back inside the API call itself (`frontend/src/entity/users/api/userApi.ts:48-60`). The global settings row already carries three authentication switches (`backend/internal/features/users/models/users_settings.go`), rendered on the settings screen at `frontend/src/features/settings/ui/SettingsComponent.tsx`, and the frontend reads a runtime flag `IS_EMAIL_CONFIGURED` (`frontend/src/constants.ts:37-39`) to decide whether to offer password recovery on the sign-in screen (`SignInComponent.tsx:170`).

The trap: `SendEmail` returns `nil` when SMTP is not configured, after logging a warning and sending nothing (`backend/internal/features/email/email.go:32-36`). Anything that treats a `nil` return as "the code is on its way" would hand the user a code-entry screen for a code that was never sent. The fail-closed requirement therefore cannot rest on that return value alone; see the decision below.

A second trap sits next to it. `IS_EMAIL_CONFIGURED` is not the backend's opinion: the container entrypoint sets it from `SMTP_HOST` and `DATABASUS_URL` (`docker/start.sh:138-144`), the backend sets its own flag from `SMTP_HOST` and `SMTP_PORT` (`backend/internal/features/email/di.go:13-22`), and `DATABASUS_URL` only decides whether an invitation message carries a link (`workspaces/services/membership_service.go:371-376`). The two disagree in both directions, so the settings screen cannot use the frontend flag to predict what the gate will do.

Two things the tests need do not exist yet. `MockEmailSender` (`backend/internal/features/users/testing/mocks.go`) records sent messages but cannot report itself as unconfigured, and the audit entries the controller tests produce go into a writer with an empty body (`controllers/e2e_test.go:255-258`). `replace-seeded-admin-with-first-signup` replaces that writer with a recording one; this change adds the configured-state answer to the mail sender mock.

This change is constrained by [`backend/AGENTS.md`](../../../backend/AGENTS.md) for the migration and controller-test conventions, by [`frontend/AGENTS.md`](../../../frontend/AGENTS.md) for the dictionary rule that keeps every user-facing string out of components, and by [`website/AGENTS.md`](../../../website/AGENTS.md) and [`assets/readme/AGENTS.md`](../../../assets/readme/AGENTS.md) for the six-language documentation.

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

A new `two_factor_codes` table holds `user_id`, the hashed code, `expires_at`, `is_used`, a count of failed attempts and `created_at` - the reset-code shape plus the counter. The sign-in response carries the row's identifier, and the verify call is keyed on that identifier rather than on the address.

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
- **Fixing `docker/start.sh` so the frontend flag matches the backend rule.** The right end state, but that flag also decides whether the sign-in screen offers password recovery (`SignInComponent.tsx:170`) and whether other email features appear, and the published configuration page states the current rule as documentation (`website/app/(en)/advanced-config/page.tsx:239-248`). Correcting it changes screens this change does not touch and six languages of documentation, so it belongs to its own change; the proposal records it as out of scope.

### Gate the setting on real administrator addresses, using the same rule the API already enforces

Turning the setting on checks every active administrator's address with the same validation the profile update applies, so the settings gate and the profile form cannot disagree about what counts as an address. `UpdateUserInfoRequestDTO` binds `omitempty,email` (`backend/internal/features/users/dto/dto.go:42`), so the rule comes from the binding validator and the gate calls it directly rather than reimplementing a pattern.

Alternatives rejected:

- **Checking only the recorded bootstrap administrator.** Any other administrator could equally be holding an unusable address, and the point of the gate is that no administrator is locked out.
- **Checking every user, not only administrators.** A member with a broken address loses their own access, which password reset already handles; an administrator with a broken address can leave the instance with nobody able to turn the setting back off through the interface.
- **A regular expression in the settings service.** Two definitions of "valid address" in one codebase is how the gate and the form end up disagreeing.

### Re-check the account at the verification step

The pending sign-in proves that a password was correct ten minutes ago, not that the account may be let in now. Before issuing the token, the verification step reloads the account and repeats the checks the first step made: the account exists, it is active (`user_services.go:168-178`), and its `PasswordCreationTime` still matches the value recorded when the pending sign-in was created. It also re-reads the setting, so a pending sign-in started while the second factor was on still completes after an operator has switched it off.

The password timestamp matters because `GenerateAccessToken` embeds it (`user_services.go:271-276`) and the change of a password is what invalidates issued tokens. Without the check, an owner who reacts to a stolen password by changing it would leave a ten-minute window in which the thief's pending sign-in still mints a valid token.

Alternative rejected: destroying every pending sign-in for an account whenever it is deactivated or its password changes. It spreads knowledge of the second factor into the deactivation and password paths; checking at the moment of use keeps it in one place and covers cases those paths do not know about.

### Cap issued codes, not only resends

A resend limit alone is bounded per pending sign-in, and nothing stops a caller from starting a new one. `SendResetPasswordCode` already meets the same problem with a count of recent rows for the account (`user_services.go:562-570`), and the second factor reuses that shape: five codes an hour per account, counted over the pending sign-in table, refused before any mail is sent. The resend limits sit inside that ceiling.

This bounds an annoyance rather than an attack, because a code is only issued after a correct password. What it protects is the mailbox of somebody whose password has leaked and the instance's SMTP quota.

Alternative rejected: relying on the sign-in rate limiter (ten attempts a minute per address, `user_controller.go:148`). It is scoped to protect password guessing and is far too generous for sending mail.

### Sweep expired codes instead of keeping them forever

The pending sign-in table is written on every sign-in and read once. Rows that have expired are of no use to anyone, and `password_reset_codes` shows what happens without a sweep: `DeleteExpiredCodes` (`password_reset_repository.go:43-47`) was written for exactly this and is called from nowhere, so the table has only ever grown.

One background task registered with the others (`cmd/main.go:317`) deletes expired rows from both tables on an interval. Adopting the reset codes in the same task costs one call and fixes a table that is already accumulating rows in every deployment.

Alternative rejected: deleting the pending sign-in inline when it expires. Nothing reads an expired row, so nothing would trigger the deletion for the rows that matter - the ones nobody ever comes back for.

### The new endpoints inherit the protections sign-in already has

`POST /users/signin` and `POST /users/send-reset-password-code` both verify Cloudflare Turnstile when it is enabled (`user_controller.go:124-143`, `:427-447`) and both pass through the scoped rate limiter. The verification and resend endpoints do the same: resend sends mail, and verification submits a guess. Leaving them unguarded would make the second step the softest part of the sign-in path.

Alternative rejected: carrying the Turnstile result from the first step over to the second. The pending sign-in identifier already proves the first step happened, but a challenge answered once would then cover every later request that quotes the identifier, which is the thing the challenge is there to prevent.

### Move the audit trail to the point where access is actually granted

The "User signed in" audit entry (`user_services.go:194-198`) moves to the verification step, so the log records a completed sign-in rather than a correct password. A pending sign-in destroyed by five wrong codes gets its own entry, because that is the shape of an attack worth seeing in the log. Both are asserted through the recording audit writer `replace-seeded-admin-with-first-signup` installs in the controller test routers.

Alternative rejected: keeping the existing entry where it is and adding a second one for verification. The log would then show a sign-in for every attempt that never completed, which is exactly the signal the second factor is supposed to make visible.

### One flag, named for what people search for

The console command is `--disable-2fa`, parsed beside `--test-storage`, `--new-password` and `--email` in `backend/cmd/main.go:154-166` and dispatched from the same startup point as the password reset (`main.go:115`), after the database is ready. It flips the global setting off, reports whether anything changed, and exits.

The name carries a digit, which the repository's other flags do not. That is deliberate: it is the term an owner in trouble will type and search for, and the alternative `--disable-two-factor-auth` optimizes for internal consistency at the expense of the person who needs it most.

Alternative rejected: an authenticated endpoint. The caller who needs this cannot sign in, which is the whole reason the command exists.

### The frontend stops trusting every sign-in response to carry a token

`userApi.signIn` currently saves the token and notifies listeners inside the call (`frontend/src/entity/users/api/userApi.ts:48-60`). It changes to return a result the caller discriminates: either a completed sign-in or a pending one carrying its identifier. Only the completed shape stores a token. The verification call stores the token on success.

`AuthPageComponent` gains a fourth authentication mode beside `signIn`, `signUp`, `requestReset` and `resetPassword` (`frontend/src/pages/AuthPageComponent.tsx:21`), holding the pending identifier and the address to display. The code-entry screen follows `ResetPasswordComponent` (`frontend/src/features/users/ui/ResetPasswordComponent.tsx`), which already validates a six-digit code, plus a resend control.

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
- **The gate is checked when the setting is turned on, not afterwards.** -> Nothing re-checks it when an administrator is later appointed or SMTP is removed from the environment. An appointed administrator holds a validated address by construction, and a mail server that disappears is the fail-closed case `--disable-2fa` answers. Re-validating on every sign-in would make each sign-in depend on scanning the administrator list for no gain over failing closed.
- **The change edits documentation created by `replace-seeded-admin-with-first-signup`.** → The task list applies it after that change is in place, and the tasks say which existing section each edit extends.

## Migration Plan

One migration, with both directions as the repository requires: the up step adds the settings column with a `false` default and creates the pending-code table, the down step drops both. Since the default is off, deploying the change alters nothing about how anyone signs in until an administrator turns it on. Rolling the binary back with the setting off is uneventful; rolling it back with the setting on leaves a column the old code ignores, so sign-in silently reverts to one factor - worth stating in the completion notes, because it means a rollback is also an unannounced security downgrade.
