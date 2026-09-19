## Context

See proposal.md - Why.

The state that shapes the approach:

- `frontend/src` is 32,700 lines. Strings are inlined at their point of use, with no copy layer. A crude grep finds 299 text attributes, 411 JSX text nodes and 136 literals in `.ts` files; the real count is closer to 1,500 once multi-line JSX, template literals, option arrays and `alert()` calls are included. Running `i18next/no-literal-string` (plugin 6.1.5) over today's `src`, tests excluded, reports 1,010 literals in `jsx-text-only` mode, 1,957 in `jsx-only` and 2,812 in `all`. The higher counts mix copy with structural strings; see the lint decision. Per slice, `jsx-text-only` counts `features/settings` 20, `databases` 246, `restores` 21, `healthcheck` 15, `workspaces` 44, `users` 73, `verification` 103, `notifiers` 127, `backups` 199, `storages` 136, `widgets/main` 14, `shared/ui` 8 and `pages` 4.
- Copy is not confined to `ui/` segments. `entity/databases/model/postgresql/ConnectionStringParser.ts:45,64,112-124` returns error prose, `entity/notifiers/models/getNotifierNameFromType.ts` returns display names, and `entity/storages/models/getStorageNameFromType.ts:6` returns `'local storage'` in lower case so it can sit in the middle of a sentence. The dictionary has to be reachable from `entity/` and `shared/`, which puts it in `shared/`.
- About thirty label tables and option arrays are module-level constants, evaluated once when the module is imported: `features/notifiers/lib/notificationTypeLabels.ts:3,13`, the weekday, interval, period and notification tables at `features/backups/logical/ui/ShowLogicalBackupConfigComponent.tsx:30-62`, the retention options at `features/backups/logical/ui/EditLogicalBackupConfigComponent.tsx:64`. The short weekday names alone exist in six copies: `ShowLogicalBackupConfigComponent.tsx:30`, `EditLogicalBackupConfigComponent.tsx:54`, `PhysicalIntervalEditor.tsx:23`, `ShowPhysicalBackupConfigComponent.tsx:30`, `EditBackupVerificationConfigComponent.tsx:38`, `ShowBackupVerificationConfigComponent.tsx:24`.
- Status labels already exist in several shapes. `features/backups/physical/model/physicalBackupStatus.ts:39` and `features/backups/logical/model/restoreVerificationStatus.ts:25` hold label tables; the second is a `Partial` with no `NOT_VERIFIED` entry, because that status never shows a tag: `LogicalBackupsComponent.tsx:56` returns nothing for it before any lookup. `features/verification/agents/model/agentStatus.ts:28` labels `AgentStatus`, a union type the frontend derives from heartbeat timestamps (`agentStatus.ts:7`). Four components render statuses with their own copy of the words: `VerificationDetailDrawer.tsx:51`, `VerificationsComponent.tsx:58`, `LogicalBackupsComponent.tsx:386`, `PhysicalBackupsComponent.tsx:55`.
- Other enums reach the screen through label functions and switches: `getStorageNameFromType`, `getNotifierNameFromType`, `getDatabaseTypeLabel`, `entity/databases/model/sshtunnel/sshTunnelAuthTypeLabels.ts:3`, and role labels in three shapes: `getRoleDisplayText` in `features/users/ui/ProfileComponent.tsx:16` and in `features/workspaces/ui/WorkspaceMembershipComponent.tsx:292`, and inline option labels in `features/users/ui/UsersComponent.tsx:237,241` with a second select from `:330`.
- Copy carries inline markup: across `.tsx` files there are 40 `<code>`, 15 `<strong>`, 7 `<a>` and 2 `<b>` elements inside text, and 50 `<br />`. `entity/databases/model/postgresql/physical/physicalConnectionErrorContent.ts:4-20` builds its own rich text out of text runs flagged `isBold`.
- Some sentences are assembled from pieces: `Notify to {…}` at `features/notifiers/ui/NotifierCardComponent.tsx:27`, `Type: {…}` at `features/storages/ui/StorageCardComponent.tsx:27`, `Last backup {…fromNow()}` at `features/databases/ui/DatabaseCardComponent.tsx:75`.
- Two places build English plurals by hand: `features/workspaces/ui/WorkspaceMembershipComponent.tsx:517` (`member${… !== 1 ? 's' : ''}`) and `features/workspaces/ui/WorkspaceSettingsComponent.tsx:148` (`database(s)`).
- `main.tsx:11` enables dayjs's `relativeTime`, and there are 27 `fromNow()` calls in 19 files, among them `DatabaseCardComponent.tsx:75`, `features/settings/ui/AuditLogsComponent.tsx:160,198` and `features/users/ui/UserAuditLogsSidebarComponent.tsx:135`.
- Components take `message` and `modal` from `App.useApp()` (for example `LogicalBackupsComponent.tsx:83`), so the locale given to AntD's `ConfigProvider` reaches confirmation dialogs and toasts without extra wiring.
- `ThemeProvider` (`shared/theme/`) already establishes the pattern for a user preference: React context, `localStorage`, a toggle in the header. Locale follows it rather than inventing a second shape.
- `ThemeToggleComponent` already renders at three call sites: `widgets/main/MainScreenComponent.tsx:254`, `widgets/main/SidebarComponent.tsx:132` and `features/users/ui/AuthNavbarComponent.tsx:49`. Merging the language control into it covers the navbar, the narrow-viewport sidebar and the pre-login screen in one move.
- The website's `website/app/components/LanguageSelectorComponent.tsx` is working prior art, including an `isSplitEnd` variant that glues the selector to a neighbouring button as one split control. `website/app/i18n.ts:41` lists the pages the website publishes in every language (`TRANSLATED_PATHS`), and translated pages keep the English anchor ids (`website/app/[lang]/access-management/content/ru.tsx:290` has `id="global-settings"`). The frontend has 24 references to databasus.com: links to documentation pages, to the home page (`features/users/ui/AuthNavbarComponent.tsx:9,15`, `widgets/main/MainScreenComponent.tsx:200`), which `TRANSLATED_PATHS` lists as `""`, to the untranslated `/sponsorship` (`shared/ui/SponsorshipLinkComponent.tsx:12`), and one example icon URL used as a form placeholder (`EditMattermostNotifierComponent.tsx:196`).
- ESLint uses flat config (`tseslint.config(...)`). There is no `overrides` key; per-directory rules are additional config objects. `eslint-plugin-react` is installed, but its `jsx-no-literals` rule is not enabled: `react.configs.recommended` (`frontend/eslint.config.js:29`) leaves it off.
- `shared/api/apiHelper.ts:32-35` already parses `json.code` into `ApiError.code`, and `EditPostgreSqlPhysicalSpecificDataComponent.tsx:204` already branches on it. The error-code contract exists in one place and needs generalizing, not inventing. The failure paths around it put English plumbing in front of the user. When the error body carries no message, `apiHelper.ts:44-46` fills `ApiError.message` with the code itself, or with `${url}: request failed with status ${status}` when there is no JSON body; the `response.text()` fallback at `:37-41` never succeeds, because `response.json()` has already consumed the body. HTTP 502 and 504 throw a plain `Error('failed to fetch')` (`:20-21`). When the server cannot be reached at all, `fetch` rejects (`:59`) and, after the retries, the browser's own `TypeError` ("Failed to fetch", "NetworkError when attempting to fetch resource.") is rethrown unchanged (`:68`). `ApiError` (`shared/api/ApiError.ts:7`) carries only `message` and `code`. The `alert(e.message)` calls show all of this to the user, and so do the components that put an error's message into their own state, such as `setError((e as Error).message)` in `features/users/ui/ResetPasswordComponent.tsx:108`: 121 places read an error's message. One of them decides by matching text: `describeRestoreError` (`features/backups/physical/ui/PhysicalRestoreComponent.tsx:34-44`) picks a hint by searching the message for `409` and `422`, which only the fallback text contains, and for the English words `in progress` and `gap` in the backend's message. Separately, `features/users/ui/RequestResetPasswordComponent.tsx:54` shows the backend's success text for a password reset request as-is.
- `shared/ui/ConfirmationComponent.tsx:27` renders its `description` prop as HTML through `dangerouslySetInnerHTML`. Eight files use the component, and `features/restores/ui/RestoresComponent.tsx:366` relies on that: its description carries `<strong>` and `<br/><br/>` markup.
- There are 14 test files. Vitest runs in the `node` environment with no DOM (`frontend/vitest.config.ts:5`), so tests cover functions, not rendered screens. Three of them assert English error text: `ConnectionStringParser.test.ts:159`, `MySqlConnectionStringParser.test.ts:186`, `MongodbConnectionStringParser.test.ts:308`.
- CI runs `pnpm test` on a full checkout (`.github/workflows/ci-release.yml:155-161`). The Docker image build copies only `frontend/` and runs `pnpm build` (`Dockerfile:12,21`).

