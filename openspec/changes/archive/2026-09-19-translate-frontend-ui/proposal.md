## Why

The marketing website ships in six languages, but the product behind it is English only. A user who arrives through the Russian or Chinese landing page logs in and hits an entirely English interface. The website translation set the audience expectation; the application has to meet it.

There is also a window that closes. Today's 32,700 lines of frontend code carry roughly 1,500 hardcoded strings, and that number grows with every feature. Extraction gets more expensive the longer it waits, and nothing currently stops a new hardcoded string from landing.

## Governing docs

This change answers to [`AGENTS.md`](../../../AGENTS.md) at the repo root and to [`frontend/AGENTS.md`](../../../frontend/AGENTS.md). It also amends the root doc's language rule, which [`assets/readme/AGENTS.md`](../../../assets/readme/AGENTS.md) restates, so that doc is in scope for consistency even though no README translation changes. It touches no backend or agent code, so those module docs do not apply.

[`website/AGENTS.md`](../../../website/AGENTS.md) applies in two ways, though no website code changes:

- Its "Translation quality" rules govern how every non-English dictionary is written, including locale typography, and they gain the interface's canonical terms per language.
- Its `app/i18n.ts` is the source of truth for which pages exist in which language. The frontend links to those pages and a frontend test reads that file, so the doc gains a note that adding or removing a translated path affects the frontend.

### **BREAKING** rule change, approved and applied

The root doc's "Language in code" section permitted translated end-user content in three places and nowhere else: the website page copies, the README translations, and the six language-switcher labels in the root `README.md`. It forbade any language other than English inside `frontend/src/`, fallback copy and error messages included.

This change puts Russian, Spanish, Portuguese, Chinese and French text into `frontend/src/shared/i18n/locales/*.ts`, which that wording forbade. The rule now names a fourth permitted location, and nothing about the change is implementable without it.

The amendment adds exactly one location, `frontend/src/shared/i18n/locales/<locale>.ts`, and changes nothing else: identifiers, file names, dictionary keys, comments, log messages, API strings, test assertions and commit messages stay English, and every other file under `frontend/src/` stays English including fallback copy and error messages. It is recorded in the root `AGENTS.md` under "Language in code" (task 2.2).

The language control's native names (`Русский`, `中文`) need no further amendment: each dictionary names its own language, so they live inside the permitted files.

## What Changes

- Add an i18n layer under `frontend/src/shared/i18n`: `i18next` + `react-i18next`, a `LocaleProvider` mirroring the existing `ThemeProvider`, and a language control in the navbar.
- Ship the same six languages as the website: `en` (source of truth) plus `ru`, `es`, `pt`, `zh`, `fr`.
- Author locale dictionaries as TypeScript modules typed against the English one, so a missing or stray key fails `tsc -b` instead of silently falling back at runtime. A unit test checks that every translation of a key uses the same `{{placeholders}}` as the English one.
- Replace every user-facing hardcoded string in `frontend/src` with a dictionary lookup, slice by slice. Code outside components, including module-level label tables and parsers in `entity/`, returns keys rather than text, so a language switch re-renders everything without a reload.
- Phrase counts so one string fits every number (`Members: 5` rather than `5 members`). No message depends on grammatical plural forms.
- Keep sentences whole: a sentence with inline markup (`<code>`, `<strong>`, links) is one key rendered through `Trans`, and values are interpolated into a full sentence rather than concatenated from fragments.
- Render translated text only as text. The confirmation dialog stops rendering its description as HTML, and a user-entered name in a translated sentence never becomes markup.
- Add `eslint-plugin-i18next` with `i18next/no-literal-string` in `all` mode over `.ts` and `.tsx`, enabled per directory as each slice is migrated and collapsed into one entry over `src` once every slice is done.
- Route AntD's own strings through `ConfigProvider locale` and date formatting through `dayjs.locale`, both following the selected language.
- Group numbers by the selected language instead of the browser's, so digits and dates on the same screen stop disagreeing.
- Set the document's language attribute and title from the selected language at runtime. `frontend/index.html` keeps `lang="en"` and the English `<title>` as the values shown before the script runs.
- Translate every enum shown to the user through typed tables of keys: the status enums, replacing four copy-pasted `renderStatusTag` / `renderStatus` / `renderStatusBadge` variants, and the other labelled enums (storage and notifier types, intervals, periods, retention policies, roles, weekdays). Enum values stay English: they are wire protocol.
- Open links to databasus.com pages in the selected language when the website publishes that page in it, and in English otherwise.
- Show a translated message for failures the backend does not describe (network errors, responses without an error body) instead of a raw error code or a request URL.
- **BREAKING** for contributors, not users: once the migration merges, a user-facing string literal anywhere in `frontend/src` fails the lint job.

### The language control

The website's `LanguageSelectorComponent` is the reference: a compact button in the navbar showing the current language, a dropdown that opens on hover and lists the six languages by their native names.

Here it is merged with the existing theme control into one paired button, language on one side and Dark/Light/System on the other, in the style the website already uses to glue the language selector to the GitHub button (`isSplitEnd`).

