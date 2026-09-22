## Context

See proposal.md for the motivation and `specs/outgoing-email/spec.md` for the behavior contract. This section covers only the current code the approach has to work with.

Two copies of the SMTP code exist, and they have already drifted apart:

| | Instance sender (`backend/internal/features/email/email.go`) | Notification channel (`backend/internal/features/notifiers/models/email_notifier/model.go`) |
|---|---|---|
| Encryption | port 465 means TLS, otherwise STARTTLS only if advertised (`:137-170`) | same rule (`:220-275`) |
| Greeting | literal `localhost` (`:152`); the TLS path sends none, so the standard library greets as `localhost` too | `os.Hostname()` (`:124-134`), which in a container is its ID |
| Authentication | PLAIN, then a second connection with LOGIN (`:172-206`) | same (`:277-312`) |
| LOGIN prompts | also accepts `User Name\x00` and `Password\x00`, and answers any other prompt with the username (`:246-258`) | answers only `Username:` and `Password:` (`auth.go:17-27`) |
| Headers | hand-assembled, no `Message-ID`, `MIME-version: 1.0;` (`:61-80`) | the same, plus `Message-ID` on the SMTP host's domain and CR/LF stripping (`:146-180`) |
| Time limit | 5 s to open the connection, nothing after (`:121`, `:139`) | same |

Two facts correct what the table might suggest. Go's DATA writer turns every bare LF into CRLF on the wire (`net/textproto`, `dotWriter.Write`), so the LF-only line endings in the header builders never reach the server. The standard library's Q-encoding also encodes any control character, so an invitation subject built from a workspace name (`backend/internal/features/workspaces/services/membership_service.go:107`) cannot add a header today. The injection requirement in the spec pins that property for the shared code; it is not fixing a live hole.

The live hole is authentication, explained in proposal.md. `smtp.PlainAuth` refuses to run over an unencrypted connection to anything but localhost. The LOGIN fallback has no such check (`email.go:242-244`), and the two-connection retry that reaches it means one wrong password also costs two failed logins.

Other code this change touches:

- The instance sender is a singleton built from the environment. It counts as configured when `SMTP_HOST` and `SMTP_PORT` are both set (`backend/internal/features/email/di.go:13-22`). `backend/internal/config/config.go:158-161` already refuses to start with a host and no port. The container entrypoint derives the frontend's `IS_EMAIL_CONFIGURED` from `SMTP_HOST` and `DATABASUS_URL` (`docker/start.sh:144-149`), and the sign-in screen shows the password reset link only when that flag is set (`frontend/src/features/users/ui/SignInComponent.tsx:178`).
- The users feature sees the sender through `EmailSender{IsConfigured; SendEmail(to, subject, body)}` (`backend/internal/features/users/interfaces/interfaces.go:13-18`). The workspaces feature sees only `SendEmail` (`backend/internal/features/workspaces/interfaces/interfaces.go:10`). Neither passes a context.
- `SettingsService` already holds the sender and answers `IsEmailConfigured()` (`backend/internal/features/users/services/settings_service.go:52-54`). It also has a validator that decides whether an administrator's address is usable (`:20`, `:187`).
- The only rate-limit helper that answers 429 is a method on `UserController` (`backend/internal/features/users/controllers/user_controller.go:426-443`). `SettingsController` has no limiter (`backend/internal/features/users/controllers/di.go:15-17`).
- The frontend API helper turns every 502 and 504 into a generic "request failed" and drops the body (`frontend/src/shared/api/apiHelper.ts:18-19`). Other error statuses keep the backend's `error` text, and `translateApiError` shows it when the response carries no known `code` (`frontend/src/shared/i18n/translateApiError.ts:22-34`).
- A failed notification is logged and stored as the channel's `LastSendError`, which the channel shows in the interface (`backend/internal/features/notifiers/service.go:310-325`).
- The backend tests deliver notification mail to a Mailpit container that accepts any login over an unencrypted connection (`backend/internal/util/testing/containers/mailpit.go:31-34`). No compose file runs a Mailpit: the `test-mailpit` host in `.env.example`, which CI copies to `.env` (`.github/workflows/ci-release.yml:285`), resolves to nothing, so instance mail in tests that keep the real sender fails at the lookup and is only logged.
- The password reset request returns any service error to the caller as `error` (`backend/internal/features/users/controllers/user_controller.go:391-394`), including a failed delivery (`user_services.go:590-592`), while an unknown address succeeds silently (`:511-514`). `Test_ResetPassword_EmailSendFailure_ReturnsError` pins today's 400. The change keeps that answer on purpose, as proposal.md explains, so the reworked transport errors reach the person who asked for the code.
- Password sign-in with the second factor on fails closed when the code cannot be sent (`backend/internal/features/users/services/two_factor_auth.go:246-255`).

