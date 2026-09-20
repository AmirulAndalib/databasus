This change extends behavior and documentation introduced by `replace-seeded-admin-with-first-signup`. Apply it after that change is in the working tree, or the documentation tasks in sections 7 and 8 have nothing to extend and the recording audit-log writer the tests below assert against does not exist.

## 1. Storage and settings

- [ ] 1.1 Create the migration with `make migration-create` under `backend/`, adding the second-factor flag to the global settings row with a `false` default and creating the pending sign-in code table with its user reference, hashed code, expiry, used flag, failed-attempt count and creation time; follow the migration rules in `backend/AGENTS.md` (timestamps as `TIMESTAMPTZ`, the foreign key and the lookup index on the user reference as separate statements), and write the down step that drops the table and the column. Verify with `make migration-up` then `make migration-down` on a scratch database.
- [ ] 1.2 Add the settings field to the global settings model and carry it through the settings read and update paths; while adding the audit message for it, fix the two existing ones in `UpdateSettings` (`backend/internal/features/users/services/settings_service.go:42-64`), which format the value after assigning it and therefore report `false -> false`, and add the message `IsMemberAllowedToCreateWorkspaces` never writes (`:66-68`). Verify with a controller test that reads the setting, turns it on and reads back the new value, and with tests that assert through the recording audit writer that each of the four switches reports its old and new value once.
- [ ] 1.3 Add `IsConfigured() bool` to the mail sender and to the `EmailSender` interface the users feature depends on (`backend/internal/features/users/interfaces/interfaces.go:13-15`), exposing the flag already computed in `backend/internal/features/email/di.go:13-22`, and implement it in `MockEmailSender` (`backend/internal/features/users/testing/mocks.go`) from a field a test can set; verify with `make test` in `backend/` that the existing email and users suites still pass.
- [ ] 1.4 Carry the mail sender's own answer into the settings response so the settings screen stops predicting the gate from the build-time flag `IS_EMAIL_CONFIGURED`, whose rule differs (`docker/start.sh:138-144`); verify with a controller test that reads the settings with a configured and with an unconfigured mail sender and sees the field follow the sender.
- [ ] 1.5 Gate turning the setting on: refuse when mail is not configured, and refuse when any active administrator's address fails the same validation the profile update binds; verify with controller tests covering both refusals, the account named in the administrator refusal, the accepted case, and that a refusal leaves the stored setting off.
- [ ] 1.6 Run `make lint` in `backend/`.

## 2. Two-step sign-in

