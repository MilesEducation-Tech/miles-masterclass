# Miles Masterclass v3 — Refactor PLAN

Produced by Phase 0 (`/refactor-phase 0`) on 2026-09-22. Spec: the refactor spec in this folder.
Progress and decisions: `docs/refactor/STATE.md`. Phase 0 report: `reports/phase-00.md`.

Every figure below is measured from the code — the import graph was parsed with a script
(comments stripped, so commented-out routes do not count), and bundle claims were checked against
`docs/refactor/baseline/bundle.json` and the built `dist/`.

## Context

The spec splits the work into **Part A (phases 0–7, structure-only moves)** and **Part B (phases
8–14, modernization)**. Phase 0 is the audit every later phase executes against.

**Headline: the codebase is in far better shape than the spec assumes, and the real work is narrower
than expected.** Zero constructor injection, zero class-based guards/interceptors, zero
`InjectionToken`/`useClass`/`useFactory`, zero `ChangeDetectionStrategy.Eager`, zero committed
`.DS_Store`, no `baseUrl` to remove. Several phases shrink to near no-ops. The genuinely large work is
structural moves (Part A) and three specific bundle/coupling problems named below.

---

## 1. Config baseline

### tsconfig

- `tsconfig.json`: strict, `target: ES2022`, `module: "preserve"` (implies `moduleResolution: bundler`),
  `isolatedModules`, `experimentalDecorators: true`, `importHelpers`.
  **No `baseUrl`, no `paths`.** Phase 2 is purely additive — nothing deprecated to remove.
- `tsconfig.app.json`: `rootDir: ./src`, `include: src/**/*.ts`, excludes specs.
- `tsconfig.spec.json`: `types: ["vitest/globals"]`, plus an explicit `include` of
  **`src/app/shared/core/constant/icon.ts`** — a hard-coded path Phase 3 must update.
- `.storybook/tsconfig.json`: extends `tsconfig.app.json`, widens `rootDir` to `..`.
- `pnpm exec tsc -p tsconfig.app.json --noEmit` is **clean** — no TS 6 deprecation warnings.

### angular.json

- `@angular/build:application`; `outputMode: "server"`, SSR entry `src/server.ts`.
- Styles `src/styles/{styles,animation,dialog}.css` in three targets (build, storybook, build-storybook).
- Budgets: initial **2 MB warn / 3 MB error**; `anyComponentStyle` 12 kB / 16 kB.
- `fileReplacements` exist for `development` and `local` only — the hook Phase 1 uses for mocks.
- **`test` target has no options at all** — no `setupFiles`. Adding `src/test-setup.ts` needs a new
  `test.options` block.
- `lintFilePatterns: src/**/*.{ts,html}` — path-agnostic, no move impact.

### .storybook/main.ts

`stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)']` — **path-agnostic; no move
breaks it.** (The spec's §2.10 lists this as a thing to update; it isn't.)

### eslint.config.mjs

- Flat config: ESLint 10 + angular-eslint 22 + typescript-eslint 8 + storybook plugin.
- `ignores` hard-codes **`src/app/shared/core/constant/location.ts`** and `location-min.ts` —
  move-sensitive, Phase 3 must update both paths.
- `@angular-eslint/prefer-inject` is **off** → Phase 8 turns it on.
- No `eslint-plugin-boundaries`, no `eslint-import-resolver-typescript` → Phase 7 installs both.

### Hydration (current) — `src/app/app.config.ts`

```ts
provideClientHydration(
  withEventReplay(),
  withHttpTransferCacheOptions({ includePostRequests: false }),
),
```

**`withIncrementalHydration()` is NOT enabled.** Router adds `withComponentInputBinding()`,
`withInMemoryScrolling({scrollPositionRestoration:'top', anchorScrolling:'enabled'})`,
`withViewTransitions()`. Three `provideEnvironmentInitializer` calls eagerly resolve `Network`,
`UpdateChecker.init()`, `Analytics.init()`.

⚠️ `app.config.ts` imports `partnerMockInterceptor` from
`./admin/partner-platform/shared/services/partner-mock-interceptor` — a dev-only mock wired into the
root injector from an admin feature folder. Phase 1 target.

### Deploy / misc (no `src/` paths → no move impact)

`vercel.json`, `vercel.sh`, `api/index.mjs`, `proxy.conf.json`, `.postcssrc.json`,
`.husky/pre-commit` (`pnpm exec lint-staged`).

### Already satisfied, contrary to the spec

- **Phase 1 bullet 1 is a no-op:** `git ls-files | grep DS_Store` → empty. Six `.DS_Store` files exist
  on disk but are already git-ignored.
- **§2.10 `.storybook/main.ts` globs:** path-agnostic, nothing to update.
- **§2.10 Tailwind `@source` paths:** no `@source` directive exists anywhere (see §8).

### Postman environments — secret KEY NAMES only (no values read; every secret value is empty)

