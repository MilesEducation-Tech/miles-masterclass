# CAIRA LMS → Miles Masterclass — exact API-binding parity

> Master plan. Each phase below gets its own `prompts/<phase>.md` from `_TEMPLATE.md`
> before any code is written (AGENTS.md §1). This file is the map, not the build order for
> a single sitting.
>
> Reads alongside — does not replace — `prompts/caira-api-binding.md` (rev 2). That plan
> binds miles-masterclass to the **CAIRA Web API reference** (50 endpoints). This plan is
> narrower and harder: reproduce **exactly what `CAIRA-LMS-2026` actually calls in
> production**, no more, no less — on miles-masterclass's routes, structure, design system
> and type discipline.

---

## Goal

Every CAIRA API call `CAIRA-LMS-2026` makes today is reproduced in miles-masterclass v3 —
same paths, same params, same payloads, same response handling — expressed as
`@Service()` + `httpResource` reads and `ApiClient` writes, fully typed, on the existing
`/:country/:profession_type` routes and Tailwind design system.

---

## What it read

**CAIRA-LMS-2026** (Angular 12 / NgModules / `ng-uikit-pro-standard`, no SSR)

- `src/environments/environment.ts` — hosts
- `src/app/pages/caira-ready/caira-ready.service.ts` (335 lines — 25 of the 31 calls)
- `src/app/pages/caira-ready/caira-status.service.ts`, `caira-progress/caira-progress.service.ts`
- `src/app/pages/caira-ready/caira-auth.service.ts` (localStorage session)
- `src/app/pages/caira-ready/caira-login/caira-qr-login/caira-qr-login.service.ts`
- `caira-ready.module.ts` (routes), `caira-home.component.ts`, `chapter.component.ts`,
  `final-assessment.component.ts`, `chapter-quiz.component.ts`,
  `course-feedback-modal.component.ts`, `webinar-detail-modal.component.ts`,
  `masterclass-details.component.ts`, `caira-ready.component.ts`

**miles-masterclass** (Angular 22 / standalone / signals / SSR)

- `AGENTS.md` §§3, 6, 7, 8
- `prompts/caira-api-binding.md` (rev 2, 753 lines) — phase state P0–P9
- `src/app/shared/core/http/caira.endpoints.ts` (47 paths) + `caira-error.ts`
- `src/app/shared/core/models/caira/{envelope,auth,masterclass,course-detail}.model.ts`
- `docs/CAIRA_GAPS.md`, `docs/api-and-routes.md`, `docs/caira-contracts/`
- `docs/adr/0001-service-decorator.md`, `0002-no-external-store.md`

---

## 1. The two projects, in one paragraph each

**CAIRA-LMS-2026** is the shipped CAIRA learner surface, bolted into the legacy Miles CPA
LMS at `src/app/pages/caira-ready/**`. NgModules, MDB Angular UI, OnPush + `markForCheck()`,
RxJS `Subscription` fields unsubscribed by hand. Every API call funnels through one
335-line `CairaReadyService` typed `any` end to end. It carries its **own** session in
`localStorage` under `caira_*` keys, deliberately separate from the CPA session, and
attaches the CAIRA bearer token by hand with a `skip: "true"` header that tells the legacy
global interceptor to leave the request alone. There is no refresh flow — an expired JWT
falls back to the QR login. It is the source of truth for _which_ endpoints matter.

**miles-masterclass v3** is the rebuild: Angular 22 standalone, SSR/SSG hybrid, signals as
the only state container, Tailwind v4 + `shared/components/ui`, and a transport layer built
for CAIRA specifically — a single `CAIRA` endpoint registry, a five-kind `cairaError()`
classifier, and a three-interceptor chain (`appInterceptor` → `errorInterceptor` →
`authInterceptor`) with a single-flight refresh queue. Reads are `httpResource`, writes are
`ApiClient`, and no facade layer exists. P0–P3 of the CAIRA binding have shipped (transport,
auth, catalog listing, course detail); P4–P9 are open.

---

## 2. The exact CAIRA-LMS call inventory — 31 calls

Base host in CAIRA-LMS is `environment.cairaProgressUrl` (`https://api.milescaira.com/`,
trailing slash stripped), **except** the QR pair which uses `environment.qrLoginUrl`
(a separate Cloud Run host) and one call to the legacy CPA API.

`WEB` = `CAIRA_LMS_Masterclass_MilesOne_Web`.
Status column: ✅ path already in `caira.endpoints.ts` · ➕ must be added · ⚠️ path differs.

