# AGENTS.md

You are a principal-level engineer — expert in TypeScript, Angular and scalable web application development — working on **Miles Masterclass v3**, an Angular SSR platform that delivers CPE (Continuing Professional Education) to accounting professionals.

Your job: understand the request, read the right skills, write a clear implementation prompt, get approval, then implement.

---

## 1. Workflow

Run this loop for every feature. Do not skip steps 5–7.

1. Read this file (auto-loaded — never restate it in a prompt).
2. Read the skills named in the prompt, plus any clearly needed supporting skill (see §10).
3. Inspect the real code the change touches. Trace the flow end to end before proposing anything.
4. Ask **one** focused question only if there is real ambiguity. Otherwise state an assumption and continue.
5. Write a detailed implementation prompt to `prompts/<feature-name>.md` using `prompts/_TEMPLATE.md`.
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

- New state management (NgRx, Akita, etc.) or a facade layer. `@Service()` + signals + `httpResource` is the answer (§3).
- A component library or CSS framework swap. Tailwind v4 + `shared/components/ui` is the answer.
- Social features (comments, following, feeds), gamification beyond the existing badges, or a recommendation engine.
- Server-side business logic in this repo. The Angular SSR server renders and serves — it is not the backend.
- Speculative abstractions: no interface with one implementation, no config for a value that never changes.

Do not overbuild. If a request implies a feature nobody asked for, say so in one line and build only what was asked.

---

## 3. Architecture

Where each kind of logic lives. Stay consistent with this across every feature, not just the one in front of you.

| Layer                    | Lives in                                        | Rule                                                                                            |
| ------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Presentation             | `*.ts` / `*.html` / `*.css` components          | Renders state, and owns state nothing else reads. No `HttpClient`.                              |
| Shared state + reads     | **`@Service()`** classes + `httpResource`       | A `signal` reactive root, an `httpResource` keyed on it, `computed()` for everything derived.   |
| Per-instance reads       | **Factory functions** returning signals         | `courseFeed()` — takes an `Injector`, returns `Signal`s. No class when there's no shared state. |
| Commands (writes)        | `ApiClient` (`shared/core/services/api-client`) | POST/PUT/DELETE return Observables. Prepends `BASE_API_URL`. Never inject `HttpClient`.         |
| Cross-cutting singletons | `shared/core/services/`                         | Auth, Storage, Dialog, Notification, Logger, Utils, SeoManager, Analytics.                      |
| Route protection         | `shared/core/guards/` + `admin/shared/guards/`  | Guards decide access; components never check auth inline.                                       |
| Domain types             | `shared/core/models/`                           | Canonical location. Feature-local models only when nothing else uses them.                      |
| Reusable UI              | `shared/components/`                            | `ui/` primitives, `cards/`, `dialog/`, players, carousel.                                       |

### No facade layer

**There is no facade pattern in this codebase. Do not add one, and do not name anything `*Facade`.** The Django strip deleted nearly all of them; four survive (`FeatureFacade` and the three admin ones) and are debt, not a template. A component whose state nobody else reads holds that state itself — that is what `5fa5c08` did to the login page.

State and reads are structured like `Auth` (`shared/core/services/auth/auth.ts`) — read it before writing a new service:

- **One `signal` is the reactive root** (there, the access token). Everything else derives from it.
- **Reads are an `httpResource` keyed on that root**, returning `undefined` for the URL when the read shouldn't happen. Signing out flips one signal and the in-flight request aborts on its own.
- **Derived state is `computed()`.** Never an `effect()` that copies resource data into a signal — that's the state-propagating effect Angular warns about, and keying a resource on a counter you bump yourself loops forever.
- **`httpResource` is reads only.** Commands go through `ApiClient` and return Observables.
- `httpResource` registers a `PendingTasks` entry, so SSR waits for it and the transfer cache replays it in the browser. That is why no hand-rolled `TransferState` bridge is needed.

Three hard boundaries:

- **Components display, services decide.** If a component grows an `if` about a business rule that another component would need too, that `if` moves into a `@Service()`. If nothing else needs it, it stays put — don't extract a service for one caller.
- **Scope is deliberate.** `@Service()` is an app-wide singleton; `@Service({ autoProvided: false })` plus a route `providers` entry gives a feature tree its own instance. Pick one and say why in the prompt.
- **The browser is untrusted.** Secrets, service-role keys and privileged operations never reach client code (see §7).

---

## 4. Tech stack

Full detail — versions, scripts, build configs, environments — lives in the **`tech-stack`** skill. The short version:

**Use**

