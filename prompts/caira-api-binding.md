# CAIRA Web API — Binding Plan

> Revision 2. Rewritten against the architecture that actually landed: **no facade layer**,
> `@Service()` + `httpResource` for reads, `ApiClient` for commands (AGENTS.md §3).
> Phases P0–P3(listing) have shipped — this revision records what they settled, not what they
> proposed.

## Context

`241ce4f "Remove the Django data layer, keep the design system"` stripped every binding to the
sunsetting `api.milesmasterclass.com` API. Deleted: `ApiClient`, all three interceptors,
`http.model.ts`, `BASE_API_URL` (all three environments), 21 facades and 21 payload-model files.
Kept: every template, style token, layout shell, guard, route and Storybook story, plus the two
data paths that never touched Django (Supabase, WordPress).

Each removal site left a `ponytail:` marker — 153 across 92 files at the strip, **150 across 91
today**. Each unbound consumer still holds an inline `any` placeholder under the same field name, so
templates compile unedited and pages render their empty states. **Those placeholder literals are
executable specs**: a service matching their key names and return kinds drops in with zero template
edits.

This plan rebinds that layer against the CAIRA Web API (50 endpoints,
`~/Downloads/CAIRA_Web_API_Reference.md`), with error classification at the HTTP boundary. Outcome:
a learner can log in, browse masterclasses, play chapters with persisted progress, pass quizzes and
the final assessment, submit feedback, and see CPE credit, Credly badges and certificates — on the
unchanged design.

**Branch:** `feat/caira-api-binding` off `master`.

### What has landed

| Commit                | Phase                                                                       |
| --------------------- | --------------------------------------------------------------------------- |
| `7a2e833`             | `@Service` replaces `@Injectable` across 36 files (ADR-0001)                |
| `ad14640`             | **P1** transport core + **P2** auth, bound end to end                       |
| `e82fa32`             | ADR-0001 (DI decorator), ADR-0002 (no external store)                       |
| `623c6ae`             | **P3 listing** — catalog rails, `courseFeed()` factory, `masterclass.model` |
| `2043771` + `5fa5c08` | Identity driven by `httpResource`; `AuthFacade` folded into the login page  |
| `bd06b74`             | AGENTS.md: facade layer removed from the rules                              |

**P0 is closed** except item 4 (QR crypto). Hosts are confirmed and in `environment*.ts`; three
contracts are captured in `docs/caira-contracts/`; `docs/CAIRA_GAPS.md` is written (G-numbered).

---

## Decisions (locked)