The approach is constrained by [`backend/AGENTS.md`](../../../backend/AGENTS.md): positional DI, sentinel errors in `errors.go`, migrations with separate constraint statements, controller tests over unit tests, and the logging rules that forbid secrets and route emails through central redaction. [`frontend/AGENTS.md`](../../../frontend/AGENTS.md) adds the dictionary rule, enum label tables and progressive disclosure in forms. [`website/AGENTS.md`](../../../website/AGENTS.md) adds the six-language sync rule with identical heading anchors. The root [`AGENTS.md`](../../../AGENTS.md) forbids keeping the old encryption behavior as a compatibility mode.

## Goals / Non-Goals

**Goals:**

- One implementation of the SMTP conversation, with no environment or database access, so it can be tested against fake servers.
- Instance mail and notification channels differ only in where their settings come from.
- A test message that surfaces the mail server's own words when delivery fails.

**Non-Goals:**

- Changing the `Send` signature every notifier backend implements. The email channel supplies its own deadline internally.
- A queue or retry for instance mail. A delivery is still one synchronous attempt.

## Decisions

### The shared transport is a pure package under `internal/util/smtp_transport`

The package exposes `Send(ctx, Connection, Message) error`. `Connection` holds host, port, security mode, username, password, greeting name and the certificate-verification switch. `Message` holds the sender, the recipient, the subject and the HTML body. The package also owns the rules both callers share: `GetDefaultSecurityForPort`, `ParseSender` (a bare address or a display name with an address, with the `Databasus` default name), `ResolveSender(from, username, host)`, `ValidateHeloName` and `GetDefaultHeloName(databasusURL)`. It reads no environment variables and no database.

`features/email` builds a `Connection` from the environment once, answers `IsConfigured()` and sends through the transport. The notification model builds a `Connection` from its row and decrypted password and keeps only validation, encryption and its message text. The notification model reads `DATABASUS_URL` through `config.GetEnv()` for the default greeting name, as `backend/internal/features/storages/models/local/model.go` already reads the environment from a model.

Alternatives rejected:

- **Keep the code in `features/email` and have the notification model import it.** One feature's model would depend on another feature's package, and that package also carries the environment singleton the model has no business touching.
- **Adopt a third-party mail library.** It would solve message building and TLS policy, but the user asked for the code to stay in the repository, and it adds a dependency for about 300 lines whose behavior the tests must pin either way.
- **Name the package `smtp` or `email`.** `smtp` shadows `net/smtp` inside the package. `email` collides with `features/email` in the one file that imports both.

### An explicit security mode replaces the port rule and optional STARTTLS

`Security` is a string enum with the values `tls`, `starttls` and `none`. It lives in the transport's `enums.go`. `starttls` checks the server's EHLO answer and fails with `ErrStartTLSNotOffered` before any other command when the upgrade is not offered. `none` never attempts an upgrade. The certificate-verification switch applies to `tls` and `starttls` only.

Alternatives rejected:

- **Keep optional STARTTLS, or add it as a fourth `opportunistic` mode for migrated channels.** Either keeps the downgrade hole, and the root `AGENTS.md` rules out keeping the old behavior as a compatibility layer.
- **A boolean `SMTP_TLS`.** It cannot tell a server that expects encryption from the first byte apart from one that expects an upgrade.
- **Keep the port rule and only make STARTTLS mandatory.** TLS on a port other than 465 and a deliberately unencrypted relay would still have no way to be expressed.

### Authentication is chosen from the server's offer, and both mechanisms check the connection

After the connection is established and, where the mode requires it, upgraded, the transport reads the `AUTH` mechanisms from EHLO. It uses PLAIN when offered, then LOGIN, and fails with a clear error when credentials are configured but neither is offered. Both mechanisms are implemented in the package, and both refuse to start unless the connection is encrypted or the mode is `none`. When `starttls` fails because the upgrade is not offered, the transport closes the socket without sending `QUIT`, so the server sees nothing after `EHLO`. The LOGIN prompt match accepts the union of both current prompt sets, compared without regard to case. Any other prompt ends the attempt with an error rather than a guessed answer.

Alternatives rejected:

- **Keep PLAIN, then reconnect and try LOGIN.** It needs a second connection, and a wrong password becomes two failed logins, which brings account lockouts at some providers closer.
- **Use `smtp.PlainAuth` from the standard library.** It permits unencrypted PLAIN to localhost regardless of the chosen mode and rejects it everywhere else even when the operator chose `none`. The mode, not the host name, has to decide.