| #   | Method | Path                                                         | CAIRA-LMS method                        | Request                                                                       | Registry                       |
| --- | ------ | ------------------------------------------------------------ | --------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------ |
| 1   | POST   | `login-with-phone-otp`                                       | `cairaLogin`                            | body: OTP request                                                             | ⚠️ `web/login-with-phone-otp`  |
| 2   | POST   | `verify-otp`                                                 | `verifyOtp`                             | body: OTP verify                                                              | ⚠️ `web/verify-otp`            |
| 3   | POST   | `{qrLoginUrl}qr/initiate`                                    | `CairaQrLoginService.initiate`          | `{ public_key }`                                                              | ✅ (different host)            |
| 4   | POST   | `{qrLoginUrl}qr/confirm`                                     | `CairaQrLoginService.confirm`           | `{ session_id, verification_pin }`                                            | ✅ (different host)            |
| 5   | POST   | `{cpaApiUrl}updateCairaToken`                                | `updateCairaToken`                      | body: token bridge                                                            | — legacy CPA, **not portable** |
| 6   | GET    | `web/app-status/`                                            | `CairaStatusService.getAppStatus`       | —                                                                             | ➕                             |
| 7   | GET    | `{WEB}/caira/levels_progress/`                               | `cairaHeaderDetails`                    | —                                                                             | ✅ `levelsProgress`            |
| 8   | GET    | `{WEB}/Top_Section/`                                         | `homeTopSection`                        | params: `limit`/`page`/`offset`                                               | ✅ `topSection`                |
| 9   | GET    | `{WEB}/Masterclass_Course_Section/`                          | `masterclassCourseSection`              | params: same                                                                  | ✅ `courseSection`             |
| 10  | GET    | `{WEB}/Completed_Masterclass_Course_Section/`                | `completedCourseSection`                | params: same                                                                  | ✅ `completedCourseSection`    |
| 11  | GET    | `{WEB}/Masterclass_Course_Detail/{courseId}/`                | `getMasterClassDetails`                 | —                                                                             | ✅ `courseDetail`              |
| 12  | GET    | `caira/masterclass/levels-page/`                             | `masterclassLevelDetails`               | —                                                                             | ➕                             |
| 13  | GET    | `caira/masterclass/levels-page/`                             | `masterclassFaqDetails`                 | params: `type=Frequently Asked Questions`                                     | ➕ (same path, FAQ variant)    |
| 14  | GET    | `{WEB}/caira/all_webinars_web/`                              | `getAllWebinars`                        | —                                                                             | ✅ `allWebinarsWeb`            |
| 15  | GET    | `{WEB}/caira/webinars_web/{id}/`                             | `getWebinarDetail`                      | —                                                                             | ✅ `webinarDetail`             |
| 16  | POST   | `registerV4/`                                                | `registerWebinar`                       | **empty body**, params `webinar_id`, `event_type` (default `"webinar"`)       | ➕                             |
| 17  | GET    | `registerV4/{attemptId}/status/`                             | `getRegistrationStatus`                 | —                                                                             | ➕                             |
| 18  | GET    | `caira/webinar_feedback_questions/?webinar_id=`              | `getWebinarFeedbackQuestions`           | query only                                                                    | ✅ `webinarFeedbackQuestions`  |
| 19  | POST   | `caira/webinar_feedback_submit/?webinar_id=`                 | `submitWebinarFeedbackQuestionsAnswers` | query param **on the POST**                                                   | ✅ `webinarFeedbackSubmit`     |
| 20  | POST   | `{WEB}/caira/masterclass/chapter/{chapterId}/start/`         | `saveCourseEnrollment`                  | no body                                                                       | ✅ `chapterStart`              |
| 21  | GET    | `{WEB}/caira/masterclass/quiz/{chapterId}/questions/`        | `getQuizQuestions`                      | —                                                                             | ✅ `quizQuestions`             |
| 22  | POST   | `{WEB}/caira/masterclass/quiz/{chapterId}/submit/`           | `saveQuizQuestionSelection`             | `{ question_id, selected_option_ids }` — **one question per request**         | ✅ `quizSubmit`                |
| 23  | POST   | `{WEB}/caira/masterclass/course-progress/{courseId}/update/` | `saveVideoWatchTime`                    | `{ chapter_id, last_watched_position_seconds, max_watched_duration_seconds }` | ✅ `courseProgressUpdate`      |
| 24  | GET    | `{WEB}/caira/masterclass/{courseId}/assessment/questions/`   | `getFinalAssessmentQuestions`           | —                                                                             | ✅ `assessmentQuestions`       |
| 25  | POST   | `{WEB}/caira/masterclass/{courseId}/assessment/submit/`      | `submitFinalAssessmentQuestionsAnswers` | `{ answers: [...] }`                                                          | ✅ `assessmentSubmit`          |
| 26  | GET    | `{WEB}/caira/masterclass/{courseId}/assessment/result/`      | `getFinalAssessmentExamReportData`      | —                                                                             | ✅ `assessmentResult`          |
| 27  | GET    | `{WEB}/caira/masterclass/{courseId}/feedback/questions/`     | `getFeedbackQuestions`                  | —                                                                             | ✅ `feedbackQuestions`         |
| 28  | POST   | `{WEB}/caira/masterclass/{courseId}/feedback/submit/`        | `submitFeedbackQuestionsAnswers`        | `{ responses:[{question_id, rating}], optional_feedback_text? }`              | ✅ `feedbackSubmit`            |
| 29  | POST   | `{WEB}/caira/masterclass/{courseId}/bookmark/`               | `bookmarkCourse`                        | no body — pure toggle                                                         | ✅ `bookmark`                  |
| 30  | POST   | `{WEB}/caira/level_based_badge_clicked/`                     | `claimBadgeAsPerLevel`                  | `{ credly_assertion_id }` → `data.credly_accept_url`                          | ✅ `levelBadgeClicked`         |
| 31  | GET    | `caira/get_all_badges_V4/`                                   | `CairaProgressService.getProgress`      | —                                                                             | ✅ `allBadgesV4`               |
| 32  | POST   | `milesone-activity`                                          | `salesforceEvent`                       | `{ activity_type, event_parameters }`                                         | ➕                             |