| #   | Decision                                                                                                           | Consequence                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **No runtime response validation.** TS interfaces + defaults only.                                                 | No new dependency. Backend drift surfaces as a runtime error in a component, caught by the `unexpected` bucket. Request-side validation (forms, path/query params) is **not** covered by this waiver and stays.                                                           |
| 2   | **Errors are classified at the boundary into five kinds.**                                                         | `domain` (has `reason`) → typed data, never a toast. `auth` (has `detail`) → refresh or redirect. `unexpected` → toast + `Logger`. One pure function, two consumers (interceptor + the `computed()` over a resource's `error()`).                                         |
| 3   | **Three login paths: email+password, phone OTP, QR.**                                                              | QR is deferred to its own phase behind a documented blocker (§P8).                                                                                                                                                                                                        |
| 4   | **Uncovered surfaces are left as-is and documented.**                                                              | Payment, partner-platform, micro-learning, podcast, global search keep their placeholders and empty states. No route removal, no nav changes in this branch. Gaps go in `docs/CAIRA_GAPS.md`.                                                                             |
| 5   | **Wire types never reach a template.** One mapper per domain converts CAIRA shapes to the existing view models.    | Smaller diff than rewriting templates. Landed in `masterclass.model.ts` (`topSectionToCard`, `courseSectionToCard`, `groupByLevel`) — mappers live **beside the wire types**, not in a separate `mappers/` folder.                                                        |
| 6   | **Endpoint paths are a plain const object, not `RouteConfig` phantom types.**                                      | `caira.endpoints.ts` ships **47 paths**. Typing comes from the call site: `api.get<TopSectionResponse>(...)`. Trailing slashes are load-bearing — `APPEND_SLASH` 301s drop a POST body — so the file is the only source and `caira.endpoints.spec.ts` guards it.          |
| 7   | **Reads are `httpResource`; writes are imperative on `ApiClient`.** _Settled — the P1 spike resolved this._        | `httpResource` **does** register a `PendingTasks` entry (`_resource-chunk.mjs`), so SSR waits for it. The manual `PendingTasks.add()` path in rev 1 §1.6 is **deleted** — one pattern, not three. It runs through the interceptor chain, so classification still applies. |
| 8   | **Domain ids widen from `number` to `string`, except webinars.**                                                   | CAIRA ids are UUIDs. Landed for the catalog (`CourseCard.id: CairaUuid`); **still pending** for course detail, chapters, assessments and badges. Webinar ids are genuinely integers (§0.4) and stay numeric. See §1.7.                                                    |
| 9   | **`@Service` replaces `@Injectable` on every injectable class.** [ADR-0001](../docs/adr/0001-service-decorator.md) | Landed in `7a2e833` across 36 files. DI failures are **runtime**, so a green build does not verify this — an SSR boot does.                                                                                                                                               |
| 10  | **No external state store.** [ADR-0002](../docs/adr/0002-no-external-store.md)                                     | NgRx SignalStore evaluated and rejected. Shared list state is a plain factory (`courseFeed()`), not `signalStoreFeature`, not a dependency.                                                                                                                               |
| 11  | **No facade layer.** _New in rev 2 — supersedes rev 1's "route-scoped facades" throughout._                        | Shared state is a `@Service()`; per-instance state is a factory function returning signals; state one component reads lives in that component. Nothing new is named `*Facade`. See §1.6 and AGENTS.md §3.                                                                 |

---

## Assumptions

1. ~~Base URL is unknown~~ — **confirmed and shipped.** Prod `https://api.milescaira.com/`,
   UAT `https://uat-api.milescaira.com/`, in all three `environment*.ts`. **No `/api/` prefix** —
   routes are registered at the Django URLconf root.
2. **Only `Authorization: Bearer <jwt>` is read** (§0.1). The deleted `appInterceptor` sent
   `x-app-type`, `x-platform`, `x-country-code`; all three are dropped. CAIRA does not allowlist
   them, so each would have failed the CORS preflight. Confirmed live.
3. **`/:country/:profession_type` is cosmetic.** No CAIRA endpoint takes a country or profession
   parameter. The URL prefix stays; it is not forwarded.
4. **Prefix compare is case-insensitive** (`prefix.lower() != 'bearer'`), so a lowercase
   `bearer <token>` still works. Standardised on `Bearer`.
5. **`communication_method: 5` is never sent.** Endpoint #34 refuses it and strips `otp_dev`; the
   mobile twin #39 leaks the OTP to any anonymous caller. Web binds #34/#35 only, never #39/#40.
6. **Auth failures arrive as 403, not 401** — no `authenticate_header()` override. Verified live and
   captured in `docs/caira-contracts/00-auth-failures.json`.

---

## Part 1 — Target architecture

### 1.1 Transport

`ApiClient` is rebuilt at its old path with its old shape (`resolveUrl` + six verbs) and stays dumb —
URL resolution only. It also exposes **`absoluteUrl()`**, which is what `httpResource` needs: a
resource takes a URL string, not a relative path.

Envelope knowledge lives in the **wire-type modules**, not a separate `envelope.ts`. Rev 1 planned
three runtime helpers (`unwrapData` / `unwrapStatus` / `unwrapBare`); in practice the envelopes are
**generic types** (`CairaStatusEnvelope<T>`) and unwrapping is a property read inside the
`computed()` over the resource — a helper function that only does `.data` earns nothing.

**The envelope zoo — six success shapes** (§0.6). `CommonResponse<T>` models none of them and is not
recreated:

| Shape                           | Endpoints                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| `{status: true, ...}` (boolean) | Top Section, Course Section, Completed Course, Course Detail, Levels Progress, Badge Clicked |
| `{status: "success", data}`     | Bookmark, Progress Get/Update, Webinars, Badges Tracker, Catalog, CPE Progress               |
| bare fields, no `status`        | Chapter Start, Quiz, Assessment, Feedback, Enrollment                                        |
| raw serializer output           | Instructor Detail (#16)                                                                      |
| bare JSON **array**             | Webinar Feedback Questions (#31)                                                             |
| SSO pass-through                | #33–#35, #39–#41, #49 — only keys this backend reads are guaranteed                          |

No auto-detection — the discriminators overlap. Each call site names its envelope type explicitly.

### 1.2 Error classification — the core of this plan

`cairaError(err: HttpErrorResponse): CairaFailure` — one pure function, the only place that knows
all the error shapes. **Shipped** in `shared/core/http/caira-error.ts` with `caira-error.spec.ts`.

```ts
export type CairaFailure =
  | {
      kind: 'domain';
      status: number;
      reason: string;
      message?: string;
      extra: Record<string, unknown>;
    }
  | { kind: 'auth'; status: number; detail: string; expired: boolean }
  | { kind: 'validation'; status: 400; fields: { field: string; message: string }[] }
  | { kind: 'notFound'; status: 404; message: string }
  | { kind: 'unexpected'; status: number; message: string };
```

Discriminators, all code-backed by the reference:

- **`domain`** — body has a `reason` key. Covers `chapter_locked`, `already_completed`,
  `chapters_not_complete`, `already_passed`, `cool_off_active` (carries
  `cool_off_minutes_remaining` / `cool_off_ends_at` in `extra`), `assessment_not_passed`,
  `feedback_already_submitted`, `already_started_via_7dc` (409). **These are UI states.** They never
  toast and never trigger a token refresh.
- **`auth`** — body has a `detail` key **and** the request carried an `Authorization` header. Both
  401 and 403 land here. `expired: true` when `detail` matches `Signature has expired.` /
  `Admin signature has expired.`
- **`validation`** — the pydantic envelope `{status:"error", errors:[{field, message}]}` (#8, #10,
  #13, #18). Also normalises DRF's field-keyed dict (#32) into the same `fields` array.
- **`notFound`** — 404 with `{status:"error", message}`.
- **`unexpected`** — everything else, including the raw-exception 500s (§0.5), the 400 catch-alls
  that should have been 500s (#20, #24), and network failures.

**Two traps a naive `error.error.message` read gets wrong:**

- The `web/*` login routes use `{code, message}`; `qr/*` uses `{error}`; DRF uses `{detail}`; the web
  LMS module uses `{status, message}` or `{status, reason}`. Five vocabularies.
- QR confirm returns **401 `{"error":"Incorrect PIN","attempts_remaining":2}`** — a wrong PIN, not a
  bad token. It must not trigger a refresh. Guarded by the "request carried an Authorization header"
  clause, since `/qr/confirm` is unauthenticated.

### 1.3 Interceptor chain

Registered in `app.config.ts`. **Shipped**, in this order:

```ts
provideHttpClient(withInterceptors([appInterceptor, errorInterceptor, authInterceptor]));
```

| Order | Interceptor        | Does                                                                                                                                      |
| ----- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `appInterceptor`   | `loading.start()` / `finalize(loading.stop())`; attaches `Authorization: Bearer <cookie>` unless `SKIP_AUTH_TOKEN`. **No `x-*` headers.** |
| 2     | `errorInterceptor` | Calls `cairaError()`; toasts **only** `kind === 'unexpected'`, and only when `SKIP_ERROR_NOTIFICATION` is unset. Rethrows untouched.      |
| 3     | `authInterceptor`  | On `auth` + `expired`, runs the single-flight refresh queue and retries.                                                                  |

`errorInterceptor` sits **above** `authInterceptor` so a request the refresh queue retries is not
double-toasted. `IS_ADMIN_REQUEST` and `adminTokenInterceptor` are **not** recreated — the admin
panel is Supabase-only and never touches this API.

Refresh loop-guard: the old code checked `req.url.includes('refresh_token')`. CAIRA's path is
`refresh` — that substring check silently breaks. The guard matches the resolved refresh path
exactly and also skips every unauthenticated auth route (`web/*`, `qr/*`, `refresh`).

`refresh` takes the token in the **JSON body**, not a header, and its response is fully opaque
(§41). `Auth.refreshToken()` probes the four shapes the sibling login endpoints return, most
specific first, and treats a miss as a failed refresh → `clearAuth()`.

### 1.4 Endpoint registry

`shared/core/http/caira.endpoints.ts` — **shipped, 47 paths.** Plain consts, functions for path
params:

```ts
const WEB = 'CAIRA_LMS_Masterclass_MilesOne_Web';
export const CAIRA = {
  topSection: `${WEB}/Top_Section/`,
  courseSection: `${WEB}/Masterclass_Course_Section/`,
  courseDetail: (id: string) => `${WEB}/Masterclass_Course_Detail/${id}/`,
  chapterStart: (id: string) => `caira/masterclass/chapter/${id}/start/`,
  webinarDetail: (id: number) => `caira/webinars_web/${id}/`, // int, not uuid
  // …
} as const;
```

**Id types are deliberately not unified**: courses, chapters, instructors and levels are UUID
strings; `Webinar.webinar_id` is an integer (§0.4). Typing them separately is what stops
`webinars_web/undefined/` bugs.

### 1.5 SSR

- `Top_Section` and `Masterclass_Course_Section` are **auth-optional** → the masterclass listing
  stays server-rendered and crawlable. No route-mode change. **Verified in P3.**
- `Masterclass_Course_Detail` is **auth-required**. `Storage` reads cookies from the SSR request, so
  a logged-in user's SSR pass carries their token and still renders. An anonymous crawler gets a
  403 → render the shell, let SEO come from the Supabase `seo_pages` row. **The route stays
  `RenderMode.Server`** — moving it to Client would also lose the server-rendered meta tags. Logged
  as a gap (public course-detail endpoint ask).
- `withHttpTransferCacheOptions({ includePostRequests: false, includeRequestsWithAuthHeaders: true })`
  is active, so SSR GETs are replayed in the browser with no per-service `TransferState` code.
- **`Auth` needs no manual `TransferState`.** Rev 1 planned to restore `initializeUserData()`; the
  `httpResource` + transfer-cache combination replaced it outright — same outcome, none of the code.
  `environment.AUTH.transferUserData` / `transferAuthStatus` are now dead keys and should be deleted.
- **No hand-written `PendingTasks.add()`.** `httpResource` registers its own; a manual one is a
  double-release hazard.

### 1.6 State and read patterns

**One shape, not three.** Decision 7 settled what rev 1 left open, and Decision 11 removed the
facade layer. Every new binding follows `Auth` (`shared/core/services/auth/auth.ts`):

- **One `signal` is the reactive root.** For `Auth` it is the access token; for a course page it is
  the route id.
- **Reads are an `httpResource` keyed on that root**, returning `undefined` for the URL when the
  read must not happen (anonymous, no id yet). Sign-out flips one signal and the in-flight request
  aborts on its own.
- **Derived state is `computed()`.** Never an `effect()` copying resource data into a signal.
- **Errors:** `computed(() => { const e = res.error(); return e ? cairaError(e) : null; })`.
- **Writes** are `ApiClient.post()` + `takeUntilDestroyed(destroyRef)`. Never a bare `.subscribe()`.

Where the code goes:

| Scope                                | Shape                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| Read by more than one component      | `@Service()` (app-wide) or `@Service({ autoProvided: false })` + route `providers` |
| Repeated per instance, parameterised | **Factory function returning signals** — `courseFeed()` is the precedent           |
| Read by exactly one component        | **In that component.** `5fa5c08` did this to the login page.                       |

Consequences for the remaining phases:

- Rev 1's "New `XFacade`" lines are all rewritten below. Nothing new is named `*Facade`.
- The four surviving `*Facade` classes (`FeatureFacade`, `LeadsFacade`, `RbacFacade`,
  `AdminUsersFacade`) are **already this pattern** — `@Service()` + `resource()`/`httpResource`.
  Only the name is legacy. Renaming them is a separate cosmetic commit, not part of any phase here.
- **`FeatureFacade` must stay auto-provided.** `Utils.applyBookmarkChange` broadcasts into that
  instance; a route-scoped copy forks it and the broadcast lands where nobody listens.
- Adopting `httpResource` **deletes the `effect()` → `loadCourse()` wiring** in
  `masterclass-course.ts`, `masterclass-chapter.ts` and their podcast twins. Route inputs become the
  resource's key. This also removes the double-fire hazard that needed a
  `if (this.selectedReelId() === id) return;` guard.
- **`fetchMyProfile` stays imperative, deliberately.** It cannot be a resource keyed on auth state:
  a profile _save_ changes the data without changing the token, and an earlier version keyed on a
  bumped counter re-fired on its own result forever. It calls `profile.reload()` instead.
- **Signal Forms** (`@angular/forms/signals`) — what `login.ts` already uses. Do **not** introduce
  `FormControl`/`FormGroup`/`FormBuilder`. Rules that bite: never `null`/`undefined` as an initial
  model value (`''`, `0`, `[]`); the `submit()` callback **must be `async`**; call a field before
  reading flags (`form.otp().errors()`, not `form.otp.errors()`); `when` works only with
  `required()` — use `applyWhen` otherwise.
- **Testing is zoneless.** Act → `await fixture.whenStable()` → Assert. Never `fixture.detectChanges()`.

### 1.7 Design-system contract — what the mappers must produce

The design system was deliberately preserved, so it — not the wire format — defines the target
shape. Audit of the components the mappers feed:

| Component                                                                     | Domain input                                           | Typed?                                           |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------ |
| `horizontal`, `vertical`                                                      | `card = model.required<any>()`                         | no — and it is a **`model()`, not an `input()`** |
| `hover`, `square`, `coming-soon`                                              | positional inputs                                      | partly                                           |
| `badge-card`                                                                  | `card = input.required<BadgeCardData>()`               | **yes** — closed `BadgeAction` union             |
| `badge-hero-card`, `badge-level-card`, `badge-course-card`, `instructor-card` | `input.required<any>()`                                | no                                               |
| `tracker-table`                                                               | `rows = input.required<TrackerTableRow[]>()`           | **yes**                                          |
| `caira-credly-badge`                                                          | `includedForCaira`, `hasIndividualBadge`, `cairaLevel` | yes                                              |

Three consequences:

1. **`card` is a two-way `model()`.** The card writes back into the parent's signal — that is how an
   in-card bookmark toggle mutates the rail in place via `Utils.applyBookmarkChange`. Mapped
   view-models must live in a **writable** signal and be safe to patch field-by-field. Do not hand a
   card a `computed()` projection. _(This is the one place `courseFeed()` deviates: `items` is a
   `computed()`. A bookmark toggle from a rail card therefore needs `reload()` or a local writable
   copy — resolve it in P3-detail's prompt.)_
2. **Empty strings must be coerced to `null` for image URLs.** `ngSrc=""` throws **NG02952** and
   kills the render, and adapted payloads have shipped `''` before. CAIRA's `image_url`,
   `course_thumbnail_url` and `badge_image_url` are all nullable. **Landed** for the catalog — the
   `img()` helper in `masterclass.model.ts`. Every later mapper reuses it.
3. **The id-type conflict (Decision 8) — partially done.** `CourseCard.id` is `CairaUuid`. Still
   pending, and each will fail on a UUID:
   - `BadgeCardData.badgeId: number`, `.courseId: number | null` → widen to `string`
   - `TrackerTableRow.id: number | null` → widen to `string | null`
   - `Number(...)` coercions that yield **`NaN`**: `masterclass-course.ts:85`,
     `masterclass-chapter.ts:81`/`:90`, `masterclass-course-hero.ts:99`, `course-feedback.ts:68`
     and `:157`, `final-assessment-report.ts:101` and `:129`, plus the podcast twins
     (`podcast-course.ts:67`, `podcast-chapter.ts:77`/`:86`, `podcast-course-hero.ts:107`)
   - numeric signatures to widen: `course-chapter-list.ts getChapterCompletedStatus`,
     `masterclass-chapter.ts handleNavigation`, `masterclass-course-hero.ts addToCart`,
     `course-feedback.ts`, `final-assessment-report.ts toggleExpand`

   **`v2-to-upcoming.ts` is the exception** — its seven `id: number` declarations are correct,
   because `Webinar.webinar_id` really is an integer. Leave it alone.

   These are type-level edits to `.ts` only. **No template changes** — templates interpolate ids,
   they do not do arithmetic on them.

---

## Part 2 — Phases

Each phase ships independently. `pnpm build:prod` must stay green at every boundary — it is the only
gate green today (`lint` and `test` are already red on `master`; do not make them worse).

Per AGENTS.md §1, each remaining phase gets its own `prompts/<phase>.md` from `prompts/_TEMPLATE.md`
before implementation.

### P0 — Contract freeze ✅ closed except item 4

1. ~~Confirm prod + UAT hosts~~ — done, in `environment*.ts`.
2. ~~Confirm the three `x-*` headers are unread and `Authorization` is allowlisted~~ — done.
3. Capture live JSON per endpoint → `docs/caira-contracts/`. **3 of ~20 captured**
   (`00-auth-failures`, `01-top-section`, `02-course-section`). The three serializers explicitly
   outside the reference — `CAIRAMasterclassQuizQuestionSerializer`,
   `CAIRAMasterclassFeedbackQuestionSerializer`, `_build_full_course_progress` — are **still
   uncaptured** and block P4/P5. This is the top schedule risk.
4. **Obtain the QR crypto contract** (curve, KDF, AES mode, encodings) or defer P8. Open.
5. ~~Write `docs/CAIRA_GAPS.md`~~ — done, G-numbered.

### P1 — Transport core ✅ shipped (`ad14640`)

Delivered: `BASE_API_URL` in all three environments · `models/caira/envelope.model.ts` (envelope
types, `CairaFailure`, `SKIP_AUTH_TOKEN`, `SKIP_ERROR_NOTIFICATION`) · `http/caira-error.ts` ·
`http/caira.endpoints.ts` (47 paths) · `services/api-client/api-client.ts` (+ `absoluteUrl`) ·
the three interceptors · `app.config.ts` wiring · `LoadingService` refed.

Specs: `caira-error.spec.ts`, `caira.endpoints.spec.ts`, `auth.model.spec.ts`.

**The SSR spike resolved yes** — `httpResource` registers a `PendingTasks` entry and blocks SSR.
Decision 7 is closed and rev 1's three-pattern table is gone.

Not built: `http/envelope.ts`. Envelopes are generic types; a runtime unwrap helper earned nothing.

### P2 — Auth ✅ shipped (`ad14640`, `2043771`, `5fa5c08`)

Endpoints #33, #34, #35, #41, #42, #43, #44, #45.

`Auth` is the reference implementation of §1.6: the access token is the reactive root, `v2/status`
is an `httpResource` keyed on it, `currentUser` / `isProfileComplete` are `computed()`. `AuthFacade`
was written and then **folded into the login page** (`5fa5c08`) — it had one consumer.

Settled during the phase:

- Email tab binds #33 (email + password); Mobile tab binds #34/#35 (OTP).
- **403 `PROFILE_INCOMPLETE`** routes to the profile-completion dialog, not the error toast.
- **409 `MULTIPLE_ACCOUNTS`** (#35) gets dedicated "contact support" copy.
- `countryCode` is `"91"` on #33 but `"+91"` on #35 — normalised on read.
- #33 is the only throttled endpoint → 429 handled with the DRF `{detail}` body.
- Login keys are `result.token` / `result.refresh_token`, not the old `data.token`.
- **Profile completeness comes from `v2/status`**, never from a login response's `onboarding` flag —
  #33 hardcodes it `true`, which would let an incomplete profile straight through. `isExistingUserGuard`
  binds to the derived value.

Still open: `signup` and `forget-password` are **empty stub classes** but routed. OTP-only auth has
no password reset for the phone path; #33 has no reset endpoint at all. Stubs stay, gap logged.
`profile.ts` (L349/373/388/445) is **not yet bound** — it moves to P3-detail's prompt or its own.

### P3 — Masterclass catalog ✅ listing shipped (`623c6ae`) · detail pending

Endpoints #1, #2, #3 shipped. **#4, #14, #15, #16 pending.**

Shipped: `masterclass.model.ts` (wire types + `topSectionToCard` / `courseSectionToCard` /
`groupByLevel` / `img`), `courseFeed()` factory, `FeatureFacade` rebuilt on `httpResource`.
Four of nine rails have a source; the other five are `emptyCourseFeed()` and every section is
`@if`-guarded, so they render nothing (G-22).

**Remaining — course detail.** Deliverables: a `@Service({ autoProvided: false })` on the course
route (not a facade) keyed on the route id, plus detail mappers in `masterclass.model.ts`.
Consumers: `masterclass-course.ts`, `masterclass-course-hero.ts`, `course-chapter-list.ts`,
`instructor-details.ts`. **Does the id widening (§1.7)** for the masterclass and podcast trees —
this is where `Number(id)` stops being viable.

Contract facts to build against:

- Pagination is `limit` / `page`, with **legacy `offset` overriding `page`** when present. Default
  limit 6, clamped to 100. Out-of-range page returns `[]`, not an error. `courseFeed()` grows
  `limit` rather than accumulating pages — that is what removes the page-merge `effect`.
- `#2` `course_status` is `1` not-started / `2` in-progress / `3` closed; **`3` wins over `2`**;
  anonymous always gets `1`. `#3` **omits `course_status` entirely** and always reports
  `active_in_challenge: false` despite requiring a JWT — the mapper defaults both.
- `#2` returns a course **once per level** (dedup key `(level_id, course_id)`), and its
  `course_field_of_study` carries only `name`, no `id` — unlike `#4`'s `fields_of_study`.
- `#4` mixes snake_case aliases with raw model field names in one object
  (`Masterclass_Course_Name` beside `trailer_video_url`). The mapper is the only place that knows.
- `#4` `sponser_identification_number` — the misspelling is FE-locked and intentional. Do not "fix" it.
- `#15` bookmark is a **pure toggle** with no body; any body is ignored. It is not set-state.
  `Utils.toggleBookmarkCourse` expects `{status, is_bookmarked}` → map from `{status:"success", bookmarked}`.
  Resolve the `model()`-writeback question from §1.7.1 here.
- `#16` returns **raw serializer output with no envelope**.
- `#4` is cached server-side per-user over a global base key. Content edits lag. Do not build a
  client-side cache-buster; document it for QA.

### P4 — Chapter player and progress

Endpoints #6, #17, #18.

A route-scoped `@Service({ autoProvided: false })` on the chapter route keyed on the chapter id,
plus a progress mapper. Consumers: `masterclass-chapter.ts`, `video-chapter.ts`, `audio-chapter.ts`,
`course-resources.ts`. **Blocked on the P0 capture of `_build_full_course_progress`.**

- `#6` must be called on chapter open. It creates a 365-day enrollment and the progress row.
- **`reset_required: true` returns a different, 2-key body** on #6, #10 and #18 — the 365-day window
  expired and all progress was wiped. Needs a dialog, not an error. Check it _before_ reading any
  other key.
- `#18` accepts a single chapter **or a bulk list**, normalised by `get_items()` — the wrapper key
  lives in `Masterclass/schemas.py` and must come from the P0 capture.
- **95% rule is server-side**: `Max_Watched >= duration * 0.95` sets both `Is_Video_Completed` and
  `Is_Video_Seekable`. The client sends positions; it does not decide completion.
  `Max_Watched_Duration_Seconds = max(existing, incoming)`; `Current_...` is overwritten.
- `#18` `skipped` is **omitted entirely when empty** — never index it unguarded.
- `is_video_seekable` is forced `true` when the course is closed. This replaces the old client-side
  `PlayerMode.CPE` seek lock — seek restriction is a compliance requirement, so it follows the
  server flag rather than local state.
- `#4` chapter lock walk: `is_locked = not prev_completed and not is_course_closed`; chapter 1 always
  unlocked. When locked, `hls_video_url` and `transcript_text` are `null` and **all nine**
  `user_chapter_progress` values are `null`.
- `409 already_started_via_7dc` on #6 → a `domain` state with its own copy, not an error.
- `chapterFacade.selectCpeMode()` (`masterclass-chapter.ts:243`) is called but absent from the
  placeholder — it fails at runtime until wired.

### P5 — Quiz, final assessment, feedback

Endpoints #7, #8, #9, #10, #11, #12, #13.

Route-scoped services on the exam and feedback routes. Consumers: `chapter-quiz.ts`,
`final-assessment-exam.ts`, `final-assessment-report.ts`, `course-feedback.ts` — whose placeholder
is `{}`, so **every call site there is currently dead**. **Blocked on the P0 capture** of the quiz-
and feedback-question serializers.

- **Quiz submit is one question per request** (#8), returning immediate per-question feedback.
  `chapter-quiz.ts` already submits per-question — good fit.
- **`#7`'s resume branch returns a heterogeneous `questions` array**: hand-built answered items keyed
  `CAIRA_Masterclass_Question_Text` first, then raw serializer items. The mapper handles both shapes
  in one array. `previously_completed` is hardcoded `false` on both branches — do not branch on it.
- **`#11` is the only endpoint** keying question text as `question_text`, using `options` rather than
  `options_feedback`, and carrying `was_selected`. Three exceptions in one response.
- `#10` requires **exactly `questions_to_show` answers** or 400. Read the count from `#9`.
- `#10`'s failure copy hardcodes "Score below 70%" while the real gate is `pass_threshold_percent`
  from `#9`. **Render the number from `#9`, not the message string.** Pass/fail is the server's
  decision — never compute a threshold client-side.
- **`correct_option_ids` is built from a Python `set`** (#10, #11) — order is not stable. Compare as
  sets; never index positionally.
- `403 cool_off_active` carries `cool_off_minutes_remaining` (never 0 — it is `max(1, …)`) and
  `cool_off_ends_at`. Render a countdown, not an error toast. The `already_passed` branch logs 409
  internally but **returns 403 on the wire**.
- `#13` response `{feedback_submitted, cpe_awarded, badge_issued, certificate_triggered}` drives the
  success state — feedback is the trigger for the whole credential pipeline.
  `optional_feedback_text` is optional; `responses` is required and iterated unconditionally.
- Exam routes are already `RenderMode.Client`; exam answers stay in memory by design.
- **`:sessionId` has no backend counterpart.** CAIRA identifies an attempt by
  `(user, course, attempt_number)` — no session id, no timer, no resumable attempt. The segment
  comes out of `masterclass/:courseId/:courseTitle/final-assessment/:sessionId/{exam,report}` (and
  the podcast twin), with entries added to `src/legacy-redirects.ts`.
  `final-assessment-report.ts:101`'s `loadReport(Number(sessionId))` becomes a course-scoped
  `GET .../assessment/result/`.

### P6 — Badges, CPE, levels

Endpoints #5, #19, #22, #23, #24, #25, #26, #27, #28, #29, #30.

An app-wide `@Service()` for CPE/badge state (the tracker and the badge library both read it), plus
mappers. Consumers: `cpe-tracker.ts` (22-key placeholder), `tracker-toolbar.ts`, `tracker-table.ts`,
`badge-swiper.ts`, `library/badge/badge.ts` (whose `cards` computed is hardcoded `[]`),
`caira-credly-badge.ts`.

Widens `BadgeCardData.badgeId` / `.courseId` and `TrackerTableRow.id` per §1.7. `BadgeCardData` is
the one properly typed view-model in the card layer — its closed `BadgeAction` union drives an
exhaustiveness guard, so mapping CAIRA's seven `cta.action` values onto its six `BadgeAction` values
is a **compile-time-checked** decision, not a silent default. Resolve the mapping in P6's prompt.

- **The CPE tracker is year-based today** (`selectedYear`, `yearOptions`, `setYear`); CAIRA
  aggregates by **level**, with no year dimension anywhere. The toolbar's year selector has no
  source. Either hide it or repurpose it to level — decide in P6's prompt; log the gap either way.
- `#5` **rotates the array** so the first `"Ongoing"` level leads. Level 1 can never be `"Locked"`.
- `#5` `progress` is a **string** `"12.5/30"` with trailing `.0` trimmed; `target_cpe` is `int` when
  whole, else float. Parse, don't display raw, where a number is needed.
- **`#23`'s `caira_badges.progress` numerator is the global `grand_total`**, so all three levels show
  the same numerator over different denominators. `#22` computes it correctly. Prefer `#22` for web.
- `#24` badge `state` + `cta` drive the card entirely. `cta.action` ∈ `VIEW_BADGE` · `CLAIM_BADGE` ·
  `SUBMIT_FEEDBACK` · `NONE` · `REGISTER` · `VIEW_WEBINAR` · `OPEN_COURSE`; `url` is populated only
  for the first two. Special case: `state === "LOCKED"` with a truthy `course_id` overrides to
  `("Start Course", "OPEN_COURSE", true)`. Map to `BadgeCardData` — do not re-derive the label.
- `#24` `counts` are **pre-truncation**; the array key is dynamic (`f"{section}_badges"`); its
  catch-all returns **400, not 500**.
- **`#19` and `#28` are different endpoints with the same name.** `#19` (web module) takes
  `credly_assertion_id`; `#28` (`caira/`) takes the full `credly_accept_url`. Both return a URL
  **without** the `/accept` suffix, unlike `#5`'s `credly_accepted_url`. Bind `#19` for web.
- `#26`/`#27` have a **cache-prefix mismatch** — claiming an alumni badge may not invalidate the read
  for up to 300 s. Call `reload()` after a claim rather than trusting the next GET.
- `#25` requires a `level` UUID; a **non-UUID value 500s with a raw exception**, not a 400. Validate
  the param client-side before sending — request-side validation, not covered by the Decision 1 waiver.
- `#29` GET's `data.id` is **polymorphic** — a webinar UUID when `showfeedback` is true, a Credly URL
  when false. Branch on `showfeedback` before reading `id`.
- Certificates are embedded URLs (`masterclass_certificate_url`, `webinar_certificate_url`,
  `credly_pdf_certificate_for_level`). There is **no download endpoint** — render links, and drop
  jsPDF for these. Bulk download and the NASBA template have no counterpart → gaps.

### P7 — Webinars

Endpoints #20, #21, #31, #32.

A route-scoped service on the webinar routes + mapper. Consumers: `webinar.ts`, `webinar-course.ts`,
`webinar-hero.ts`, `premiere-list-item.ts`, `webinar-registration-form.ts`. The surviving
`v2-to-upcoming.ts` / `upcoming-to-content.ts` / `webinar-status.ts` adapters expect the old v2
shape and are the mapper's target.

- `#20` returns **all** active webinars grouped `{upcoming, expired, completed}` — no pagination, no
  filters. Cards carry **no `status` field**; grouping conveys it. `#21` **does** have `status`.
- Webinar `id` is `str(webinar_id)` — the **integer**, serialized as a string. `#21` takes it as an
  integer path param. Keep webinar ids numeric (§1.7).
- **`#20` has no 500 path** — every internal failure is flattened to 400. `#21`'s 404 body has no
  `error` key while its 400 does.
- `#31` returns a **bare JSON array** and uses DRF `{detail}` errors; `#32` uses `{status, message}`
  and returns **201**, with `webinar_id` as a **query param even on the POST**. Same duplicate-
  feedback condition, two different messages and two different envelopes.
- `#32`'s `invalid_feedback_ids` comes from a `set` — order is nondeterministic.
- **There is no registration endpoint in this reference.** `registration.registration_status` is
  read-only. `webinar-registration-form.ts` has no binding target → gap.

### P8 — QR login (blocked)

Endpoints #36, #37, #38.

**Blocker:** the reference explicitly places `account/qr_login/crypto.py` outside its scope, so the
inner structure of the `{epk, iv, ct}` blob — curve, KDF, AES mode, and the encoding of `public_key`
— is undocumented. The browser cannot decrypt without it. Also undocumented: `store.SESSION_TTL`,
the `make_pin()` format, and whether the dash in `"4324-3456"` is significant to `verify_pin`.

Do not start until P0 item 4 lands. Then: WebCrypto keypair in-browser (browser-only, never SSR),
`#36` → render QR of `session_id` → poll `#38` with the typed PIN → decrypt → `storeTokens`.
`#37` is the phone's call and is not implemented here. `#38` is **single-use** (the session is purged
before responding) and has a **3-attempt lockout** returning 429 — surface `attempts_remaining` from
the 401 body.

### P9 — Gaps and docs

- `docs/CAIRA_GAPS.md` — keep current as each phase closes or adds a G-entry.
- Rewrite `docs/api-and-routes.md` (310 lines, still describes the dead Django surface).
- **The eight stale `SKILL.md` files rev 1 planned to update no longer exist** — `c31f69d` deleted
  every repo skill. The rules they carried now live in AGENTS.md §3/§4/§8, which `bd06b74` brought
  current. Either rebuild the repo skills from the post-CAIRA code or delete the §10 tables that
  reference them — decide before P9, and do not update files that aren't there.
- Delete the dead `environment.AUTH.transferUserData` / `transferAuthStatus` keys (§1.5).

---

## Part 3 — Known gaps (no CAIRA counterpart)

Surfaces keep their placeholders and empty states per Decision 4. Each has a `docs/CAIRA_GAPS.md`
entry (G-numbered).

| Gap                                                                      | Surface                                 |
| ------------------------------------------------------------------------ | --------------------------------------- |
| Subscriptions, cart, coupons, plans, orders, invoices                    | `features/payment/**`                   |
| Partner Platform — networks, firms, sub-companies, partner RBAC          | `admin/partner-platform/**`             |
| Micro-learning and podcast as CPE course types                           | `offerings/{micro-learning,podcast}/**` |
| Text search and suggestions                                              | `global-search` (deleted)               |
| Instructor **list** (detail-only exists)                                 | `library/instructor/**`                 |
| Recommendations, because-you-watched, complimentary, coming-soon         | 5 of the 9 masterclass rails (G-22)     |
| CPE credits by calendar year                                             | `cpe-tracker` toolbar year selector     |
| Bulk certificate download, NASBA template                                | `cpe-tracker` toolbar                   |
| Webinar registration                                                     | `webinar-registration-form.ts`          |
| Profile dropdowns — company, sector, job role, state board, prof. course | `profile.ts` (5 of 13 fields)           |
| Public (crawlable) course detail                                         | SEO regression on `#4`                  |
| Password reset                                                           | `forget-password` stub                  |
| Rail metadata (section headings)                                         | `CourseFeed.metadata()`                 |
| Faculty registration, partner code, firm sponsorship, UTM                | assorted                                |

---

## Security requirements

- No new secret reaches the browser. CAIRA is Bearer-only. The `caira/*_lms` endpoints authenticate
  with a shared API key and **must never be called from this app**.
- Tokens flow through interceptors only. No hand-attached `Authorization` header (AGENTS.md §7).
- `communication_method: 5` must be impossible in any build — assert it in a unit test.
- Never log a token. The backend deliberately logs only `has_token`; match that.
- Several 500 handlers return `str(exc)` verbatim (§0.5). The `unexpected` bucket shows generic copy
  to the user and sends the raw string to `Logger` only — never into a toast.
- PII stays out of URLs and query strings, including when building filter strings.
- The two Supabase clients stay split and untouched.

---

## Files that will change

Remaining phases only — P1/P2/P3-listing are on the branch already.

| Area          | Create                                                           | Modify                                                                                                   |
| ------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Contracts     | `docs/caira-contracts/*.json` (≈17 more)                         | `docs/caira-contracts/README.md`                                                                         |
| Masterclass   | course-detail service + detail mappers in `masterclass.model.ts` | `masterclass-course.ts`, `masterclass-course-hero.ts`, `course-chapter-list.ts`, `instructor-details.ts` |
| Chapter       | chapter service + `progress.model.ts`                            | `masterclass-chapter.ts`, `video-chapter.ts`, `audio-chapter.ts`, `course-resources.ts`                  |
| Assessments   | assessment + feedback services, `assessment.model.ts`            | `chapter-quiz.ts`, `final-assessment-{exam,report}.ts`, `course-feedback.ts`, `legacy-redirects.ts`      |
| CPE / badges  | CPE/badge service, `cpe.model.ts`                                | `cpe-tracker.ts`, `tracker-*.ts`, `badge.ts`, `badge-card.model.ts`, `api-adapters.ts`                   |
| Webinar       | webinar service + mapper                                         | `webinar*.ts`, `v2-to-upcoming.ts`                                                                       |
| Auth leftover | —                                                                | `profile.ts` (L349/373/388/445)                                                                          |
| Docs          | —                                                                | `docs/api-and-routes.md`, `docs/CAIRA_GAPS.md`, `AGENTS.md` §10                                          |

Route-scoped services go into the emptied `providers: []` arrays at `features.ts` L21/41/144,
`masterclass.ts` L160/171/183/193, `cpe-tracker.routes.ts` L11, `auth.ts` L105.
**`FeatureFacade` stays auto-provided** — re-providing it route-scoped forks the instance that
`Utils.applyBookmarkChange` broadcasts into.

Two keys are still called by components but missing from their placeholders, and fail at runtime
until wired: `chapterFacade.selectCpeMode()` (`masterclass-chapter.ts:243`) and the entire
`course-feedback.ts` placeholder (`{}`). `FeatureResource.metadata()` was resolved in P3 —
`courseFeed()` returns a `signal(undefined)` for it, since no endpoint serves rail metadata.

---

## Verification

Per phase:

```bash
pnpm lint && pnpm format:fix && pnpm test && pnpm build:prod
```

`build:prod` must be green. `lint` / `test` must be **no worse** than the `master` baseline
(already red — ~55 lint errors, ~14 test failures).

SSR run at every phase boundary, since routes and render modes are in play:

```bash
pnpm build && pnpm serve:ssr:miles-masterclass-v3
```

End-to-end on UAT (`pnpm start`, port **4101**):

1. DevTools → Network: every XHR hits `uat-api.milescaira.com`, carries `Authorization: Bearer …`,
   and **no request is blocked by CORS preflight**. Confirm no `x-*` headers.
2. Log in by phone OTP and by email+password. A `PROFILE_INCOMPLETE` account opens the profile
   dialog rather than toasting.
3. `/us/cpa/masterclass` renders cards from `Masterclass_Course_Section/`; a **logged-out** reload
   still renders them server-side with correct meta tags:
   ```bash
   curl -s http://localhost:4000/us/cpa/masterclass | grep -E '<title>|og:|canonical'
   ```
4. Open a course → `Masterclass_Course_Detail/<uuid>/` fires once; locked chapters expose no
   `hls_video_url`.
5. Play 30 s, reload → the player resumes (`course-progress/<uuid>/update/` then GET).
6. Watch past 95 % → the quiz unlocks with no client-side rule (`show_quiz` flips server-side).
7. Answer a quiz question → feedback reveals immediately; answering it again is rejected with
   `Question already answered in this attempt.` and shows **no toast**.
8. Complete all chapters → fail the final assessment → re-open immediately → the 403
   `cool_off_active` renders as a **countdown, not an error toast**. This is the single most
   important check that Decision 2 works.
9. Pass → submit feedback → `cpe_awarded` / `badge_issued` / `certificate_triggered` drive the
   success state.
10. `/us/cpa/cpe-tracker` → credits and badges render; a certificate link opens the S3 PDF.
11. Expire a token → confirm a **403** with `{"detail":"Signature has expired."}` triggers exactly
    **one** refresh across concurrent requests, and that they all retry.
12. Hit `/us/cpa/payment/cart` and `/us/cpa/micro-learning` → each renders its empty state and issues
    **zero** failing XHRs.

---

## Risks

1. ~~The base URL is unknown~~ — closed.
2. ~~CORS preflight~~ — closed; the three `x-*` headers are gone and preflight passes.
3. **Three response shapes are still undocumented and uncaptured** — the quiz-question,
   feedback-question and `_build_full_course_progress` serializers. **P4 and P5 cannot be written
   accurately without them.** This is now the top schedule risk, and the only one blocking work that
   is otherwise ready.
4. ~~Auth failures are 403, not 401~~ — handled and verified; keep verification step 11.
5. **QR crypto is unspecified** and may not be recoverable without backend help. P8 may not ship.
6. **Server-side caching** on `#4` (per-user over a global base key) will look like a bug to QA.
   Document before test starts.
7. **No runtime validation** (Decision 1) means a backend shape change lands as a component error
   rather than a caught boundary failure. The `unexpected` bucket keeps it from being silent, but it
   is a runtime discovery, not a build-time one.
8. **`httpResource` and `resource` are marked experimental**, and the whole read path now depends on
   them — a larger bet than rev 1 made, since the manual `PendingTasks` fallback is gone. Mitigation:
   they are confined to services and factories, so the blast radius is one layer.
9. **The id widening (§1.7) is a cross-cutting type change** landing inside P3-detail and P6 rather
   than as its own commit. `tsc` catches every site and no templates change, so the risk is churn
   rather than correctness — but it makes those diffs larger than they look.
10. **The card `model()` write-back conflicts with `courseFeed()`'s `computed()` items** (§1.7.1). A
    bookmark toggle from a rail card has no writable target today. Unresolved; first surfaces in
    P3-detail.
