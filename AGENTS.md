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
- A component library or CSS framework swap. Tailwind v4 + `shared/components/ui` is the answer.
- Social features (comments, following, feeds), gamification beyond the existing badges, or a recommendation engine.
- Server-side business logic in this repo. The Angular SSR server renders and serves — it is not the backend.
- Speculative abstractions: no interface with one implementation, no config for a value that never changes.

Do not overbuild. If a request implies a feature nobody asked for, say so in one line and build only what was asked.

---

## 3. Architecture

Where each kind of logic lives. Stay consistent with this across every feature, not just the one in front of you.

| Layer                          | Lives in                                        | Rule                                                                                  |
| ------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| Presentation                   | `*.ts` / `*.html` / `*.css` components          | Renders state. No HTTP, no business rules, no `HttpClient`.                           |
| Feature state + business logic | **Facades** (`shared/services/<name>-facade/`)  | Signals for state, methods for actions. This is where HTTP, dialogs and routing live. |
| HTTP                           | `ApiClient` (`shared/core/services/api-client`) | Prepends `BASE_API_URL`. Never inject `HttpClient` in a feature.                      |
| Cross-cutting singletons       | `shared/core/services/`                         | Auth, Storage, Dialog, Notification, Logger, Utils, SeoManager, Analytics.            |
| Route protection               | `shared/core/guards/` + `admin/shared/guards/`  | Guards decide access; components never check auth inline.                             |
| Domain types                   | `shared/core/models/`                           | Canonical location. Feature-local models only when nothing else uses them.            |
| Reusable UI                    | `shared/components/`                            | `ui/` primitives, `cards/`, `dialog/`, players, carousel.                             |

Three hard boundaries:

- **Components display, facades decide.** If a component grows an `if` about business rules, that `if` belongs in a facade.
- **Facades are route-scoped by default.** Most are provided in the route config, not `providedIn: 'root'`, so two feature trees get independent instances. `FeatureFacade` and the core singletons are the deliberate exceptions.
- **The browser is untrusted.** Secrets, service-role keys and privileged operations never reach client code (see §7).

---

## 4. Tech stack

Full detail — versions, scripts, build configs, environments — lives in the **`tech-stack`** skill. The short version:

**Use**

- **Angular 22** (standalone, signals, `@if`/`@for`) — the framework. No NgModules in new code.
- **`@angular/ssr` + Express** — SSR/SSG/CSR hybrid. Render mode is per-route in `app.routes.server.ts`.
- **Signals + RxJS 7** — state. Facades expose `signal`/`computed`; RxJS for HTTP streams.
- **Tailwind CSS v4** — styling. Component CSS only for what Tailwind genuinely can't express.
- **`@angular/aria` + `@angular/cdk`** — accessible primitives (listbox, overlay, a11y).
- **Supabase** — SEO rows, admin auth, lead capture. Two separate clients (see the `supabase` skill).
- **Django REST API** (`BASE_API_URL`) — courses, users, payment, CPE, everything learner-facing.
- **Video.js 8** (+ HLS, YouTube plugin) — video and audio playback.
- **`@ng-icons`** — icons. **Swiper 12** — carousels. **jsPDF + html2canvas-pro** — certificates.
- **Vitest 4** — tests. **ESLint 10 + Prettier 3** — lint/format. **Storybook 10** — component docs.
- **pnpm 10** — package manager.

**Do not use**

- NgRx, Akita, or any external store. `@ngrx/*` must not enter `package.json`.
- `HttpClient` directly inside a feature — go through `ApiClient`.
- NgModules, `*ngIf`/`*ngFor` structural directives, or `OnDestroy` (use `DestroyRef`).
- `npm` or `yarn` — the lockfile is `pnpm-lock.yaml`. Run `pnpm install --frozen-lockfile` after any branch switch.
- A second date, HTTP, form, icon, or carousel library. What's installed covers it.
- `document` / `window` / `localStorage` directly — use `Storage`, or guard with `isPlatformBrowser`.
- `DOCUMENT` from `@angular/common` — import it from `@angular/core` (the `common` re-export is deprecated in v22).

---

## 5. Data model

Domain types live in `src/app/shared/core/models/`. The ones that carry rules:

| Model                                                                                                  | Required before anything downstream works                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `masterclass.model.ts` — `ContentDetails`, `CourseChapter`, `QuizDetails`                              | A chapter needs `chapterId` + a playable source. Course pages key off `courseId` + a `courseTitle` slug.                                                                                                                         |
| `micro-learning-course.model.ts` — `MicroLearningReel`                                                 | A reel has **both** `id` and `chapter_id`. Activity tracking (`myclassactivity`) uses **`chapter_id`**. Completion is derived: 95% watched → `isReelCompleted()`. Never add a second completion flag.                            |
| `nano-learning.model.ts`                                                                               | API path segment is `nano_learning` (snake_case); frontend URL segment is `micro-learning` (kebab-case). Never conflate the two.                                                                                                 |
| `course.model.ts` — `InstructorDetails`, `FieldOfStudy`, `PriceDetails`, `PlayHistory`, `QuizQuestion` | Credits render from `FieldOfStudy`; never sum credits by hand — use `TotalCpeCreditsPipe`.                                                                                                                                       |
| `auth.model.ts` — `AUTH_ROUTES`, `SessionResponse`, `AuthFailure`                                      | Sign-in is OTP-only against MilesCAIRA Accounts v1. A bad token answers **403, not 401**; refresh **before** expiry, never as a retry; refresh tokens **rotate** and two refreshes must never overlap. See `docs/AUTH_API.md`.   |
| `account.model.ts` — `UserDetails`, `AnswerMap`, `Question`                                            | `profile/` is questionnaire answers **only** (changed 2026-09-09); the user row is `user_details/`. `profile_status` is the onboarding milestone and is **not** the token claim `miles.onboarding_required` — opposite polarity. |
| `assessment.model.ts`                                                                                  | An exam session needs a session id. Masterclass uses `:sessionId`, podcast/micro-learning use `:session_id` — both are live, do not "normalise" without fixing every consumer.                                                   |
| `seo.models.ts` / `seo.constants.ts`                                                                   | A Supabase `seo_pages` slug excludes the locale prefix. `DYNAMIC_SLUG_PREFIXES` decides who owns a route's SEO.                                                                                                                  |
| `admin/admin-rbac.model.ts` — `PERM`                                                                   | Every admin route is gated by a `PERM` constant. Never hardcode a permission string.                                                                                                                                             |
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

Never invent a path. For auth and account routes the contract is `docs/AUTH_API.md`, backed by the generated `Postman Collection/`. If a route is in neither the code nor those, ask.

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

- **UI**: `pnpm start` (port **4100**) and verify in a browser. Type checks are not feature correctness.
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