### 2.1 What CAIRA-LMS does **not** call

In the registry but unused by the production LMS — **out of parity scope**, leave as-is:
`#14 enrollment`, `#16 instructorDetail`, `#17 courseProgress` (GET — CAIRA-LMS only ever
writes progress and re-reads it from `#4`), `#22 badgesTrackerWeb`, `#24 badgesCatalog`,
`#25 cpeProgress`, `#26/#27 alumni badges`, `#28 levelBadgeClickedByUrl`,
`#29 feedbackOrBadgeStatus`, `#30 otherBadgeStatus`, `#33 loginWithEmailPassword`,
`#37 qrClaim`, `#41 refresh`, `#42–#50` (identity family).

> `#16`, `#17` and `#22` are already bound or planned in `caira-api-binding.md`. Parity does
> not require removing them — it requires not _blocking_ on them. Flag any surface that
> depends on one as beyond-parity in that phase's prompt.

### 2.2 The five endpoints miles-masterclass is missing

These are the real deliverable of this plan. None exists in `caira.endpoints.ts` today.

```ts
// shared/core/http/caira.endpoints.ts — additions

/** L1 · GET · levels page content tree. `?type=` selects a named section. */
levelsPage: 'caira/masterclass/levels-page/',

/** L2 · GET · web maintenance / pathway / onboarding gate. Trailing slash required. */
appStatus: 'web/app-status/',

/** L3 · POST · **no body** · `?webinar_id=&event_type=` · async, returns 202-style accept */
webinarRegister: 'registerV4/',

/** L4 · GET · poll the async registration attempt */
webinarRegisterStatus: (attemptId: string) => `registerV4/${attemptId}/status/`,

/** L5 · POST · Salesforce activity relay. Fire-and-forget; never blocks a UI transition. */
activityEvent: 'milesone-activity',
```

**Response shapes to capture into `docs/caira-contracts/` before binding:**

| Endpoint                  | Observed shape (from consumer code)                                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `levels-page`             | `{ status: true, data: { levels: [{ id, sections: [{ id, items: [...] }] }] } }` — boolean-status envelope. FAQ variant returns the same tree; the consumer takes the **first** matching section.                                           |
| `app-status`              | `{ is_maintenance?, is_web_maintenance?, is_pathway?, is_onboarding_completed? }` — bare, no envelope. **All-true is the happy path**; block on `is_web_maintenance === true`, `is_pathway === false`, `is_onboarding_completed === false`. |
| `registerV4/`             | `{ status: "accepted", registration_status: "PENDING" \| "REGISTERED", attempt_id, status_url, message? }`                                                                                                                                  |
| `registerV4/{id}/status/` | `{ registration_status: "PENDING" \| "REGISTERED" \| "FAILED", error_message?, error_code? }`                                                                                                                                               |
| `milesone-activity`       | Response ignored by every call site. Type as `unknown`.                                                                                                                                                                                     |

`activity_type` is a **closed union of four values**, each with its own
`event_parameters` shape:

```ts
export type CairaActivityEvent =
  | { activity_type: 'login'; event_parameters?: undefined }
  | {
      activity_type: 'video_completed';
      event_parameters: {
        video_name: string;
        video_type: 'Course Video';
        course_playlist_name: string;
      };
    }
  | {
      activity_type: 'course_completed';
      event_parameters: {
        credit_amount: number;
        credit_type: 'CPE';
        course_name: string;
        course_instructor: string;
      };
    }
  | {
      activity_type: 'badges_claim';
      event_parameters: {
        badge_type: 'Level';
        badge_name: string;
        credit_amount: number;
        credit_type: 'CPE';
        webinar_name: string;
        course_name: string;
      };
    };
```

### 2.3 The one place parity must NOT be reproduced

**Resolved — miles-masterclass is already correct.** An earlier read of this called it a
path mismatch to settle with a live `curl`. It is not.

