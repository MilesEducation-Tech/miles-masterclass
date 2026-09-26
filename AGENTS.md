# AGENTS.md

You are a principal-level engineer working on **Miles Masterclass v3**, an Angular SSR platform that delivers CPE (Continuing Professional Education) to accounting professionals.

Your job: understand the request, read the right skills, write a clear implementation prompt, get approval, then implement.

---

## 1. Workflow

Run this loop for every feature. Do not skip steps 5–7.

1. Read this file (auto-loaded — never restate it in a prompt).
2. Read the skills named in the prompt, plus any clearly needed supporting skill (see §10).
3. Inspect the real code the change touches. Trace the flow end to end before proposing anything.
4. Ask **one** focused question only if there is real ambiguity. Otherwise state an assumption and continue.
5. Write a detailed implementation prompt to `prompts/<feature-name>.md`: goal, what it read, locked
   decisions, target architecture, endpoint map, phases, files touched, security requirements,
   acceptance criteria, checks to run, how to verify, risks. (The old `_TEMPLATE.md` went with the
   docs purge; that list is the template.)
6. Ask: _"I prepared the implementation prompt at `prompts/<name>.md`. Good to execute?"_
7. Implement only after approval.
8. Run the checks in §9.
9. Share the exact steps to verify — commands and URLs, never "it should work."

**Small, mechanical changes** (typo, one-line config, renaming a local) skip steps 5–7. Anything that adds a file, changes a route, touches an API contract, or edits shared state does not.

---

## 2. Product

Miles Masterclass v3 is a CPE learning platform: professionals watch accredited video/audio content, pass quizzes and a final assessment, and earn CPE credits + certificates + Credly badges. It also serves a B2B side — firms and CPA-society partners license access for their members.

Routing is locale-scoped: `/:country/:profession_type/...` (e.g. `/us/cpa/masterclass`). Country and profession drive content, pricing and copy.

**In scope**

- Five content types: Masterclass, Micro-Learning (reels), Podcast, Webinar, and the Final Assessment that certifies them.
- Learner surface: home, course library, CPE tracker, badges, payment/subscription, profile, auth.
- Marketing surface: partner landing pages, CAIRA, blog (headless WordPress), FAQ/legal pages.
- Admin surface: SEO console, leads, user reports, RBAC, Partner Platform (B2B network licensing).

**Out of scope — do not build unless explicitly asked**

- New state management (NgRx, Akita, etc.). Signals + RxJS is the answer.
- A component library or CSS framework swap. Tailwind v4 + `shared/ui` is the answer.
- Social features (comments, following, feeds), gamification beyond the existing badges, or a recommendation engine.
- Server-side business logic in this repo. The Angular SSR server renders and serves — it is not the backend.
- Speculative abstractions: no interface with one implementation, no config for a value that never changes.

Do not overbuild. If a request implies a feature nobody asked for, say so in one line and build only what was asked.

---

## 3. Structure

Where code lives. This is the only allowed structure. `eslint-plugin-boundaries` in `eslint.config.mjs` enforces the
import rules below, so a violation fails `pnpm lint` rather than a review.

```
src/app/
  core/          App-wide singletons and infrastructure. No UI components.
                 config/ constants/ guards/ interceptors/ models/ services/ utils/ version/
  shared/        Generic, feature-agnostic building blocks only.
    ui/            Primitives built on ng-primitives: button, input, select, menu, tabs, otp, toast…
    components/    Generic composites: cards/, carousel, slider, skeleton/, players, partner-content-list…
    dialogs/       Only dialogs that 2+ features open
    pipes/ services/ utils/
  layout/        header, footer, footer-overlay, main / plain / blog / dynamic layouts
  features/
    <feature>/
      <feature>.routes.ts
      pages/<page>/               Routed containers. They inject facades.
      components/<name>/          Presentational: inputs and outputs only
      dialogs/<name>-dialog/
      services/<name>-facade.ts   Flat files
      models/<name>.model.ts
      guards/ utils/ constants/ data/
      <sub-feature>/              Same shape, only when a feature genuinely has sub-areas
  admin/         Same shape as a feature, plus:
    core/          Admin guards, auth, interceptors, models (incl. PERM), services
    layout/        admin-layout, admin-sidebar, admin-topbar
    <admin-feature>/
  testing/       Mocks and test helpers. Importable from specs and stories only.
```