`base_url`, `token`_, `refresh_token`_, `lms_notification_webhook_key`_, `miles_one_webhook_secret`_,
`login_identifier`, `otp_code`, `auto_refresh`, `auto_capture`, `token_refresh_skew_seconds`, plus id
placeholders (`address_id`, `course_id`, `chapter_id`, `attempt_id`, …). `*` = `type: secret`; all four
are empty in all three env files (LOCAL / UAT / PROD). `Postman Collection/` → `postman/` in Phase 1
(quote the path — it has a space).

---

## 2. Import-boundary violations (~150 real)

Legitimate edges excluded: routes aggregators (`features/features.ts`, `admin/admin.routes.ts`) and
`admin/<x> → admin/shared`.

| Violation                                                                                                                        | #   | Root cause                                                                          | Fixed in |
| -------------------------------------------------------------------------------------------------------------------------------- | --- | ----------------------------------------------------------------------------------- | -------- |
| `admin/partner-platform-v2 → admin/partner-platform`                                                                             | 39  | v1's `shared/` is the **live** models/services/dialogs layer for v2                 | 6        |
| `core → shared`                                                                                                                  | 25  | `Utils` + `EngagementDialog` open shared dialogs; core constants use `shared/utils` | 3/4      |
| other admin feature → `partner-platform`                                                                                         | 17  | `users`, `seat-tracker`, `admin-users`, `leads`, `user-onboarding`                  | 6        |
| `features/partners → features/home`                                                                                              | 14  | every partner page imports `home/components/offerings/*`                            | 5        |
| `features/* → pages/faq`                                                                                                         | 12  | the FAQ component is consumed by 6 features                                         | 4        |
| `shared → features/*`, `shared → admin/*`, `shared → pages/ai-labs`                                                              | 20  | feature-specific dialogs parked in `shared/components/dialog/`                      | 4        |
| `features/offerings → features/{shared,partners,payment}`                                                                        | 9   | `FeatureFacade`, `partner-content-list`, `PaymentFacade`                            | 3/5      |
| `pages/uae-caira → features/{partners,home,offerings}` + faq                                                                     | 7   | landing page composes feature components                                            | 5        |
| `features/home → features/{offerings,shared,partners}` + faq                                                                     | 6   | same                                                                                | 5        |
| `core → features/{shared,payment}`                                                                                               | 4   | `Utils`, `EngagementDialog`, `core/guards/payment/payment.guard.ts`                 | 3        |
| **`caira-tracker ⇄ cpe-tracker` (circular)**                                                                                     | 4   | each imports the other's utils/components                                           | 5        |
| `layout/footer-overlay → features/{shared,payment}`                                                                              | 2   |                                                                                     | 4/5      |
| `blog → faq`, `library → partners`, `faculty → payment`, `cpa-landing → features/shared`, `how-to-claim-credly-badge → partners` | 7   |                                                                                     | 5        |

### Five findings that drive the move map

1. **`features/shared/services/feature-facade` is not a feature service.** 15 importers spanning
   `core/`, `shared/`, `layout/` and 5 features. Per the placement rule it moves to
   **`core/services/feature-facade.ts`** — matching AGENTS.md §3, which already calls `FeatureFacade`
   a deliberate root-singleton exception. `section-filters-facade` moves with it (imported by
   `shared/components/carousel`).
2. **`pages/faq/shared/components/faq-content` is shared UI.** 16 importers across offerings, blog,
   home, partners, uae-caira, connect-us and `pages/shared`. Moves to
   **`shared/components/faq-content/`**; the routed FAQ page stays a feature.
3. **`shared/core/services/utils/utils.ts` (853 lines, 57 importers) is the worst knot.** It opens 9
   shared dialogs and imports `features/payment` + `features/shared`. **Decision taken: it moves to
   `shared/services/utils.ts` in Phase 4** — it is a dialog-launching UI service, not infrastructure.
   `shared → shared` is legal, so 17 violations clear with a pure move and no logic change.
   `core/guards/payment/payment.guard.ts` moves into `features/payment/guards/` in Phase 5.
4. **`admin/partner-platform/shared/` is the de-facto `admin/core/`** — 7 admin features plus all of
   partner-platform-v2 depend on it. v1 cannot be deleted before that layer is extracted, and v2 also
   imports three dialogs out of v1's _dead_ routed pages (`allocate-seats-dialog`,
   `network-form-dialog`, `create-partner-code-dialog`). Those dialogs must be kept and relocated.
5. **`pages/` is a second features root.** `features/features.ts` loads 11 things out of `pages/`.
   The target structure has no top-level `pages/`, so Phase 5 dissolves it (mapping in §3).

---

## 3. Move map (old → new, by phase)

### Phase 1 — Hygiene

