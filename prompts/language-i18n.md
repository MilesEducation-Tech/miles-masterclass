# Language and translation (i18n)

Status: approved 2026-10-01; **L1 implemented, uncommitted.** Follows `prompts/country-resolution.md`.

## Goal

The web app speaks the visitor's language: UI text, number/date/currency formatting, page direction, and
content from Django (which will soon honour `Accept-Language`). Country and language are independent: country
decides plans (done), language decides text.

## Locked decisions (from the user, 2026-10-01)

- Languages: **English (default everywhere), Arabic, French, German, Spanish.**
- **Not in the URL.** Routes stay `/:country/:profession/...`; the app resolves the language itself.
- Library: **Transloco** (`@jsverse/transloco` 8.4, peer `@angular/core >=16`, updated 2026-09-26).
  `@angular/localize` is ruled out: it builds one bundle per language behind a language URL prefix.
- UI strings live in **JSON files in the repo**, one per language (later split per feature scope).
- **Switcher + automatic default**: the browser's language picks the default, a switcher overrides it and is
  remembered in a cookie.
- SEO and performance must not regress (same bar as country).

## Assumptions (reviewer: read these first)

1. **Any language in any country.** The country does not limit or pick the language; the default is `en`
   everywhere. A German speaker in the US can choose German. (Country-specific formatting such as Indian digit
   grouping `1,00,000` is a follow-up; `en` keeps today's `en-US` formatting so nothing changes for English users.)
2. **Switching language reloads the page.** It happens once per user, and a reload is what makes everything
   consistent at once: Angular's `LOCALE_ID` (which every `currency`/`date`/`number` pipe reads and which cannot
   change after bootstrap), `<html lang dir>`, and every Django response refetched in the new language. This
   replaces a whole class of half-switched-state bugs with one `location.reload()`.
3. **A language is switched on per environment, only when it is complete.** `environment.I18N.languages` lists
   the languages a build may resolve to. Production starts at `['en']`, so shipping the plumbing changes nothing
   for real users; a language is added to production when its translations are done. UAT gets `en fr de es`
   first, and `ar` once the right-to-left work lands (otherwise testers see a half-mirrored layout).
4. **Translated content from Django is Django's job.** We send `Accept-Language`; course titles, descriptions etc.
   come back translated when Django supports it. The large in-repo content files (`core/constants/faq.ts`,
   the legal pages) are out of scope here: legal translations need legal review, and FAQ copy may move to Django.

## How the language is resolved

```
server (SSR):  lang cookie → Accept-Language header (q-ordered) → 'en'   ──► TransferState
browser:       TransferState (SSR pages) → lang cookie → navigator.languages → 'en'   (client-rendered routes)
```

- Every candidate is reduced to its primary subtag (`fr-CA` → `fr`, `ar-AE` → `ar`) and must be in
  `environment.I18N.languages`; anything else is skipped.
- The browser takes the server's answer from `TransferState`, so the server-rendered DOM and the hydrated DOM are
  in the same language (no NG0500). Only client-rendered routes (`auth/**`, `payment/**`, admin), which have no
  server render, resolve on their own.
- The `lang` cookie is written **only** by the switcher. Nothing is auto-saved (the mistake the old `country`
  cookie made).
- Crawlers send no cookie and (Googlebot) no `Accept-Language`, so they always get English. Translated pages are not
  indexed separately; that was accepted when the language was kept out of the URL.

## Tickets (one ticket = one branch = one PR, each under ~400 changed lines)

| #    | Ticket                                                                                                                            | Branch                                | Depends on                       |
| ---- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------- |
| L1   | `feat(core): resolve the visitor's language and send it to the API`                                                               | `feat/MIL-<n>-language-resolution`    | country resolution merged        |
| L2   | `feat(core): add Transloco and a language switcher, translating the header and footer`                                            | `feat/MIL-<n>-transloco-switcher`     | L1                               |
| L3   | `refactor(shared): use logical start/end utilities so layouts can mirror` (then `layout`, then per feature)                       | `refactor/MIL-<n>-rtl-logical-<area>` | none (zero visual change in LTR) |
| L4   | `feat(core): right-to-left layout for Arabic` (direction-implying icons, Swiper `dir`, enable `ar` on UAT)                        | `feat/MIL-<n>-rtl-arabic`             | L1, L3                           |
| L5…n | `feat(<scope>): translate the <feature> UI` (auth, payment, offerings, home, library, tracker, partners…)                         | `feat/MIL-<n>-i18n-<feature>`         | L2                               |
| —    | Backend: Django honours `Accept-Language`, sends `Vary: Accept-Language`; optional `language` on the user for cross-device memory | —                                     | —                                |

