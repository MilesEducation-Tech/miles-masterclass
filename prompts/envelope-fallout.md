# Envelope fallout: webinar registration, `CommonResponse`, and the two dead home-page reads

**Branch:** `fix/MIL-XXX-envelope-fallout` (from `master`; `git branch -m` once the ticket exists)
**Commit:** `fix(offerings): read the {success, message, data} envelope on webinar registration`
**Approved 2026-10-10** with D1 (remove the continue card and its call), D2 (drop the footer's eager cart
load), and D3 (leave the dead-route `.status` reads to their rebinds). The work happens in a sibling worktree
at `../miles-masterclass-envelope`, because the edit guard refuses paths under `.claude/worktrees/`.
**Size:** M, about 250 changed lines, most of them deletions. Independent of `fix/MIL-52-auth-envelope`:
neither branch touches the other's files, and MIL-52 never reads `.status`.

## Jira ticket

**Summary:** `fix(offerings): read the {success, message, data} envelope on webinar registration`
**Issue type:** Bug · **Component:** offerings (plus core, layout) · **Branch:** `fix/MIL-XXX-envelope-fallout`
**Links:** relates to MIL-52 (auth envelope). Postman `06. Events and Bookings/` `UNIVERSAL POST
events-register-via-zoom-v1` and `UNIVERSAL GET events-register-via-zoom-status-v1`; this file.

### Context

Since 2026-10-10 the MilesCAIRA backend wraps every response, success and error alike, in
`{success, message, data}`. MIL-52 fixed sign-in and profile. This ticket covers the rest of the live
surface.

### Current behaviour

- **Webinar registration fails for every learner.**
  - `postRegistration` reads `status_url` and `attempt_id` at the top level
    (`webinar-registration.ts:104,118`). Both now sit in `data`.
  - `resolveStatusUrl(undefined)` throws, so the learner gets "Something went wrong".
- **The status poll would never finish.** `registration_status` is in `data` (`:186`), so the loop would
  run to its 45 s cap and report `timed-out`.
- **Two error fields are lost.**
  - `toWebinarError` reads `errors` and `retry_after_seconds` from the top level (`webinar-error.ts:197,199`).
    Both are in `data` now.
  - The double-tap retry therefore always waits the 15 s default.
- **Every signed-in page fires two requests that answer Django 404 HTML.**
  - `GET v2/user/last_viewed/` comes from the footer's "continue learning" card.
  - `GET user/cart/mybucket/` comes from the footer's cart count.
- `CommonResponse<T>` still declares `status: boolean`.

### Expected behaviour

- Register → 202 → poll → "You are registered". A second tap answers "Already registered".
- Field errors and `retry_after_seconds` are read.
- No 404s on a signed-in page.
- `CommonResponse` says `success`.

### Scope

- **In:**
  - Webinar register and status unwrap `data`; `toWebinarError` reads `data`.
  - `CommonResponse.status` → `success`, plus the two literals that construct one.
  - Footer: stop calling `last_viewed` and `mybucket` (decisions D1 and D2).
- **Out:**
  - **The legacy surface** (see "Found while auditing"). It is not envelope fallout: those routes no longer
    exist. Each feature needs its own rebind ticket.
  - **The `.status` reads on legacy routes** (decision D3).

### Acceptance criteria

- [ ] Signed in on UAT, registering for an upcoming webinar ends with "You are registered" and a join
      affordance, and registering again shows "Already registered". **Partly verified, blocked by the backend.**
  - **What passed:** register answered 202, and the client followed the server's `status_url` with the
    attempt id.
  - **What happened next:** it polled `data.registration_status` (`PENDING`) up to the 45 s cap, then took the
    "Still working on it" path and reloaded the feed.
  - **Why it stops there:** UAT never moves the attempt past `PENDING` (`docs/WEBINAR_API_QUESTIONS.md`
    Q13), so the registered and already-registered states can't be reached on UAT.
- [x] No request on a signed-in home page answers 404. Home calls only `user-details/` and
      `tracks-page/?login_type=post_login`, both 200.