The website solved the same problem differently, with five full page copies per page and no dictionaries. That works there because each URL needs its own static HTML for search engines and the pages are prose. Applying it here would mean 525 component copies held structurally in sync. The application diverges deliberately.

### Rules that constrain the approach

- Root `AGENTS.md:38-40`: target-language text lives in `frontend/src/shared/i18n/locales/<locale>.ts` and nowhere else under `frontend/`. This decides three things below: each locale is exactly one file, the language switcher's native names come from the dictionaries, and the glossary of interface terms cannot live under `frontend/`.
- `frontend/AGENTS.md` FSD MUST rule 4 says shared holds only infrastructure, and the dictionaries are domain-scoped (`backups`, `databases`, `storages`). The reading this design adopts: the provider, `t()` and the locale wiring are infrastructure, and copy strings carry no domain calculation, so `shared/i18n` is the right layer. The alternative reading, that copy is domain content belonging in `entity/`, would scatter one dictionary across seven slices and break the single-source-of-truth typing that the whole approach rests on. Recorded here so it is a decision rather than an oversight. The table of website pages sits in `shared/i18n` on the same grounds; `frontend/AGENTS.md:135` already places route constants in `shared/`.
- `frontend/AGENTS.md:138` puts app-wide providers in an `app/` layer. The frontend has no such layer: `App.tsx` and `main.tsx` sit at the root of `src/`, and `ThemeProvider` lives in `shared/theme/`. `LocaleProvider` follows `ThemeProvider` into `shared/i18n`, because its context and `useLocale` must be importable from `entity/` and `features/`. Splitting the provider component into the root of `src/` and keeping only the context and hook in `shared/i18n` was rejected: it divides one unit between two places to honour a layer the codebase does not have, and makes the two preference providers differ in shape.
- FSD MUST rules 1 and 2 (downward-only imports, public API through `index.ts`) decide where label tables go: next to the type they label, exported through that slice's `index.ts`.
- FSD MUST rule 5 (one type per file in `model/`) gives `LocalizedText` its own file.
- `frontend/AGENTS.md:103` (plain hyphen in user-visible strings) is scoped to English; see the translation-rules decision.
- `website/AGENTS.md:47-55` ("Translation quality") governs how each non-English dictionary is written.

## Goals / Non-Goals

**Goals:**

- A forgotten translation is a compile error, not a runtime fallback.
- The migration is a burn-down with a machine-checkable finish line, not an open-ended sweep.
- Each language reads as if written in it, so the key is the identity and the English text is just the English value.
- Switching the language re-renders what is on screen without losing it: open drawers stay open, unsaved form input stays. (Modal dialogs and masked drawers cover the navbar, so the control is reachable only from the page itself or from the narrow-viewport sidebar, which contains it.)

**Non-Goals:**

- Right-to-left languages. None of the six need it, and no layout work assumes it.
- Lazy-loading dictionaries per feature slice. One dictionary per language, loaded whole. Revisit if a dictionary passes a few hundred KB.
- Machine translation in the build. Translations are written and reviewed, like the website's.
- Messages that change with grammatical number. See "Counts are phrased so one string fits every number".

## Decisions

### Dictionaries, not per-language component copies

See Context. Component reuse is the deciding factor: the same `EditStorageComponent` serves six languages, so language must be a runtime lookup rather than a file variant.

### `i18next` + `react-i18next`

Alternatives considered:

