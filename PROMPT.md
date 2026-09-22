# Miles Masterclass v3 — Restructure & Modernization Spec

This file is the single source of truth for the refactor. It is owned by the user and must not be edited by Claude.
Every session starts from here, `docs/refactor/STATE.md` (progress), and `docs/refactor/PLAN.md` (the approved plan).
Phases are run with `/refactor-phase <n> [feature]`, one phase (or one feature of a Part B phase) per session.

The work has two parts:

- **Part A (Phases 0–7) is structure only.** Moves, renames and import updates. Behavior, URLs, selectors,
  class names, change detection and styling stay identical.
- **Part B (Phases 8–14) is modernization.** Services, data layer, headless UI, @defer and lazy services,
  and Tailwind, applied one concern per phase and one feature per session.

Never mix the two: don't modernize code while moving it. A file that is moved and rewritten in the same change loses its git history.

---

## 1. Stack (verify against package.json; don't assume older conventions)

- **Angular 22:**
  - Standalone components; SSR via @angular/ssr + Express 5
  - v20+ file naming, with no `.component`/`.service` suffixes
  - OnPush is the default change detection
- **TypeScript 6.0:** `baseUrl` is deprecated. Path aliases use `paths` with `./`-prefixed targets and no `baseUrl`.
- **Headless UI:** ng-primitives (Angular Primitives). Do not introduce @angular/aria or new CDK-based headless components.
- **Styling:** Tailwind CSS v4 via @tailwindcss/postcss. `cn()` (clsx + tailwind-merge) lives in the shared utils.
- **Tooling:**
  - Unit tests: `ng test` using Vitest
  - ESLint 10 (flat config) with angular-eslint 22 and typescript-eslint 8
  - Storybook 10, Prettier 3, husky + lint-staged
  - pnpm only
- **Data sources:** Angular HttpClient (REST backend) and supabase-js (admin, RBAC, SEO).
- **Heavy libraries (must stay out of the initial bundle):** three, video.js, swiper, gsap, lenis, motion, jspdf,
  html2canvas-pro, jszip, canvas-confetti, @milesverse/sdk.

## 2. Harness contract (how every session works)

1. **Never run `git commit`, `git push`, or destructive git commands.** Use `git mv` for moves so history is kept.
   The user commits after reviewing each phase. End every phase with a conventional-commit message for the user to use.
2. **State:** `docs/refactor/STATE.md` is the handoff between sessions.
   - At the start of a session, read it.
   - After every step, update "Now" and prepend one line to the step log.
   - At the end of a phase, set the phase status and list the decisions you need from the user.
3. **Verification** uses the project scripts only:
   - Per step: `node scripts/refactor/verify.mjs --quick` (typecheck + lint).
   - End of phase/feature: delegate to the `verifier` subagent, which runs `node scripts/refactor/verify.mjs`
     (lint, unit tests, local + prod builds, Storybook build, format check, bundle report, SSR smoke test
     against the recorded baseline).
   - A phase is not done until the full run is green.
   - Never disable, skip, or weaken a test, lint rule, or gate.
   - Never re-record baselines (the user does that).
4. **Delegation:**
   - Use the `import-auditor` subagent to find every reference to a file before moving it.
   - Use the `reviewer` subagent to check the phase diff against this spec before writing the report.
   - Keep large logs out of the main context by letting subagents summarize.
5. **Reports:** write `docs/refactor/reports/phase-NN[-feature].md` using the report format in section 7.
6. **Step size:** work in small, green steps (one feature, or at most ~30 moved files per step).
   If the context is getting long, finish the current step, update STATE.md, and tell the user to `/clear`
   and rerun the same command. The next session resumes from STATE.md.
7. **Scope discipline:**
   - Don't delete feature code (especially the v1 partner platform) without approval recorded in STATE.md "Decisions".
   - Log bugs you find; don't fix them.
   - Don't run `ng update`, `ng generate`, or any schematics/migrations.
   - In Part A, change no logic.