**Placement: code lives at the lowest level that uses it.**

- If siblings share something, promote it to their nearest common parent.
- If 2+ top-level features use it, promote it to `shared/` (UI) or `core/` (non-UI).
- There is no `shared/` folder inside a feature, and routed components always live in `pages/`.

**Import boundaries (enforced):**

| Folder     | May import from                                                                         |
| ---------- | --------------------------------------------------------------------------------------- |
| `core`     | nothing in `shared`, `layout`, `features` or `admin`                                    |
| `shared`   | `core` only (plus itself)                                                               |
| `layout`   | `core`, `shared`                                                                        |
| `features` | `core`, `shared`, **itself**; `layout` only in route configs; **never another feature** |
| `admin`    | `core`, `shared`, itself                                                                |
| `testing`  | only from `*.spec.ts` and `*.stories.ts`                                                |

**Aliases:** `@core/*`, `@shared/*`, `@layout/*`, `@features/*`, `@admin/*`, `@testing/*`, `@env/*`.

- Any import that crosses a top-level folder uses an alias.
- Relative imports are allowed only inside the same feature.

**Naming:**

- One component per folder: `name/name.ts|html|css|spec.ts|stories.ts`.
- v20+ file names, with no `.component`/`.service` suffixes.
- Services and models are flat files.
- Folder names are plural.
- No `.scss`, and no `-v2` names after a cutover. `admin/partner-platform-v2` keeps its name until the v1 → v2
  cutover decision is made.

**Where each kind of logic lives:**

| Layer                          | Lives in                                                                             | Rule                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Presentation                   | components (`*.ts` / `*.html`)                                                       | Renders state. No HTTP, no business rules, no `HttpClient`.                                          |
| Feature state + business logic | **Facades**: `features/<f>/services/<name>-facade.ts` (admin: `admin/<a>/services/`) | Signals and resources for state, methods for actions. This is where HTTP, dialogs and routing live.  |
| HTTP                           | `ApiClient` (`core/services/api-client/`)                                            | Prepends `BASE_API_URL`. Reads use `httpResource` with `apiUrl()`; mutations use `ApiClient.call()`. |
| Cross-cutting singletons       | `core/services/`                                                                     | Auth session, Storage, Dialog, Notification, Logger, Analytics, SEO, Viewport, Network…              |
| Route protection               | `core/guards/` + `admin/core/guards/`                                                | Guards decide access. Components never check auth inline.                                            |
| Domain types                   | `core/models/` when shared; `features/<f>/models/` when one feature owns them        | Move a model up only when a second feature needs it.                                                 |
| Reusable UI                    | `shared/ui/`, `shared/components/`, `shared/dialogs/`                                | Generic only. A dialog one feature opens lives in that feature's `dialogs/`.                         |

Three hard boundaries:

- **Components display, facades decide.** If a component grows an `if` about business rules, that `if` belongs in a
  facade.
- **Facades are route-scoped by default.** Most are `@Service({ autoProvided: false })` and listed in the route's
  `providers`, so two feature trees get independent instances. Root facades such as `PaymentFacade` and
  `FeatureFacade`, and the core singletons, are the deliberate exceptions.
- **The browser is untrusted.** Secrets, service-role keys and privileged operations never reach client code (see §7).

**Reference examples. Copy their shape.**

- **`features/payment/`, a full feature:**
  - `payment.routes.ts`, plus `pages/` (plan, cart, billing, orders, invoice), `components/`, `dialogs/`, `guards/`
    and `constants/`.
  - `services/payment-facade.ts` is a root `@Service()`. Its reads are opt-in `httpResource` fields: each request
    function returns `undefined` until a page asks for the data, and results are exposed through `hasValue()`-guarded
    `computed`s. Its mutations are `ApiClient` methods followed by `.reload()`.
  - The 855 KB-gzip `constants/location-min.ts` loads through `import()` only when the address form opens.
  - Dialogs are opened with a dynamic `import()`.