- **LinguiJS.** Rejected on the key strategy. Lingui uses the English source text as the key, so editing an English phrase silently invalidates all five translations. Since each language is written independently rather than rendered literally, keys must be stable and text-independent.
- **A hand-rolled `t()`, roughly 60 lines.** Attractive given the project's tight dependency budget (AntD only, one icon set). Plural rules do not decide it, since counts are phrased without plural forms. What decides it is `Trans`, which renders the ~60 sentences with inline markup, and `useTranslation`, which re-renders a component when the language changes. A hand-rolled version would rebuild both.
- **`react-intl` / FormatJS.** Comparable, but a heavier compile step for ICU messages than this codebase needs.

Versions: `i18next` 26.4.2, `react-i18next` 17.0.14 and `eslint-plugin-i18next` 6.1.5 are current as of 2026-09-18, and the change pins those major versions.

Required configuration:

- `nsSeparator: false`, otherwise a key containing a colon is misparsed as a namespace reference.
- `interpolation.escapeValue: false`, since React escapes `t()` output rendered as a child.
- `react.transKeepBasicHtmlNodesFor: []`. By default react-i18next turns `<br>`, `<strong>`, `<i>` and `<p>` in dictionary text into elements even when no component supplies them (`src/defaults.js:10` in 17.0.14). With an empty list only supplied tags become elements, so dictionaries use named tags such as `<bold>` and `<code>` that each call site maps, and a stray `<strong>` in a translation shows as text.
- `react.transDefaultProps: { shouldUnescape: true, tOptions: { interpolation: { escapeValue: true } } }`, because `Trans` is the exception to the `escapeValue` line above. It interpolates `values` into the sentence before parsing the sentence for tags, so with escaping off a value such as `<strong>bold</strong>` or `<code>x</code>` becomes a real element. Attributes are dropped, so `<img src=x onerror=…>` stays inert, but the value no longer appears as entered. With these defaults every `Trans` escapes values before parsing and unescapes them into plain React text afterwards, so `<strong>bold</strong>` and `Tom & Jerry` render literally, and tags the component does not supply (`<host>:<port>`) render as text.
- `fallbackLng: 'en'` as a last-resort runtime guard only. Completeness is enforced by types (below); the fallback exists for a dictionary that failed to load, not for a missing key.
- Resources passed inline at `init`. With inline resources, initialization finishes synchronously (`i18next` 26.4.2, `dist/esm/i18next.js:1909`), so the first render already has the stored language's dictionary.

`returnNull: false` is not listed: it is the default since i18next 23 (`dist/esm/i18next.js:1714` in 26.4.2).

### Translated text stays text

The two `Trans` settings above keep dictionary text and interpolated values from becoming markup. Two more rules and one accepted limitation follow. Everything in this section was checked with react-i18next 17.0.14 and i18next 26.4.2 through `react-dom/server`.

`Trans` has one more quirk the settings do not fix: it interpolates text again after parsing, so a value that itself contains `{{name}}` is expanded a second time (`a {{name}} b` rendered as `a a {{name}} b b`). A user-entered value therefore never enters `Trans` through `values`. The dictionary holds a self-closing tag in its place (`Delete <workspaceName/>?`), and the component supplies an element whose child is the value (`components={{ workspaceName: <strong>{name}</strong> }}`). React renders that child as text, and `Trans` neither parses nor interpolates it. An empty pair `<workspaceName></workspaceName>` does not work: it drops the element's own children. `values` stays for data the product controls: numbers, dates, product names.

Plain `t()` has a milder form of the same quirk, and it is accepted. In a message with two placeholders, a value that contains the other placeholder's `{{…}}` text gets that text expanded, and the message's own placeholder is left raw: `Workspace {{name}} deleted ({{count}})` with the name `a {{count}}` and a count of 3 comes out as `Workspace a 3 deleted ({{count}})`. `skipOnVariables`, on by default, does not prevent it. The output is still text, never markup.

No translated text is rendered as HTML. One component does so today, `ConfirmationComponent.tsx:27`. Its `description` becomes a `ReactNode` rendered as a child, and the description at `RestoresComponent.tsx:366` becomes a `Trans` key with `<bold>` plus a second key for the question after the line breaks. This lands before the first slice, because callers in `features/databases` and later slices migrate before the component's own slice does. The spec states the behavior as its own security requirement, task 1.7 pins it with a unit test, and the final verification checks that `dangerouslySetInnerHTML` no longer appears in `src`.

Alternatives considered:

- **Routing every user-entered value through `Trans` elements, including in plain `t()` messages.** It would fix the `t()` quirk, but it would also rule out consumers that need a plain string, such as `alert()` and the document title, to fix a case that only occurs when a name contains placeholder syntax.
- **Keeping `ConfirmationComponent`'s HTML description and escaping values before they reach it.** Every caller would have to escape correctly, and one miss is an injection point.

### Type safety comes from the locale files, not the library

This is the load-bearing decision, and no library provides it out of the box: i18next falls back at runtime, Lingui reports gaps in a CLI run. Both are checks a person can ignore.

Two independent layers:

```
shared/i18n/locales/en.ts        <- source of truth for the key set
    export const en = { backups: { logical: { title: 'Logical backups' } } }
             |                                    |
   layer 1: valid keys                  layer 2: complete dictionaries
   declare module 'i18next' {           locales/ru.ts:
     interface CustomTypeOptions {        import type { en } from './en'
       resources: { translation: typeof en }
     }                                    export const ru: typeof en = { ... }
   }
   t('backups.logical.titel') fails     missing key OR stray key fails tsc -b
```

`const ru: typeof en` is an exact structural check including nesting: it rejects a missing key and a leftover one alike.

While the slices are migrated, each dictionary is split into one file per namespace (`locales/en/<ns>.ts`, `locales/ru/<ns>.ts`), so slices migrated in parallel edit different files. Each Russian namespace is typed `typeof <ns>En` and written as one literal, so a missing, stray or nested stray key still fails `tsc` with the key named. The split is temporary: a task before the remaining languages folds every namespace back into one literal per locale and deletes the folders, which leaves the shape described here. `en` is declared without `as const`, so values widen to `string` and translations are not forced to match the English text.

