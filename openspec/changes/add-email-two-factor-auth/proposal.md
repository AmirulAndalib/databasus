## Why

Databasus signs a user in with an email address and a password, and hands back a token that stays valid for ten years (`backend/internal/features/users/services/user_services.go:269`). A leaked or guessed password is therefore full, durable access to every database credential, storage key and backup the instance manages. For a tool whose whole purpose is holding the keys to someone's production data, a single factor is thin.

The pieces for an email second factor are already in the codebase and proven by the password-reset flow: six-digit codes from `crypto/rand`, hashed and single-use with an expiry (`user_services.go:572-607`), an SMTP sender that reports whether it is configured (`backend/internal/features/email/di.go`), and a scoped rate limiter (`user_controller.go:449`). What is missing is the second step at sign-in and an administrator switch to turn it on.

## Depends on

`replace-seeded-admin-with-first-signup`. That change makes the administrator of a new instance the first account registered on it, so it holds a real address from the start, records which account that is, and lets an upgraded instance move off the placeholder login `admin`. Without it, the most privileged account on a fresh install has that literal string in its address column and no mailbox, so a second factor could only be enforced by locking that account out.

## Governing docs

This change answers to [`AGENTS.md`](../../../AGENTS.md) at the repo root, [`backend/AGENTS.md`](../../../backend/AGENTS.md), [`frontend/AGENTS.md`](../../../frontend/AGENTS.md), [`website/AGENTS.md`](../../../website/AGENTS.md) and [`assets/readme/AGENTS.md`](../../../assets/readme/AGENTS.md). No verification agent code changes, so [`agent/verification/AGENTS.md`](../../../agent/verification/AGENTS.md) does not apply.

## What Changes

- Add a global setting, off by default, that requires a second factor for password sign-in. It sits on the existing settings screen, below the other authentication settings, and only an administrator can change it.
- Refuse to turn the setting on unless the instance can actually deliver the codes: SMTP must be configured, and every active administrator must hold a real email address. The refusal names what is missing, and the settings screen links to the SMTP section of the published configuration documentation.
- Let the settings screen ask the backend whether mail is configured, instead of reading the build-time flag `IS_EMAIL_CONFIGURED`. The flag is generated from `SMTP_HOST` and `DATABASUS_URL` (`docker/start.sh:138-144`), while the backend treats mail as configured when `SMTP_HOST` and `SMTP_PORT` are set (`backend/internal/features/email/di.go:13-22`). Those two answers disagree in both directions, so a toggle driven by the flag would be greyed out on an instance the backend would accept, or offered on one it refuses.
- **BREAKING** change to the sign-in contract: `POST /users/signin` no longer always returns a token. When the setting is on and the password is correct, it returns a challenge identifier instead, and the token comes from a second call that carries the identifier and the emailed code. Callers that assumed a token in every successful response must handle both shapes. No compatibility shim is kept.
- Send a six-digit code to the account's address after the password is verified, never before, so a wrong password neither sends mail nor reveals whether the account exists.
- Expire a code ten minutes after it is issued, burn it after five wrong attempts, and accept it once. Offer a resend, limited to one per minute and five per hour for the same address.
- Cap issued codes at five per hour per address, counting every code the account receives rather than only the resends. Without that cap, repeating the first step with a correct password mints a fresh pending sign-in each time, and the sign-in limiter of ten attempts a minute (`backend/internal/features/users/controllers/user_controller.go:148`) leaves room for hundreds of messages an hour into one mailbox.
- Check at the verification step that the account may still be let in: it exists, it is still active, its password has not changed since the pending sign-in was created, and the second factor is still on. A pending sign-in otherwise survives a deactivation for ten minutes and then issues a token.
- Guard the verification and resend endpoints with the same Cloudflare Turnstile check that already guards password sign-in and the reset-code request (`user_controller.go:124-143`, `:427-447`), since the resend sends mail.
- Delete pending sign-in codes once they expire, through a background sweep. The same sweep takes over `DeleteExpiredCodes` (`backend/internal/features/users/repositories/password_reset_repository.go:43-47`), which exists for password reset codes and is called from nowhere, so that table has been growing without bound since it was introduced.
- **Fail closed**: if the code cannot be sent, the sign-in fails with an explicit "could not send the code" response rather than letting the caller in. This means a broken SMTP server locks everybody out, which is why the next item exists.
- Fix the settings audit trail the new switch joins. `UpdateSettings` builds its message after assigning the new value (`backend/internal/features/users/services/settings_service.go:42-64`), so both existing switches log `false -> false` instead of the transition, and the third switch logs nothing at all (`:66-68`). Copying that shape for a security switch would hide who turned the second factor on and off, so the existing messages are corrected and the missing one added.
- Add a console escape hatch: `docker exec -it databasus ./main --disable-2fa` turns the global setting off, so an owner whose mail server has died can get back in without editing the database by hand.
- Leave sign-in through Google and GitHub unchanged. Those providers run their own multi-factor checks, and adding a second email code on top of them buys little. This is a deliberate gap and the specs record it as one.
- Document the feature where the product's security story already lives: the root `README.md` security section, the website's security page, and the security answer of the website's home-page FAQ. Document `--disable-2fa` on the website password page and in the FAQ entry that `replace-seeded-admin-with-first-signup` introduces. Each of those exists in six languages and is updated in all of them.