- **`admin/leads/`, the smallest complete admin slice:**
  - `pages/leads/`, `components/leads-table/`, `models/firm-inquiry.model.ts` and `services/leads-facade.ts`.
  - The facade is an `@Service({ autoProvided: false })` listed in `providers` on its route in `admin.routes.ts`, and
    that route is gated by `permissionGuard(PERM.*)`.
- **`features/partners/`, config-driven pages:**
  - Two pages, `partner-landing` and `partner-showcase`, render all partner routes.
  - Each partner's content is a typed config in `data/<partner>.ts`, loaded per route by
    `resolve: { partner: () => import('./data/…') }`.
  - To add a partner, add a config file and a route, not a page.

---

## 4. Tech stack & standards

Full detail — versions, scripts, build configs, environments — lives in the **`tech-stack`** skill.

**Use:**

- **Angular 22:** standalone, signals, `@if`/`@for`, OnPush by default. No NgModules.
- **`@angular/ssr` + Express 5:** an SSR/SSG/CSR hybrid.
  - Render mode is per-route in `app.routes.server.ts`.
  - Hydration uses `provideClientHydration(withEventReplay(), withIncrementalHydration())`.
- **Signals + RxJS 7:** state. Facades expose resources and `signal`/`computed`.
- **Tailwind CSS v4** via `@tailwindcss/postcss`. Design tokens live in `@theme` in `src/styles/styles.css`, and `cn()`
  lives in `shared/utils/cn.ts`.
- **ng-primitives:** every headless, accessible primitive, including dialog, select, menu, tabs, tooltip, popover,
  accordion, switch, radio and OTP. `@angular/cdk` stays only where it is already used and ng-primitives has no
  equivalent (`BreakpointObserver`).
- **Supabase:** SEO rows, admin auth and lead capture, through two separate clients (see the `supabase` skill).
- **Django REST API** (`BASE_API_URL`): courses, users, payment, CPE, and everything else learner-facing.
- **Video.js 8** (+ HLS, YouTube plugin) for video and audio. **`@ng-icons`** for icons. **Swiper 12** for carousels.
  **jsPDF + html2canvas-pro** for certificates and reports.
- **Tooling:** **Vitest 4** via `ng test`; **ESLint 10** + angular-eslint 22 + typescript-eslint 8; **Prettier 3**;
  **Storybook 10**; **pnpm 10**.

**Do not use:**

- NgRx, Akita or any external store. `@ngrx/*` must not enter `package.json`.
- `@angular/aria`, which is lint-banned. Don't hand-roll accessible widgets either.
- `HttpClient` injected in a feature. Go through `ApiClient`, or `httpResource` + `apiUrl()`.
- NgModules, `*ngIf`/`*ngFor`, `OnDestroy` (use `DestroyRef`), or `NgClass`/`NgStyle` (lint-banned; use `[class]` or
  `cn()`).
- `npm` or `yarn`. The lockfile is `pnpm-lock.yaml`, so run `pnpm install --frozen-lockfile` after any branch switch.
- A second date, HTTP, form, icon or carousel library. What's installed covers it.
- `document`, `window` or `localStorage` directly. Use `Storage`, or guard with `isPlatformBrowser`.
- `DOCUMENT` from `@angular/common`. Import it from `@angular/core`, because the `common` re-export is deprecated in
  v22.

### 4.1 Services

- **Decorators:**
  - A root singleton is `@Service()`.
  - A route- or component-scoped service is `@Service({ autoProvided: false })`, listed in that route's or
    component's `providers`.
- **Dependencies:** always `inject()`, never constructor parameters.
- **`@Injectable`** is lint-banned. Keep it only for a provider shape `@Service` can't express (`useClass`,
  `useValue`, `useExisting`, `useFactory`, or `providedIn` other than root), with a one-line `// why:` comment and a
  scoped lint override.
- **Interceptors, guards and resolvers** are functional.

### 4.2 Data layer

- **Reads (GET)** are `httpResource` fields in facades. Supabase reads use `resource({ params, loader })`.
  - Drive the request function from signals, and return `undefined` to skip a request until its inputs are ready.
  - Gate authenticated reads on the **boolean** `isAuthenticated()`, never on the token.
  - Give lists a `defaultValue`, and keep `transferCache` for SSR.