- **Angular 22** (standalone, signals, `@if`/`@for`) — the framework. No NgModules in new code.
- **`@angular/ssr` + Express** — SSR/SSG/CSR hybrid. Render mode is per-route in `app.routes.server.ts`.
- **Signals + `httpResource`** — state and reads. `signal`/`computed` for state, `httpResource` for GETs. **RxJS 7** for commands through `ApiClient` and for interceptor plumbing — not as a state container.
- **Tailwind CSS v4** — styling. Component CSS only for what Tailwind genuinely can't express.
- **`@angular/aria` + `@angular/cdk`** — accessible primitives (listbox, overlay, a11y).
- **Supabase** — SEO rows, admin auth, lead capture. Two separate clients (see the `supabase` skill).
- **Django REST API** (`BASE_API_URL`) — courses, users, payment, CPE, everything learner-facing.
- **Video.js 8** (+ HLS, YouTube plugin) — video and audio playback.
- **`@ng-icons`** — icons. **Swiper 12** — carousels. **jsPDF + html2canvas-pro** — certificates.
- **Vitest 4** — tests. **ESLint 10 + Prettier 3** — lint/format. **Storybook 10** — component docs.
- **pnpm 10** — package manager.

**Do not use**

- NgRx, Akita, or any external store. `@ngrx/*` must not enter `package.json`. SignalStore was evaluated in full and rejected — read [ADR-0002](docs/adr/0002-no-external-store.md) before raising it again; it names the three conditions that would reverse the decision.
- `@Injectable`. Use `@Service()` / `@Service({ autoProvided: false })` — see [ADR-0001](docs/adr/0001-service-decorator.md).
- `HttpClient` directly inside a feature — go through `ApiClient`.
- NgModules, `*ngIf`/`*ngFor` structural directives, or `OnDestroy` (use `DestroyRef`).
- `npm` or `yarn` — the lockfile is `pnpm-lock.yaml`. Run `pnpm install --frozen-lockfile` after any branch switch.
- A second date, HTTP, form, icon, or carousel library. What's installed covers it.
- `document` / `window` / `localStorage` directly — use `Storage`, or guard with `isPlatformBrowser`.
- `DOCUMENT` from `@angular/common` — import it from `@angular/core` (the `common` re-export is deprecated in v22).

---

## 5. Data model

Domain types live in `src/app/shared/core/models/`. The ones that carry rules:

| Model                                                                                                  | Required before anything downstream works                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `masterclass.model.ts` — `ContentDetails`, `CourseChapter`, `QuizDetails`                              | A chapter needs `chapterId` + a playable source. Course pages key off `courseId` + a `courseTitle` slug.                                                                                                                                                                           |
| `micro-learning-course.model.ts` — `MicroLearningReel`                                                 | A reel has **both** `id` and `chapter_id`. Activity tracking (`myclassactivity`) uses **`chapter_id`**. Completion is derived: 95% watched → `isReelCompleted()`. Never add a second completion flag.                                                                              |
| `nano-learning.model.ts`                                                                               | API path segment is `nano_learning` (snake_case); frontend URL segment is `micro-learning` (kebab-case). Never conflate the two.                                                                                                                                                   |
| `course.model.ts` — `InstructorDetails`, `FieldOfStudy`, `PriceDetails`, `PlayHistory`, `QuizQuestion` | Credits render from `FieldOfStudy`; never sum credits by hand — use `TotalCpeCreditsPipe`.                                                                                                                                                                                         |
| `caira/auth.model.ts` — `CairaUser`                                                                    | A user is authenticated only with a valid access token. **There is no plan model** — CAIRA has no subscriptions; access is `User.enrolled` tag membership. Profile completeness comes from `v2/status`, never from a login response's `onboarding` flag (#33 hardcodes it `true`). |
| `assessment.model.ts`                                                                                  | An exam session needs a session id. Masterclass uses `:sessionId`, podcast/micro-learning use `:session_id` — both are live, do not "normalise" without fixing every consumer.                                                                                                     |
| `seo.models.ts` / `seo.constants.ts`                                                                   | A Supabase `seo_pages` slug excludes the locale prefix. `DYNAMIC_SLUG_PREFIXES` decides who owns a route's SEO.                                                                                                                                                                    |
| `admin/admin-rbac.model.ts` — `PERM`                                                                   | Every admin route is gated by a `PERM` constant. Never hardcode a permission string.                                                                                                                                                                                               |
| `caira/envelope.model.ts` — `CairaFailure`, the six envelopes                                          | **There is no `CommonResponse<T>`.** CAIRA has six success envelopes and five error vocabularies. Unwrap in the `computed()` over the resource, not in the template, and classify failures with `cairaError()`.                                                                    |