**This prompt implements L1.** L2 onward each get their own prompt and approval.

### L1 Jira ticket

**Summary:** `feat(core): resolve the visitor's language and send it to the API`
**Issue type:** Story · **Component / scope:** core
**Branch:** `feat/MIL-<n>-language-resolution`
**Links:** `prompts/language-i18n.md` · relates to the country-resolution ticket · blocks L2, L4, L5…

#### Context

Five languages are coming. Before any string is translated, the app needs one answer to "which language is this
visitor in", identical on server and browser, and Django needs to receive it.

#### Current behaviour

No language concept. `<html lang="en">` is hard-coded (`src/index.html:2`), `LOCALE_ID` is Angular's default
`en-US`, and API requests carry only the browser's own `Accept-Language` (none at all for SSR calls from Node).

#### Expected behaviour

- `LanguageContext.current` resolves as above.
- Every non-external API request (browser and SSR) carries `Accept-Language: <lang>`.
- `<html lang>` and `dir` (`rtl` for Arabic) match the language, set during SSR.
- `LOCALE_ID` is the language; Angular locale data for it is loaded lazily, only for non-English visitors.
- Production (`I18N.languages = ['en']`): identical to today.

#### Scope

- In: the resolution, the API header, `<html lang dir>`, `LOCALE_ID` + lazy locale data, environment config, specs.
- Out: Transloco, the switcher, any translated string (L2/L5), RTL styling (L3/L4), per-country formatting.

#### Acceptance criteria

- [ ] `Accept-Language: fr` reaches Django from the browser **and** from SSR when the visitor's language is French.
- [ ] `lang` cookie beats `Accept-Language`; an unsupported or disabled language falls through to the next source.
- [ ] Server-rendered `<html lang="fr">`; Arabic gives `dir="rtl"`.
- [ ] Hydration uses the server's language (TransferState); no NG0500.
- [ ] `{{ 1234.5 | number }}` renders `1 234,5` in French, `1,234.5` in English.
- [ ] Production build: no locale-data chunk requested, `lang="en"`, SEO output byte-identical to `master`.
- [ ] Initial bundle not larger than `master` beyond a few hundred bytes (locale data must be lazy).
- [ ] `pnpm lint`, `pnpm ng test --watch=false`, `pnpm build:prod` green (state the environment).

**Estimate:** M

## L1 design