- [ ] 2.1 Add the pending sign-in repository and the code issuance path: six digits from a cryptographically secure source, stored hashed, expiring ten minutes after issuance; verify with a test that a stored row never contains the plain code and that an expired row is rejected as invalid.
- [ ] 2.2 Change `POST /users/signin` so that, with the setting on and the password correct, it issues a code and returns the pending sign-in identifier instead of a token; verify with a controller test asserting the response carries no token, a code row exists, and the mock sender received one message addressed to the account.
- [ ] 2.3 Make the send failure explicit: check that mail is configured before creating the pending sign-in, and fail the request with a "could not send the code" response when either the check or the send fails, leaving no usable pending sign-in behind; verify with a controller test using a sender that reports itself unconfigured and another that returns an error, asserting in both cases that no pending sign-in row remains usable.
- [ ] 2.4 Add the verification endpoint that exchanges the pending identifier and the code for a token, marking the code used; verify with controller tests covering success, a reused code, an expired code, a code belonging to a different pending sign-in, and an identifier that never existed.
- [ ] 2.5 Enforce five wrong attempts per pending sign-in, after which it is destroyed and the correct code no longer works; verify with a controller test that submits five wrong codes and then the right one.
- [ ] 2.6 Add the resend endpoint, invalidating the previous code and limited through the existing scoped rate limiter to one per minute and five per hour for the same address; verify with a controller test that a second immediate resend is refused and that the previous code stops working after a successful resend.
- [ ] 2.7 Cap issued codes at five an hour per account, counted over the pending sign-in rows the way `SendResetPasswordCode` counts reset codes (`user_services.go:562-570`), and refuse beyond that before any mail is sent; verify with a controller test that completes the password step six times and asserts the sixth sends no mail and returns no usable pending sign-in.
- [ ] 2.8 Re-check the account at the verification step: it exists, it is still active, its password creation time still matches the one recorded with the pending sign-in, and the setting being switched off in the meantime does not block the user; verify with controller tests for a deactivated account, a password changed between the two steps, and a sign-in completed after `--disable-2fa` ran.
- [ ] 2.9 Apply to the verification and resend endpoints the Cloudflare Turnstile check and the scoped rate limiting that sign-in and the reset-code request already carry (`user_controller.go:124-143`, `:427-467`); verify with controller tests that, with the challenge enabled, both endpoints refuse a request without a valid answer before checking any code or sending any mail.
- [ ] 2.10 Confirm the paths that must not change: a wrong password and an unknown address send no mail and answer as they do with the setting off, sign-in with the setting off still returns a token in one step, and the Google and GitHub callbacks still issue a token directly with the setting on; verify with controller tests for each.
- [ ] 2.11 Move the "User signed in" audit entry to the verification step and add an entry for a pending sign-in destroyed by wrong codes; verify with controller tests that assert through the recording audit writer that a completed sign-in writes one entry at the verification step and none at the password step, and that an abandoned one writes the destruction entry.
- [ ] 2.12 Add a background task beside the others in `runBackgroundTasks` (`backend/cmd/main.go:317`) that deletes expired pending sign-in codes and calls `DeleteExpiredCodes` (`backend/internal/features/users/repositories/password_reset_repository.go:43-47`), which no caller has ever invoked; verify with tests that seed an expired and a live row in each table and confirm one sweep removes only the expired ones.
- [ ] 2.13 Regenerate the API documentation with `make swagger`, confirm the sign-in endpoint documents both response shapes, and run `make test` and `make lint` in `backend/`.

## 3. Console escape hatch

- [ ] 3.1 Add the `--disable-2fa` flag to `parseCommandLineOptions` (`backend/cmd/main.go:154`) and dispatch it from the same startup point as the password reset (`main.go:115`), turning the setting off, reporting whether anything changed and exiting; verify by running the binary against a database with the setting on and confirming the next password sign-in completes without a code.
- [ ] 3.2 Add tests covering the command on an instance where the setting is already off, expecting a success exit and a "no change" report, and on one where it is on, expecting the stored setting to be off afterwards; verify with `make test` in `backend/`.

## 4. Settings screen

- [ ] 4.1 Add the toggle to `frontend/src/features/settings/ui/SettingsComponent.tsx` below the existing authentication switches, disabled with an explanation when the settings response reports no mail server, and carrying a link to the configuration documentation's SMTP section; verify in the running application with mail configured and with it unconfigured.
- [ ] 4.2 Add the configuration page to `WEBSITE_PAGES` (`frontend/src/shared/i18n/websitePages.ts`) with the `email-smtp` anchor, marked as translated, and extend `websitePages.test.ts`; verify with `pnpm test` in `frontend/`.
- [ ] 4.3 Surface the backend's refusal on the settings screen so an administrator sees which condition failed; verify by turning the setting on while another administrator holds the bootstrap login and reading the message.

## 5. Code-entry step