8. **Change detection:** do not add, remove or change `changeDetection` on any component. Components with an
   explicit `Eager` strategy are listed in the plan for the user to decide on.
9. **Reuse before creating:** search `core/` and `shared/` first.
10. **Updating references after a move.** Every reference must be updated:
    - Imports, and `loadComponent`/`loadChildren` paths in all `*.routes.ts`
    - `app.routes.server.ts`, `server.ts`, `main.server.ts`, `seo.ts`, `legacy-redirects.ts`
    - Specs and stories
    - `angular.json` (styles, assets, fileReplacements, test options, storybook targets)
    - `tsconfig*.json`
    - `.storybook/main.ts` globs
    - Tailwind `@source`/`@import` paths
    - `vercel.json`/`vercel.sh`

## 3. Target structure (the ONLY allowed structure)

```
src/app/
  core/                      App-wide singletons & infrastructure. No UI components.
    config/  constants/  guards/  interceptors/  models/  pipes/  directives/  services/  version/
  shared/                    Generic, reusable, feature-agnostic building blocks only.
    ui/                      Primitives built on ng-primitives (button, input, select, menu, tabs, otp, toast...)
    components/              Generic composites (cards/, carousel, slider, marquee, skeleton/, heading, video-js...)
    dialogs/                 ONLY generic dialogs used by 2+ features
    pipes/  directives/  utils/
  layout/                    header, footer, footer-overlay, main-layout, plain-layout, blog-layout, dynamic-layout
  features/
    <feature>/
      <feature>.routes.ts
      pages/<page>/          Routed container components (inject facades)
      components/<name>/     Presentational components (inputs/outputs only)
      dialogs/<name>-dialog/
      services/<name>-facade.ts   Flat files
      models/<name>.model.ts
      utils/  constants/
      <sub-feature>/         Same shape, only when a feature genuinely has sub-areas
  admin/                     Same shape as a feature
    <admin-feature>/
    core/                    Admin guards, auth, interceptors, admin models
    layout/                  admin-layout, admin-sidebar, admin-topbar
  testing/                   Mocks and test helpers. Never imported by production code.
```

### Placement & boundary rules

- **Placement:** code lives at the lowest level that uses it.
  - If siblings share it, promote it to their nearest common parent.
  - If 2+ top-level features use it, promote it to `shared/` (UI) or `core/` (non-UI).
- **No `shared/` inside features.** There is no `shared/` folder inside a feature, and routed components always live in `pages/`.
- **Import boundaries:**
  - `core` imports nothing from `shared`, `layout`, `features` or `admin`.
  - `shared` imports nothing from `features`, `admin` or `layout`.
  - Features import only from `core`, `shared`, and themselves (plus `layout` in route configs). Never from other features.
  - `admin` imports only from `core`, `shared`, and itself.
  - `testing` is importable only from specs and stories.
- **Aliases:** `@core/*`, `@shared/*`, `@layout/*`, `@features/*`, `@admin/*`, `@testing/*`, `@env/*`.
  Any import that crosses a top-level folder uses an alias. Relative imports are allowed only within the same feature.
- **Naming and file conventions:**
  - One component per folder: `name/name.ts|html|css|spec.ts|stories.ts`.
  - Services and models are flat files.
  - Folder names are plural.
  - No `.scss`.
  - No `-v2` names after cutover.

## 4. Modernization standards (Part B only)

### 4.1 Services: `@Service()`

- Root singletons use `@Service()` from `@angular/core`, with no options.
- Component-scoped services use `@Service({ autoProvided: false })`, listed in that component's `providers`.
- All dependencies use `inject()`. Constructor parameter injection is not allowed; convert it first.
- Keep `@Injectable` only where `@Service` can't express the provider: `useClass`/`useValue`/`useExisting`,
  `providedIn: 'platform'`, and similar. Each kept one gets a one-line `// why:` comment and is listed in the report.