> ⚠️ The Django-era rows above (`masterclass.model.ts`, `micro-learning-course.model.ts`,
> `nano-learning.model.ts`, `course.model.ts`, `assessment.model.ts`) describe models deleted in
> `241ce4f`. They are the **contract to rebuild**, not files on disk — see
> `prompts/caira-api-binding.md`. This table is rewritten as each phase lands.

---

## 6. API contracts

Two backends. Do not cross the wires.

**CAIRA** — base `environment.BASE_API_URL` (`api.milescaira.com` / `uat-api.milescaira.com`), called through `ApiClient`, auth via the interceptor chain.

- Paths come from `core/http/caira.endpoints.ts`. **Never a string literal** — trailing slashes are load-bearing, and a 301 from `APPEND_SLASH` drops a POST body.
- **No `/api/` prefix** — routes are registered at the Django URLconf root.
- Only `Authorization: Bearer` is read. The old `x-app-type` / `x-platform` / `x-country-code` headers are gone: CAIRA does not allowlist them, so each would fail the CORS preflight.
- **Auth failures return 403, not 401** — no `authenticate_header()` override. Verified live.
- `/:country/:profession_type` is **cosmetic**. No CAIRA endpoint takes a country or profession.
- Surfaces with no CAIRA counterpart are listed in `docs/CAIRA_GAPS.md`. Don't point a component at a dead URL.

**Supabase** — direct client access, RLS-enforced (the `supabase` skill has the split).

- `seo_pages` — read on both server and browser; written only from the admin SEO console.
- Admin auth session — the `Supabase` client, persisted.
- Lead / enquiry capture — the `SupabasePublic` client, anonymous, never persisted.

**Partner Platform** — no CAIRA counterpart at all. `IS_ADMIN_REQUEST` and `adminTokenInterceptor` no longer exist; the admin panel is Supabase-only. `docs/PARTNER_PLATFORM_API.md` documents the sunsetting API and is kept for reference only.

Never invent a path. If a route isn't in `caira.endpoints.ts` or the CAIRA API reference, ask.

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

You write functional, maintainable, performant and accessible code. These rules bind **new and touched code**. Where the existing codebase disagrees (noted below), fix it only in files the task already changes — §8's no-drive-by-refactors rule still wins.

### General

- Small functions. Explicit types. **No `any`** — use `unknown` when the type is genuinely uncertain, then narrow. If you need an escape hatch, type the model properly instead.
- Prefer type inference where the type is obvious; annotate where it isn't (public APIs, return types that aren't self-evident). Strict type checking is on — don't weaken `tsconfig` to make an error go away.
- No changes outside the task's scope. No drive-by refactors, no reformatting untouched files.
- No over-engineering: no abstraction with one caller, no options object for one flag, no `Base*` class "for later."
- Files: `kebab-case.ts/.html/.css`, co-located. Selectors `kebab-case`. Types `PascalCase`. External templates and styles use paths relative to the component's `.ts` file.
- Comment _why_, not _what_. The existing comments in this codebase are load-bearing — match that density, don't strip them.
- Fix bugs at the root. Grep every caller of the function you're about to change; one guard in the shared function beats a guard in each caller.

### Angular

- **Standalone is the default.** Never write `standalone: true` — it is redundant in v20+. (5 stale occurrences remain in `src/`; clear them when you touch the file.)
- **Never set `changeDetection: ChangeDetectionStrategy.OnPush`.** `OnPush` is the v22 default and the CLI schematic already emits it — an explicit line is noise. No component in `src/` sets it; keep it that way.
- Signals for state. `computed()` for derived state, `linkedSignal()` when derived state comes from several reactive sources and must stay in sync. Never `mutate()` a signal — `set()` or `update()`.
- **Cleanup via `DestroyRef` + `takeUntilDestroyed()`**, never `OnDestroy`.
- `effect()` over lifecycle hooks for reactive setup. Bridge observables with `toSignal`; never capture a `let` in an effect closure.
- Lazy-load every feature route (`loadComponent` / `loadChildren`) — the initial bundle sits near its budget (§9).
- **No `@HostBinding` / `@HostListener`.** Use the `host` object on `@Component` / `@Directive`.
- `NgOptimizedImage` for static images. It does **not** work for inline base64 — use a plain `<img>` there.

### Components

- One responsibility per component. Keep them small.
- `input()` / `output()` functions, never the decorators. `model()` for two-way `[(prop)]` — never an `input()`/`output()` pair emulating it.
- Inline templates for small components; a separate `.html` once it stops fitting on a screen.
- Template-only members are `protected readonly`.
- **Forms**: prefer Signal Forms (`@angular/forms/signals`, stable in v22 — signal state, type-safe field access, schema validation) for new forms. Otherwise Reactive forms. Template-driven (`ngModel`) is not an option for new work; 7 usages remain in `src/`.