- [ ] 5.1 Change the sign-in client call so it returns either a completed sign-in or a pending one and stores a token only for the completed shape (`frontend/src/entity/users/api/userApi.ts:48-60`), and add the verification and resend calls; put the decision between the two shapes in a plain function beside the API module and cover it with a unit test for both shapes and for a response carrying neither, following the module-level test style already used under `frontend/src/entity`. Verify with `pnpm test` in `frontend/`.
- [ ] 5.2 Add the code-entry screen as a fourth mode in `frontend/src/pages/AuthPageComponent.tsx`, following `ResetPasswordComponent` for the six-digit input, showing which address the code went to, and offering a resend; verify by completing a two-step sign-in in the running application.
- [ ] 5.3 Handle the failure paths in the interface: a wrong code, an expired or destroyed pending sign-in that sends the user back to the password step, a refused resend, and the "could not send the code" response; verify each by driving the corresponding backend condition.
- [ ] 5.4 Add the new copy to all six dictionaries under `frontend/src/shared/i18n/locales/`, with no user-facing string left in a component; verify with `pnpm test` in `frontend/` that the dictionary parity suite (`dictionaries.test.ts`) keeps the six files in step.
- [ ] 5.5 Confirm sign-in with the setting off behaves exactly as before, including sign-up, which still receives a token directly; verify by signing in and registering on an instance with the setting off.
- [ ] 5.6 Run `pnpm lint`, `pnpm format`, `pnpm test` and `pnpm build` in `frontend/`.

## 6. English documentation

- [ ] 6.1 Add the second factor to the security feature list in the root `README.md` (the "Enterprise-grade security" section at line 91), as one line naming email delivery as the channel; verify the claim matches what the specs say, including that it does not cover external identity providers.
- [ ] 6.2 Document `--disable-2fa` in the root `README.md` recovery section, beside the password reset and administrator listing commands that `replace-seeded-admin-with-first-signup` documents there; verify the command line is copy-pasteable against a running container.
- [ ] 6.3 Add the second factor to the website's security page (`website/app/(en)/security/page.tsx`), stating what it covers and that external identity providers are outside it, and pointing at the recovery command; verify with `npm run build` in `website/` and by loading the page.
- [ ] 6.4 Add one line about the second factor to the security answer of the website's home-page FAQ (`website/app/(en)/page.tsx`), in both the visible answer at line 1295 and the structured-data copy at line 181; verify both copies carry the same wording and `npm run build` passes in `website/`.
- [ ] 6.5 Extend the website password page (`website/app/(en)/password/page.tsx`) with the disable command, and extend the "I forgot my admin email or password" FAQ entry from `replace-seeded-admin-with-first-signup` to mention it; verify with `npm run build` in `website/`.
- [ ] 6.6 Run `npm run lint` in `website/`.

## 7. Translations

- [ ] 7.1 Mirror the website changes into Russian: the security page section in `website/app/[lang]/security/content/ru.tsx`, the FAQ security answer and the recovery FAQ entry in the Russian home-page content, and the password page section in `website/app/[lang]/password/content/ru.tsx`; verify with `npm run build` in `website/` and by reading the pages under `/ru/`.
- [ ] 7.2 Repeat for Spanish (`es`).
- [ ] 7.3 Repeat for Portuguese (`pt`).
- [ ] 7.4 Repeat for Chinese (`zh`).
- [ ] 7.5 Repeat for French (`fr`).
- [ ] 7.6 Mirror the README changes into `assets/readme/README.{ru,es,pt,zh,fr}.md` following `assets/readme/AGENTS.md`; verify each file keeps the command lines byte-identical to the English ones.

## 8. Verification and review

- [ ] 8.1 Run `make test` and `make lint` in `backend/`, `pnpm lint`, `pnpm format`, `pnpm test` and `pnpm build` in `frontend/`, and `npm run lint` and `npm run build` in `website/`; fix every failure.
- [ ] 8.2 Confirm every endpoint this change adds or changes has a controller test for its success path and for each refusal the specs name, and that no behavior in `specs/two-factor-authentication/spec.md` is left with a scenario nothing exercises.
- [ ] 8.3 Walk the whole feature on a running instance: turn the setting on with mail configured, sign in in two steps, exhaust the attempts, resend a code, break the mail configuration and confirm sign-in fails closed, then recover with `--disable-2fa`.
- [ ] 8.4 Record in the change's completion notes that rolling the binary back with the setting on silently returns the instance to one factor, as described in design.md - Migration Plan.
- [ ] 8.5 Complete the mandatory compliance review for the finished diff and resolve every CHANGES REQUIRED finding.