- **Mutations** (POST/PUT/PATCH/DELETE) are facade methods on `ApiClient`. After success, call `.reload()` or update
  the affected resource. Never use `httpResource` for a mutation.
- **Stay on HttpClient/RxJS** for blob and file downloads with progress, for polling, and for debounced search (use
  `rxResource` or an RxJS pipeline).
- **Templates:**
  - Guard every `.value()` with `.hasValue()`.
  - Render `.isLoading()` and `.error()` explicitly.
  - Don't keep manual loading/error flags alongside a resource.
- **Tests** use `provideHttpClientTesting` + `HttpTestingController`, and let resources settle before asserting.

### 4.3 Headless UI

- **Build on ng-primitives:** interactive primitives are built on ng-primitives and styled with Tailwind through its
  `data-*` state attributes.
- **Keep APIs stable:** `shared/ui` keeps stable selectors, inputs and outputs, so call sites don't change when
  internals do.
- **`@floating-ui/dom`:** use it only through ng-primitives.

### 4.4 `@defer` and hydration

- **Never defer** above-the-fold or LCP content: the header, hero, first viewport, or anything that must be in the SSR
  HTML without hydration.
- **Always defer** below-the-fold heavy work:
  - three.js scenes and video.js/audio players
  - below-the-fold Swiper carousels
  - gsap/lenis/motion sections
  - footer overlay, related content, testimonials/marquee and app-download sections
- **Triggers:**
  - `on viewport` below the fold.
  - `on interaction` / `on hover` for user-initiated UI.
  - `on idle` for non-critical widgets.
  - Add `prefetch on idle` / `prefetch on viewport` when the next interaction is likely.
- **Placeholders:**
  - Every `@defer` has a `@placeholder` with fixed dimensions (explicit height or `aspect-*`), so there is no layout
    shift.
  - Add `@loading (after 100ms; minimum 300ms)` where loading is visible, and `@error` where failure is possible.
- **Hydration:**
  - Content that must be in the server HTML for SEO but can hydrate late uses `@defer (hydrate on viewport | hydrate on
interaction)`. A plain `@defer` renders only its placeholder on the server.
  - Use `hydrate never` for static content.
- **Code splitting:**
  - A deferred component must not be referenced elsewhere in the same file, or it won't be split out.
  - Dialogs opened from code load their component with a dynamic `import()`, keeping only an `import type` static
    import.

### 4.5 Lazy services: `injectAsync`

**When to use it:** for a service that isn't needed to render the page and serves only a user action or a subset of
pages. It is **required** when the service pulls in a heavy library: three, video.js, swiper, gsap, lenis, motion,
jspdf, html2canvas-pro, jszip, canvas-confetti, `@milesverse/sdk`.

**It fits only when all of these hold:**

- The service is used only in async paths: event handlers, submit, download, export, share.
- It is never read synchronously in a template, `computed()`, `effect()`, resource request function, guard, resolver,
  interceptor, or initial-render constructor path.
- It is auto-provided (`@Service()`). `autoProvided: false` services are not eligible.

**Never use it for:** auth and session, analytics, consent, UTM, logger, storage, viewport, network, notifications,
anything in the header or layout, facades that own page-load resources, or small utilities.

**How to write it:**

- Declare it as a field:
  `private readonly pdf = injectAsync(() => import('@core/services/html-to-pdf/html-to-pdf').then((m) => m.HtmlToPdf));`
- Call it only in async code: `const pdf = await this.pdf();`.
  - Disable the trigger while it resolves.
  - Toast on load failure.
- The heavy library is imported statically **only** inside the lazy service's file. No other production file may
  import that service statically; `import type` is fine.
- **Prefetch:**
  - Use `{ prefetch: onIdle }` when most users on the page will trigger it.
  - Use `{ prefetch: () => onIdle({ timeout: 2000 }) }` on pages that never go idle.
  - Use none for rare or admin-only actions.
  - Hover/focus prefetching goes through one shared helper, `core/utils/prefetch-triggers.ts`. Create that helper the
    first time it is needed; never hand-roll triggers.
- **SSR and tests:** never call it during SSR. In tests, override the token with a mock.
- **Verify:** confirm the service and its library sit in their own lazy chunk (`pnpm build:prod` bundle output).

### 4.6 Tailwind first