### Out of scope

- Authenticator apps, hardware keys and recovery codes. Email is the only channel here, and it is the only one the instance already has.
- Per-user opt-in. The setting is global, matching the other authentication settings on the same screen.
- Trusting a device so the code is asked for less often. Every password sign-in asks.
- Shortening the ten-year token lifetime, or revoking issued tokens. A second factor guards the door; the lifetime of what is handed out on the way through is a separate problem and this change does not touch it.
- Requiring a code during sign-up, including sign-up from an invitation. Registration issues a token directly (`backend/internal/features/users/controllers/user_controller.go:95-103`), and for an ordinary registration that token opens a brand-new member account with no access to anything. The one registration that creates an administrator is the first one on an empty instance, where the second factor cannot be on, because no administrator has existed to turn it on. The invitation branch is weaker than that: it sets a password on a row an administrator created earlier (`user_services.go:68-101`), so whoever knows an invited address can complete that sign-up without a code and inherit whatever the invitation carried. That is a hole in the invitation flow rather than in the second factor - it needs no password today either - and closing it means giving invitations a secret, which is its own change. Recorded here as an accepted gap so the change that gives invitations a token knows the second factor depends on it.
- Reconciling the three definitions of "email is configured". The backend (`email/di.go:13-22`), the container entrypoint that generates the frontend flag (`docker/start.sh:138-144`) and the published configuration page (`website/app/(en)/advanced-config/page.tsx:239-248`) each state a different rule, and `DATABASUS_URL` only ever adds a link to an invitation message (`workspaces/services/membership_service.go:371-376`). This change stops the second factor from depending on the disagreement by asking the backend, and leaves the disagreement itself, which also drives the sign-in screen's forgot-password link, to a change that can walk every consumer.
- Requiring a code on top of the password-reset flow. That flow already proves control of the mailbox, which is the same evidence the second factor asks for.
- Verifying that an administrator's stored address receives mail before the setting is switched on. The setting checks that the address is a real address and that SMTP is configured; delivery is proven the first time a code is sent.

## Capabilities

### New Capabilities

- `two-factor-authentication`: the global second-factor setting, its preconditions, the two-step sign-in it produces, and the console command that disables it.

### Modified Capabilities

None. `root-admin-account` is introduced by `replace-seeded-admin-with-first-signup` and reaches `openspec/specs/` only when that change is archived, so there is nothing here to delta against. The behavior that touches it - the bootstrap administrator being subject to the second factor like any other account, and the console escape hatch when mail delivery dies - is second-factor behavior and belongs to the new capability.

## Impact

- **Database**: a new column on the global settings row, and a new table holding pending sign-in codes.
- **Backend**: the sign-in service and controller, the settings service, its validation and its response, the email sender's configured-state check, the rate limiter, the background task list, and a new command-line flag in `backend/cmd/main.go`.
- **Test support**: `MockEmailSender` (`backend/internal/features/users/testing/mocks.go`) gains the configured-state answer with a settable value, and the recording audit-log writer that `replace-seeded-admin-with-first-signup` adds to `users/testing` is what the moved sign-in entry is asserted against.
- **API**: `POST /users/signin` gains a second response shape; two new endpoints verify a code and request a resend. The generated API documentation changes with them.
- **Frontend**: the authentication screen gains a code-entry step between the sign-in form and the application, the settings screen gains the toggle, the client stops storing a token from every sign-in response, and six interface dictionaries gain the new copy. The table of linked website pages gains the configuration page so the toggle can link to its SMTP section.
- **Docs**: root `README.md` and its five translations; the website's security page, its home-page FAQ in both its visible and structured-data form, its password page, and the five translated copies of each.