- Interceptors, guards and resolvers are functional.

### 4.2 Data layer: `httpResource` for reads, `HttpClient` for writes

- **Reads (GET)** move to `httpResource` inside facades. Facades expose the resource, or `computed()` signals
  derived from it.
  - Use reactive request functions driven by signals.
  - Return `undefined` from the request function to skip a request when inputs aren't ready.
  - Set a `defaultValue` for lists.
  - Keep `transferCache` behavior for SSR.
- **Mutations (POST/PUT/PATCH/DELETE) stay on `HttpClient`** as facade methods. After success, `.reload()` or
  update the affected resource. Never use httpResource for mutations.
- **Stay on HttpClient/RxJS** for:
  - Blob/file downloads and progress
  - Polling
  - Debounced search/typeahead. Use `rxResource` or an RxJS pipeline here, not httpResource.
- **Supabase calls** (supabase-js, not HttpClient) use `resource({ params, loader })` for reads.
  Mutations stay as facade methods.
- **Templates:**
  - Guard every `.value()` read with `.hasValue()`.
  - Render `.isLoading()` and `.error()` states explicitly.
  - Remove the manual loading/error flags the resource replaces.
- **Tests** use `provideHttpClientTesting` + `HttpTestingController`, and wait for resources to settle before asserting.

### 4.3 Headless UI: ng-primitives

- All interactive primitives (button, input, select, combobox/autocomplete, menu, tabs, checkbox, radio, switch,
  dialog, tooltip, popover, accordion, OTP, toast) are built on ng-primitives and styled with Tailwind.
- `shared/ui/aria/*` and the hand-rolled autocomplete/select-menu/tab-strip/checkbox-list migrate to ng-primitives.
  Public inputs/outputs and selectors stay stable so call sites don't change.
- `@floating-ui/dom` is used only through ng-primitives. No new direct usage.
- CDK usages (dialog, overlay, a11y) are migrated only where the plan says ng-primitives covers them.

### 4.4 @defer and hydration

- **Never defer** above-the-fold or LCP content: header, hero, the first viewport, or anything that must be in the
  SSR HTML for SEO without hydration.
- **Always defer** below-the-fold heavy components:
  - three.js scenes (`wave-canvas`, `laptop`, `floating-assets`)
  - video.js/audio players until interaction or viewport
  - Below-the-fold swiper carousels
  - gsap/lenis/motion sections
  - `footer-overlay`, related-content, testimonials/marquee, app-download sections
- **Triggers:**
  - `on viewport` for below the fold
  - `on interaction` / `on hover` for user-initiated UI
  - `on idle` for non-critical widgets
  - Add `prefetch on idle` or `prefetch on viewport` where the next interaction is likely.
- **Every @defer block has a `@placeholder`** with fixed dimensions: a Tailwind skeleton with explicit height or
  aspect ratio, so there is zero layout shift.
  - Add `@loading (after 100ms; minimum 300ms)` where loading is visible.
  - Add `@error` where failure is possible.
- **SSR:**
  - Enable incremental hydration: `provideClientHydration(withIncrementalHydration())`. Keep event replay.
  - Content that must be in the server HTML for SEO but can hydrate lazily uses
    `@defer (hydrate on viewport | hydrate on interaction)`. A plain `@defer` renders only its placeholder on the server.
  - Use `hydrate never` for static content.
- **Code splitting:**
  - A deferred component must not be referenced anywhere else in the same file, or it won't be split.
  - Dialogs opened programmatically lazy-load their component with a dynamic `import()`.

### 4.5 Lazy services: `injectAsync` wherever it fits

Use `injectAsync` (from `@angular/core`) for any service that is not needed to render the page and is only used
after a user action or on a subset of pages. Always use it when the service pulls in a heavy library.

**It fits when ALL of these are true:**