| From                                                                                 | To                              | Note                                                                                                                                            |
| ------------------------------------------------------------------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Postman Collection/`                                                                | `postman/`                      | quote the space in `git mv`                                                                                                                     |
| `src/app/shared/components/__mocks__/` (4)                                           | `src/app/testing/mocks/`        | story-only consumers; zero production importers                                                                                                 |
| `admin/partner-platform/shared/services/partner-mock-{interceptor,handlers,role}.ts` | `src/app/testing/partner-mock/` | then register **only** in `local`/`development` via `fileReplacements`, and prove absence from prod with `bundle-report.mjs --must-not-contain` |
| `features/home/.../app-download.scss` (0 B), `offerings.scss` (0 B)                  | `.css`                          | empty; `styleUrl` updated                                                                                                                       |
| `features/home/.../floating-assets.scss` (3.1 KB)                                    | `.css`                          | **no** SCSS-only syntax — verified                                                                                                              |
| `features/home/.../laptop.scss` (7.5 KB)                                             | `.css`                          | only `//` comments (23) — convert to `/* */`                                                                                                    |
| —                                                                                    | `.DS_Store` cleanup             | **no-op**, already ignored and uncommitted                                                                                                      |

### Phase 2 — Path aliases

Add to `tsconfig.json` (no `baseUrl`, keep `moduleResolution: bundler`):
`@core/*` → `./src/app/core/*`, `@shared/*`, `@layout/*`, `@features/*`, `@admin/*`,
`@testing/*` → `./src/app/testing/*`, `@env/*` → `./src/environments/*`.
Verify in: prod build, Vitest, `build-storybook`, and ESLint (add `eslint-import-resolver-typescript`).
**Doing this before Phase 3 is essential** — there are no barrels and no aliases today, so every import
is a relative chain up to 6 levels deep; aliasing first collapses the Phase 3–6 diff enormously.

### Phase 3 — Core

`src/app/shared/core/` → `src/app/core/`, with `constant/` → `constants/`. Then, per the placement rule
(code lives at the lowest level that uses it), push these **down** into their single consumer:

| From `shared/core/...`                                                                                                                             | To                                 | Consumer         |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------- |
| `constant/faq.ts`, `models/faq.model.ts`                                                                                                           | `features/faq/{constants,models}/` | pages/faq        |
| `constant/payment.ts`, `constant/location-min.ts`, `guards/payment/payment.guard.ts`                                                               | `features/payment/`                | payment          |
| `constant/{privacy-policy,terms-of-service}.ts`, `models/legal-doc.model.ts`                                                                       | `features/legal/`                  | legal pages      |
| `models/{assessment,feedback-model,form,micro-learning-course,video-player}.model.ts`, `constant/video-player.ts`, `services/app-download-prompt/` | `features/offerings/`              | offerings        |
| `models/{cpe-credit,cpe-tracker,caira-badge}.model.ts`                                                                                             | `features/tracker/`                | trackers         |
| `models/badge.model.ts`                                                                                                                            | `features/library/`                | library          |
| `models/seo.models.ts`, `services/seo/supabase-seo.ts`, `utils/seo/seo-csv.ts`                                                                     | `admin/seo/`                       | admin/seo        |
| `models/admin/*` (3), `services/{admin-auth,audit-log}/`                                                                                           | `admin/core/`                      | admin only       |
| `services/milesverse/`                                                                                                                             | `features/milesverse/services/`    | pages/milesverse |
| `services/salesforce-lead/`                                                                                                                        | `features/faculty/services/`       | pages/faculty    |
| `services/onboarding-api/`, `guards/auth/{auth,guest}.guard.ts`                                                                                    | `features/auth/`                   | auth only        |
| `directives/html-to-pdf.directive.ts`                                                                                                              | _(dead — listed, not deleted)_     | 0 importers      |

Merge `features/shared/services/{feature-facade,section-filters-facade}` → `core/services/`.
Keep in `core/`: `api-client`(52), `logger`(54), `dialog`(95), `notification`(38), `analytics`(20),
`storage`, `supabase`, `auth-session`(9), `account-api`, `viewport`(8), `consent`, `seo-manager`,
`constants/icon.ts`(22), `models/{course,http,feature,aria,profile,payment}`, `seo.constants`.

**`constants/location.ts` (969,250 lines / 25 MB, zero importers) is `git mv`'d, not deleted**
(decision: list only). Its ESLint `ignores` entry must be repointed. Expect a slow `git mv` and a large
`git status`.

### Phase 4 — Shared & layout

`shared/components/*` splits into `shared/{ui,components,dialogs,pipes,directives,utils}`:

- `shared/components/ui/*` → `shared/ui/*` (16 primitives; `ui/aria/*` keeps its folder for now,
  flattened in Phase 10).
- Generic composites stay in `shared/components/`: `carousel`, `slider`, `marquee`, `skeleton/`,
  `heading`, `video-js`, `audio-js`, `cards/`, `section-nav`, `rating-star`, `video-poster`.
- **`shared/core/services/utils/utils.ts` → `shared/services/utils.ts`** (decision taken).
- `pages/faq/shared/components/faq-content` → `shared/components/faq-content/`.
- `shared/core/pipes/*` → `shared/pipes/*`; `shared/utils/*` stays.
- **Dialogs move to their owners** — this is the bulk of Phase 4 and clears 20 violations:

| Dialog(s)                                                                                                                                 | New home                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `cart-drawer`, `coupon`, `firm-sponsorship`, `partner-code-prompt`, `subscription`                                                        | `features/payment/dialogs/`              |
| `assessment-result`, `html-content`, `select-cpe-mode`, `video`, `webinar-details`                                                        | `features/offerings/dialogs/`            |
| `certificate-download`, `cpe-compliance`, `caira-badge-info`                                                                              | `features/tracker/dialogs/`              |
| `ai-lab-dialog`, `ai-lab-agent-dialog`, `ai-lab-terms-dialog`                                                                             | `features/ai-labs/dialogs/`              |
| `app-download`                                                                                                                            | `features/home/dialogs/`                 |
| `create-partner-admin`, `partner-report-preview` (+ `report-preview.format.ts`), `edit-admin-roles`, `apply-partner-code`, `block-status` | `admin/` (owning feature)                |
| `global-search`                                                                                                                           | `layout/dialogs/`                        |
| `utils-dialog`, `share`, `course-info`, `filter`, `profile-completion`, `version-update`, `calendly`                                      | stay in `shared/dialogs/` (2+ consumers) |

`layout/` already exists and is correct. Add from `pages/`: `main-layout`, `plain-layout`,
`blog-layout`, `dynamic-layout`. Storybook globs and Tailwind `@source` need **no** change.

### Phase 5 — Features (run per feature)

Dissolve `pages/` and remove every internal `shared/` layer.

| From                                                                           | To                                                                                               |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `app/auth/` (+ its `shared/` layer flattened)                                  | `features/auth/{pages,services}/`                                                                |
| `pages/faq/`                                                                   | `features/faq/`                                                                                  |
| `pages/uae-caira/`                                                             | `features/uae-caira/`                                                                            |
| `pages/milesverse/`                                                            | `features/milesverse/`                                                                           |
| `pages/ai-labs/`                                                               | `features/ai-labs/`                                                                              |
| `pages/instructor-details/`, `pages/faculty/`                                  | `features/instructors/`, `features/faculty/`                                                     |
| `pages/{privacy-policy,terms-of-service,compliance,shared/components/legal-*}` | `features/legal/`                                                                                |
| `pages/{connect-us,how-to-claim-credly-badge,page-not-found}`                  | `features/<name>/`                                                                               |
| `pages/{main,plain,blog,dynamic}-layout/`                                      | `layout/` (Phase 4)                                                                              |
| **`features/{caira-tracker,cpe-tracker}/`**                                    | **`features/tracker/{caira,cpe}/`** (decision taken — kills the cycle; sub-features are allowed) |
| every `features/<f>/shared/pages/*`                                            | `features/<f>/pages/*`                                                                           |
| every `features/<f>/shared/components/*`                                       | `features/<f>/components/*`                                                                      |
| `features/payment/shared/service/`                                             | `features/payment/services/` (singular → plural)                                                 |
| `features/offerings/<type>/shared/*`                                           | `features/offerings/<type>/{pages,components}/*`                                                 |

Extract the four route tables that live inside component files into real `<feature>.routes.ts`:
`auth/auth.ts` → `auth.routes.ts`; `features/features.ts` → `features.routes.ts`;
`features/library/library.ts` → `library.routes.ts`; `features/offerings/offerings.ts` →
`offerings.routes.ts`. Then delete the empty `app/pages/`.