The check that rejects a stray key (TypeScript's excess-property check) applies only to an object literal written in place. A nested object that arrives through a variable or a spread escapes it: `const ru: typeof en = { backups: ruBackups }` accepts a stray key inside `ruBackups` (checked with tsc 5.8). Each dictionary therefore stays one literal in one file, which is also the only shape the root `AGENTS.md:38` permits. Splitting by domain would be possible with `satisfies` on every part, but the rule names one file per locale, and a file of a couple of thousand lines is still navigable by key.

Code that stores a key rather than calling `t()` directly types it as `TranslationKey`, an alias for i18next's `ParseKeys` (`typescript/t.d.ts:151`), so a table of keys gets the same check as a call site.

The `import type` link from each translation to `en` is erased at build time, so the English dictionary does not end up in the Russian bundle.

Consequence worth naming: a language cannot be added partially. Either its dictionary is complete or the build is red. That is why the four remaining languages come last, after the key set has settled.

### Placeholders are checked by a test, not by types

Because `en` widens its values to `string`, i18next cannot see which `{{placeholders}}` a message uses. A Russian value that drops `{{name}}`, or a Chinese one that renames it, passes `tsc -b` and renders a sentence with a hole in it.

A unit test walks every key of `en` and asserts that each other dictionary's value uses the same set of `{{…}}` names and the same set of `Trans` tags.

Alternatives considered:

- **`as const` on `en`.** i18next would then type interpolation values, but `typeof en` would demand the English text itself in every translation, which makes the completeness check unusable.
- **Template-literal types that extract placeholders from ~1,500 strings.** Correct, but slow for `tsc` on every build to do what a 30-line test does.

What stays unchecked is the parameter name at a `t()` call site; review covers it.

### Counts are phrased so one string fits every number

i18next stores plural forms as sibling keys with suffixes: English needs `_one` and `_other`, Russian `_one`, `_few`, `_many` and `_other`, Chinese only `_other`. Under `const ru: typeof en`, Russian's `_few` is a stray key: tsc rejects it with TS2561 (checked with tsc 5.8). The type check and i18next's plurals cannot both hold.

Only two places pluralize today (see Context), so counts are phrased as a label and a number, `Members: 5` / `Участников: 5` / `Membres : 5`, or as a sentence whose wording does not depend on the number. The convention goes into `frontend/AGENTS.md`.

Alternatives considered:

- **i18next plurals as designed.** Rejected: Russian cannot express them under the completeness check, and Chinese would be forced to carry an `_one` it never uses.
- **An English dictionary carrying every suffix any language needs.** `en` would hold `_few` and `_many` values nobody reads, and each new language could add suffixes to every plural key in `en`.
- **ICU messages through `i18next-icu`.** One key per message, so `typeof en` keeps working, but it adds a dependency and a message syntax for two call sites. If copy that depends on grammatical number grows, this is the route to take.
- **A mapped type that expands `_one`/`_other` into each language's forms.** Correct, but type machinery for two call sites.

### Keys are domain-scoped, not path-scoped

`t('backups.logical.emptyState.title')`, not `t('features.backups.logical.ui.EditLogicalBackupConfigComponent.emptyState.title')`.

Top-level namespaces follow the domain, not the file tree: `backups`, `databases`, `storages`, `notifiers`, `verification`, `workspaces`, `users`, `settings`, `status`, `errors`, `common`, `language`. A path-shaped key would look tidy today and rot at the first component move, and FSD already permits a component to migrate between `pages/`, `features/` and `entity/` as consumers appear.

### Code outside components hands out keys, not text

A module-level constant is evaluated once, when its module is first imported. If `NOTIFICATION_TYPE_OPTIONS` called `t()`, the options would stay in the language that was active at import time. A parser that returns translated prose has a similar problem: the error sits in component state and stays in the old language after a switch.

So constants, label tables and functions outside components hold or return keys, and the component resolves them with `t()` while rendering. A stored key that needs inline markup goes through `TransByKey` in `shared/i18n`: `Trans` cannot type-check an `i18nKey` typed as the whole key union (TypeScript stops with TS2590 once the union is a few hundred keys long), so the wrapper takes a `TranslationKey` and hands it on. A function that needs parameters returns a `LocalizedText`, `{ key: TranslationKey; params?: Record<string, string | number> }`, defined in its own file in `shared/i18n`. The connection string parsers return `{ error: LocalizedText }`, and their tests assert the key instead of English words. Eleven of their failure messages append the thrown error's text today (`Failed to parse connection string: ${(e as Error).message}`, for example at `ConnectionStringParser.ts:137`); the keys that replace them drop that detail, because it is the browser's English text, which the backend-errors decision also keeps off the screen.

Alternatives considered:

- **Calling `i18n.t` inside the constant or function.** A constant freezes the language of its first import, a stored result keeps the old language after a switch, and tests would need an initialized i18n instance to read English text back.
- **Getter functions such as `getWeekdayOptions()`, called during render.** They work, but every call site must remember to call inside render, and nothing flags a call hoisted to module level. A table of keys cannot go stale.

### Enum labels become typed tables of keys

Every enum shown to the user gets a `Record<Enum, TranslationKey>`: the six status enums shown as labels (`VerificationStatus`, `RestoreStatus`, `LogicalBackupStatus`, `PhysicalBackupStatus`, `RestoreVerificationStatus`, `HealthStatus`), `AgentStatus`, and the labelled enums listed in Context (storage and notifier types, database types, SSH auth types, notification types, intervals, periods, retention policies, roles). `AddMemberStatusEnum` gets no table: it only decides which branch the add-member flow takes (`WorkspaceMembershipComponent.tsx:172-175`) and is never shown.

It is an explicit `Record`, not a template key:

```ts
// no: a dynamic key defeats the type check entirely
t(`status.verification.${status}`)

// yes: adding an enum member leaves the Record incomplete and fails the build
export const VERIFICATION_STATUS_LABEL_KEYS: Record<VerificationStatus, TranslationKey> = { ... }
```

Tables are named `<TYPE>_LABEL_KEYS`, following the existing `SCREAMING_SNAKE` tables, and the converted ones are renamed to match: `PHYSICAL_BACKUP_STATUS_LABELS` becomes `PHYSICAL_BACKUP_STATUS_LABEL_KEYS`, `AGENT_STATUS_LABELS` becomes `AGENT_STATUS_LABEL_KEYS`, and so on.

A table lives next to the type it labels, in its own file (`VerificationStatusLabelKeys.ts` beside `entity/verification/runs/models/VerificationStatus.ts`), re-exported from the slice's `index.ts`. For the enums in `entity/`, the label parts of `physicalBackupStatus.ts` and `restoreVerificationStatus.ts` move to the enum's slice; their badge styles are presentation and stay in the feature. `AgentStatus` is a feature's own type, so its table stays in `features/verification/agents/model/`.

A new table replaces the old label source outright. `getStorageNameFromType`, `getNotifierNameFromType`, the `getRoleDisplayText` switches and the six weekday copies are deleted by the slice task that migrates their last consumer; no function keeps returning English text alongside the table.

The rejected alternative is keeping tables where they are used. Two features showing the same enum would each hold a table, and the copies drift; that is how the four status render functions came about.

`RESTORE_VERIFICATION_STATUS_LABELS` becomes `RESTORE_VERIFICATION_STATUS_LABEL_KEYS: Record<RestoreVerificationStatus, TranslationKey | null>` with `NOT_VERIFIED: null`. "No tag" becomes an explicit value, and adding a member still fails the build. Keeping the `Partial` would silently exempt this enum from the guarantee.

Weekdays get one table of seven keys that replaces the six copies, next to the interval model in `entity/intervals`. Taking the names from `Intl.DateTimeFormat` or dayjs instead was rejected: they come back in lower case in Russian, French, Spanish and Portuguese (`пн`, `lun.`) and with trailing periods in some, so each language would need casing fix-ups that cost more than seven keys.

Period labels such as `3 months` are one key per enum value. Each is a fixed phrase, so they need no plural handling.

Components keep their own markup (a tag here, an icon and span there) and take the words from one place. This deduplicates as a side effect; that is a bonus, not the goal.

### Sentences stay whole

A translator can only reorder a sentence that reaches them as one piece. Two rules follow.

Inline markup goes through `Trans`. The dictionary holds the whole sentence with named tags (`Run <code>pg_dump</code> on the server`), and the component supplies the elements: `components={{ code: <code />, docsLink: <a href={…} /> }}`. A translator can move the tag to wherever the language puts it. With the project's `Trans` configuration (see the i18next decision), only the tags the component supplies become elements, and a user-entered value is supplied as an element's child rather than interpolated. Where `<br />` separates two sentences, they become two keys. The physical connection errors follow the same rule: each note becomes one key with `<bold>` tags instead of a list of text runs, and commands stay literal. `managedNote(username)` renders as plain text (`EditPostgreSqlPhysicalSpecificDataComponent.tsx:445`), so it becomes a key resolved with `t()` and `{{username}}`, not a `Trans` sentence.

Values are interpolated into a full sentence, never concatenated with translated fragments. An inserted value is a name or a piece of data that does not inflect: a user-entered name, a product name (Telegram, S3, Google Drive), a number or a date. When the inserted word is a common noun that a language would inflect, like `getStorageNameFromType.ts:6`'s `'local storage'`, each value gets its own sentence key (`storages.card.type.local`).

Alternatives considered:

- **Splitting a sentence around its markup into several keys.** The fragments are glued in English order, and Russian or Chinese needs a different one.
- **HTML strings in the dictionary, rendered with `dangerouslySetInnerHTML`.** Rejected on security grounds: it bypasses React's escaping and turns every dictionary value into an injection point.
- **ICU `select` for inflected values.** Same dependency trade-off as for plurals, for a handful of sites.

### Locale-dependent output is read through hooks

When `LocaleProvider` publishes a new locale, React re-renders the components that consume its context, and `react-i18next` re-renders the components that call `useTranslation`. A component that calls `dayjs(date).fromNow()` or a number formatter without either keeps the old language until something else re-renders it.

Translated text therefore comes from `useTranslation`, and relative times and grouped numbers come from `useLocale()`, which exposes `formatNumber` and `formatRelativeTime`. The 27 `fromNow()` calls switch to `formatRelativeTime` as their slices are migrated, so afterwards `fromNow()` appears only inside the formatter; the lint rule cannot see this, so the final verification checks it with grep. The provider switches `dayjs.locale` and `i18n.changeLanguage` before it publishes the new value. The tree is never remounted.

Alternatives considered:

- **`key={locale}` on the tree.** The simplest guarantee that everything updates, but every switch remounts the application: open drawers close and unsaved form input is lost.
- **Setting the global `dayjs.locale` and nothing else.** Components update only on their next unrelated render.

### The lint rule is what makes the migration finite

`eslint-plugin-i18next`, rule `i18next/no-literal-string`, in `all` mode over `*.{ts,tsx}`.

The plugin's default mode is `jsx-text-only` (`lib/options/defaults.js:3` in 6.1.5), which covers the same ground as `react/jsx-no-literals`: JSX text nodes only. Measured on today's `src`, it misses 133 `placeholder` attributes, 126 `title` attributes, 53 `message.error` and `message.success` texts, 45 parser error strings, 44 option labels in arrays, and the button and body texts of confirmation dialogs (`okText`, `cancelText`, `actionText`, `description`). `jsx-only` adds attributes but still misses every call and every `.ts` file. Only `all` covers the copy that lives outside JSX.

`all` also reports structural strings, and they fall into recurring classes: `size` (234 reports, mostly `"small"`), `key` and `dataIndex` (76), request headers (33), query parameter names (46), icon paths and colour values. Exclusions are configured per class:

- JSX attributes: an exclude-list of props that never carry copy (`size`, `type`, `mode`, `rowKey`, `color`, `variant`, `placement`, `direction`, `autoComplete`, `path`, `value`, `htmlType`, …). An exclude-list rather than an include-list, because a copy prop missing from an include-list goes unchecked without anyone noticing, while a non-copy prop missing from an exclude-list shows up as a lint error that someone fixes.
- Callees: `console.*`, header and query-parameter builders, `document.createElement`, and state setters that take identifiers.
- Object properties: `key`, `dataIndex`, `type`, `format`, `icon`, `cache`, `okType`, `defaultSortOrder`.
- Words: URLs and absolute paths.
- Files: `*.test.ts`, and `api/` segments, which hold request plumbing. The user-visible text there, `failed to fetch` at `shared/api/apiHelper.ts:21` and the status fallback at `apiHelper.ts:44-46`, is replaced by frontend-side error codes that `translateApiError` resolves (task 3.1), so the exclusion hides no copy.

The exact lists are pinned in task 2.1 from these report classes. One-off cases take an inline suppression with a stated reason, which keeps the config from turning into a dumping ground.

Three details of the configuration came out of building it:

- The plugin skips every literal inside a variable with a SCREAMING_SNAKE name and every default parameter value, and no option turns that off. Module-level label tables are where copy hides, so `eslint.config.js` wraps the rule and routes both node types through the handler for an ordinary variable. A technical constant such as a `localStorage` key takes an inline suppression.
- The rule runs with type information (`parserOptions.project`). A literal whose expected type is a union of string literals is skipped, which removes the `TranslationKey` values in label tables and props such as `size="small"` without an exclusion each. The flip side: a prop typed `'Save' | 'Cancel'` would pass, so copy is never typed as a literal union.
- Callee exclusions (`replace`, `split`, `join`, `get`, ...) also skip the string the method is called on, so `'Deleted {name}'.replace('{name}', name)` passes. No copy is built that way, and the sentence rules forbid it anyway; review covers it.
- The dictionaries (`locales/**`) are ignored, since they are the copy. During the migration a temporary `eslint.i18n-check.js` applies the rule to directories not yet enabled, so a slice can be checked before its entry lands; it is deleted when the entries collapse.

The rule is enabled per directory as each slice lands:

```js
{
  files: ['src/features/settings/**/*.{ts,tsx}'],
  plugins: { i18next },
  rules: { 'i18next/no-literal-string': ['error', i18nextLiteralStringOptions] },
},
```

When the last slice is migrated, the per-directory entries collapse into one entry over `src/**/*.{ts,tsx}`. That entry passing `pnpm lint` is the finish line: no user-facing literal is left anywhere in `src`.

Slices are migrated smallest first, so the infrastructure is debugged on `features/settings` rather than `features/databases`.

### The language control is merged with the theme control

The website's selector is the reference: a compact button showing the current language, a dropdown listing all six by native name, opening on `onMouseEnter` and closing on `onMouseLeave`, with the panel using top padding rather than a margin so the hover area between button and list stays contiguous. That detail is not cosmetic; a gap makes the dropdown close while the pointer crosses it.

Rather than adding a second standalone button, the language selector and the theme selector become one paired control, split down the middle, the way the website glues its selector to the GitHub button. Two reasons: the navbar has no room for a third control at narrow widths, and the two settings are the same kind of thing (a per-browser display preference), so grouping them is honest rather than decorative.

The paired control, `LanguageThemeControlComponent` in `shared/ui`, composes a new `LanguageSelectorComponent` (named after the website's) with the existing `ThemeToggleComponent`, which stays as the theme half and gains the split styling. The paired control takes `ThemeToggleComponent`'s place at its three existing call sites, which is what satisfies the spec's placement requirement without a separate placement task.

Alternatives considered:

- **A separate language button beside the theme button.** Simpler to build, but adds a third control to a navbar that already competes for width, and the website has already established the paired shape.
- **Language inside the theme dropdown as a submenu.** Fewer pixels, but buries a setting a first-time visitor needs to find immediately, and nested dropdowns on hover are fragile.

The language half is an AntD `Dropdown` with `trigger={['hover', 'click']}` rather than a copy of the website's hand-built panel. It matches the theme half's menu in both themes and keeps keyboard support, and AntD's leave delay keeps the list open while the pointer crosses from the button to the list; click is there for touch screens, which have no hover. The theme half keeps its click trigger.

### Each dictionary names its own language

The language list shows `English`, `Русский`, `Español`, `Português`, `中文`, `Français` in every interface language. Each dictionary holds its own language's name under `language.nativeName`, and the control reads the name from each locale's resources. All dictionaries are in the bundle anyway (see Risks), so this costs nothing at runtime.

Alternatives considered:

- **A constant like `LOCALE_NATIVE_NAMES` in `website/app/i18n.ts:31`.** It would put target-language text outside the dictionaries, which root `AGENTS.md:40` forbids, and would need a second rule amendment.
- **Every dictionary holding all six names.** Thirty-six strings, each written identically six times.

### Three surfaces that are not React state

Three things follow the language but sit outside the component tree, and each needs wiring the dictionary alone does not give:

- `index.html` hardcodes `<html lang="en">` and an English `<title>`. Both are set from the provider once the locale resolves. The `lang` attribute is what screen readers switch voices on and what stops the browser offering to translate a page already in the reader's language; the title is what a bookmark keeps.
- Eight `toLocaleString()` calls carry no locale argument, so they follow the browser rather than the selection. On an English browser with Russian selected, dates would read Russian and numbers English on the same screen. They are in `LogicalBackupsComponent.tsx:513,515`, `PhysicalBackupsComponent.tsx:49,52`, `VerificationDetailDrawer.tsx:45,48,157` and `StarButtonComponent.tsx:56`. The formatter moves to `shared/i18n` and takes the selected locale.
- The unit words stay English (`MB`, `GB`), only the digits regroup.

Two decisions this raises:

`index.html` is a static Vite entry, so its `lang` and `<title>` can only follow the language at runtime. They are set from `LocaleProvider` rather than from a separate `useDocumentLanguage` hook: the provider already owns the resolved locale and runs before first paint, and a second hook would need a consumer in the tree to fire at all, which is exactly the coupling the provider exists to avoid. The markup keeps English values as the pre-hydration fallback.

Chinese does not follow the website's number rule, and the spec deliberately says so. `website/AGENTS.md` fixes `zh 180 万` for millions, qualified as the form for prose. `(1800000).toLocaleString('zh')` returns `1,800,000`; the 万 form needs `Intl.NumberFormat` with `notation: 'compact'`. A row count in a table cell is not prose, and a compact form loses precision a size or a count needs, so the interface shows full grouped numerals in every language and reserves 万 for the website's marketing copy. Verified: `en 1,800,000`, `ru 1 800 000`, `fr 1 800 000`, `es/pt 1.800.000`, `zh 1,800,000`.

### Two axes: words follow the language, clocks follow the region

The product ships one control, and it selects a language. Formatting conventions are a second, independent axis, and conflating them silently is how a plan like this goes wrong. The split adopted here:

- Words follow the selected language. Labels, month and weekday names, component-library text, status labels.
- Digit grouping follows the selected language too. A user who picks French and reads `1,234.5` will file it as a bug, and the product gives them no other control to fix it. This is a deliberate simplification, not a claim that grouping is linguistic.
- Clock format and date order keep following the browser. `shared/time/getUserTimeFormat.ts:3,43` and `shared/time/utils.ts:5` derive 12-hour versus 24-hour and the day/month order from `navigator.language`, and they stay that way. Language does not determine these: English speakers use 12-hour in the United States and 24-hour in the United Kingdom, so deriving a clock from a language selection would be guessing. The browser reports the user's actual region, which is the better signal.

The residual oddity is that a French selection can show French month names above 12-hour AM/PM times. That is correct rather than inconsistent: the words are in the reader's language and the clock is in their region's convention.

Durations (`formatDuration`, `2h 15m 3s`) need no work under this split. They are technical readouts whose digits never reach a grouping threshold, and their unit letters stay English along with the other unit words.

### Locale persistence mirrors the theme

`localStorage` under `databasus-locale`. No user profile field: the backend has no notion of a user language, and adding one only becomes necessary when notifier emails need translating, which is outside this change.

Reading the stored value during provider initialization (as `ThemeProvider` does with `getStoredTheme`) is what satisfies the "no flash of English" scenario in the spec.

The supported languages are the dictionaries that exist: one list, `en` and `ru` while the slices are migrated, growing by one entry as each remaining dictionary is written. A stored value that is not in the list is treated as absent, so a removed language or an edited value falls back to detection instead of breaking the interface.

Initial detection reads the browser, not the operating system: a page cannot observe the system setting. What it has is `navigator.languages`, the browser's ordered preference list, which usually but not always follows the system.

The rule: walk `navigator.languages` in order, take the first entry whose primary subtag matches a supported language, fall back to English. Walking the list matters. A user whose preferences are `["de", "ru"]` genuinely prefers Russian over English, and checking only `navigator.language` would hand them English. The resolution is a pure function, `resolveInitialLocale({ storedLocale, browserLanguages, supportedLocales })`, so each rule has a unit test. It takes one object because two of its inputs are lists of language codes, and positional arguments of the same type swap without a compile error.

Region subtags are stripped, which forces two mappings that should be stated rather than discovered:

- `zh-TW` and `zh-HK` resolve to the Simplified Chinese dictionary, though their users read Traditional. Simplified is what the website ships and what this change ships.
- `pt-PT` resolves to the Brazilian Portuguese dictionary, matching `website/AGENTS.md`, which fixes Portuguese as pt-BR.

Both are the least-bad option while only one variant exists per language, and both are a reason to add a variant later rather than a defect to fix now. `website/app/i18n.ts` already carries the same kind of mapping in `HTML_LANG_CODES` (`zh: "zh-CN"`).

### Website links follow the selected language

When the website publishes a linked page in the selected language, the link opens `https://databasus.com/<lang>/<path>/`; otherwise, and always for English, it opens the English page. The trailing slash is the website's URL form (`website/AGENTS.md:43`). Anchors carry over unchanged because translated pages keep the English ids.

A typed table in `shared/i18n`, `WEBSITE_PAGES`, lists every website page the application links to: the documentation pages, the home page (path `""`) and the untranslated `sponsorship` page. Each entry has its path, an optional anchor and whether the website translates it. `getWebsitePageUrl(page, locale)` builds the URL. The link text is copy and lives in the dictionaries. The example icon URL in the Mattermost form is a placeholder value, not a link, and stays literal.

The table must agree with `TRANSLATED_PATHS` in `website/app/i18n.ts:41`. A unit test imports that file's source with Vite's `?raw` suffix, extracts the list, and asserts that every entry's translated flag matches its membership in both directions. This was checked in a scratch copy of the frontend:

- Vite refuses files outside the project root by default, so `frontend/vitest.config.ts` needs `server.fs.allow: ['..']`.
- A `?raw` import is typed by the `vite/client` ambient declarations (`src/vite-env.d.ts:1`), so `tsc -b` passes in the Docker build, where `website/` is absent.
- CI runs `pnpm test` on a full checkout, where the file exists.

The consequence: a website change that stops or starts translating a linked page fails the frontend test until the table follows. `website/AGENTS.md` gets a note next to its `TRANSLATED_PATHS` rule so the failure is not a surprise.

Alternatives considered:

- **Prefixing every link with the language.** Untranslated pages such as `notifiers/mattermost` and `sponsorship` would return 404.
- **A copy of the list with no test.** A page the website stops translating would 404 in the application, and nobody would notice.
- **Importing `website/app/i18n.ts` as a module.** `tsc -b` in the Docker build would fail without `website/`, tying the image build to the website tree.
- **Fetching a list from databasus.com at runtime.** Self-hosted installations may run without internet access, and the website would have to publish a new file.

### Backend errors: fix the frontend half of the contract now

The backend returns roughly 416 free-text English messages; 67 of the frontend's 78 `alert()` calls show `e.message`. Translating them is out of scope, but the frontend's handling is not: it standardizes on translating by `ApiError.code` and falling back to the backend's message. The backend can then acquire codes incrementally without any further frontend rework. `ConnectionErrorCode` in `backend/internal/features/databases/databases/postgresql/shared/connection_error.go` is the existing precedent on the backend side.

`ApiError.message` holds the backend's message and nothing else. `ApiError` gains a `status` field holding the HTTP status of every error response, and failures the backend never describes get frontend-side codes in the same `snake_case` form as `ConnectionErrorCode`:

- `network_unreachable` when the `fetch` call itself rejects (`apiHelper.ts:59`). Only that call's rejection is wrapped. The `catch` at `apiHelper.ts:62` also receives the `ApiError`s thrown by the response check, and those pass through unchanged; wrapping the whole `catch` would turn every backend error into `network_unreachable`.
- `request_failed` for HTTP 502 and 504 (`apiHelper.ts:20-21`) and for any error response without a JSON body (`apiHelper.ts:44-46`).

A code is never copied into the message, and the dead `response.text()` fallback at `apiHelper.ts:37-41` is deleted. In the same task, `describeRestoreError` switches to deciding by `status` alone: its number match stops working the moment the fallback text is gone, and its word matches (`in progress`, `gap`) are the matching on English text that this decision rejects. The hints it appends become keys. The password-reset success text is replaced by a frontend key when the `users` slice is migrated, since the frontend already knows the request succeeded.

`translateApiError(error, t)` lives in `shared/i18n/translateApiError.ts` and takes the calling component's `t`, so it is a pure function a unit test can drive. It resolves in order: a known code gives its translation (`request_failed` includes the status); otherwise the backend's message is shown as-is; otherwise a general translated message. It never shows the message of an error that is not an `ApiError`, since that text comes from the browser or a library, not from the backend. Each slice routes every place that shows an error's message through it, whether that is `alert()`, `message.error()` or a component's own error state. The lint rule cannot see these reads, because none of them holds a literal, so the final verification finds them with grep.

One read of a message remains, and it is not display: the S3 storage form opens its advanced settings when a connection test fails with a certificate error, and it recognizes that failure by the backend's text. The behavior predates this change; a backend error code for it would remove the last match on English text.

`translateApiError` covers codes whose content is one message. The physical connection errors keep their own lookup keyed by the same codes, because they render a title, a summary, steps and commands rather than one message; the component falls back to `translateApiError` for any other code.

Alternatives considered:

- **Matching on the English message text.** Needs no backend work, but breaks without warning the first time the backend rewords a message.
- **Leaving the frontend side to the backend change.** Every `alert(e.message)` would be reworked twice: once here to translate the surrounding copy, and again when codes arrive.
- **Keeping the current fallback that writes the code, or the URL and status, into the message.** The user would keep seeing raw codes and request URLs, which the spec rules out.

### Translations follow the website's rules, not the English hyphen rule

`frontend/AGENTS.md:103` asks for a plain hyphen in every user-visible string. That rule now applies to `en.ts` only. The other dictionaries follow the locale conventions in `website/AGENTS.md:53`, the ones the website's translations already use: Russian keeps «—» where the grammar wants it and writes «е» rather than «ё»; Spanish addresses the reader as usted; French uses vous, a space before `%` and a plain space before `: ; ! ?`; Chinese uses 你, full-width punctuation and a space at every boundary between Chinese and Latin characters; Portuguese is Brazilian (`website/AGENTS.md:41`).

The canonical interface terms per language (backup, storage, notifier, workspace, restore, health check, verification) are recorded in the "Translation quality" section of `website/AGENTS.md`: the Russian ones after the `databases` slice, the others as each dictionary is written. That section already records one such choice, «рабочие пространства» (`website/AGENTS.md:52`), and the follow-up that re-quotes interface labels in the docs will need the same words.

Alternatives considered:

- **The hyphen rule in every language.** Russian and French copy would read as translated, which the website's rules exist to prevent.
- **A glossary under `frontend/`.** Root `AGENTS.md:40` allows target-language text there only in the dictionaries, and dictionary comments must be English, so they cannot hold the terms either.

## Risks / Trade-offs

- **The branch drifts from `develop`.** The migration touches nearly every component, and features landing on `develop` meanwhile conflict with it string by string. → Merge `develop` into the branch often rather than rebasing it. After each merge, `pnpm lint` flags the literals the new work added to already-migrated directories, and they move into the dictionaries before the next slice starts.
- **The migration stalls half-finished.** On a branch, a stall costs a rotting branch rather than a half-translated product. → Slices are small, each ends with lint, tests and build green, and the riskiest slice comes second so a design flaw surfaces early.
- **Text expansion breaks layouts.** Russian and French run 20-30% longer than English, and AntD forms with fixed `labelCol` will wrap or clip. → Visual checks are done in Russian, not English. Russian is migrated alongside English from the first slice precisely so this surfaces immediately rather than at the end.
- **Chinese is shorter and denser**, which hides different problems (line height, mixed CJK and Latin spacing). → Spot-check Chinese on the table-heavy screens once its dictionary lands.
- **Tests assert English text.** Three parser tests check error wording. → They assert keys once the parsers return `LocalizedText`.
- **The exclusion list for technical strings grows into a loophole.** → Exclusions are per recurring class and measured; one-offs take an inline suppression with a reason.
- **Six dictionaries in one bundle.** Measured: about 1,130 messages per language, and the main bundle grows from 516 KB to 673 KB gzipped. → Shipped all six; loading each non-English dictionary and its AntD/dayjs locale with a dynamic import is a contained follow-up if that cost matters.
- **The type-level completeness check makes adding a language all-or-nothing.** → Accepted deliberately. A partially translated language is worse than an absent one, and this is the mechanism that guarantees it cannot ship.
- **The documentation-link test couples frontend CI to the website.** A website contributor can break a frontend test. → Accepted, since the alternative is silent 404s; the note in `website/AGENTS.md` explains the failure.
- **Phrasing without plurals constrains copywriting.** → Accepted for two call sites. ICU messages are the route if such copy grows.

## Migration Plan

No data migration and no deployment coupling: this is a frontend build.

The whole change is built on one long-lived branch and merged into `develop` once every task is done, final verification and review included. Nothing between the first slice and the last reaches users, so the language list needs no release gate. Inside the branch each slice is its own commit; after the merge, rollback is reverting the merge commit.

Sequencing is by slice, smallest first, English and Russian together:

```
settings(4)  -> databases(159) -> restores(13) -> healthcheck(19) -> workspaces(34)
  -> users(48) -> verification(60) -> notifiers(102) -> backups(119) -> storages(136)
  -> entity/, widgets/, pages/, shared/ui/
```

Counts are the crude-grep numbers and understate the real ones. The per-slice lint counts in Context rank a few neighbouring slices differently (`healthcheck` below `restores`, `storages` below `backups`); the order is kept, because swapping neighbours of similar size changes nothing about what each slice proves.

`databases` is second rather than last on purpose. Strict smallest-first validates the key namespace only on trivial slices, so a design flaw surfacing in the largest one would mean reworking every slice already migrated. Doing it right after the infrastructure is proven costs fluency and buys the ability to revise the key layout while only one other slice depends on it.

Spanish, Portuguese, Chinese and French are written only after the key set has stopped moving. Translating earlier means redoing the work each time a key is renamed.

## Open Questions

- Which AntD locale bundles to import statically versus dynamically. Affects bundle size only, decidable once real numbers exist.
- Whether `common.*` should hold shared verbs (`Save`, `Cancel`, `Delete`) or whether each domain repeats them. Sharing risks a verb that reads correctly in one context and wrong in another, in languages with grammatical gender or aspect. Resolvable during the first two slices, with the default being: share only where every language confirms the wording carries over.