- [x] Home and the webinar list and detail pages render, signed out and signed in. These are the live
      web-api reads, which already unwrap `data`.
- [x] `pnpm lint` and `pnpm build:prod` are green (macOS local).

### Risks and open questions

- **Backend ask:** there is no `api/v1` or `web-api/v1` twin of `v2/user/last_viewed/`. The nearest thing is the
  per-course `continue_watching` block on `course-section/` cards. If the footer card should come back, the
  backend needs a "last viewed course" route.
- **Verification side effect:** registering on UAT creates a real Zoom registrant and a Salesforce lead
  against the test account. I will confirm before pressing Register.

## What I read

- `AGENTS.md`, `CLAUDE.md`, `prompts/auth-envelope-fix.md` and the MIL-52 diff (on its branch).
- **The regenerated Postman collection** (on MIL-52, `f877623`): 238 requests, every example enveloped.
- **Every API path literal in `src/app`** (167). The 103 legacy paths (`v2/*`, `user/*`, `promotion/*`,
  `partners/*`, `reports/*`, `tracks/`, `instructor/`…) were probed against `uat-api.milescaira.com` on
  2026-10-10. **All 103 answer Django 404 HTML.**
- **The live callers:**
  - `masterclass-home-facade` (`tracks-page/`)
  - `course-detail` (`course-detail/`, `about-course/`, `bookmark/`)
  - `webinar.model` and `webinar-registration` (main, details, register, status)
  - `live-session` / `meeting-session.model` (claim, heartbeat, release, signature)

## Endpoint map (live routes only; auth and account are MIL-52)

| Route                                                          | Caller                         | Envelope today                                             |
| -------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------- |
| `web-api/v1/masterclass/tracks-page/`                          | `masterclass-home-facade`      | ✅ `parse` unwraps `data`                                  |
| `web-api/v1/masterclass/course-detail/`, `about-course/`       | `course-detail-facade`         | ✅ `parse` unwraps `data`                                  |
| `web-api/v1/masterclass/bookmark/:id/` (POST)                  | `course-detail-facade`         | ✅ body ignored, reloads `course-detail/`                  |
| `web-api/v1/events/webinar-main-page/`, `-details-page/`       | `webinar-facade`               | ✅ `parseMainPage` / `parseDetail` unwrap `data`           |
| `api/v1/events/attendance-session/*`, `meeting-sdk-signature/` | `meeting-session`              | ✅ `resultOf` accepts either shape                         |
| `api/v1/events/register-via-zoom/` (POST)                      | `webinar-registration:145,153` | ❌ reads `status`, `attempt_id`, `status_url` bare         |
| `api/v1/events/register-via-zoom-status/:id/`                  | `webinar-registration:186`     | ❌ reads `registration_status` bare                        |
| all of the above, refusals                                     | `toWebinarError`               | ⚠️ `code` from `data`; `errors`, `retry_after_seconds` not |

## Changes

### 1. Webinar registration (`features/offerings/webinar/`)

- **`services/webinar-registration.ts`**
  - Register: type the POST as `CommonResponse<RegisterResponse>` and add
    `.pipe(map((res) => ({ ...res.data, message: res.message })))`. The envelope's `message` is the copy
    ("You are already registered for this webinar."), and `data` has none. One local `post()` covers the
    first try and the lock-contention retry.
  - Poll: type the GET as `CommonResponse<AttemptStatusResponse>` and add `.pipe(map((res) => res.data))`.
- **`models/webinar.model.ts`:** one line on `RegisterAcceptedResponse` / `AlreadyRegisteredResponse` saying
  `message` is the envelope's, merged in.
- **`utils/webinar-error.ts`**
  - Read `errors` and `retry_after_seconds` as `body[…] ?? inner[…]`, the same idiom already used for
    `code` and `join_opens_at`.
  - Reword the comment above `inner`: every route wraps now, not only the live-session ones.

### 2. `CommonResponse` (`core/`)

- **`core/models/http.model.ts`:** `status: boolean` → `success: boolean`, with a one-line doc giving the date.
- **The two literals that build one** change `status: false` → `success: false`:
  - `core/services/job-sectors/job-sectors.ts:11`
  - `shared/components/course-related-section/course-related-section.ts:23`