### One deadline covers the whole conversation

`Send` derives a context with a 30-second timeout from the caller's context, dials with it and sets the same deadline on the connection. A caller with a shorter deadline wins. The notification channel passes `context.Background()`, because its `Send` has no context.

Alternatives rejected:

- **A `SMTP_TIMEOUT` variable.** No one has asked for it, and the proposal lists it as out of scope.
- **Keep the dial timeout only.** A server that stops answering after the greeting holds the invitation request, or a sign-in waiting for its code, indefinitely.

### Messages are built from parsed addresses, not from strings

`From` and `To` are formatted with `net/mail.Address`, which encodes a non-ASCII display name. The subject has CR, LF and NUL removed and is Q-encoded. `Message-ID` is `<uuid@domain of the sender address>`. The body is sent as `text/html; charset="UTF-8"` with quoted-printable transfer encoding. The recipient is parsed with `net/mail.ParseAddress` and rejected if it carries anything but an address. The notification model applies the same parse to `TargetEmail` in `Validate`, so a bad recipient is refused on save rather than at the next backup event.

Alternatives rejected:

- **Keep `sanitizeHeaderValue` over hand-built header strings.** It works, but only for headers whose author remembers to call it.
- **`Message-ID` on the SMTP host's domain, as the channel does today.** It leaks the internal relay's name into every message and has nothing to do with the sender.
- **8-bit body without a transfer encoding.** HTML templates can hold lines longer than the 998 characters SMTP allows, and some servers would reject or break them.

### "Configured" means `SMTP_HOST` is set, and the entrypoint agrees

`features/email` computes `IsConfigured()` as `SMTPHost != ""`. The startup check guarantees a port whenever a host is set. `docker/start.sh` drops `DATABASUS_URL` from its condition, so the sign-in screen's reset link follows the same rule. The settings screen keeps reading `isEmailConfigured` from `GET /users/settings`, which already carries it.

Alternatives rejected:

- **Keep `DATABASUS_URL` in the rule.** It only adds a link to invitations. Requiring it hides password reset on instances that can send the reset code perfectly well.
- **Let the sign-in screen ask the backend.** Anyone who is not signed in would need a public endpoint that answers the question, and the build-time flag already answers it correctly once the entrypoint uses the right condition.

### `SMTP_FROM` accepts a display name instead of a new `SMTP_FROM_NAME`

`ParseSender` accepts `noreply@example.com` or `Acme Backups <noreply@example.com>`. An unreadable `SMTP_FROM` stops startup, next to the existing port check. The channel's `from` field goes through the same parser in `Validate`.

`ResolveSender` applies the fallback order both callers share. An explicit sender is parsed and its error returned. Without one, the username is used only when it parses as a bare address; otherwise the sender is `noreply@` and the host. Relays such as SendGrid (`apikey`) and SES (an access key ID) log in with a username that is not an address, and today that username becomes the envelope sender and every message is refused.

`SMTP_HELO_NAME` and the channel's `heloName` go through `ValidateHeloName`: a host name of letters, digits, hyphens and dots, or an address literal in brackets (`[192.0.2.1]`, `[IPv6:2001:db8::1]`). An invalid `SMTP_HELO_NAME` stops startup; an invalid channel value is refused on save.

Alternatives rejected:

- **A separate `SMTP_FROM_NAME` variable and a `from_name` column.** That gives two ways to set a name, which then need a precedence rule. A `SMTP_FROM` already written with a display name, which fails at every send today, would still fail.
- **Refuse any display name in `SMTP_FROM`.** It would turn setups that are broken today into instances that refuse to start, when accepting the form repairs them instead.
- **Refuse at startup a username that is not an address when `SMTP_FROM` is unset.** It would stop instances whose relay accepts `noreply@host` as the sender.

### The test message is a settings action for administrators

`POST /users/settings/test-email` is registered in `SettingsController` behind `RequireRole(UserRoleAdmin)`. It is limited to five attempts per administrator per ten minutes, with the scope `test_email` and the user ID as identifier. `SettingsService.SendTestEmail(ctx, admin)` returns `ErrEmailNotConfigured` when the sender is not configured and `ErrAdminEmailMissing` when the address fails the validator the service already uses or `net/mail.ParseAddress`. Checking both keeps an address the transport would reject from surfacing as a delivery error instead of the refusal. Otherwise it sends and writes one audit entry with the outcome, whatever stage the failure happened at: `Test email sent to <address>` or `Test email to <address> failed`.

