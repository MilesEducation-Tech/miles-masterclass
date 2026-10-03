# Language L5: translate the feature pages

Status: **approved 2026-10-03 ("start L5"); L5a implemented, uncommitted.** Builds on L1–L4 (merged as
#49–#56). Assumption 4 was not answered, so the strict reading (JSON counts) stands.
L5 is a series (`L5…n` in `prompts/language-i18n.md`). This prompt locks the mechanism every feature uses,
plans the series, and details the first two PRs. Later PRs follow the same recipe without a new prompt unless
they need a decision (marked ⚑ below).

## Goal

Feature pages speak the visitor's language, the way the header and footer have since L2. Each feature owns its
dictionary, which loads with the feature's route, so the root dictionary (initial bundle) stays layout-only.

## What was read

- L1–L4 prompts; `configuration/language.ts`, `core/services/translation-loader/translation-loader.ts`,
  `testing/transloco.ts`, `src/i18n/i18n.spec.ts`, `src/i18n/en.json`.
- Transloco 8.4 `setTranslation` / `load` source: `setTranslation(dict, lang, { emitChange: false })` merges
  into the already-loaded language, and the pipe reads the merged map synchronously.
- `features/auth/` end to end: `auth.routes.ts`, `auth.ts|html`, `pages/login/`, `pages/profile/`,
  `services/auth-facade.ts`, `core/models/auth.model.ts` (`toAuthFailure`), the two auth specs;
  `app.routes.server.ts` (`auth/**` is client-rendered).
- A string census of every feature and `shared/` template (below).

## Locked mechanism (applies to every L5 PR)

1. **Files:** `src/i18n/<feature>/<lang>.json` (L2 decision 1), keys **without** the feature prefix. They are
   merged under `<feature>.*`, so `src/i18n/auth/en.json` → `auth.login.sendOtp`. Two features can't collide.
2. **Loading: a route resolver, not Transloco scopes.** Transloco's scopes load from inside the pipe, after
   the component renders: on the server that renders empty text unless SSR happens to wait, and in the browser
   it flashes. A resolver is part of navigation, so SSR waits for it and nothing renders before it.
   ```ts
   resolve: { i18n: featureTranslations('auth', en, { ar: () => import(…), fr: …, de: …, es: … }) }
   ```
   - **English is a static import in the feature's route file**, so it ships inside the feature's lazy chunk:
     English never waits on a translation request (L2 decision 2).
   - **Other languages are lazy chunks.** The server puts what it loaded into `TransferState` (`i18n.<feature>.<lang>`),
     so a server-rendered page hydrates without fetching it; client-rendered routes fetch it once.
   - The loader map is typed `Record<Exclude<Language,'en'>, …>`, so a missing language file fails the build.
3. **Strings in TypeScript** (validation messages, toasts, computed labels) use `TranslocoService.translate()`,
   as `header.ts` / `footer.ts` do. It is synchronous because the resolver ran first.
4. **No `[innerHTML]`, ever.** A sentence with a link or `<strong>` inside becomes fragments around the
   element (`auth.login.agreeLead` + link + `auth.login.and` + link). Key names say where each fragment sits.
5. **Plurals keep today's ternary** (`count === 1 ? '….one' : '….other'`) with a `{{ count }}` placeholder.
   Translators write `other` so it reads for any number (Arabic's dual/few/many). No messageformat plugin.
6. **Not translated:** brand and product names (Miles Masterclass, CAIRA, Credly, WhatsApp), `CPE`, data from
   Django or Supabase (course titles, questionnaire questions, server error messages: Django/SSO's job via
   `Accept-Language`, L1 assumption 4), the NASBA statement, legal pages and `core/constants/faq.ts` (legal
   review), and `/admin` (pinned English in L4).
7. **The parity spec covers every dictionary set** (`src/i18n/i18n.spec.ts`): root plus one entry per feature,
   same keys / no empty values / same placeholders as English. Each PR adds its feature's entry.
8. **Specs and stories** get the feature's English through `provideTranslocoTesting()`, which merges every
   feature's `en.json` under its prefix, so assertions on English text keep working.
9. **I draft ar / fr / de / es** for native review, as in L2. They reach no real user before review, because
   production enables only `en`.

## Assumptions (reviewer: read these first)

1. **Auth goes first.** It is every learner's first screen and it is client-rendered, so it proves the
   lazy-chunk path; the `TransferState` path is covered by a spec and by the root loader it reuses.
2. **The SMS consent paragraph is translated**, unlike the NASBA statement: nobody prescribes its wording,
   and consent has to be in a language the person reads. **Compliance must review it** before production
   enables any language. Flagged in the ticket.
3. **`toAuthFailure` fallbacks stay English.** The SSO almost always sends its own `message`, which wins and
   is English until the SSO honours `Accept-Language`; translating the rarely seen fallback alone buys nothing.
4. **The ~400-line PR limit counts the JSON.** Five languages make each key ~5–6 changed lines, so a PR holds
   roughly 40–50 keys. That makes the series ~35 PRs (table below). If JSON lines shouldn't count, PRs can
   be grouped per feature (~15 PRs). **Your call; I've planned for the strict reading.**

## Census and series plan

Template strings only (text nodes + `placeholder` / `aria-label` / `alt` / `title`); TypeScript strings add
roughly a third. Estimates, re-measured per PR.

| PR      | Scope (`feat(<scope>): …`)                                                                                                                                                                                                                       | Strings | PRs |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | --- |
| **L5a** | `auth`: mechanism + auth shell + login page                                                                                                                                                                                                      | ~41     | 1   |
| **L5b** | `auth`: login validation messages + profile page                                                                                                                                                                                                 | ~28     | 1   |
| L5c…    | ⚑ `shared`: components on the home page (cards, carousel, plan-benefits, offerings, app-download, caira-level-stack). Shared strings must live in the **root** dictionary (no route owns them), so they cost initial bundle; measured in that PR | ~200    | 4–5 |
| …       | `home` + `uae-caira` (feature-owned copy, hero, plan pointers)                                                                                                                                                                                   | ~60     | 2   |
| …       | `library` (course, instructor, badge libraries)                                                                                                                                                                                                  | ~50     | 1   |
| …       | `offerings` (masterclass, micro-learning, podcast, webinar, assessments)                                                                                                                                                                         | ~330    | 7–8 |
| …       | `payment` (plans, cart, billing, orders, invoice)                                                                                                                                                                                                | ~210    | 4–5 |
| …       | `tracker` (CPE + CAIRA trackers)                                                                                                                                                                                                                 | ~90     | 2   |
| …       | `partners`, `faculty`, `how-to-claim-credly-badge`, `page-not-found`                                                                                                                                                                             | ~110    | 2–3 |
| …       | `milesverse`, `ai-labs`                                                                                                                                                                                                                          | ~240    | 5   |
| …       | ⚑ `shared` dialogs + remaining shared components                                                                                                                                                                                                 | ~150    | 3–4 |

Out of the series: legal pages, FAQ constants, NASBA statement, admin, PDF templates (invoice / certificate
copy needs a decision on which language a downloaded certificate is in: ⚑ raised with the tracker PRs).

---

## L5a: mechanism + login page

### Jira ticket

**Summary:** `feat(auth): translate the login page`
**Issue type:** Story · **Component / scope:** auth (plus a core resolver)
**Branch:** `feat/MIL-XXX-i18n-auth-login` (rename with `git branch -m` once the ticket exists)
**Links:** `prompts/language-l5-features.md` · `prompts/language-i18n.md` · follows L4 (`95aa7aa`) · blocks L5b

#### Context

Since L2 the header and footer follow the visitor's language, but every page between them is English. The
login page is the first screen every learner sees. This ticket also adds the per-feature loading every later
feature translation reuses.

#### Current behaviour

`/auth/login` is English in every language: the shell (`features/auth/auth.html`, "Back to Home"), the page
copy (`pages/login/login.html`), and the labels built in `services/auth-facade.ts` (tabs, delivery channel,
consent text). There is no way for a feature to ship a dictionary.

#### Expected behaviour

- `featureTranslations(feature, en, lazy)` resolver: English from the feature chunk, other languages as a lazy
  chunk, through `TransferState` on server-rendered routes; merged under `<feature>.*` before the route renders.
- With `lang=fr` (UAT/local), `/auth/login` is French on both steps (identifier and OTP), with no flash of
  English or raw keys, and exactly one French auth chunk downloaded.
- English pages unchanged, and no extra request for English.

#### Scope

- In: the resolver, the auth dictionary (5 languages), the auth shell, the login template, the facade's display
  strings (tabs, delivery note, consent text), parity spec + testing helper.
- Out: login validation / error messages and the profile page (L5b); `toAuthFailure` fallbacks (assumption 3).

#### Acceptance criteria

- [ ] `/auth/login` with `lang=fr|de|es|ar`: every visible string on both steps translated; Arabic right-to-left.
- [ ] No raw key and no English flash on load (screenshot after a hard reload).
- [ ] Network: one `auth` dictionary chunk for non-English, none for English.
- [ ] Production build: login text identical to `master`, initial bundle unchanged (auth dictionary is in the
      lazy auth chunk).
- [ ] A missing or empty key in any `src/i18n/auth/*.json` fails `pnpm ng test`.
- [ ] `pnpm lint`, `pnpm ng test --watch=false`, `pnpm build:prod`, `pnpm build:dev`, `pnpm check:structure`
      green (state the environment).
- [ ] Compliance has seen the translated SMS / email consent text before production enables a language.

**Estimate:** M (~420 lines, of which ~235 JSON)

### Files

| File                                                              | Change                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/services/translation-loader/translation-loader.ts` (+ spec) | extract the `TransferState` read/write into a private `transferred(key, load)`; add `getFeatureTranslation(feature, lang, load)`; export `featureTranslations(feature, en, lazy): ResolveFn<true>` which picks the dictionary for `LanguageContext.current` and calls `setTranslation({ [feature]: dict }, lang, { emitChange: false })`. The resolver injects `TranslocoService`; the loader can't (Transloco injects the loader: a cycle) |
| `src/i18n/auth/{en,ar,fr,de,es}.json` (new)                       | ~41 keys: `shell.*`, `login.*`                                                                                                                                                                                                                                                                                                                                                                                                              |
| `features/auth/auth.routes.ts`                                    | `resolve: { i18n: featureTranslations('auth', en, {…}) }` on the parent route                                                                                                                                                                                                                                                                                                                                                               |
| `features/auth/auth.ts                                            | html`                                                                                                                                                                                                                                                                                                                                                                                                                                       | "Back to Home" and the background `alt` through the pipe               |
| `features/auth/pages/login/login.ts                               | html`                                                                                                                                                                                                                                                                                                                                                                                                                                       | every string through the `transloco` pipe; link sentences as fragments |
| `features/auth/services/auth-facade.ts` (+ spec)                  | `otpDeliveryNote`, `consentLabel` through `translate()`; tab labels translated in the template, tab values unchanged                                                                                                                                                                                                                                                                                                                        |
| `testing/transloco.ts`                                            | English = root + `{ auth: authEn }`                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/i18n/i18n.spec.ts`                                           | loop over dictionary sets: `root`, `auth`                                                                                                                                                                                                                                                                                                                                                                                                   |

## L5b: validation messages + profile page

**Summary:** `feat(auth): translate the profile page and sign-in messages` · **Branch:**
`feat/MIL-XXX-i18n-auth-profile` · **Estimate:** S–M (~250 lines)

- `auth-facade.ts`: the ten login / OTP validation messages and the organisation-SSO message.
- `pages/profile/`: headings, load error, select placeholders, Continue / Save Changes, the required / choose
  messages, "Still to answer" (plural ternary), the save toasts, the leave-without-saving dialog.
- Questionnaire questions, help text and options come from Django: not translated here.
- Acceptance as L5a, plus: the profile spec still passes with English text.

## Security

- Dictionaries are static, reviewed JSON; nothing is bound with `[innerHTML]`, so a translation can't inject
  markup. Fragments keep links as real `<a>` elements with their existing `routerLink` / `href`.
- The resolver only ever loads from a fixed, typed import map keyed by an enabled `Language`; nothing
  user-controlled shapes an import path or a `TransferState` key.

## Checks to run

```bash
pnpm lint
pnpm ng test --watch=false
pnpm build:prod
pnpm build:dev
pnpm check:structure
pnpm format:fix
```

## How to verify

1. **Dev server** (`pnpm start`, port 4101, local config enables all five):
   - `lang=fr` cookie → `/auth/login`: French on the identifier step; switch Mobile / Email; send an OTP to a
     test identifier or force the OTP step → French there too. Hard reload: no English flash, no raw key.
   - Network: one `auth` French chunk; with `lang=en`, none.
   - `lang=ar`: Arabic, right-to-left, inputs stay left-to-right (L4).
   - Console: no missing-key warnings, no NG0500.
2. **Production build**: login text identical to `master`; initial bundle size unchanged (report kB).
3. Screenshots at 375 / 1440 px in English (unchanged) and French.

## Risks

- **German and French run long.** The login card is `max-w-xl`; the consent paragraph and the tab labels are
  checked at 375 px and flagged, not restyled.
- **Fragment order.** Splitting "By signing up … Terms of Service and Privacy Policy" fixes the links' order
  for every language. Fine for these five; a language needing a different order would need a template branch.
- **~35 PRs at the strict line budget** (assumption 4).
- **Drafts need native review**, Arabic above all, and the consent text needs compliance review.
