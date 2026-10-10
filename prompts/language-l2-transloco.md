# Language L2: Transloco, the language switcher, and the translated header and footer

Status: approved 2026-10-01; **L2a + L2b implemented and verified, uncommitted.** Builds on L1 (`prompts/language-i18n.md`, uncommitted on top of
`feat/MIL-14-country-resolution`).

## Goal

Real translated text for the first time. Two PRs, both under ~400 changed lines:

| PR  | Ticket                                                                     | Branch                            |
| --- | -------------------------------------------------------------------------- | --------------------------------- |
| L2a | `feat(core): add Transloco with per-language JSON and a language switcher` | `feat/MIL-<n>-transloco-switcher` |
| L2b | `feat(layout): translate the header and footer`                            | `feat/MIL-<n>-i18n-layout`        |

## What was read

- `layout/header/header.html` (405 lines), `layout/header/nav.config.ts`, `layout/footer/footer.html` (197),
  `layout/footer/footer.ts` (link arrays built in `computed`s), `shared/components/nav-menu-item/` (used only
  by the header), `core/models/nav.model.ts` (`NavItem`, also used by section-nav and several pages: those
  are left alone).
- `shared/ui/native-select` (`select[app-select]`, ng-primitives `NgpNativeSelect`).
- Specs and stories that render the header or footer: `header.spec.ts`, `footer.spec.ts`,
  `main-layout.spec.ts`, `header.stories.ts`, `footer.stories.ts`.
- `@jsverse/transloco` 8.4.0 (peer `@angular/core >=16`, updated 2026-09-26).

## Locked decisions