| File                                                               | Change                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/constants/languages.ts` (new)                                | `SUPPORTED_LANGUAGES = ['en','ar','fr','de','es']`, `DEFAULT_LANGUAGE = 'en'`, `RTL_LANGUAGES = ['ar']`, `LANGUAGE_COOKIE = 'lang'`                                                                                                                                        |
| `core/models/language.model.ts` (new)                              | `Language` union type, same pattern as `CountryCode`                                                                                                                                                                                                                       |
| `core/utils/language.ts` (new, + spec)                             | `toLanguage(tag)`: primary subtag, must be enabled in this environment. `pickLanguage(tags)`: first enabled. `parseAcceptLanguage(header)`: q-ordered tags                                                                                                                 |
| `core/services/language-context/language-context.ts` (new, + spec) | `@Service()`; `readonly current: Language`, resolved once (a switch reloads). Server: cookie → `REQUEST` `Accept-Language` → `en`, written to TransferState. Browser: TransferState → cookie → `navigator.languages` → `en`. `dir` getter                                  |
| `configuration/language.ts` (new)                                  | `provideLanguage()`: `LOCALE_ID` from `LanguageContext`; an app initializer that sets `<html lang dir>` via `DOCUMENT` and, for non-English only, `await import()`s that one Angular locale and registers it (explicit map of four imports, so each is its own lazy chunk) |
| `app.config.ts`                                                    | add `provideLanguage()`                                                                                                                                                                                                                                                    |
| `core/interceptors/app/app-interceptor.ts` (+ spec)                | set `Accept-Language` from `LanguageContext.current`; external requests untouched                                                                                                                                                                                          |
| `environments/*.ts`                                                | `I18N: { languages: [...] }`: production `['en']`, development (UAT) `['en','fr','de','es']`, local all five                                                                                                                                                               |

**Why `Accept-Language` costs no extra request:** it is a CORS-safelisted request header (for values like `fr`),
so unlike `X-Country-Code` it never triggers a preflight and needs no backend CORS change. Django reads it with
its standard `LocaleMiddleware`, which also adds `Vary: Accept-Language`.

## Security

- The cookie and `Accept-Language` are user-controlled; they only ever select from the enabled list, never reach
  a template, path or `import()` unvalidated. The locale import map is a fixed object, not a computed path.
- Nothing about language affects price or permissions.

## Checks to run

```bash
pnpm lint
pnpm ng test --watch=false
pnpm build:prod
pnpm check:structure
```

## How to verify

1. Production bundles, against a `master` build of the same commit (same in-process probe as the country work):
   identical SEO output, `lang="en"`, no locale chunk, initial bundle size.
2. A development build probed with `Accept-Language: fr-CA,fr;q=0.9` → `<html lang="fr">`; with cookie
   `lang=de` and `Accept-Language: fr` → `de`; with `Accept-Language: ar` → `lang="ar" dir="rtl"` only where `ar`
   is enabled.
3. Dev server in the browser: set `lang=fr`, reload; the network tab shows `Accept-Language: fr` on API calls,
   numbers format the French way, console has no NG0500; switching the cookie back restores English.

## Risks

- **Mixed-language pages on UAT** until each feature is translated (L5…n): English UI text with French number
  formatting and, once Django ships, French course content. That is why production stays `['en']` until a
  language is complete.
- **Arabic before L3/L4** would mirror flex layouts but not the ~540 physical `ml-/pl-/left-/text-left` classes
  (116 files): `ar` stays off on UAT until then.
- Chrome's Accept-Language reduction sends only the top language. Fine: we only need the top supported one.

## L1 implementation notes (2026-10-01)

- `provideLanguage()` lives in `src/app/configuration/language.ts`, beside `provideIconsProvider()`: that folder
  holds app-level provider functions, while `core/config/` holds static data.
- `ENABLED_LANGUAGES` is an `InjectionToken` (factory: `environment.I18N.languages` filtered through
  `SUPPORTED_LANGUAGES`), so specs can enable languages the test environment doesn't.
- `LOCALE_ID` is `en-US` for English (Angular's own default), and `dir` is only written for right-to-left, so
  the English document is byte-identical to before.
- **Measured (local macOS, Node 24, production bundles):**
  - SEO output identical to `master` (59 lines).
  - Production resolves every visitor to `en` (`<html lang="en" class="dark">`, unchanged).
  - Initial bundle 235.25 → 236.01 kB transfer (+0.76 kB: the resolver, parser and provider). Raw stays 1.02 MB.
  - Locale data is lazy: one ~2 KB chunk per language, downloaded only by visitors in that language.
- **UAT build probed:** `fr-CA` → `fr`, cookie `de` beats `fr`, `es-MX` → `es`, `ar-AE` → `en` (not enabled
  on UAT), no preference → `en`; the server's answer is in `TransferState`.
- **Browser (dev server, local config):** cookie `lang=fr` → `<html lang="fr">`. In-app navigation sent
  `Accept-Language: fr` on every Django call; the Supabase call, which uses its own client, has none. No CORS or
  NG0500 errors. `lang=ar` → `dir="rtl"`: the header mirrors, the physical spacing doesn't yet (L3/L4).
- **Found, not fixed (separate task):** `app-interceptor.spec.ts` fails to compile when run on its own (`Buffer`
  in `auth-session.ts`), at HEAD too. It passes inside the full suite only because other specs pull in Node's
  typings.
- **L1 doesn't touch any file the country commit changed,** so it can branch from `master`.