**Remaining cross-feature edges to resolve in Phase 5** (move the magnet, don't duplicate it):
`features/home/components/offerings/{offerings.ts,offerings.config.ts}` has 14 importers from
`features/partners` → promote to `shared/components/offerings-grid/`. `partner-content-list` has 6
cross-feature importers → promote to `shared/components/`. `PaymentFacade` is already
`providedIn:'root'` so its type imports are fine, but the component import in `pages/faculty`
(`plan-scrolling-gallery`) needs promoting to `shared/`.

### Phase 6 — Admin

- `admin/shared/{guards,utils,directives}` → `admin/core/`; `admin/shared/{pages/admin-*-password,
components/admin-login, components/forbidden}` → `admin/auth/pages/`.
- **Extract `admin/partner-platform/shared/` → `admin/core/`** (models, `partner-admin-me`,
  `partner-network-facade`, `partner-superadmin-facade`, `admin-provisioning`) and
  `admin/shared/components/{stat-card,allocation-picker}`. This alone clears 56 of the 66 admin edges.
- Relocate the three dialogs v2 imports out of v1's dead routed pages into
  `admin/partner-platform-v2/dialogs/`.
- Restructure partner-platform-v2 **under its current name**; leave v1 in place; propose the cutover
  (v1 deletion + `-v2` name drop) in the report as a decision request.

### Phase 7 — Boundaries

Install latest `eslint-plugin-boundaries` (read its `node_modules` README first) +
`eslint-import-resolver-typescript`. Encode the boundary rules with `boundaries/dependencies`, object
selectors and `{{ }}` templates. Add `no-restricted-imports` (no relative imports crossing a top-level
folder), a `NgClass`/`NgStyle` ban, and an `@angular/aria` ban. Expected residue needing the user's
temporary-warning decision: the `Utils`→dialog imports that Phase 11 converts to dynamic `import()`.

---

## 4. Services inventory

**35 root singletons, 20 route/component-scoped, 5 already `@Service()`.**

- **Zero constructor injection anywhere.** Every service uses `inject()`. Phase 8 bullet 1 is a no-op.
  (The only parameterised constructors belong to two non-decorated helpers: `FeatureResource` and
  `DialogRef`.)
- **Zero class-based interceptors and zero class-based guards.** All 3 interceptors and all 13
  guards/resolvers are already functional. Phase 8 bullet 3 is a no-op.
- **Zero `InjectionToken`, zero `useClass`/`useValue`/`useExisting`/`useFactory`** in production code.
  → **Every `@Injectable` can become `@Service()` with no kept exceptions.** Phase 8 is mechanical:
  ~35 `providedIn:'root'` → `@Service()`, ~20 route-scoped → `@Service({ autoProvided: false })`.
- Already `@Service()`: `AccountApi`, `ApiClient`, `AuthSession`, `OnboardingApi`, `AuthFacade`
  (the last with `autoProvided: false`).
- Route-scoped facades listed in `providers:` — `MasterclassFacade`, `ChapterFacade`,
  `FinalAssessmentFacade`, `FeedbackFacade`, `MicroLearningCourseFacade`, `Tracks`, `UaeCairaFacade`,
  `LeadsFacade`, `UserReportFacade`, `UserOnboardingFacade`, `RbacFacade`, `AdminUsersFacade`,
  `PartnerUsersFacade`, `PartnerAdminMe`, `PartnerNetworkFacade`, `PartnerSuperAdminFacade`,
  `PartnerReportFacade`.

### `injectAsync` candidates (spec §4.5)

| Service                                     | Heavy lib                                         | Status                                                                                                                               |
| ------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `core/services/html-to-pdf`                 | html2canvas-pro + jspdf                           | **already done** — both consumers use `injectAsync`; lands in its own 652 KB chunk. The spec lists it as "required"; it is complete. |
| `features/tracker/.../certificate-download` | jszip (already dynamic inside `blob-download.ts`) | eligible — confirm the chunk                                                                                                         |
| `assessment-result-dialog`                  | **canvas-confetti, static import in a component** | not a service — fix with one `await import('canvas-confetti')` (currently a 28 KB chunk, low stakes)                                 |
| `core/services/milesverse`                  | @milesverse/sdk                                   | **verified NOT a problem** — the SDK sits in an 8 KB lazy chunk, absent from the initial bundle. Leave as plain `inject()`.          |
| admin/partner report + CSV export services  | jszip via `blob-download`                         | eligible, admin-only → **no prefetch**                                                                                               |
| `admin/seo` seo-csv                         | none heavy                                        | not worth it                                                                                                                         |

**Do NOT convert** (spec §4.5 exclusions, all present here): `AuthSession`, `Analytics`, `Consent`,
`Utm`, `Logger`, `Storage`, `Viewport`, `Network`, `NotificationService`, `Dialog`, `FeatureFacade`.
Note `Network`, `UpdateChecker` and `Analytics` are eagerly resolved in `app.config.ts`.

---

## 5. HTTP inventory

- **`ApiClient` is honoured**: 52 files inject it; only **2** files inject `HttpClient` directly —
  `ApiClient` itself and `features/blog/services/blog-api.ts` (justified: WordPress is a different
  origin). Note many call sites name the injected `ApiClient` `http`, which reads misleadingly.
- **Already migrated:** 4 `httpResource` fields (`AccountApi.user`, `AccountApi.appStatus`,
  `OnboardingApi.questions`, `OnboardingApi.answers`).
- **The Phase 9 workload is 37 `resource()` usages** wrapping `firstValueFrom(api.get(...))` — the
  direct `httpResource` conversions. `rxResource` is unused.
- **~95 READ (GET)** calls → `httpResource`. **~60 MUTATION** (POST/PUT/PATCH/DELETE) → stay on
  `HttpClient` + `.reload()`.
- **7 DOWNLOAD** endpoints stay on `HttpClient` (blob / `observe:'response'`): leads export-csv,
  partner report export-csv, user-report export-csv, partner users export-csv, exercise-files
  download, nasba template, bulk certificate.
- **~10 SEARCH** (debounced/typeahead) stay on `rxResource`/RxJS, **not** `httpResource`: leads,
  partner seats, superadmin firms, onboarding users, company lookup, user-report, instructor library,
  global-search, location-autocomplete, admin audit-log.
- **POLLING: none via HttpClient.** The only real poll is `pages/milesverse/report` around the
  MilesVerse SDK.
- **Supabase (42 calls)** → `resource({params, loader})` for reads, facade methods for mutations.
  Tables: `admin_users`, `admin_roles`, `admin_permissions`, `admin_role_permissions`,
  `admin_user_email_domains`, `admin_audit_log`, `seo_pages`. RPCs: `set_admin_user_roles`,
  `delete_admin_user`, `provision_admin_user`, `touch_admin_login`, `get_my_admin_profile`,
  `log_admin_activity`. Storage bucket `seo-images`.
- **Third backend not in the spec:** `MilesVerse` via `@milesverse/sdk` against
  `environment.MILESVERSE_API_URL`. Interceptor-invisible, like Supabase.
- **`fetch()` bypassing all interceptors** (by design): `update-checker` (`/version.json`),
  `html-to-pdf` (CORS images), `blob-download`, and SSR-only `src/seo.ts` / `src/server.ts`.

---

## 6. Headless UI inventory

**ng-primitives is already the majority.** 20 files import `ng-primitives/*`: combobox, select,
listbox, tabs, menu, accordion, collapsible, toast, progress, input-otp, rating, button.

| Still to migrate                                                                                      | Current                                                                                                                           | Target                                                                                                                   |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **`core/services/dialog/dialog.ts` (325 LOC) + `src/styles/dialog.css` (94 LOC)** backing ~45 dialogs | hand-rolled `createComponent` + `ApplicationRef.attachView`, manual backdrop, escape handler, z-index stacking, animation classes | `ng-primitives/dialog` — **the single biggest Phase 10 item**                                                            |
| `shared/ui/autocomplete/` (713 LOC)                                                                   | hand-rolled overlay, `fixed z-[9999]`                                                                                             | retire in favour of `aria-autocomplete` (294 LOC, primitive-backed, 10 consumers). Its one consumer is `job-sectors.ts`. |
| tooltip in `categories-list`                                                                          | hand-rolled `[style.top.px]`/`[style.left.px]`                                                                                    | `ng-primitives/tooltip`                                                                                                  |
| popover / dropdown panels in `header.html`, `nav-menu-item`, `user-avatar-menu`, `admin-sidebar`      | hand-rolled `absolute top-[calc(100%+8px)]`                                                                                       | `ng-primitives/popover`                                                                                                  |
| `role="switch"` buttons in `ai-lab-agent-about`, `consent-banner`                                     | hand-rolled                                                                                                                       | `ng-primitives/switch` (installed, unused)                                                                               |
| raw `type="radio"` in `select-cpe-mode`, `aria-input`, `ai-lab-agent-dialog`                          | raw inputs                                                                                                                        | `ng-primitives/radio` (installed, unused)                                                                                |
| `pages/faq/.../faq-item` accordion                                                                    | hand-rolled + 18-line CSS keyframe                                                                                                | `ng-primitives/accordion`                                                                                                |

**CDK: only 2 usages in all of `src/`** — `CdkTrapFocus` in `layout/header` and `BreakpointObserver`
in `how-to-claim-credly-badge`. ng-primitives covers neither directly; recommend **keeping both**
(decision request for Phase 10). CDK is also pulled transitively by ng-primitives overlays
(`styles.css:418` z-index-patches `.cdk-overlay-container`).

**`@angular/aria`: zero usage, not in `package.json`.** **`@floating-ui/dom`: zero direct usage** —
only via ng-primitives. Both spec concerns are already clean.

---

## 7. @defer, hydration & bundle

**34 live `@defer` blocks across 11 templates. All 34 have `@placeholder`. Only 1 has `@loading`;
none has `@error`.** Triggers already follow the spec: `on viewport; prefetch on idle` below the fold,
`on idle` for non-critical. Existing blocks: masterclass (8), podcast (8), micro-learning (5),
webinar (3), home (3), partnership-content (2), corporate/illinois/bkn (1 each), carousel (1),
ai-labs (1).

### The three real bundle findings (measured)

1. **The largest lazy chunk is not a library — it is committed data.**
   `chunk-XLYZGBBV.js` at **3418 KB raw / 839 KB gzip** (33% of all lazy JS) is
   `shared/core/constant/location-min.ts` — 483,302 lines of country/state data, confirmed by 5,038
   `state_code` occurrences. Its **only** consumer is `features/payment/.../billing.ts`, which uses it
   for a country dropdown and two lookups. Every user reaching billing downloads 839 KB gzip for that.
   **Phase 11 recommendation:** serve it from the API (`v2/locations/autocomplete/` already exists) or
   at minimum `await import()` it behind the country field. Biggest single perf win in the audit.
   Its sibling `location.ts` (969,250 lines / 25 MB) has **zero** importers.
2. **`@import 'video.js/dist/video-js.css'` at `styles.css:2`** ships player CSS globally on every
   route, even though the video.js _JS_ is correctly dynamic-imported. Move it to the
   `video-js`/`audio-js` component `styleUrl`.
3. **`withIncrementalHydration()` is the highest-leverage one-liner in Part B.** All 34 `@defer`
   blocks are already correctly triggered and placeholder-backed but render only their placeholder on
   the server. `ai-labs.html:226` has a comment explicitly accepting "these sections aren't in the SSR
   HTML" as a trade-off — incremental hydration removes it.

**Initial bundle is 501.9 KB raw / 101.6 KB gzip (12 files)** — nowhere near the 2 MB budget.
**AGENTS.md §9's claim that "the initial bundle sits near its 2.00 MB budget" is stale and should be
corrected in Phase 14.** The problem is the lazy side: 274 chunks / 10.3 MB raw.

Heavy libraries are mostly already split: `three` (512 KB chunk, lazy engine import), `video.js`
(712 KB, dynamic), `jspdf`+`html2canvas` (652 KB, `injectAsync`), `jszip`/`gsap`/`swiper/element`
(dynamic), `@milesverse/sdk` (8 KB chunk), `lenis` (**not imported anywhere** — dependency is unused).
**The only static heavy import left is `canvas-confetti` in `assessment-result-dialog.ts:10`.**

`app.routes.ts` eagerly imports `PageNotFound`, `BlogLayout` and `Compliance` into the initial
bundle — worth converting to `loadComponent` in Phase 11.

---

## 8. Tailwind inventory

- **117 non-empty component stylesheets + 96 empty ones.** Of the 117, **41 are the identical 3-line
  `:host { display: block }` boilerplate** → replace with `host: { class: 'block' }` in the decorator.
  **137 stylesheet files deletable with zero visual change.**
- **MUST STAY (~30 files)** with reasons: `@keyframes` (`laptop.scss` 8, `floating-assets.scss` 8,
  `briefing-session.css` 4, `report.css` 5, `dialog.css` 6, `animation.css` 9, `marquee`,
  `record-disk`, `faq-item`, `empty-cart`, `payment.css`, `slider-skeleton`, …); third-party overrides
  (`micro-learning-reel-card.css` — 35 `::ng-deep` + 30 `.vjs-*`; `carousel.css` `.swiper-*`;
  `blog-post.css` 27 `::ng-deep` for CMS `innerHTML`); complex `:host`/pseudo rules
  (`ai-labs.css` 1096 LOC, `milesverse/*`, `surround-carousel`, `caira-level-stack`).
- **CONVERTIBLE**: `slider.css` (84), `plan-card.css` (32), `course-info.css` (31),
  `horizontal.css` (19), `coming-soon.css` (12), `coupon-dialog.css` (8), `faculty.css` (5),
  `invoice.css` (5), `badge-hero-card.css` (2), plus 6 one-line files.
- **`@theme inline` at `styles.css:147-206`**: 33 colors, 3 fonts, 4 radii, 8 shadows — all `var()`
  indirection over `:root` (68 vars) with an `.admin-theme` override (~45 vars incl. the `--mm-*`
  status scale). **Bug: `--radius-4xl` is used at `styles.css:297,303,308` but never defined**, so
  scrollbar radii silently resolve to nothing.
- **No `@source` directives exist.** Tailwind v4 relies entirely on auto-detection. Worth verifying
  class detection reaches `.ts` files with `cn()` string literals — and it means **no `@source` paths
  need updating during any move.**
- **`NgClass`/`NgStyle`: only 13 occurrences in 9 templates**, 2 `.ts` imports. Small Phase 12 item.
- **Hardcoded colors** worth tokenising: `payment.html` (49), `empty-cart.html` (45),
  `ai-labs.css` (67), `badge-level.ts` (18), `plan-card.ts` (11), `ui/progress/progress.ts` (4 — a
  design-system component with raw hex). Excluded as legitimate: `icon.ts` (420, inline SVG),
  `partner-icons.ts` (36, SVG), `surround-carousel.engine.ts` (12, three.js materials).
- **`cn()`** lives at `shared/utils/cn.ts`, used by 22 files. Gap: `ui/{select-menu,checkbox-list,
progress,spinner,error-state,page-loading}` don't use it — `select-menu.ts` hardcodes a long class
  string in its `host` block.

---

## 9. Change detection (list only)

**18 explicit `changeDetection:` lines in all of `src/` — every one is `OnPush`. Zero `Default`,
zero `Eager`.** Since Angular 22 defaults to `OnPush`, all 18 (plus their `ChangeDetectionStrategy`
imports) are redundant, but the spec's §8 forbids touching `changeDetection`, so they are listed only.
The STATE.md decision "Components with explicit `ChangeDetectionStrategy.Eager`" can be closed as
**not applicable**.

Files: `caira-tracker` (8), `cpe-tracker` (3), `admin/user-onboarding` (4),
`admin/partner-platform-v2/onboarding` (1), `caira-badge-info-dialog`, `apply-partner-code-dialog`.

---

## 10. Partner landing pages — similarity diff (Phase 13)

12 page folders under `features/partners/shared/pages/`. **All 12 `.css` files are 0 bytes.**

| Page                                                             | ts        | html                          | Verdict                                                                                                                     |
| ---------------------------------------------------------------- | --------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `ctcpa` / `dscpa`                                                | 207 / 207 | 65 / 65                       | **Near-identical.** `diff` = 8 hunks, all name/id/anchor swaps ("CTCPA"→"DSCPA", `connecticut-section`→`delaware-section`). |
| `hawaii`, `cpa-canada`                                           | 208 / 225 | 64 / 65                       | same shape; diff vs ctcpa = 40 / 51 lines                                                                                   |
| `mgi-world`, `mgi-north-america`, `allinial-global`, `corporate` | 219–285   | 57–62                         | same shape, different content arrays                                                                                        |
| `bkn`                                                            | 337       | 70                            | extra sections                                                                                                              |
| `illinois`                                                       | 454       | 93                            | most divergent                                                                                                              |
| `caira-landing`                                                  | 183       | 37                            | different page type — exclude from consolidation                                                                            |
| **`ascpa`**                                                      | **9**     | **1** (`<p>ascpa works!</p>`) | **dead stub** — its route is commented out in `partner.routes.ts`                                                           |

**Conclusion: consolidation is well-supported.** 10 of the 12 (excluding `caira-landing` and the dead
`ascpa`) collapse into one config-driven `features/partners/pages/partner-landing/` plus
`features/partners/data/<partner>.ts`. The per-page data is: hero copy, section anchor id, enquiry
`enquiry_type`, an icon/logo URL, an offerings list, and a content list. Phase 13's SSR smoke test must
cover all 10 partner routes. **Still gated on the user's yes/no in STATE.md.**

---

## 11. Suspected dead code (list only — decision taken: do not delete)

Verified by both import search **and** selector search in templates.

| Path                                                                                                                      | Evidence                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `shared/core/constant/location.ts`                                                                                        | **969,250 lines / 25 MB**, zero importers (`location-min.ts` is the live one)                              |
| `shared/core/directives/html-to-pdf.directive.ts`                                                                         | zero importers; `[appHtmlToPdf]` in zero templates                                                         |
| `shared/core/config/feature.config.ts`                                                                                    | zero importers                                                                                             |
| `shared/core/models/nano-learning.model.ts`                                                                               | zero importers (live model is `micro-learning-course.model.ts`)                                            |
| `features/cpa-landing/cpa-landing.ts` + `shared/core/guards/cpa-landing-match.guard.ts`                                   | zero importers, `app-cpa-landing` in zero templates, guard referenced by no route — whole feature unrouted |
| `shared/components/cards/badge-course-card`, `cards/badge-level-card`                                                     | zero importers, selectors in zero templates                                                                |
| `shared/components/dialog/webinar-registration-dialog`                                                                    | zero importers, selector unused, never `Dialog.open`ed                                                     |
| `features/home/.../laptop/laptop.ssr.notes.ts`                                                                            | notes-only module, zero importers                                                                          |
| `features/partners/shared/pages/ascpa/`                                                                                   | stub component, route commented out                                                                        |
| `lenis` (package.json dependency)                                                                                         | imported nowhere; `surround-carousel.engine.ts:491` comments that nothing instantiates it                  |
| Story-only (production-dead): `shared/components/marquee`, `dialog/badge-claim-upsell-dialog`, `dialog/badge-info-dialog` | selector appears only in `.stories.ts`                                                                     |

**Explicitly NOT dead — do not cut these:** `features/blog/pages/blog-list` (`<app-blog-list>` is in
`blog-all.html`), `micro-learning-episode-grid` (in `micro-learning-course.html`), and
`shared/ui/autocomplete` (used by `job-sectors.ts`).

---

## 12. Other bugs found (logged, not fixed — spec §7)

- `--radius-4xl` referenced at `styles.css:297,303,308`, never defined.
- `@ng-icons/*` (8 packages) are in `devDependencies` but imported by production code via
  `configuration/ng-icon.ts`.
- AGENTS.md §9 says `pnpm start` runs on port 4100; `package.json` uses **4101**.
- AGENTS.md §9's "initial bundle sits near its 2.00 MB budget" is wrong — it is 501.9 KB.
- `app.config.ts` pulls a dev-only mock interceptor into the production module graph.
- `lenis` is an unused dependency.
- Pre-existing: `footer-overlay.isAllowedRoute` returns `true` for a route outside the allowlist
  (already open in STATE.md).

---

## 13. Part B feature list & order

Smallest and lowest-risk first, so the pattern is proven before it hits `offerings`.
These rows are mirrored into the STATE.md Part B tracker.

| #   | Feature / area                                                                      | Files | Why here                                                             |
| --- | ----------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------- |
| 1   | `shared/ui` (primitives)                                                            | 62    | Phase 10 only; must land before features that consume it             |
| 2   | `features/blog`                                                                     | 31    | self-contained, own HTTP client, no dialogs                          |
| 3   | `features/library`                                                                  | 31    | 3 clean facades, 5 `resource()` to convert                           |
| 4   | `features/tracker` (caira+cpe)                                                      | 46    | 11 `resource()`, certificate download, jszip                         |
| 5   | `features/auth`                                                                     | 10    | already `@Service()`, already `httpResource` — smallest Part B diff  |
| 6   | `layout`                                                                            | 26    | header/footer/footer-overlay; above the fold, so **no `@defer`**     |
| 7   | `features/home`                                                                     | 21    | hero above fold; 3 `@defer` already correct                          |
| 8   | `features/partners`                                                                 | 77    | large but repetitive; do before Phase 13 consolidation               |
| 9   | `features/payment`                                                                  | 72    | **the 839 KB location-min chunk lives here** — Phase 11's main prize |
| 10  | `features/offerings`                                                                | 132   | largest; 5 facades, 21 `@defer` blocks, both players                 |
| 11  | `admin/*` (core, leads, users, seo, user-report, user-onboarding, audit-log, roles) | ~60   | admin-only → `injectAsync` with **no prefetch**                      |
| 12  | `admin/partner-platform(-v2)`                                                       | 65    | last — depends on the Phase 6 cutover decision                       |