1. **Translation files:** `src/i18n/<lang>.json`, one per language, nested by area (`nav.*`, `header.*`,
   `footer.*`, `language.*`). Later features add their own Transloco **scope** (`src/i18n/<feature>/<lang>.json`,
   loaded with the feature's lazy route), so the root file only ever holds layout strings and stays small.
2. **Loading, chosen for zero extra requests in production:**
   - **English is imported statically** into the main bundle. It is the default and, for now, production's only
     language, so English pages never wait on a translation request, on server-rendered and client-rendered
     routes alike.
   - **Every other language is a lazy `import()`** of its JSON (its own chunk). The server puts the loaded
     dictionary into `TransferState`, so a server-rendered page hydrates with no translation request. Only the
     client-rendered routes (`auth/**`, `payment/**`, admin) fetch the chunk, once.
   - The dictionary is loaded in `provideLanguage()`'s existing app initializer, BEFORE the first render, so no
     text ever flashes as a key or as English.
   - `reRenderOnLangChange: false`: the language never changes without a reload (L1), so Transloco doesn't watch.
3. **A missing translation fails CI, not production.** A spec checks every language file against `en.json`:
   the same keys, no empty values, and the same `{{ placeholders }}`. Transloco would otherwise display the
   raw key.
4. **The switcher** is `layout/components/language-switcher/`, a native `<select app-select>` (accessible and
   native on phones, no new widget). It lists the languages enabled in this build by their **own** names
   (English, العربية, Français, Deutsch, Español: never translated, so a lost user can always find theirs).
   - Choosing one calls `LanguageContext.use(lang)`, which writes the `lang` cookie (1 year) and reloads the page.
   - **It renders only when more than one language is enabled**, so production (`['en']`) is unchanged.
   - Placed in the footer's bottom bar beside "Cookie settings", which every page and every screen size has.
     A header placement can follow if the design wants it.
5. **What is not translated:**
   - Brand and proper names: Miles Masterclass, Miles AI Labs, CAIRA, App Store, Google Play, LinkedIn,
     YouTube, Instagram, and the partner societies.
   - **The NASBA sponsor statement** (footer): NASBA prescribes its wording, so it stays English in every
     language until compliance decides otherwise.
6. **I draft the Arabic, French, German and Spanish strings.** They are drafts for native-speaker review.
   They can't reach real users before then, because production enables only `en`.

## L2a: Transloco and the switcher

- `pnpm add @jsverse/transloco` (one dependency).
- `src/i18n/{en,ar,fr,de,es}.json`, holding only the switcher's strings in this PR (`language.label`).
- `configuration/language.ts`:
  - `provideTransloco` (available languages = `SUPPORTED_LANGUAGES`, `defaultLang` `en`,
    `reRenderOnLangChange: false`, `prodMode` from `isDevMode()`);
  - a `TranslationLoader` `@Service()` (static `en`, lazy `import()` map for the others, `TransferState`);
  - the initializer sets the active language and awaits its dictionary.
- `LanguageContext.use(lang)` and `LanguageContext.enabled`.
- `layout/components/language-switcher/` (`.ts`, `.html`, `.spec.ts`, `.stories.ts`), placed in `footer.html`.
- `src/app/testing/transloco.ts`: a `provideTranslocoTesting()` helper (English dictionary, synchronous) for
  specs and stories.
- `src/i18n/i18n.spec.ts`: the parity check from decision 3.

## L2b: translate the header and footer

- `nav.config.ts` and `footer.ts` link arrays: `label`, `subLabel`, `badge` and `title` become translation
  keys (`nav.masterClass`, `footer.explore`…). Routes and actions are untouched.
- `header.html`, `nav-menu-item.html` and `footer.html` render them through the `transloco` pipe, plus the
  inline strings: Profile, Order History, Sign out, and the aria-labels (`Go to homepage`,
  `Toggle navigation menu`, `Site navigation`, `Primary`); Download on the, Scan to Download App, Our Location,
  USA / UAE / India, Social, Sponsor ID, the copyright line, Cookie settings, the QR `alt`, and `Schedule a demo`.
- `@for` keeps tracking by the key, which is stable across languages; the accordion value stays the key too.
- About 60 keys × 5 languages.
- The header, footer and main-layout specs and stories get `provideTranslocoTesting()`.

## Security

- **The JSON files are static and reviewed in PRs.** No translation is ever bound with `[innerHTML]`, so a
  translated string can't inject markup.
- **The switcher writes only an enabled `Language`,** checked by `toLanguage()`. The cookie value is never
  trusted on the way back in either (L1).

## Acceptance criteria

- [ ] **Production build:** no switcher, no translation request, header and footer text unchanged, SEO output
      identical to `master`.
- [ ] **UAT build:** the switcher lists English / Français / Deutsch / Español. Choosing one reloads into that
      language. Header and footer text are translated in the server HTML; hydration shows no flash and no NG0500.
- [ ] **Arabic** (local build): text in Arabic, `dir="rtl"`. Spacing still physical until L3/L4, as expected.
- [ ] A missing or empty key in any language file fails `pnpm ng test`.
- [ ] **Initial bundle:** Transloco plus the English layout dictionary, reported in kB; no other language in the
      initial chunks.
- [ ] `pnpm lint`, `pnpm ng test --watch=false`, `pnpm build:prod`, `pnpm build-storybook` pass (state the environment).

## Checks to run

```bash
pnpm lint
pnpm ng test --watch=false
pnpm build:prod
pnpm build:dev
pnpm build-storybook
pnpm check:structure
```

## How to verify

1. **Production and UAT bundles,** served in-process (same probe as L1):
   - production: header and footer text and SEO identical to `master`, no switcher markup;
   - UAT with `Accept-Language: fr`: French header and footer in the server HTML, plus the dictionary in
     `TransferState`.
2. **Dev server in the browser:**
   - change the footer select to Deutsch → the page reloads in German and the `lang` cookie is `de`;
   - no NG0500 in the console, no extra translation request on a server-rendered page;
   - `/auth/login` (client-rendered) fetches the German chunk once.
3. Screenshots of the footer and header at 375 / 1440 px in English (unchanged) and German.

## Risks

- **Transloco is the first i18n code in the initial bundle.** Its cost is measured and reported. If it is
  material, the pipe's runtime is the cost of having i18n at all.
- **German strings run long.** The header nav at `lg` may wrap or crowd; this is checked at 1440 px and flagged,
  not silently restyled.
- **The draft translations need native review,** most of all the Arabic: CAIRA and NASBA terminology.

## Implementation notes (2026-10-01)

- **Header and footer labels are translated in the component, not the template.** `nav.config.ts` holds keys,
  and `Header.translateNav()` translates both navs once. The footer's `t()` translates its own arrays.
  - Brand and partner names never pass through the translator.
  - `nav-menu-item` needed no change.
  - Inline template strings and aria-labels use the `transloco` pipe.
- `TranslationLoader` is a `@Service()` in `core/services/translation-loader/`. `LAZY_DICTIONARIES` is typed
  `Record<Exclude<Language,'en'>, …>`, so a language without a file fails the build.
- **Testing setup:**
  - The unit-test build uses the UAT environment, so the footer renders the switcher in specs. Every spec
    that renders the footer needs `provideTranslocoTesting()`: footer, main-layout and blog-layout.
  - The switching spec observes `location.reload` through a proxy over the real `document`. Replacing
    `DOCUMENT` outright breaks TestBed.
- **Measured (local macOS, Node 24, production bundles, against committed HEAD `5d21d72`):**
  - **Production:** header and footer text identical (76 lines), even for a French browser. No switcher,
    no i18n transfer state, SEO identical.
  - **Initial bundle:** 235.96 → 241.06 kB transfer.
    - L1: +0.76 kB.
    - Transloco: +4.4 kB.
    - English layout dictionary: +0.6 kB.
  - **Other dictionaries:** lazy, ~2 KB each.
- **UAT build, French browser:** the server HTML has the French header and footer, `i18n.fr` in transfer
  state, and the switcher reads "Langue".
- **Browser (dev server, local config):**
  - Picking Deutsch in the footer select reloads the page into German, with the `lang` cookie set to `de`.
  - On a server-rendered page the dictionary comes inside the page's transfer state: none of the 110
    downloaded scripts contains it.
  - The client-rendered `/auth/login` downloads exactly one German chunk.
  - The German guest header fits on one line at 1440 px, and nothing overflows horizontally at 375 px.
  - No NG0500 and no missing-key logs.
- **Not verified:** the signed-in nav in German (no OTP session). Its labels are about the same length as
  the English ones.
- **Flagged, not restyled:** at 375 px the longer German copyright wraps onto two left-aligned lines, where
  the English fits on one. A `text-center` on that `<p>` would fix it for every language.
- **Text still in English, out of scope (L5):** the hero copy on the home page, and the login page's own
  links.