- The service is used only inside async code paths: event handlers, submit/download/export/share actions,
  post-interaction flows.
- It is never read synchronously in a template, `computed()`, `effect()`, `httpResource` request function,
  guard, resolver, interceptor, or a constructor path that runs on initial render or during SSR.
- It is auto-provided: `@Service()` with default options, or `@Injectable({ providedIn: 'root' })` for justified
  exceptions. Services with `autoProvided: false` are not eligible.

**Required candidates (confirm each in the plan):**

- `html-to-pdf` (html2canvas-pro + jspdf)
- `certificate-download` / zip generation (jszip)
- Anything wrapping canvas-confetti
- The `milesverse` service (@milesverse/sdk)
- Partner/admin report and CSV export services
- SEO bulk-upload / `seo-csv` processing
- Audit-log export
- Any other service that imports a heavy library or serves only admin or rare flows

**Do NOT use it for:**

- Auth/session, analytics, consent, UTM, logger, storage, viewport, network, notification or toast services
- Anything used by the header or layout
- Facades that own resources rendered on page load
- Small utility services. Plain `inject()` is simpler there.

**How to write it:**

- Declare it as a field initializer so it runs in an injection context:
  `private readonly pdf = injectAsync(() => import('@core/services/html-to-pdf').then(m => m.HtmlToPdf), { prefetch: onIdle });`
  Alternatively, make the service the file's default export and pass the import directly.
- Call it only inside async code: `const pdf = await this.pdf(); await pdf.generate(...)`.
  Disable the trigger and show a loading state while it resolves, and handle load failure with a toast.
- The heavy library is imported statically inside the lazy service file only. That file becomes the split point.
- **No static import of a lazily-injected service anywhere in production code.** `import type` is allowed.
- **Prefetch strategy:**
  - `{ prefetch: onIdle }` when most users on the page will likely trigger the action.
  - `{ prefetch: () => onIdle({ timeout: 2000 }) }` for busy pages that never go idle.
  - No prefetch for rare or admin-only actions.
  - Hover/focus prefetching goes through ONE shared helper, `core/utils/prefetch-triggers.ts`. Don't hand-roll triggers.
- **SSR:** these services must never be called during server rendering.
- **Tests:** override the service token in TestBed with a mock.
- **Verify:** the service and its library are in their own lazy chunk and absent from the initial bundle
  (check the bundle report).

### 4.6 Tailwind first (enforced)

- Styling lives in templates as Tailwind utilities.
- A component `.css` file is allowed only for what Tailwind cannot express:
  - Custom `@keyframes`
  - Third-party DOM overrides (video.js, swiper internals)
  - Complex `:host`, `::part`, or pseudo-element rules
    Delete emptied `.css` files and remove their `styleUrl`.
- Design tokens (colors, fonts, spacing, radii, shadows, animations) live in `@theme` in `src/styles/styles.css`.
  - No hardcoded hex/rgb/px values in templates when a token exists.
  - Add missing tokens to `@theme` rather than repeating arbitrary values.
  - Arbitrary values only for true one-offs.
- Component CSS that uses `@apply` or theme functions must begin with `@reference` to the main stylesheet.
  Prefer utilities over `@apply`. Never use `@apply` just to shorten a template.
- Conditional classes:
  - Use `[class]` bindings or `cn()`. `NgClass` and `NgStyle` are banned.
  - Shared UI variants are class maps merged with `cn()`, so consumers can override via `class`.
- States, responsive behavior and dark mode use Tailwind variants (`hover:`, `md:`, `dark:`, `data-[state=open]:`,
  and ng-primitives data attributes), not custom CSS.
- **Visual parity is required** at 375px, 768px and 1440px. List any intentional differences.
  Flag every converted component for the user's visual QA in the report.

## 5. Phases

### Part A — Structure (moves only)