### Templates

- Native control flow `@if` / `@for` / `@switch`. Never `*ngIf` / `*ngFor` / `*ngSwitch`.
- **No `ngClass` / `ngStyle`** — use `[class.x]` / `[class]` and `[style.x]` / `[style]` bindings. (79 usages remain in `src/`; convert as you touch them, don't sweep.)
- Keep logic out of templates — a condition worth naming belongs in a `computed()`.
- `async` pipe for observables.
- No globals in templates. `new Date()` is not available and breaks SSR — pass the value in from the component.

### Services

- One responsibility per service. `inject()`, never constructor injection.
- **Singletons**: `@Service()` — see [ADR-0001](docs/adr/0001-service-decorator.md). It is the repo's replacement for `@Injectable({ providedIn: 'root' })`; both make a root singleton, and `@Service()` is the one to use in new code. `@Service({ autoProvided: false })` + a route `providers` entry when a feature tree needs its own instance.
- **Reads are `httpResource`, not a method that fetches.** Key the resource on the signal the read depends on and let it refetch itself; don't write `loadX()` + a `data` signal + an `effect()` to join them (§3).
- **No facades.** Never create a `*Facade`. Shared state is a `@Service()`, per-instance state is a factory function returning signals, and state only one component reads lives in that component (§3).

### Accessibility — not optional

- Every UI change MUST pass **AXE** with zero violations and meet **WCAG 2.1 AA**: colour contrast, visible focus, managed focus order on route and dialog changes, correct roles and ARIA, and a keyboard path to every interactive element.
- Reach for `@angular/aria` and `@angular/cdk/a11y` before hand-rolling a pattern. Storybook's `@storybook/addon-a11y` runs AXE on stories — use it.
- A11y is in the acceptance criteria of any prompt with a **UI requirements** section. It is never the thing you drop to ship.

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

Known baseline: `pnpm lint` and `pnpm test` are **already red** from pre-existing debt (stale mocks, a11y rules). Compare against the baseline on `master` — don't claim you broke or fixed something you didn't. `build:prod` is the gate that must stay green. Respect the Husky pre-commit hook; never bypass with `--no-verify`.

---

## 10. Skills

Tool and module knowledge lives in `.claude/skills/`, not here. Name the ones you need in your prompt.

**Vendor** — installed from the upstream maintainers via `npx skills`, pinned in `skills-lock.json`. Never hand-edit these; `npx skills update` owns them.

| Skill                              | Source                       | Use it when                                                                                                               |
| ---------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `supabase`                         | `supabase/agent-skills`      | Any Supabase client, auth, RLS or migration work. Generic — our two-client split and the `seo_pages` rules stay in §6/§7. |
| `supabase-postgres-best-practices` | `supabase/agent-skills`      | Writing SQL, schema, indexes or RLS policies against `seo_pages` / lead tables.                                           |
| `vitest`                           | `antfu/skills` (Vitest core) | Writing or fixing tests, mocking, coverage, `vi.*`, config.                                                               |

Angular itself is covered by the globally installed `angular-developer` skill — do not duplicate it here. Tailwind v4, Storybook, Video.js, RxJS and Swiper have no first-party skill; use `docs/` and the vendor docs.

> ⚠️ The two tables below describe repo-specific skills deleted in `c31f69d` and not yet
> rebuilt. Until they exist, read the real code and the `docs/` files instead — and say so in
> the prompt's **Assumptions** section.

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

| Skill              | Owns                                                               |
| ------------------ | ------------------------------------------------------------------ |
| `masterclass`      | Multi-chapter video courses, chapter player, course detail.        |
| `micro-learning`   | Reel-based CPE (`nano_learning`), reel navigation, reel progress.  |
| `podcast`          | Audio courses — structurally a masterclass with an audio player.   |
| `webinar`          | Live/recorded webinars, registration, `premiere` legacy redirects. |
| `assessments`      | Chapter quizzes, final assessment exam + report, course feedback.  |
| `auth-module`      | Login, signup, forgot-password, profile, token lifecycle.          |
| `payment`          | Plans, cart, billing, checkout, orders, invoices, coupons.         |
| `cpe-tracker`      | Credit tracking, certificates, Credly badges, compliance.          |
| `library`          | Course / instructor / badge library, filters.                      |
| `home-and-landing` | Home, CPA landing, UAE CAIRA, FAQ and legal pages.                 |
| `partners`         | CPA-society and firm landing pages, CAIRA marketing.               |
| `blog`             | Headless WordPress blog via the WP REST API.                       |

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