The controller answers 200 with `{"recipientEmail": ...}` on success. The two refusals get 400 with the codes `email_not_configured` and `admin_email_missing`, and the frontend translates them. A delivery failure gets 400 with the transport's error as `error` and no code, so `translateApiError` shows the mail server's response.

The rate-limit helper becomes a package-level function in `users/controllers`, which both controllers call. `SettingsController` gains the counter and a logger through positional DI.

The frontend calls the endpoint with `fetchPostJson` and its default `isRetryOnError = false`. With retries on, `apiHelper` repeats a failed request up to 30 times (`frontend/src/shared/api/apiHelper.ts:6-7`), which would send a message per repeat and burn the rate limit.

Alternatives rejected:

- **502 for a delivery failure.** It is the honest status for a failing upstream, but `apiHelper.ts:18-19` replaces its body with a generic message, and the server's response is the reason the button exists.
- **A recipient field.** It would let the instance mail any address. Proving that the server delivers only needs the administrator's own mailbox.
- **Send through the unconfigured path and let it skip silently.** Then a test on an unconfigured instance would report success, which is the exact confusion this change removes.

### The notification channel gains two columns with a port-based backfill

The migration adds `security VARCHAR(16) NOT NULL DEFAULT 'starttls'`, sets `tls` where `smtp_port = 465`, drops the default and adds a `CHECK` constraint in its own statement. It adds `helo_name VARCHAR(255) NOT NULL DEFAULT ''`.

A request may omit `security`. For a channel without a stored row, whether it is being created or sent a test notification before its first save (`backend/internal/features/notifiers/service.go:95-100` and the unsaved branch of `SendTestNotificationToNotifier`), the service calls a `FillDefaults` step that sets an empty mode from `GetDefaultSecurityForPort` before `Validate`. `Validate` itself stays free of side effects. On update, `Update` keeps the stored mode when the incoming one is empty, as it already keeps the stored password; a non-empty mode replaces it. `Validate` then requires a known mode, so an explicit unknown value is refused. `Update` copies `HeloName` unconditionally, since an empty greeting name is a valid choice.

In the form, the security select and the greeting-name input join the existing advanced section. The section opens by itself when either field differs from its default. When the port changes, the form replaces the security mode with the new port's default only if the current mode equals the previous port's default. A mode that differs, whether picked in this session or stored earlier, is left alone. The rule holds for new and existing channels alike and needs no record of what the user touched. The proposal comes from the same port rule as the backend, kept in `entity/notifiers`.

Alternatives rejected:

- **Backfill every row with `none`.** It would quietly send every existing channel's credentials in cleartext.
- **Keep the port rule on the server when `security` is empty.** Channels would have two sources of truth, and a stored row would not say what it actually does. Filling the mode once on create keeps the row explicit.
- **Require `security` in every request.** Every existing API client that creates an email channel would start getting 400.
- **Propose a mode only until the user picks one in the current editing session.** Changing only the port of a channel stored with `none` would silently switch it to `starttls`.

## Risks / Trade-offs

- **A relay without STARTTLS on a port other than 465 stops receiving mail after the upgrade.** → The proposal marks it BREAKING. The documentation tells the operator to use `none`. A notification channel shows the failure as its last send error, and the instance mail server shows it through the new test button.
- **With the second factor on, the same relay locks everyone out of password sign-in, including the administrator who would press the test button.** → The documentation warns to set `SMTP_SECURITY` before upgrading when the second factor is on, and names the existing console command that switches it off. OAuth sign-in is unaffected.
- **The default greeting name comes from `DATABASUS_URL`, which may hold an IP address or a port.** → Only the host part is used. An IP address is sent as an address literal in brackets, as the SMTP standard requires.
- **Choosing PLAIN because it is offered can fail on a server that offers PLAIN but accepts only LOGIN.** → Such a server is rare, and the error names the mechanism that failed. Retrying across mechanisms is what doubled the failed logins, so it is not reinstated.
- **A sign-in waiting for its second-factor code can now wait up to 30 seconds and then fail.** → Before this change it could wait indefinitely. The two-factor flow already fails closed when a code cannot be sent.
- **An `SMTP_FROM` that cannot be read as an address now stops startup.** → Such a value could never have delivered mail. The log line names the variable, as the port check does.

## Migration Plan

1. The migration runs on startup and backfills `security` from the stored port. Its `down` drops both columns and the constraint.
2. Operators on a relay without STARTTLS set `SMTP_SECURITY=none`, or pick `none` in the channel's advanced settings.
3. Rolling back the code restores optional STARTTLS for instance mail. An older version ignores `SMTP_SECURITY` and `SMTP_HELO_NAME`, so nothing has to be removed from the environment.