**Phase 0 — Audit & plan (NO source changes; run in plan mode).** Write `docs/refactor/PLAN.md` with:

- **Config baseline:**
  - tsconfig and angular.json test/storybook options, `.storybook/main.ts` globs, Tailwind `@source` lines, `@theme` contents
  - Current hydration providers
  - Anything deprecated under TS 6
- **Move map:**
  - A full old → new path table, grouped by phase
  - Feature-specific code in global folders, verified by import search
  - Duplicates to merge (`local-time-zone.pipe.ts` ×2, `shared/utils` vs `core/services/utils/utils.ts`,
    html-to-pdf service + directive)
  - Cross-feature imports
  - Suspected dead code (list only)
- **Services inventory:**
  - Every `@Injectable`, marked root / component-scoped / advanced-provider
  - Whether it uses constructor injection
  - Every class-based interceptor or guard
  - Classification: eager `inject()` vs `injectAsync` candidate, with the reason, the heavy library involved,
    current static importers, and the proposed prefetch strategy
- **HTTP inventory:** every HttpClient and supabase-js call, classified as read / mutation / download / polling /
  search, with the proposed target.
- **Headless UI inventory:** `ui/aria/*`, autocomplete, select-menu, tab-strip, checkbox-list, otp and all CDK
  usages, with the ng-primitives equivalent for each and any gaps.
- **@defer inventory:**
  - Existing `@defer` blocks
  - Every component importing a heavy library, and whether it is above the fold
  - Proposed trigger, placeholder and hydrate strategy for each
- **Tailwind inventory:**
  - Every component `.css`/`.scss` file with its line count, classified as "convertible" or "must stay" (with reason)
  - Hardcoded colors/sizes that should become tokens
  - `NgClass`/`NgStyle` usages
- **Change detection:** components with an explicit `changeDetection` (list only).
- **Partner landing pages:** a similarity diff.
- **Postman environments:** secret key names only, never values.
- **Part B feature list:** the features each Part B phase will run over, in recommended order
  (smallest and lowest risk first). Write this into the STATE.md trackers.

Then stop. The user approves the plan in STATE.md "Decisions".

**Phase 1 — Hygiene.**

- Remove committed `.DS_Store` files and add them to `.gitignore`.
- Rename `Postman Collection/` → `postman/`.
- Move mocks (`partner-mock-*`, `shared/components/__mocks__`) to `src/app/testing/`. Register mock interceptors only
  in `local`/`development` via environment or `fileReplacements`, and prove they are absent from the production bundle:
  `node scripts/refactor/bundle-report.mjs --must-not-contain "<unique string from the mock handlers>"`.
- Convert `.scss` → `.css` only where no SCSS features are used.

**Phase 2 — Path aliases.**

- Remove `baseUrl` and add `paths` with `./` targets for the aliases in section 3. Keep `moduleResolution: "bundler"`.
- Verify the aliases resolve in the build, Vitest, Storybook and ESLint (add `eslint-import-resolver-typescript` if needed).

**Phase 3 — Core.**

- Move `app/shared/core/` → `app/core/`, renaming `constant/` → `constants/`.
- Move feature-specific models, services and constants into their features.
- Merge duplicates per the plan.

**Phase 4 — Shared & layout.**

- Restructure `app/shared/components/` into `shared/ui|components|dialogs|pipes|directives|utils`.
- Move feature-specific dialogs to their owners.
- Move the layouts into `layout/`.
- Update the Storybook globs and Tailwind `@source` paths.

**Phase 5 — Features.** (May be run per feature: `/refactor-phase 5 <feature>`.)

- Move `app/pages/*` features into `features/`, and move `app/auth/` → `features/auth/`.
- In every feature:
  - Remove the internal `shared/` layer and move `shared/pages/*` → `pages/`.
  - Flatten single-file folders.
  - Rename `service/` → `services/`.
  - Normalize `home/components` and `blog/components`.
- Delete the empty `app/pages/`.