`caira.endpoints.ts` registers the OTP pair under a `web/` prefix (#34
`web/login-with-phone-otp`, #35 `web/verify-otp`). CAIRA-LMS calls the **unprefixed** routes
at the URLconf root — which are #39 and #40, the _mobile_ twins. `caira.endpoints.ts` omits
both deliberately, says so in its closing comment block, and `caira.endpoints.spec.ts`
asserts they stay omitted:

- **#39 returns the generated OTP in `result.otp_dev` to any anonymous caller, for any
  phone number, with no throttle.** Already recorded as a backend defect in
  `docs/CAIRA_GAPS.md`.
- **#40 has no profile-completion gate.** #35's 403 `PROFILE_INCOMPLETE` is what opens the
  profile dialog; the mobile twin lets an incomplete profile straight through.

So the shipped web LMS authenticates through the mobile endpoints. **Do not port this.**
Parity is behavioural, and the behaviour here is a security hole. No P-P0 capture is needed;
keep #34/#35 and keep the spec that guards them.

**Still open — the QR host.** `qr/initiate` and `qr/confirm` live on a **different host** in
CAIRA-LMS (`environment.qrLoginUrl`, a Cloud Run instance), not `BASE_API_URL`. The
registry's relative entries resolve against the wrong origin as written. Fix in P-P8, not
before — nothing calls them today.

---

## 3. What this closes in `docs/CAIRA_GAPS.md`

| Gap                                                   | Status after this plan                                                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **G-23 — Webinar registration, "no binding target"**  | **Closed.** `registerV4/` + the status poll are the target. The gap register was written from the 50-endpoint reference, which omits them. |
| G-12 `is_beta_access` / trial flag                    | Unchanged — CAIRA-LMS has no equivalent either.                                                                                            |
| G-25 CPE credits by calendar year                     | Unchanged — confirmed genuine: CAIRA-LMS's tracker is level-based too. Parity means **removing the year selector**, not backfilling it.    |
| G-30 CPE vs Preview mode                              | Confirmed: CAIRA-LMS has no mode toggle. Keep `cpe_mode_details` pinned `null`.                                                            |
| G-14 plan/subscription model                          | Confirmed absent in CAIRA-LMS. `currentPlan` stays `null`.                                                                                 |
| **New: G-34 maintenance / pathway / onboarding gate** | `web/app-status/` exists and is unbound in miles-masterclass. Add the row, then close it in P-P1.                                          |
| **New: G-35 levels page content tree**                | `caira/masterclass/levels-page/` drives the CAIRA home level tabs and the FAQ accordion. Unbound.                                          |
| **New: G-36 activity relay**                          | `milesone-activity` — four Salesforce events with no miles-masterclass counterpart.                                                        |

Update the register in the **same commit** as each phase, not in P9.

---

## 4. Defects in CAIRA-LMS that must NOT be replicated

Parity is behavioural, not textual. These are bugs, and reproducing them is a regression.

| Where                                                                    | Defect                                                                                                                                                                    | What miles-masterclass does instead                                                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `saveCourseEnrollment` (#20), `bookmarkCourse` (#29)                     | `this.http.post(url, { headers })` — the options object is passed as the **request body**. No `Authorization` header is sent on either call. Both endpoints require auth. | `ApiClient.post(CAIRA.chapterStart(id), {})`; the token comes from `appInterceptor`. Never hand-attach.                       |
| `CairaReadyService.withLoader`                                           | A 5-second `setTimeout` force-hides the global loader while the request is still running.                                                                                 | `appInterceptor` already pairs `loading.start()` with `finalize(loading.stop())`. Delete the concept.                         |
| `CairaAuthService`                                                       | Reads/writes `localStorage` directly. Throws during SSR.                                                                                                                  | `Storage` service (AGENTS.md §7) — parses cookies off the SSR request.                                                        |
| No refresh flow                                                          | JWT expiry check → dump the user to QR login.                                                                                                                             | `authInterceptor`'s single-flight refresh queue (already shipped).                                                            |
| Every method returns `Observable<any>`                                   | 335 lines, zero types.                                                                                                                                                    | Typed at the call site: `api.get<CourseDetailResponse>(...)`. `unknown` where genuinely uncertain, then narrow. **No `any`.** |
| `saveVideoWatchTime` computes `max_watched_duration_seconds` client-side | Duplicates a server rule (`Max_Watched_Duration_Seconds = max(existing, incoming)`) and a 95%-completion rule the server owns.                                            | Send positions only. Let the server decide completion (`is_video_completed`, `show_quiz`).                                    |
| Bare `.subscribe()` on `salesforceEvent`, `registerWebinar`, badge claim | Never unsubscribed on some paths; the poll recurses through raw `setTimeout`.                                                                                             | `takeUntilDestroyed(destroyRef)` on every command. Poll via a `DestroyRef`-scoped timer.                                      |
| `skip: "true"` header                                                    | A legacy escape hatch for the CPA interceptor.                                                                                                                            | `SKIP_AUTH_TOKEN` / `SKIP_ERROR_NOTIFICATION` contexts (already in `envelope.model.ts`).                                      |
| Deliberate exception: the **final** progress save                        | CAIRA-LMS deliberately does _not_ cancel the last `saveVideoWatchTime` on destroy, so the last watched position survives navigation.                                      | **Keep this behaviour.** Use `ApiClient` without `takeUntilDestroyed` for that one call, and comment why.                     |

---

## 5. Route map — CAIRA-LMS → miles-masterclass

CAIRA-LMS routes are flat under `caira-ready`. miles-masterclass nests everything under
`/:country/:profession_type` (`{c}/{p}`). No new routes are needed; every CAIRA-LMS page
already has a host route.

| CAIRA-LMS                       | miles-masterclass                                                              | Note                                                                                                                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `login`                         | `/auth/login`                                                                  | Login page already absorbed `AuthFacade` (`5fa5c08`).                                                                                                                                                                                              |
| `account-update`                | `/auth/profile` + profile-completion dialog                                    | `app-status`'s `is_onboarding_completed === false` routes here.                                                                                                                                                                                    |
| `maintenance`                   | `/maintenance`                                                                 | Exists; `is_web_maintenance === true` routes here.                                                                                                                                                                                                 |
| `home`                          | `/{c}/{p}/masterclass`                                                         | Rails + level tabs + FAQ. `levels-page` feeds the tabs and the FAQ accordion.                                                                                                                                                                      |
| `tracker`                       | `/{c}/{p}/cpe-tracker`                                                         | Level-based, not year-based (see §3).                                                                                                                                                                                                              |
| `miles-ai-labs`                 | `/ai-labs`                                                                     | Already routed.                                                                                                                                                                                                                                    |
| `:id/:topic`                    | `/{c}/{p}/masterclass/:courseId/:courseTitle`                                  | Course detail — **already bound (P3)**.                                                                                                                                                                                                            |
| `:id/:topic/chapter/:chapterId` | `/{c}/{p}/masterclass/:courseId/:courseTitle/chapter/:chapterId/:chapterTitle` | `layout: 'plain'`.                                                                                                                                                                                                                                 |
| `:id/:topic/finalAssessment`    | `.../final-assessment/:sessionId/exam`                                         | ⚠️ **`:sessionId` has no CAIRA counterpart** — CAIRA identifies an attempt by `(user, course, attempt_number)`. Add a `legacy-redirects.ts` entry; do not invent a session id.                                                                     |
| `:id/:topic/examReport`         | `.../final-assessment/:sessionId/report`                                       | Same. `assessment/result/` is course-scoped, not session-scoped.                                                                                                                                                                                   |
| —                               | `/{c}/{p}/podcast/**`, `/micro-learning/**`, `/webinar/**`                     | No CAIRA-LMS counterpart for podcast/micro-learning. Empty states stay (G-18, G-19). Webinar detail lives in a **modal** in CAIRA-LMS; miles-masterclass has a real route — bind the route, keep the modal pattern only where the drawer needs it. |

`/:country/:profession_type` stays cosmetic — no CAIRA endpoint takes either parameter.

---

## 6. Phase plan

Numbered `P-P*` (parity) so they don't collide with `caira-api-binding.md`'s P0–P9. Each
phase is independently shippable and `pnpm build:prod` must be green at every boundary.

### P-P0 — Contract freeze for the delta _(blocking)_

- ~~Resolve the two auth-path mismatches~~ — closed without a capture, see §2.3.
- Capture JSON for the five new endpoints into `docs/caira-contracts/`:
  `04-levels-page.json`, `05-app-status.json`,
  `06-register-v4.json`, `07-register-v4-status.json`.
- Capture the three shapes still blocking `caira-api-binding.md` P4/P5 — they block this
  plan identically: `CAIRAMasterclassQuizQuestionSerializer`,
  `CAIRAMasterclassFeedbackQuestionSerializer`, `_build_full_course_progress`
  (+ `get_items()`'s single-vs-bulk wrapper key).
- Confirm whether `registerV4/` and `milesone-activity` sit on `BASE_API_URL` or a
  different host.
- Add `levelsPage`, `appStatus`, `webinarRegister`, `webinarRegisterStatus`,
  `activityEvent` to `caira.endpoints.ts` + `caira.endpoints.spec.ts`.
- Add G-34/G-35/G-36 rows to `docs/CAIRA_GAPS.md`.

**Deliverable:** contracts + registry. No UI.

### P-P1 — App-status gate

- New `shared/core/models/caira/app-status.model.ts` — `CairaAppStatus` with all four flags
  **optional** (the backend omits them) and a `computed()` verdict:
  `'ok' | 'maintenance' | 'needs-pathway' | 'needs-onboarding'`.
- New `shared/core/services/app-status/app-status.ts` — `@Service()`, one `httpResource`
  keyed on `Auth.accessToken` (returns `undefined` when anonymous).
- Wire into the post-login redirect and a `maintenanceGuard`. Do **not** gate on
  `Auth.isAuthenticated()` inside the service — let the interceptor chain classify a 403.
- Polarity is inverted from what the names suggest; comment it (`is_pathway: true` = good).

### P-P2 — Levels page + FAQ

- `caira/masterclass/levels-page/` → level tabs on the masterclass listing and the FAQ
  accordion. One `httpResource`; the FAQ variant is a **second resource with a `type` query
  param**, not a client-side filter (that is what CAIRA-LMS does).
- Types in `shared/core/models/caira/levels-page.model.ts` + a mapper beside the wire types.
- **Optional-chain every array access.** CAIRA-LMS carries a load-bearing comment here: a
  raw `levels[0]` throws mid-state-set and leaves the page blank below the fold.
- Reuse the `img()` null-coercion helper from `masterclass.model.ts` — `ngSrc=""` throws
  NG02952.

### P-P3 — Chapter player + progress _(= `caira-api-binding.md` P4, parity subset)_

- Endpoints: `#20 chapterStart`, `#23 courseProgressUpdate`. **Not `#17 courseProgress`** —
  CAIRA-LMS re-reads progress from `#4`'s `user_chapter_progress`, so parity does not
  require the GET.
- Route-scoped `@Service({ autoProvided: false })` on the chapter route, keyed on chapter id.
- `reset_required: true` returns a **different 2-key body** on `#20`, `#25` and `#23` —
  check it before reading any other key; it opens a dialog, not an error.
- Send `{ chapter_id, last_watched_position_seconds, max_watched_duration_seconds }`.
  Do not compute completion client-side.
- Preserve the uncancelled final save (§4).
- `409 already_started_via_7dc` on `#20` → a `domain` failure with its own copy, no toast.

### P-P4 — Quiz, final assessment, feedback _(= P5, parity subset)_

- Endpoints `#21`–`#22`, `#24`–`#26`, `#27`–`#28`.
- Quiz submit is **one question per request**: `{ question_id, selected_option_ids }`.
- `#21`'s resume branch returns a heterogeneous `questions` array; `previously_completed`
  is hardcoded `false` on both branches — do not branch on it.
- `#25` requires exactly `questions_to_show` answers (read the count from `#24`) or 400.
  Payload is `{ answers: [...] }`.
- Render the pass threshold from `#24`'s `pass_threshold_percent`, never from `#25`'s
  hardcoded "Score below 70%" copy. Pass/fail is the server's decision.
- `correct_option_ids` comes from a Python `set` — compare as sets, never index positionally.
- `403 cool_off_active` → countdown from `cool_off_minutes_remaining` / `cool_off_ends_at`,
  **not** a toast. This is the single best proof the error classifier works.
- Feedback payload `{ responses: [{ question_id, rating }], optional_feedback_text? }` —
  omit the text key entirely when blank (CAIRA-LMS does).
- `#28`'s response `{ feedback_submitted, cpe_awarded, badge_issued, certificate_triggered }`
  drives the success state — feedback triggers the whole credential pipeline.
- Add `legacy-redirects.ts` entries for the `:sessionId` segment (§5).

### P-P5 — Levels progress + badges _(= P6, parity subset)_

- Endpoints `#7 levelsProgress`, `#30 levelBadgeClicked`, `#31 allBadgesV4`. **Only these
  three** — CAIRA-LMS does not call the badge catalog, CPE progress, alumni badges or the
  tracker-web endpoint.
- `#7` rotates the array so the first `"Ongoing"` level leads; `progress` is a **string**
  (`"12.5/30"`), `target_cpe` is int-or-float. Parse; never display raw.
- `#30` takes `{ credly_assertion_id }` and returns `data.credly_accept_url` — CAIRA-LMS
  opens it in a new tab with `noopener`. Keep that.
- `#31`'s `caira_badges.progress` numerator is the **global** grand total, so all three
  levels show the same numerator. `caira-api-binding.md` recommends `#22` instead — but
  **`#22` is not what production calls.** Decide explicitly in this phase's prompt: match
  the bug, or fix it and note the divergence. Recommendation: bind `#31` for parity,
  correct the numerator in the mapper, and document it.
- Widen `BadgeCardData.badgeId` / `.courseId` and `TrackerTableRow.id` from `number` to
  `string` (Decision 8, still pending).
- Remove the CPE-tracker year selector (§3, G-25).

### P-P6 — Webinars + registration _(= P7 + the G-23 closure)_

- Endpoints `#14 allWebinarsWeb`, `#15 webinarDetail`, `#18`/`#19` feedback,
  **`#16 registerV4/` + `#17 status poll`**.
- `#14` returns all active webinars grouped `{ upcoming, expired, completed }` — no
  pagination, no `status` field on the cards; the grouping _is_ the status. `#21` has one.
- Webinar ids stay **numeric** (`Webinar.webinar_id` is a real integer). Leave
  `v2-to-upcoming.ts`'s seven `id: number` declarations alone.
- Registration is **async**: POST with an empty body and `?webinar_id=&event_type=webinar`,
  accept on `status === "accepted" || registration_status ∈ {PENDING, REGISTERED}`, then
  poll `registerV4/{attempt_id}/status/` every **2 s, 12 attempts**, ending optimistically
  as registered on timeout. Reproduce that policy; put the constants in one place.
- `#18` returns a **bare JSON array** with DRF `{detail}` errors; `#19` returns 201 with
  `{status, message}` and keeps `webinar_id` as a query param on the POST.
- Detail is a modal in CAIRA-LMS and a route in miles-masterclass — bind the route; keep
  the schedule drawer's inline card state.

### P-P7 — Activity relay

- `milesone-activity` behind a small `@Service()` (`CairaActivity`) with four typed methods:
  `login()`, `videoCompleted()`, `courseCompleted()`, `badgeClaimed()`.
- Discriminated union from §2.2 — the compiler, not the caller, guarantees
  `event_parameters` matches `activity_type`.
- **Fire-and-forget**: `SKIP_ERROR_NOTIFICATION` on the context, response typed `unknown`,
  failures go to `Logger` only. It must never block or fail a UI transition.
- Call sites mirror CAIRA-LMS exactly: after QR/OTP login success, on chapter video
  complete, on course-feedback submit success, after a successful badge claim.
- Sits alongside the existing `analytics` service — do **not** fold it in; different
  destination, different failure policy.

### P-P8 — QR login _(blocked, may not ship)_

Unchanged from `caira-api-binding.md` P8. The `{epk, iv, ct}` crypto contract
(`account/qr_login/crypto.py`) is out of the reference's scope: curve, KDF, AES mode and
`public_key` encoding are all unspecified. **New information from CAIRA-LMS:** a working
implementation exists at
`src/app/pages/caira-ready/caira-login/caira-qr-login/caira-qr-crypto.service.ts`
(146 lines) — **read it and derive the contract from there rather than waiting on the
backend.** That likely unblocks P8. Also note the separate `qrLoginUrl` host (§2.3).

### P-P9 — Docs

- Rewrite `docs/api-and-routes.md` — all 310 lines still describe the dead Django surface.
- Close G-23; keep G-34/35/36 current.
- Delete dead `environment.AUTH.transferUserData` / `transferAuthStatus` keys.
- Decide the AGENTS.md §10 skill-table question (rebuild the repo skills, or delete the
  tables pointing at files `c31f69d` removed).

---

## 7. Type-safety contract

Non-negotiable, per AGENTS.md §8 and the locked decisions in `caira-api-binding.md`:

- **No `any`.** `unknown` where genuinely uncertain, then narrow. CAIRA-LMS's 335 `any`-typed
  lines are the thing being replaced, not ported.
- **Wire types never reach a template.** One mapper per domain, living _beside_ the wire
  types in the same `*.model.ts`. No `mappers/` folder.
- **Each call site names its envelope type explicitly.** Six success envelopes exist and the
  discriminators overlap — there is no auto-detection and no `CommonResponse<T>`.
- **Unwrapping is a property read inside the `computed()`**, not a helper function.
- **`httpResource.value()` throws once the resource is in an error state**
  (`ResourceValueError`). Every `computed()` over a resource checks `error()` **before**
  `value()`. This bit five existing consumers already.
- **Ids:** courses, chapters, instructors, levels, badges → `CairaUuid` (string).
  Webinars → `number`. Registration `attempt_id` → string.
- **Paths come only from `caira.endpoints.ts`.** Never a string literal; trailing slashes
  are load-bearing.
- **Errors** classify through `cairaError()`. `domain` failures are UI states and never
  toast; `auth` failures drive the refresh queue; only `unexpected` toasts.
- **Request-side validation is not waived** by Decision 1. Validate params before they reach
  a URL.
- **Signal Forms** (`@angular/forms/signals`) for the quiz, assessment and feedback forms —
  never `FormControl`/`FormGroup`. Initial values are `''`/`0`/`[]`, never `null`.
- **Tests are zoneless**: Act → `await fixture.whenStable()` → Assert. Never
  `fixture.detectChanges()`.

### New files

| File                                                                     | Phase |
| ------------------------------------------------------------------------ | ----- |
| `shared/core/models/caira/app-status.model.ts` (+ spec)                  | P-P1  |
| `shared/core/services/app-status/app-status.ts`                          | P-P1  |
| `shared/core/models/caira/levels-page.model.ts` (+ spec)                 | P-P2  |
| `shared/core/models/caira/progress.model.ts`                             | P-P3  |
| `features/offerings/shared/services/chapter-progress/`                   | P-P3  |
| `shared/core/models/caira/assessment.model.ts` (+ spec)                  | P-P4  |
| `features/offerings/shared/services/assessment/`, `.../course-feedback/` | P-P4  |
| `shared/core/models/caira/cpe.model.ts`                                  | P-P5  |
| `shared/core/services/cpe/cpe.ts`                                        | P-P5  |
| `shared/core/models/caira/webinar.model.ts`                              | P-P6  |
| `features/offerings/webinar/shared/services/webinar/`                    | P-P6  |
| `shared/core/models/caira/activity.model.ts`                             | P-P7  |
| `shared/core/services/caira-activity/caira-activity.ts`                  | P-P7  |
| `docs/caira-contracts/03–07*.json`                                       | P-P0  |

Route-scoped services drop into the already-empty `providers: []` arrays at
`features.ts` L21/41/144, `masterclass.ts` L160/171/183/193, `cpe-tracker.routes.ts` L11,
`auth.ts` L105.

---

## 8. Assumptions

1. **Parity means production behaviour, not production code.** Where CAIRA-LMS has a defect
   (§4), miles-masterclass gets the correct behaviour and the divergence is documented.
2. `environment.cairaProgressUrl` in CAIRA-LMS and `BASE_API_URL` in miles-masterclass are
   the same host (`api.milescaira.com`, UAT `uat-api.milescaira.com`). `registerV4/` and
   `milesone-activity` are assumed to live there — **verify in P-P0**.
3. The `updateCairaToken` call to the legacy CPA API is a CAIRA↔CPA session bridge with no
   counterpart in miles-masterclass. **Not ported.**
4. `#17 courseProgress` (GET) is out of parity scope because CAIRA-LMS never calls it. If a
   miles-masterclass surface needs it, that is a beyond-parity addition and gets said so.
5. Podcast and micro-learning stay unbound (G-18, G-19) — CAIRA-LMS has neither.
6. The CPE tracker becomes level-based, matching CAIRA-LMS and the backend. The year
   selector is removed rather than stubbed.
7. `caira-api-binding.md`'s P4/P5 blockers are this plan's P-P3/P-P4 blockers too. P-P0 is
   the only phase that can start today.
8. `#31` (`get_all_badges_V4`) is bound for parity even though `#22` is more correct, with
   the numerator fixed in the mapper. Flag if you'd rather bind `#22` and diverge.

---

## 9. Risks

| #   | Risk                                                                                                                                                                                                                    | Mitigation                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | **Three response shapes still uncaptured** (quiz question, feedback question, `_build_full_course_progress`). Blocks P-P3 and P-P4 — the two largest phases.                                                            | Top schedule risk. P-P0 capture is the critical path; everything else can proceed around it. |
| 2   | ~~Auth path prefix mismatch~~ — **closed** (§2.3). Not a mismatch: CAIRA-LMS is on the mobile OTP twins (#39/#40), which leak the OTP and skip the profile gate. miles-masterclass is already correct and spec-guarded. | Residual: the QR pair resolves against the wrong host. P-P8.                                 |
| 3   | `registerV4/` and `milesone-activity` may be on a different host or a different auth scheme.                                                                                                                            | P-P0 verification. If a separate host, `ApiClient.absoluteUrl()` needs a second base.        |
| 4   | **No runtime response validation** (Decision 1). A backend shape change lands as a component error, not a caught boundary failure.                                                                                      | Accepted trade-off; `unexpected` bucket + `Logger`.                                          |
| 5   | `httpResource` / `resource` are still experimental and the whole read path depends on them.                                                                                                                             | Confined to services and factories; blast radius one layer.                                  |
| 6   | `#11 courseDetail` is **server-cached per user over a global base key** — content edits lag. Looks like a frontend bug to QA.                                                                                           | Document before test starts. Do not build a client-side cache-buster.                        |
| 7   | Async webinar registration's 12×2 s poll can end optimistically-registered while the backend later fails. CAIRA-LMS accepts this.                                                                                       | Reproduce for parity; surface `error_code` when the poll does return `FAILED`.               |
| 8   | Id widening (`number` → `string`) for badges and tracker rows lands inside P-P5 rather than its own commit.                                                                                                             | Larger diff than it looks; call it out in that phase's prompt.                               |
| 9   | QR crypto — **may now be recoverable** from CAIRA-LMS's `caira-qr-crypto.service.ts`.                                                                                                                                   | Read it in P-P8 before declaring the phase blocked.                                          |

---

## 10. Verification

Per phase:

```bash
pnpm lint          # no worse than the master baseline (~55 errors)
pnpm format:fix
pnpm test          # no worse than baseline (~14 failures)
pnpm build:prod    # THE GATE — must be green
```

SSR at every phase boundary:

```bash
pnpm build && pnpm serve:ssr:miles-masterclass-v3
curl -s http://localhost:4000/us/cpa/masterclass | grep -E '<title>|og:|canonical'
```

End-to-end against UAT (`pnpm start`, port **4101**) — the parity checks that matter:

1. Every XHR hits `uat-api.milescaira.com` with `Authorization: Bearer …`, **no `x-*`
   headers**, no CORS preflight block.
2. OTP login succeeds on the path P-P0 confirmed; `PROFILE_INCOMPLETE` opens the profile
   dialog rather than toasting.
3. `web/app-status/` fires once post-login and routes correctly for each of the four verdicts.
4. Masterclass listing renders level tabs and the FAQ accordion from `levels-page`;
   logged-out reload still SSRs with correct meta tags.
5. Course open → `Masterclass_Course_Detail/<uuid>/` fires **once**; locked chapters expose
   no `hls_video_url`.
6. Play 30 s, reload → resumes. Watch past 95 % → quiz unlocks with **no client-side rule**.
7. Re-answer a quiz question → rejected with `Question already answered in this attempt.`
   and **no toast**.
8. Fail the final assessment, re-open → 403 `cool_off_active` renders as a **countdown**.
   _(The single most important proof the error classifier works.)_
9. Pass → submit feedback → `cpe_awarded` / `badge_issued` / `certificate_triggered` drive
   the success state.
10. Register for a webinar → card flips to "Pending" immediately, poll flips it to
    "Registered" within ~24 s, and the drawer and schedule cards both update.
11. Claim a level badge → `credly_accept_url` opens in a new tab with `noopener`; a
    `badges_claim` activity event fires and its failure does **not** surface to the user.
12. Expired token → a **403** with `{"detail":"Signature has expired."}` triggers exactly
    **one** refresh across concurrent requests, and all retry.
13. `/us/cpa/payment/cart` and `/us/cpa/micro-learning` render empty states with **zero**
    failing XHRs.

---

## 11. Recommended order

```
P-P0  ──┬──> P-P1 ──> P-P2                       (unblocked today)
        ├──> P-P5 ──> P-P6 ──> P-P7              (unblocked today)
        └──> [contract capture] ──> P-P3 ──> P-P4  (blocked)
                                                  P-P8 (read the crypto service first)
                                                  P-P9 (last)
```

P-P0 is the only phase that can start immediately and the only one that unblocks the rest.
Everything in the top two branches can proceed in parallel with the capture work.