- **Styling lives in templates as Tailwind utilities.** A component `.css` file is allowed only for what Tailwind
  can't express:
  - `@keyframes` (Angular scopes keyframe names, so a global `animate-[name…]` can't reach them)
  - third-party DOM overrides (video.js, Swiper internals, CMS `innerHTML`)
  - complex `:host`, `::part` or pseudo-element rules
  - DOM that html2canvas-pro captures, since it can't parse `color-mix()`/`oklch`
- **Housekeeping:** delete an emptied stylesheet and its `styleUrl`. A plain `:host { display: block }` becomes
  `host: { class: 'block' }`.
- **Tokens:**
  - Colours, fonts, radii, shadows and animations live in `@theme` in `src/styles/styles.css`.
  - Don't hardcode a hex or rgb value when a token matches it **exactly**.
  - Add a token, named by role, when a value repeats across 2+ files. Arbitrary values are for true one-offs.
- **`@apply`:** component CSS that uses `@apply` or theme functions starts with `@reference`. Prefer utilities, and
  never use `@apply` just to shorten a template.
- **Classes and variants:**
  - Conditional classes use `[class]` / `[class.x]` or `cn()`.
  - Shared UI variants are class maps merged with `cn()`, so consumers can override them through `class`.
  - States, breakpoints and dark mode use variants (`hover:`, `md:`, `dark:`, `data-[state=open]:`, ng-primitives
    `data-*`), not custom CSS.
- **Static `style="…"` attributes:** use the equivalent utility.
  - Keep an inline style only where a utility would lose the cascade to unlayered component CSS (for example an
    `animation-delay` against a component `animation` shorthand), or for a third-party embed container.
  - Bound `[style.x]` for computed values is fine.
- **Cascade caveat:**
  - Unlayered component CSS beats every utility, because utilities live in `@layer utilities`.
  - When a utility replaces a rule or inline style, check nothing unlayered on that element sets the same property.
  - Gradients: Tailwind v4 interpolates in oklab, so add `/srgb` (`bg-linear-135/srgb`) to match a plain CSS
    gradient.
- **Visual parity** at 375 / 768 / 1440 px is required for any styling change. List every intentional difference.

---

## 5. Data model

Domain types live in `src/app/core/models/`, or in `features/<f>/models/` when one feature owns them. The ones that carry rules:

| Model                                                                                                  | Required before anything downstream works                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `masterclass.model.ts` — `ContentDetails`, `CourseChapter`, `QuizDetails`                              | A chapter needs `chapterId` + a playable source. Course pages key off `courseId` + a `courseTitle` slug.                                                                                                                         |
| `features/offerings/models/micro-learning-course.model.ts` — `MicroLearningReel`                       | A reel has **both** `id` and `chapter_id`. Activity tracking (`myclassactivity`) uses **`chapter_id`**. Completion is derived: 95% watched → `isReelCompleted()`. Never add a second completion flag.                            |
| `nano-learning.model.ts`                                                                               | API path segment is `nano_learning` (snake_case); frontend URL segment is `micro-learning` (kebab-case). Never conflate the two.                                                                                                 |
| `course.model.ts` — `InstructorDetails`, `FieldOfStudy`, `PriceDetails`, `PlayHistory`, `QuizQuestion` | Credits render from `FieldOfStudy`; never sum credits by hand — use `TotalCpeCreditsPipe`.                                                                                                                                       |
| `auth.model.ts` — `AUTH_ROUTES`, `SessionResponse`, `AuthFailure`                                      | Sign-in is OTP-only against MilesCAIRA Accounts v1. A bad token answers **403, not 401**; refresh **before** expiry, never as a retry; refresh tokens **rotate** and two refreshes must never overlap. See `docs/AUTH_API.md`.   |
| `account.model.ts` — `UserDetails`, `AnswerMap`, `Question`                                            | `profile/` is questionnaire answers **only** (changed 2026-09-09); the user row is `user_details/`. `profile_status` is the onboarding milestone and is **not** the token claim `miles.onboarding_required` — opposite polarity. |
| `features/offerings/models/assessment.model.ts`                                                        | An exam session needs a session id. Masterclass uses `:sessionId`, podcast/micro-learning use `:session_id` — both are live, do not "normalise" without fixing every consumer.                                                   |
| `seo.models.ts` / `seo.constants.ts`                                                                   | A Supabase `seo_pages` slug excludes the locale prefix. `DYNAMIC_SLUG_PREFIXES` decides who owns a route's SEO.                                                                                                                  |
| `admin/core/models/admin-rbac.model.ts` — `PERM`                                                       | Every admin route is gated by a `PERM` constant. Never hardcode a permission string.                                                                                                                                             |
| `http.model.ts` — `CommonResponse<T>`                                                                  | Django responses are wrapped. Unwrap in the facade, not the component.                                                                                                                                                           |

---

## 6. API contracts

Two backends. Do not cross the wires.

**Django REST** — base `environment.BASE_API_URL`, called through `ApiClient`, bearer attached by `appInterceptor`.

- `GET` for reads: course lists, course detail, chapters, CPE tracker report, orders, plans, profile.
- `POST` for actions: the five `api/v1/account/auth-*` sign-in routes, quiz + final-assessment submission, `myclassactivity` progress, cart operations, checkout, feedback, enquiry.
- `PUT`/`PATCH` for profile and address updates. `DELETE` for cart items and bookmarks.
- Content-type routes use the API token `nano_learning`, not the URL token `micro-learning`.

**Supabase** — direct client access, RLS-enforced (the `supabase` skill has the split).

- `seo_pages` — read on both server and browser; written only from the admin SEO console.
- Admin auth session — the `Supabase` client, persisted.
- Lead / enquiry capture — the `SupabasePublic` client, anonymous, never persisted.

**Partner Platform** — Django `/partner-admin/...`, tagged with the `IS_ADMIN_REQUEST` context token so `adminTokenInterceptor` attaches the admin token instead of the learner token.

**Surfaces: this app uses `api/v1/` and `web-api/v1/` only — never `app-api/`.** That surface belongs to the mobile app. An ESLint rule (`no-restricted-syntax`) fails the build on an `app-api/` string, because the temptation is real and specific: some fields exist on an app route and nowhere else. When that happens, ask the backend for a `web-api` twin — do not cross the surface. Open cases are in `docs/WEBINAR_API_QUESTIONS.md`.

Never invent a path. For auth and account routes the contract is `docs/AUTH_API.md`, backed by the generated `postman/`. If a route is in neither the code nor those, ask.

**Services: `@Service()`, not `@Injectable`.** Angular 22 ships `@Service()` and `ng generate service` emits it by default (`--injectable` is the opt-out). Use `@Service({ autoProvided: false })` for anything that must be listed in a route's `providers` — that is what makes a route-scoped facade's lifetime explicit. Scaffold with `ng generate`; do not hand-write the file.

**Reads vs commands.** Reads are `httpResource` fields on a `@Service()` (they fetch on sign-in and idle on sign-out by themselves — gate the request function on the **boolean** `isAuthenticated()`, never on the token string, or every rotation re-fires every read). Mutations go through `ApiClient.call()` against a `RouteConfig` registry, per Angular's own guidance that `httpResource` is not for POST/PUT.

---

## 7. Security

**Never expose to the browser**: the Supabase service-role key, Django admin credentials, the Entra client secret, DirectLine secrets, the AI-Labs provisioning secret, or any partner-provisioning token. The publishable anon key and the public client/tenant IDs in `environment*.ts` are public by design and RLS-scoped — everything else is not.

**Never run from the browser**: privileged Supabase writes (RLS must be the gate, not a client-side check), admin provisioning, or any bulk operation that bypasses a permission guard.

**Always**:

- Gate every admin route with `permissionGuard(PERM.*)`. Hiding the nav link is not guarding the route.
- Keep the two Supabase clients separate. `SupabasePublic` must stay session-free, or public form submissions inherit the signed-in admin's identity and break RLS.
- Send tokens through the interceptors. Never hand-attach an `Authorization` header.
- Read cookies through `Storage` on the server path — it parses them off the request. Touching `document.cookie` during SSR throws.
- Validate anything a user typed at the boundary before it reaches an API call.

---

## 8. Code standards

- Small functions. Explicit types. **No `any`** — if you need an escape hatch, type the model properly instead.
- No changes outside the task's scope. No drive-by refactors, no reformatting untouched files.
- No over-engineering: no abstraction with one caller, no options object for one flag, no `Base*` class "for later."
- **Standalone components, `OnPush`, signals.** `@if`/`@for`, never `*ngIf`/`*ngFor`.
- **Cleanup via `DestroyRef` + `takeUntilDestroyed()`**, never `OnDestroy`.
- Template-only members are `protected readonly`.
- `effect()` over lifecycle hooks for reactive setup. Bridge observables with `toSignal`; never capture a `let` in an effect closure.
- Files: `kebab-case.ts/.html/.css`, co-located. Selectors `kebab-case`. Types `PascalCase`.
- Comment _why_, not _what_. The existing comments in this codebase are load-bearing — match that density, don't strip them.
- Fix bugs at the root. Grep every caller of the function you're about to change; one guard in the shared function beats a guard in each caller.

---

## 9. Before you ship

Run these and report the real output — including failures.

```bash
pnpm lint          # eslint
pnpm format:fix    # prettier
pnpm test          # vitest
pnpm build:prod    # the real gate: AOT + bundle budget
```

Then, depending on what changed:

- **UI**: `pnpm start` (port **4101**) and verify in a browser. Type checks are not feature correctness.
- **SSR / server code**: `pnpm build && pnpm serve:ssr:miles-masterclass-v3`, then load the route — catches `window`/`document` leaks that dev mode hides.
- **SEO**: after the SSR run, confirm the served HTML carries the tags:
  ```bash
  curl -s http://localhost:4000/us/cpa/masterclass | grep -E '<title>|og:|twitter:|canonical'
  ```
  Then navigate between two SEO-owning pages in a browser and confirm `document.querySelectorAll('meta[property^="og:"]').length` doesn't grow.
- **Bundle-affecting change**: the initial bundle sits near its 2.00 MB budget. If `build:prod` warns, lazy-load — don't raise the budget.

Known baseline — **state the environment, because it changes the answer:**

- **Locally (macOS, Node 24.15), re-measured 2026-09-26:** all green. `pnpm lint` 0 errors (135 legacy `any` warnings, see below), `pnpm ng test --watch=false` 182 files / 692 passed + 1 skipped, `pnpm format` 0, `pnpm build:prod` 0, `pnpm build-storybook` 0.
- **In CI (ubuntu, Node 22.x):** was red on 3 `blob-download.spec.ts` failures — a Node `Blob` reaching jsdom's `FileReader`. **Fixed**; root cause and the proof in `docs/engineering/enforcement-verified.md` §4.

**A red gate means you broke it** — the old "lint and test are already red from pre-existing debt" note was stale and that debt is paid off, so don't reach for it as an excuse. But **say which environment you measured**: that `blob-download` bug passed locally and failed only in CI, and a local-green/CI-red split is the hardest kind to debug if nobody records which side they ran.

The gates run inside the required `verify` check on `master`, next to `pr-title`, `commitlint` and `branch-name` (see `docs/engineering/github-setup.md`). Respect the Husky hooks; bypassing them only delays the same failure in CI, where it cannot be skipped.

### What enforces the rules

The rules in this file hold for every contributor and every tool (Claude Code, Cursor, Copilot, Codex, Gemini, or none), because they are checked where all of them pass through: git hooks locally, required CI checks on the PR, and branch rulesets on `master`. Agent instruction files (`CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`) only point here.

| What                                                                                                                                                                             | Local (Husky)                                | CI (required on `master`)                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------- |
| Branch name `type/TICKET-description`                                                                                                                                            | `pre-commit`                                 | `branch-name`                                  |
| Conventional Commits                                                                                                                                                             | `commit-msg` → commitlint                    | `commitlint`, `pr-title` (the squash title)    |
| Import boundaries, `inject()`, `@if`/`@for`, `DestroyRef`, no `any`, no `@angular/aria` / `Injectable` / `NgClass` / `NgStyle` / `app-api/`                                      | `lint-staged` → ESLint (staged files)        | `verify` → `pnpm lint`                         |
| Naming, plural folders, no `shared/` in a feature, routed components in `pages/`, component CSS reasons, static styles, `@defer` placeholders, colours equal to a `@theme` token | `pre-commit` → `scripts/check-structure.mjs` | `verify` → `pnpm lint` (+ `pnpm test:scripts`) |
| Formatting, tests, AOT build + bundle budget, Storybook                                                                                                                          | `lint-staged` → Prettier                     | `verify`                                       |
| One reviewed, squash-merged PR per change; protected tags; releases                                                                                                              | —                                            | rulesets, `CODEOWNERS`, release-please         |

**When a check fails:**

- **ESLint:** fix the code. Never `eslint-disable` or `@ts-ignore`. The 34 files in `LEGACY_ANY_FILES` (`eslint.config.mjs`) only warn on `any`; remove a file from that list when its `any`s are gone, and never add one.
- **Structure check** (`pnpm check:structure`): it's a ratchet against `structure-baseline.json`.
  - A **new** violation fails. Fix it; a baseline entry is only for a genuine §4.6-style exception, needs a reason, and is reviewed via `CODEOWNERS`.
  - A **fixed** one fails as "out of date". Run `node scripts/check-structure.mjs --prune`, which only removes or lowers entries, and commit the smaller baseline.

---

## 10. Skills

Tool and module knowledge lives in `.claude/skills/`, not here. Name the ones you need in your prompt.

**Foundation** — read the relevant one before touching anything

| Skill                 | Use it when                                                                             |
| --------------------- | --------------------------------------------------------------------------------------- |
| `tech-stack`          | Versions, scripts, build configs, environments, adding or upgrading a dependency.       |
| `angular-conventions` | Writing any component, service, signal, effect, or template in this repo.               |
| `core-services`       | ApiClient, Auth, Storage, Dialog, Notification, Logger, Utils, Analytics, interceptors. |
| `routing-and-guards`  | Adding a route, guard, redirect, or changing an SSR render mode.                        |
| `seo`                 | Meta tags, canonical, JSON-LD, the Supabase `seo_pages` table, the admin SEO console.   |
| `ui-components`       | Building UI — `ui/` primitives, cards, dialogs, Tailwind, Storybook, a11y.              |
| `media-players`       | Video.js / audio player, HLS, CPE vs Preview mode, playback progress.                   |
| `supabase`            | Any Supabase read/write, RLS, or the two-client split.                                  |

**Learner features**

| Skill              | Owns                                                                   |
| ------------------ | ---------------------------------------------------------------------- |
| `masterclass`      | Multi-chapter video courses, chapter player, course detail.            |
| `micro-learning`   | Reel-based CPE (`nano_learning`), reel navigation, reel progress.      |
| `podcast`          | Audio courses — structurally a masterclass with an audio player.       |
| `webinar`          | Live/recorded webinars, registration, `premiere` legacy redirects.     |
| `assessments`      | Chapter quizzes, final assessment exam + report, course feedback.      |
| `auth-module`      | OTP login, onboarding/profile questionnaire, session + token rotation. |
| `payment`          | Plans, cart, billing, checkout, orders, invoices, coupons.             |
| `cpe-tracker`      | Credit tracking, certificates, Credly badges, compliance.              |
| `library`          | Course / instructor / badge library, filters.                          |
| `home-and-landing` | Home, CPA landing, UAE CAIRA, FAQ and legal pages.                     |
| `partners`         | CPA-society and firm landing pages, CAIRA marketing.                   |
| `blog`             | Headless WordPress blog via the WP REST API.                           |

**Admin**

| Skill              | Owns                                                                |
| ------------------ | ------------------------------------------------------------------- |
| `admin-panel`      | Admin shell, RBAC, admin auth, users, leads, user reports.          |
| `partner-platform` | B2B network licensing, partner codes, network / sub-company admins. |

---

## 11. When in doubt

1. Keep it small. The shortest change that fixes the root cause wins.
2. Read the relevant skill before guessing at a convention.
3. Ask one focused question rather than making a decision a rule should have made.
4. If a rule was missing and you had to invent one, say so in the prompt's **Assumptions** section — that's the section the reviewer reads first.
5. If you'd have to repeat something in more than one prompt, it belongs in this file or in a skill. Say so.

Save a prompt. Get approval. Implement. Run checks. Share test steps.