**Phase 6 — Admin.**

- Apply the same shape, with `admin/core/`, `admin/layout/`, and `admin/auth/pages/` for forgot/reset password.
- Restructure partner-platform-v2 under its current name and leave v1 in place.
- Propose the cutover steps in the report and record the decision request in STATE.md.

**Phase 7 — Enforce boundaries.**

- Install the latest `eslint-plugin-boundaries` and read its README in `node_modules` before configuring. Use:
  - The `boundaries/dependencies` rule
  - Object selectors
  - `{{ }}` templates
    No deprecated syntax.
- Encode section 3's rules in `eslint.config.mjs`, with the TypeScript resolver configured for the aliases.
- Also add these rules:
  - `no-restricted-imports` banning relative imports that cross top-level folders
  - A ban on `NgClass`/`NgStyle`
  - A ban on `@angular/aria`
- Fix violations. Violations that Part B will fix may be temporary warnings only if the user approves in STATE.md.

→ Part A ends here. The user merges and ships Part A before Part B starts.

### Part B — Modernization (one concern per phase, one feature per session)

**Phase 8 — Services.**

- Convert constructor injection → `inject()`.
- Convert `@Injectable` → `@Service()` (or `@Service({ autoProvided: false })`).
- Convert class-based interceptors and guards to functional ones.
- Add a lint rule restricting `Injectable` imports from `@angular/core`, with a file allowlist for justified exceptions.

**Phase 9 — Data layer (per feature).**

- Migrate reads per section 4.2 and the HTTP inventory.
- Mutations stay on HttpClient with `.reload()`.
- Remove replaced boilerplate and update specs.

**Phase 10 — Headless UI (per primitive group).**

- Migrate `shared/ui` to ng-primitives + Tailwind with stable public APIs, and migrate approved CDK usages.
- Update the stories for every migrated primitive.
- Verify keyboard navigation and focus behavior.

**Phase 11 — @defer, hydration & lazy services (per feature/page).**

- Enable incremental hydration once, in the first session of this phase.
- Apply the @defer plan with placeholders.
- Convert approved services to `injectAsync` and remove their static imports.
- Lazy-load dialog components.
- The report must include the per-page initial bundle before/after (from the bundle report) and the lazy chunks created.

**Phase 12 — Tailwind first (per feature).**

- Move tokens into `@theme` (first session only).
- Convert component CSS to utilities; keep only the "must stay" CSS, with `@reference` where needed.
- Replace `NgClass`/`NgStyle`.
- List every component that needs visual QA.

**Phase 13 — Partner landing pages (only if approved in STATE.md).**
Replace them with one config-driven `features/partners/pages/partner-landing/` plus `features/partners/data/<partner>.ts`.
URLs and SSR output must be identical, and the SSR smoke test must include every partner route for this phase.

**Phase 14 — Documentation.**

- Rewrite the structure section of `AGENTS.md`, covering: the stack, target structure, placement and boundary rules,
  and all of section 4.
- Use `features/payment/` and `admin/leads/` as the reference examples.
- Propose removing `docs/refactor/` and the harness; the user decides.

## 6. Definition of done (per phase or feature)

- The `verifier` reports a full green run.
- The `reviewer` reports no unresolved spec violations.
- The report is written.
- STATE.md is updated: status, decisions needed, and next command.
- A commit message is given to the user.
- Claude has stopped and not started the next phase.

## 7. Report format (`docs/refactor/reports/phase-NN[-feature].md`)

1. **Summary:** what changed (counts plus notable items).
2. **Verification:** the gate table from the verifier, plus bundle deltas for Part B.
3. **Decisions needed / skipped / suspicious.** Include every kept `@Injectable`, every CSS file kept,
   every heavy-library service not made lazy (with the reason), and bugs found.
4. **Visual QA list** (Part B): components and pages the user should check by eye.
5. **Commit message.**
