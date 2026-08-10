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
| 3   | **Three login paths: email+password, phone OTP, QR.**                                                              | All three are live. QR's transport is verified against the API; only its payload decryption rests on the G-04 assumption (§P8).                                                                                                                                           |
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

1. **`card` is a `model()`, but nothing binds it two-way — resolved, see Risk 10.** Every one of the
   ~25 card call sites in `src/` binds `[card]="…"`, not `[(card)]`, so an in-card
   `card.update(...)` writes to the model's own signal and stops there. That is enough: it flips
   the card's icon, and nothing above it needs the value. Three facts closed this out:

   - **`Utils.applyBookmarkChange` no longer exists.** It went with the Django strip, so the rail
     fan-out the two-way binding existed to serve has no caller. Only two stale doc comments
     mention it (`features.ts:18`, `feature-facade.ts:39`).
   - **No CAIRA list endpoint reports bookmark state.** `CourseSectionItem` and `TopSectionItem`
     have no `is_bookmarked`, so `courseSectionToCard` pins `added_bookmark: false` for every rail
     card on every load. There is no rail truth to keep in sync — see G-31.
   - **The one surface with real bookmark state is course detail** (#4's `is_bookmarked`), and it
     is read by one component tree, so `CourseDetail.courseDetails` is a **`linkedSignal`** —
     writable for the patch, and reset the moment #4 answers again.

   So `courseFeed().items` stays a `computed()` and no writable projection was added. Mapped
   view-models that a _single_ tree both reads and patches still belong in a writable signal;
   `linkedSignal` is the shape to reach for.

2. **Empty strings must be coerced to `null` for image URLs.** `ngSrc=""` throws **NG02952** and
   kills the render, and adapted payloads have shipped `''` before. CAIRA's `image_url`,
   `course_thumbnail_url` and `badge_image_url` are all nullable. **Landed** for the catalog — the
   `img()` helper in `masterclass.model.ts`. Every later mapper reuses it.
3. **The id-type conflict (Decision 8) — masterclass and podcast trees done.** `CourseCard.id`,
   `CourseDetailCard.id`, `ChapterView.id` and `InstructorProfile.id` are all `CairaUuid`, and
   every `Number(id)` coercion listed below is gone from the two course trees. Also widened while
   in there: `Utils.navigateToCourse` / `buildCourseUrl` / `navigateToCourseFeedback` /
   `openAdditionalResources` / `addCourseToCart` take `CairaUuid | number` (webinars keep integer
   ids), `toggleBookmarkCourse` takes `CairaUuid`, `video-chapter` / `audio-chapter` emit
   `output<CairaUuid>()`, and `InstructorDetails.instructorId` dropped its `numberAttribute`
   transform. **Still pending for P6:**
   - `BadgeCardData.badgeId: number`, `.courseId: number | null` → widen to `string`
   - `TrackerTableRow.id: number | null` → widen to `string | null`

   **`v2-to-upcoming.ts` is the exception** — its seven `id: number` declarations are correct,
   because `Webinar.webinar_id` really is an integer. Leave it alone.

   These are type-level edits to `.ts` only. **No template changes for the ids** — templates
   interpolate them, they do not do arithmetic on them. Typing the view model _did_ force four
   unrelated template-shaped fixes, because the placeholders were `any` and nothing was checked
   before: `price_detail` and `cpe_mode_details` are non-null-typed with dormant values so the
   dead pricing and CPE-mode branches still compile, the three course still-images are
   non-nullable `string` (they are bound into `ngSrc` unguarded), and `VideoPoster` now takes
   `string | null` and binds `[attr.src]` / `[attr.poster]` so a course with no trailer does not
   render `<video src="">`.

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

### P3 — Masterclass catalog ✅ shipped (listing `623c6ae` · detail this commit)

Endpoints #1, #2, #3, **#4, #14, #15 and #16 are all bound.**

**Detail, as built.** `CourseDetail` (`features/offerings/shared/services/course-detail/`) is a
`@Service({ autoProvided: false })` provided on `:courseId/:courseTitle` in **both** the masterclass
and podcast route trees — a podcast is a masterclass with an audio player and CAIRA serves both from
`Masterclass_Course_Detail`, so there is one service, not two. `courseId` is the reactive root and is a
`computed()` **read off the route the service is provided on** — not pushed in by the page. #4 and
#14 are `httpResource`s keyed on it, and the only reason to skip a request is "no id yet".

**Do not gate a read on `Auth.isAuthenticated()`.** An early version of this service did, reasoning
that #4 requires a JWT so a signed-out request could only 403. It was wrong twice: the page silently
did nothing whenever the flag was false for any reason — no request to inspect, no error to render —
and it bypassed the chain built for exactly this case. `authInterceptor` refreshes an expired token
and replays; `errorInterceptor` classifies the 403 as `kind: 'auth'` and deliberately does not toast
it. A 403 is diagnosable, a request that never fires is not.

That leaves the two course pages with **no `effect()` and no `clear()` on destroy**: the old
`effect() → loadCourse()` wiring, its auth-change re-fetch, and the effect that copied the route
input into a service signal are all gone. Leaving the course route disposes the route injector and
the service with it. `courseDetails` is a **`linkedSignal`** (§1.7.1); everything else derived is a
`computed()`. The only `effect()` anywhere in this phase is the instructor page's analytics call —
it reports state, it does not propagate it.

Wire types and mappers live in `shared/core/models/caira/course-detail.model.ts`, beside the types
they map, per Decision 5. `course-detail.model.spec.ts` covers the parts that fail silently: the
credit-on-first-field rule, the image fallback chains, locked-chapter progress, and #14 winning over
#4's cached window.

Two consequences worth knowing:

- **`course-related-section` takes its two lists as inputs** rather than injecting the service. #4
  already carries `related_courses` and `instructor_related_courses`, and the component lives in
  `shared/components/` — having it reach into a route-scoped feature service would invert the
  dependency to re-derive what its parent already holds. Its dead `relatedContent` /
  `instructorCourses` fetch scaffolding is deleted.
- **`httpResource.value()` throws once the resource is in an error state** —
  `ResourceValueError`, not `undefined`. Every `computed()` over a resource must therefore check
  `error()` **before** `value()`, or the first failed request becomes a render failure in every
  consumer instead of an empty state. This bit `CourseDetail` and the instructor page, and the same
  latent crash was already shipped in `courseFeed()`, `FeatureFacade.catalogRows` and
  `Auth.currentUser` (that last one feeds the header on every page) — all five now guard.
- **`Utils.showAdditionalResources` is now the public `openResourceLinks`.** #4's `ai_kit` and
  `exercise_file_url` are the resource list; the dialog half was already there. `openAdditionalResources(courseId)`
  survives for the card surfaces, which have no payload to open (G-32).

Shipped: `masterclass.model.ts` (wire types + `topSectionToCard` / `courseSectionToCard` /
`groupByLevel` / `img`), `courseFeed()` factory, `FeatureFacade` rebuilt on `httpResource`.
Four of nine rails have a source; the other five are `emptyCourseFeed()` and every section is
`@if`-guarded, so they render nothing (G-22).

Contract facts it was built against:

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
  `Utils.toggleBookmarkCourse` maps `{status:"success", bookmarked}` → `{status, is_bookmarked}` and
  the hero patches from the server's answer, never from a local flip. The §1.7.1 `model()`
  write-back question is closed — see Risk 10.
- `#16` returns **raw serializer output with no envelope**, and its field list is defined outside the
  documented module. `toInstructorProfile` reads both naming conventions and flattens
  `social_media_links` by platform; a UAT capture (P0 item 3) replaces the guesswork without
  touching anything but the mapper. The instructor page's three course tabs have no endpoint at
  all — G-29.
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

### P8 — QR login ✅ shipped · one assumed constant

Endpoints #36 and #38. (#37 is the phone's call and is deliberately not implemented here.)

`QrLogin` (`auth/shared/components/qr-login/`) owns the whole flow, since nothing outside the login
card reads a QR session: WebCrypto keypair → #36 → render the code with **`@code_with_sachin/ngx-style-qr`**
(SSR-safe SVG, no runtime deps) → 120 s countdown → PIN → #38 → decrypt → `storeTokens`. The keypair
is a plain field, not a signal: a private key does not belong in the reactive graph, and it is dropped
on destroy. `afterNextRender` starts it, so it never runs during SSR.

**Verified against the live API**, not just typed:

| Case                      | Result                                                        |
| ------------------------- | ------------------------------------------------------------- |
| #36 with a P-256 SPKI key | `201 {session_id, expires_in: 120}`                           |
| #38 before any claim      | `409 not_claimed` → rendered **inline in the card, no toast** |
| #38, unknown session      | `404` → "expired, please rescan"                              |
| #36 with no key           | `400 Missing public_key`                                      |

⚠️ **`session_id` is a 32-char hex string with no dashes** (`984c0d7dbbe44a5488f12e662feba034`), not
the dashed UUID4 the reference describes. Treated as an opaque string throughout.

**The decrypt contract is resolved** (G-04) — not from the reference, which still puts
`crypto.py` out of scope, but from a client that talked to this same module. The `miles-qr-login-*`
salt and info matching byte for byte is what identifies it as the same module rather than a
lookalike:

| Step       | Value                                                                       |
| ---------- | --------------------------------------------------------------------------- |
| Key agree  | ECDH **P-256**                                                              |
| Key encode | **raw uncompressed EC point, base64** — 65 bytes → 88 chars                 |
| Derive     | HKDF-SHA256, salt `miles-qr-login-salt-v1`, info `miles-qr-login-aesgcm-v1` |
| Cipher     | AES-256-GCM, tag appended to `ct`                                           |

⚠️ **`raw`, not SPKI** — the correction that mattered, and the one no live probe could have caught.
#36 does no format validation, so an SPKI key returns a clean `201` and only fails later on the
phone as `400 Invalid session encryption key`. Both encodings look equally healthy from the browser.
`qr-crypto.spec.ts` pins the export at 65 bytes with the `0x04` uncompressed marker, and pins the
salt and info so "tidying" any of them breaks the build rather than production.

**One thing is still open:** the decrypted plaintext's shape. #37 documents
`{access_token, refresh_token, user_id}`; the sibling client documents `{user_id, session_id,
token_id}`. Only the first is usable — the second is a set of references and no endpoint in this API
redeems them. `parseSession` reads the documented shape and, on a mismatch, reports the key names it
actually received (never the values, which are credentials). That turns the one case no test can
reach into a one-line diagnosis on the first real scan.

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
5. **QR crypto is unspecified.** Narrowed, not closed: P8 shipped and every call is verified live,
   but the final decrypt runs on an assumed construction (G-04). If the backend differs, QR sign-in
   fails at the last step for real users — it degrades to a clear "use email or phone" message rather
   than a broken session, but it is the one part of this branch that no test here can settle.
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
10. ~~**The card `model()` write-back conflicts with `courseFeed()`'s `computed()` items**~~ —
    **closed, and it was never a conflict.** No template binds `[(card)]`, `Utils.applyBookmarkChange`
    no longer exists, and no CAIRA list endpoint returns bookmark state, so there is no rail truth
    to propagate and the card's local `model()` write is sufficient. `courseFeed().items` stays a
    `computed()`; course detail uses a `linkedSignal`. Full reasoning in §1.7.1. The residual —
    rail cards always render unbookmarked until the learner opens the course — is G-31, a backend
    ask, not a client fix.