That merge also settles placement. `ThemeToggleComponent` already renders in three places, and the paired control replaces it at all three:

- `widgets/main/MainScreenComponent.tsx:254` - the main navbar
- `widgets/main/SidebarComponent.tsx:132` - the sidebar, for narrow viewports
- `features/users/ui/AuthNavbarComponent.tsx:49` - the authentication screen

So the language is selectable before login, not only after it. The choice is stored in `localStorage`, and on a first visit with nothing stored the interface starts in the highest-ranked language the browser prefers that the product actually ships.

### Delivery

The migration is built on one long-lived branch and merges into `develop` whole, once every slice, all five translations and the final verification are done. No build in between reaches users, so nobody sees a half-translated interface and the language list needs no release gate. See design.md - Migration Plan.

### Out of scope

- The backend. Its ~416 free-text error responses keep reaching the user in English: 67 of the frontend's 78 `alert()` calls show `e.message`. This change only fixes the frontend's side of the contract: translate by `ApiError.code` when one is present, fall back to `message` when it is not, so the backend work later is additive.
- Other text the backend authors and the frontend shows as-is: audit log entries (`AuditLog.message`, stored in the database), backup and restore failure messages (`failMessage`, `lastBackupErrorMessage`), and the notifications the backend sends by email, Telegram, Slack and the other channels.
- Replacing `alert()` with AntD notifications (78 call sites). A real improvement, a separate change.
- Re-quoting interface labels in the website docs and the README translations. Both quote English labels (`"Hourly"`, `"New Database"`) because, in the words of `website/AGENTS.md:55` and `assets/readme/AGENTS.md:29-31`, "the interface is English". Once this change merges, a Russian docs page still quotes `"Hourly"` while the Russian interface shows the Russian label. The follow-up change that re-quotes the docs also rewrites those two rules; the canonical interface terms this change records in `website/AGENTS.md` are its input.
- Unit words stay English: `h`/`m`/`s` in `formatDuration`, `MB` and `GB` in sizes. `formatDuration` needs no change at all, its digits being too small to group. The digits in sizes and counts are in scope and follow the selected language.
- Clock format and date order stay derived from the browser, not from the selected language. See design.md - Two axes.
- Technical strings: engine names, `pg_dump` and friends, connection strings, command blocks, cron expressions.
- Persisting the language choice server side. It lives in `localStorage`, like the theme.

## Capabilities

### New Capabilities

- `frontend-localization`: the frontend renders its interface in a user-selected language, keeps dictionaries provably complete, and prevents untranslated strings from being added.

### Modified Capabilities

None. This is the repository's first change; `openspec/specs/` is empty.

## Impact

- `frontend/package.json`: adds `i18next` 26, `react-i18next` 17, `eslint-plugin-i18next` 6. Measured cost: the main bundle grows from 516 KB to 673 KB gzipped (+157 KB), for the libraries, the AntD and dayjs locales and all six dictionaries, which ship in the main bundle (see design.md - Risks).
- `frontend/eslint.config.js`: gains one config object per migrated directory, collapsed into a single object over `src` at the end.
- `frontend/vitest.config.ts`: allows tests to read `../website`, for the documentation-link check.
- `frontend/src/App.tsx`: `LocaleProvider` wraps the tree, `ConfigProvider` receives an AntD locale.
- `frontend/index.html`: unchanged. Its `lang="en"` and English `<title>` remain the values shown before the script runs, and the provider overwrites them from the selected locale.
- Eight `toLocaleString()` call sites: number grouping follows the selected language rather than the browser's.
- `frontend/src/shared/ui/ThemeToggleComponent.tsx`: stays as the theme half of the new paired control; its three call sites render the paired control instead.
- `frontend/src/shared/api/apiHelper.ts`: `ApiError` carries frontend-side codes and the HTTP status for failures the backend does not describe, a network failure becomes an `ApiError` instead of the browser's `TypeError`, and the message holds only the backend's message.
- `frontend/src/shared/ui/ConfirmationComponent.tsx`: `description` becomes React content instead of an HTML string; the eight files that use it change with it.
- `frontend/src/features/**` (105 files, 23,800 lines), `frontend/src/entity/**`, `frontend/src/widgets/**`, `frontend/src/pages/**`: every user-facing literal moves to a dictionary key.
- 23 links to databasus.com pages (documentation, the home page, sponsorship): they go through a helper that picks the page's language.
- `AGENTS.md` (root): the "Language in code" rule gains a fourth permitted location. See the rule change above.
- `frontend/AGENTS.md`: gains the i18n convention, and its plain-hyphen rule is scoped to English copy.
- `website/AGENTS.md`: its translation-quality rules extend to the frontend dictionaries and gain the canonical interface terms per language; its `TRANSLATED_PATHS` rule gains a note about the frontend's links to website pages.
- Three frontend tests assert English error text (the PostgreSQL, MySQL and MongoDB connection string parsers). They switch to asserting keys.
- No backend, agent, or API changes.