- **No reader changes.** The grep found no `.status` read through `CommonResponse`. Every `.status` read
  is on a hand-written type (D3). `tsc` in `build:prod` confirms this.

### 3. Footer overlay (`layout/footer-overlay/`, `core/`), per D1 and D2

- **D1, `last_viewed` (no replacement exists):**
  - Remove the `lastViewed` effect, the `inProgressResource` / `inProgressCourse` / `activeInProgressType`
    plumbing, the `'continue'` card state and `onResume`.
  - Delete `components/continue-learning-card/` and `CONTINUE_CARD_ROUTES`.
  - In `core/models/feature.model.ts`, remove the `lastViewed` key, field and route.
  - In `core/services/feature-facade/feature-facade.ts`, remove its two special cases.
  - Add the backend ask to `docs/MASTERCLASS_API_QUESTIONS.md`.
- **D2, `mybucket` (the replacement is the commerce rebind):**
  - Delete the footer's eager `loadMyBucket()` effect.
  - `cartCount` stays: it reads `CartStore.cartData()`, which is `null` → 0 today, as it is after the 404.
  - The payment pages still load the cart themselves. That flow is all legacy and is out of scope.

## Found while auditing (out of scope, for follow-up tickets)

**The whole legacy surface is gone, not just two routes.** All 103 legacy path literals answer 404 on UAT,
grouped below by the ticket that would rebind them:

- **Payment:** cart, coupons, address, checkout, orders, plans and subscription.
  - Replacement: `api/v1/commerce/*`, `catalogue/*`, `subscriptions/*`.
  - Size: 12 files and 34 `cartData()` reads, so L, and it splits.
- **Offerings players:**
  - Paths: `v2/chapters/`, `v2/user/myclassactivity/`, `user-quiz-details/`, `user-assessment/*`,
    `user-feedback/*`, `v2/nano-learning/*`, `v2/:course_type/details/`.
  - Replacement: `web-api/v1/masterclass/*`.
- **Feeds** (FeatureFacade):
  - Paths: `v2/dashboard/`, `v2/user/{recently_viewed,completed_classes,bookmarks}/`, `instructor/`,
    `recommendation/`, `v2/library/*`.
- **Bookmarks and add-to-cart** (`Utils.toggleBookmarkCourse` / `addCourseToCart`): `v2/user/toggle-bookmark/`
  and `v2/user/cart/`.
- **Tracker and badges:** `v2/cpe-tracker/*`, `usercredits/*`, `v2/*-badges/`.
- **Faculty:** `v2/faculty/{register,verify}/`. There is no v1 twin in Postman.
- **Profile options and the profile-completion dialog:** `user/companies/`, `user/job-sectors/` and others.
- **Admin partner platform:** `partners/*`, `reports/*`.
- **Misc:** `utm/track_utm/`, `v2/locations/autocomplete/`, `v2/dashboard/suggestion/`, `ai-lab/account/`.

**D3:** the two `.status` reads named in the brief (`faculty.ts:413,448,487`, `podcast-course-hero.ts:96,115`)
and about 16 other hand-written `status: boolean` types all sit on these dead routes.

- Flipping them to `success` changes nothing a user can see: the request 404s, so neither branch runs.
- Their other top-level fields (`is_bookmarked`, `in_cart`, `user`) would move into `data` too.
- The proposal is to leave them to each feature's rebind.

## Checks

```bash
pnpm lint
pnpm build:prod
```

## How to verify

`pnpm start` (port 4101), against UAT, signed in as the temp account from MIL-52:

1. **Signed-in home:** the Network panel has no 404, and there are no `last_viewed` or `mybucket` requests.
   The footer shows the subscribe card or nothing, never "continue learning".
2. **`/us/cpa/webinar`:** open an upcoming webinar and press Register.
   - Expect a 202, then status polls answering 200, then "You are registered".
   - Press it again: expect "Already registered".
3. **Regression:** home, one masterclass course page, and the webinar list and detail pages render. There
   are no console errors.
