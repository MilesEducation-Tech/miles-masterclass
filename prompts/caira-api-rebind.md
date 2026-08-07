# CAIRA API Rebind — Miles Masterclass v3

> Implementation prompt. Written by the agent, reviewed and approved by a human **before** any code is written.
> Scope is large enough that this document is a **programme plan**: each phase below becomes its own `prompts/<phase>.md` before it is built.

---

## Goal

Replace every binding to the sunsetting `api.milesmasterclass.com` Django API with native bindings to the CAIRA API in `Miles-USP-Backend`, keeping the entire existing design and component layer intact, and record every frontend feature that CAIRA cannot serve as an explicit backend gap.

---

## What it read

**miles-masterclass-v3**

- `AGENTS.md`, `docs/api-and-routes.md`, `docs/PARTNER_PLATFORM_API.md`, `prompts/_TEMPLATE.md`
- `src/environments/environment{,.development,.local}.ts`
- `src/app/shared/core/services/api-client/api-client.ts`
- `src/app/shared/core/services/auth/auth.ts`, `src/app/shared/core/services/admin-auth/admin-auth.ts`
- `src/app/shared/core/interceptors/{app,auth,admin-token}/*`
- `src/app/shared/core/models/*.ts` (auth, course, masterclass, assessment, micro-learning-course, http, cpe-tracker, payment, profile, feature, feedback, track, search)
- every `*-facade*.ts` (22 files) and every inline endpoint constant
- `src/app/shared/core/guards/*`, `src/app/admin/shared/guards/*`
- Skills: `tech-stack`, `core-services`, `auth-module`, `routing-and-guards`, `masterclass`, `micro-learning`, `podcast`, `webinar`, `assessments`, `cpe-tracker`, `payment`, `library`, `partner-platform`, `supabase`, `seo`

**Miles-USP-Backend**

- `AGENTS.md`, `USP/urls.py` (all 1,349 lines), `USP/authentication.py`, `USP/settings.py`
- `account/views.py` (`SendOTPView`, `ValidateOTPView`, `RefreshTokenView`, `StatusViewV2`, `UserDeviceView`, `SendOTP`, `validate_otp`, `refresh_token_service`), `account/caira_access_module.py`, `account/qr_login/*`
- `CAIRA_LMS_Masterclass_MilesOne_Web/views.py` + `Miscellaneous/Documentation/{PRD,BRD}_CAIRA_LMS_Masterclass_MilesOne_Web.md` (read in full — 803 lines, the binding contract)
- `caira/{views,models,serializers}.py`, `Masterclass/{views,models,serializers,schemas}.py`, `post/`, `commerce/`, `catalogues/`, `event/`, `notification/`
- Skills: `account-users`, `caira-cpe`, `masterclass-courses`, `post-content`, `commerce-payments`, `event-webinars`, `tech-stack`

---

## Decisions (locked with the product owner before writing this plan)

| #   | Decision                                                                                                                       | Consequence                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Core now + phased gap backlog.**                                                                                             | Learner CPE core is rebound in this programme. Everything CAIRA cannot serve is written up as a backend contract ask in §7, not silently dropped.                                                                                                          |
| 2   | **Bind to `/CAIRA_LMS_Masterclass_MilesOne_Web/*` first; fall back to `/caira/*` only where the web namespace has no mirror.** | Web namespace gets us the public (no-JWT) catalog endpoints SSR needs and the documented `status`/`total_count` envelope.                                                                                                                                  |
| 3   | **Rewrite models to CAIRA shapes — no adapter layer.**                                                                         | `src/app/shared/core/models/*` is rewritten to CAIRA field names (`Masterclass_Course_Name`, `course_status`, UUID ids). Every facade, component and template that reads them changes. This is the largest single cost in the programme and is deliberate. |
| 4   | **Remove every binding to the existing API. No feature flag, no dual-path.**                                                   | Old route constants, old models and old facade methods are deleted, not deprecated. Any surface with no CAIRA counterpart has its route disabled and its entry point hidden — it does not sit on a dead endpoint.                                          |

---

## Assumptions

1. **Base URL.** CAIRA routes are registered at the URLconf **root** — there is no `/api/` prefix. `BASE_API_URL` becomes `https://api.milescaira.com/` (prod) and `https://uat-api.milescaira.com/` (UAT), inferred from `CSRF_TRUSTED_ORIGINS` in `USP/settings.py`. **Confirm both hosts with the backend team in P0 before any code is written** — this is the one value the whole programme hangs on.
2. **The web namespace is the contract of record.** Where `PRD_CAIRA_LMS_Masterclass_MilesOne_Web.md` and `USP/urls.py` disagree, `USP/urls.py` wins (the PRD's §3/§11/§12 are superseded by §13).
3. **CAIRA has no country/profession dimension.** Grep across `caira/`, `Masterclass/`, `CAIRA_LMS_Masterclass_MilesOne_Web/` for `country`/`profession` query params returns zero. The `/:country/:profession_type` URL prefix stays as-is but becomes **cosmetic** — it is not forwarded to any API call. Locale-varying pricing and copy therefore stop being data-driven.
4. **Entitlement replaces subscription.** CAIRA has no plan/subscription model at all. Access is `User.enrolled` tag membership. `has_full_access` (from `caira/mainpageV3/`) and `course_is_locked` (from course detail / unified progress GET) are the two flags the frontend reads.
5. **Assessments are session-less.** CAIRA identifies an attempt by `(user, course, attempt_number)`. There is no session id, no timer, no resumable in-progress attempt. The `:sessionId` route segment has no backend meaning and is removed.
6. **Micro-learning and podcast are not CPE course types in CAIRA.** `caira/reel/` and `caira/podcast/` return page-layout blocks of media files — no chapters, no quiz, no assessment, no per-course CPE. Their course-detail / assessment / feedback routes have no backend and are disabled.
7. Supabase-backed surfaces (admin auth, RBAC, `seo_pages`, leads) and the WordPress blog are **out of scope** — they never touched `BASE_API_URL` and are unaffected.
8. Non-prod OTP: `communication_method: 5` makes SSO return the OTP in the response body instead of dispatching it. Used for UAT/QA only; production must never send `5`.

---

## Part 1 — Target architecture

### 1.1 Transport and envelope

`ApiClient` keeps its shape (`resolveUrl` + the five verbs) but the response contract changes fundamentally. CAIRA does **not** have one envelope — it has five, and `CommonResponse<T>` no longer models any of them:

| Envelope                                                                                         | Where                                                                      | Example                                              |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------- |
| `{ status: true, total_count, ...payload }`                                                      | web LMS catalog endpoints                                                  | `Masterclass_Course_Section`                         |
| `{ status: true, course_details: {...} }`                                                        | web LMS course detail                                                      | `Masterclass_Course_Detail`                          |
| `{ status: "success", data: {...} }`                                                             | most `caira/*` endpoints                                                   | `cpe-progress`, `badges_catalog`, `all_webinars_web` |
| bare serializer dict, no envelope                                                                | `filters`, `instructor/<id>`, `chapter/start`, quiz + assessment endpoints |                                                      |
| DRF page `{ count, next, previous, results }`                                                    | `caira/masterclass/` catalog                                               |                                                      |
| `{ status: "error", message }` **or** `{ status: false, message }` **or** `{ detail }` (DRF 401) | error paths — three different shapes                                       |                                                      |

**Decision:** delete `CommonResponse<T>`. Each route gets its own exact response interface in its domain model file. Add one shared type guard in `http.model.ts`:

```ts
/** CAIRA error bodies come in three shapes; this is the only place that knows all three. */
export function isCairaError(body: unknown): body is CairaErrorBody;
```

`ApiClient` gains no unwrapping logic — unwrapping stays typed and explicit in the facade, matching the AGENTS.md §5 rule that Django envelopes are unwrapped in the facade, not the component.

### 1.2 Interceptors — one blocking finding

`USP/settings.py` sets `CORS_ALLOW_ALL_ORIGINS = True` with `CORS_ALLOW_CREDENTIALS = True`, so **any browser origin can call CAIRA today with no backend change**. But `CORS_ALLOW_HEADERS` is an explicit allowlist:

```python
CORS_ALLOW_HEADERS = ['content-type', 'authorization', 'x-csrftoken', 'x-requested-with',
    'Access-Control-Allow-Origin', 'X_LMS_OPEN_API_KEY', 'X-LMS-OPEN-API-KEY', ...,
    'x_enrollment_form_vendor_token', ..., 'X_VENDOR_TOKEN', 'x_vendor_token', 'skip']
```

`appInterceptor` currently sends **`x-app-type`, `x-platform`, `x-country-code`** on every request. **None of the three is in that list — every preflighted request will fail CORS.** Two options, decided in P0:

- **(a) Drop them frontend-side.** CAIRA reads none of them (no country/profession dimension exists), so they carry no meaning. This is the recommendation.
- **(b) Backend ask** to add the three to `CORS_ALLOW_HEADERS`. Only worth doing if ops wants them for CloudWatch traffic splitting.

Other interceptor changes:

- `Authorization` header: **no change needed.** `USP/authentication.py` does `prefix.lower() != 'bearer'`, so the existing lowercase `bearer <token>` string is accepted.
- `authInterceptor` 401 handling: CAIRA returns DRF's `{"detail": "Signature has expired."}` on 401. The refresh-and-retry logic works unchanged, but the error-toast path must stop assuming a `message` key.
- `adminTokenInterceptor` + `IS_ADMIN_REQUEST`: this exists purely for `reports/*` (Partner Platform), which has no CAIRA counterpart. **Deleted** in P8 along with `partnerMockInterceptor`.

### 1.3 Auth — full rewrite

| Concern    | Today                                                                                                                                   | CAIRA                                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Send OTP   | `POST send-otp-to-phone` `{email}` **or** `{phone, country_code}`                                                                       | `POST login-with-phone-otp` `{phone, country_code, communication_method}`                                                                     |
| Verify OTP | `POST v2/verify-otp/` `{session_id, otp, browser_session_id, utm_url, sms_consent}` → `{data:{token, refreshtoken, expire_time, user}}` | `POST verify-otp` `{session_id, otp}` → SSO payload with token at **`result.token`**, plus `onboarding`, `show_referral_code`, `is_test_user` |
| Refresh    | `POST refresh_token/` `{refresh_token}`                                                                                                 | `POST refresh` `{refresh_token}` (Django proxies SSO `/auth/refresh`)                                                                         |
| Whoami     | `GET v2/user/myprofile/` → `{data: User}`                                                                                               | `GET v2/status` → SSO identity (`sso_*`) merged with local MilesOne fields (`mo_*`)                                                           |
| Plan       | `GET v2/user/active-plan/` → `CurrentPlanData`                                                                                          | **does not exist** → replaced by entitlement (§1.4)                                                                                           |
| Device     | —                                                                                                                                       | `POST register-device/` `{device_id, device_type, ...}` — optional, enables push targeting                                                    |

Consequences to build for:

- **Email login is gone.** CAIRA's login flow is phone + country code only. `otp/generate` / `otp/validate` exist but are _post-login email verification_, not a login path. → **GAP-01.**
- `browser_session_id`, `utm_url`, `sms_consent` have no CAIRA counterpart — removed from the request and from `AuthModel`/`OtpModel`.
- `User` is rewritten from scratch against `StatusViewV2`'s response. `is_existing_user` is replaced by `onboarding` (bool); `isExistingUserGuard` rebinds to it.
- Token storage, cookie strategy, SSR `TransferState` hydration and the `authInterceptor` refresh queue are **kept as-is** — they are transport-agnostic and correct.
- **No throttling exists on CAIRA's OTP/login/refresh endpoints** (no `DEFAULT_THROTTLE_*`, zero `throttle_classes` in the repo). Frontend adds a client-side resend cooldown as it does today, and this is raised to backend as **GAP-13**.

### 1.4 Entitlement replaces `activePlanGuard`

```python
# account/caira_access_module.py — the single source of truth
enrolled_set = normalize_enrolled_set(user)              # frozenset of upper-cased User.enrolled tags
# Masterclass/views.py:855
data["course_is_locked"] = not any("CAIRA" in item for item in enrolled_set)
# caira/views.py — CAIRAMainPageViewV3
has_full_access = bool(enrolled_set & {"CPA", "CMA", "CAIRA"})
```

- `CurrentPlanData`, `isPlanActive()`, `fetchCurrentPlan()` and `activePlanGuard` are **deleted**.
- New `Auth.hasFullAccess` signal, sourced from `caira/mainpageV3/` `has_full_access`, mirrored to a cookie under the existing `environment.AUTH.activePlan` key so SSR/hard-refresh answers synchronously — same mechanism, new meaning.
- New `cairaAccessGuard` replaces `activePlanGuard` on `/cpe-tracker` and any gated offering route. On denial it must **not** redirect to `/payment/plan` (that route is being disabled) — it redirects to the CAIRA landing page with an "access via your Miles enrolment" message.
- Per-course gating additionally reads `course_is_locked` from course detail and from the unified-progress **GET** response. **It is absent from the update/POST response** — do not read it there.

### 1.5 Identifier and route changes

| Change                                                  | Impact                                                                                                                                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Course / chapter / instructor ids: numeric → **UUID**   | Route params still work (`:courseId` accepts a UUID). Every model field, cache key, `trackBy` and analytics payload changes type.                                                |
| Webinar ids stay **integer** (`webinars_web/<int:id>/`) | Mixed id types across domains — type them separately, do not unify.                                                                                                              |
| `:sessionId` in final-assessment routes                 | **No backend counterpart.** Segment removed from `/masterclass/:courseId/:courseTitle/final-assessment/exam` and `/report`. Legacy redirects added in `src/legacy-redirects.ts`. |
| `nano_learning` vs `micro-learning` token split         | Moot — neither token exists in CAIRA.                                                                                                                                            |

### 1.6 SSR / SEO impact

- `Top_Section/` and `Masterclass_Course_Section/` are **public / JWT-optional** → the masterclass listing page stays server-renderable and crawlable. Good.
- `Masterclass_Course_Detail/<uuid>/` is **JWT-required** → **course detail pages can no longer be server-rendered for anonymous crawlers.** `app.routes.server.ts` must move that route off prerender/SSR to client render, and the `seo` skill's leaf-owned SEO for course pages degrades to the Supabase `seo_pages` row only. This is a real SEO regression and is raised as **GAP-14**.
- Web LMS course detail is cached server-side (`mc_web:course:` 600 s global, `mc_web:course_user:` 30 s per-user). Admin content edits will lag up to 10 minutes — surface this to content ops, do not build a client-side cache-buster.

---

## Part 2 — Endpoint map

Legend: **✅ direct** — CAIRA endpoint exists and covers it · **⚠️ reshape** — exists but the contract differs enough to change UI behaviour · **❌ gap** — no counterpart, see §7.

### 2.1 Auth — `auth.model.ts`, `auth.ts`, `auth-facade.ts`

| Old                                               | New                         |                                                            |
| ------------------------------------------------- | --------------------------- | ---------------------------------------------------------- |
| `POST send-otp-to-phone`                          | `POST login-with-phone-otp` | ⚠️ phone only, no email                                    |
| `POST v2/verify-otp/`                             | `POST verify-otp`           | ⚠️ token moves to `result.token`; 3 request fields dropped |
| `POST refresh_token/`                             | `POST refresh`              | ✅                                                         |
| `GET v2/user/myprofile/`                          | `GET v2/status`             | ⚠️ `sso_*` / `mo_*` prefixed response                      |
| `GET v2/user/active-plan/`                        | —                           | ❌ **GAP-02** → entitlement (§1.4)                         |
| `POST v2/faculty/register/`, `v2/faculty/verify/` | —                           | ❌ **GAP-03**                                              |

### 2.2 Masterclass — `masterclass.model.ts`, `masterclass-facade.ts`, `chapter-facade.ts`

| Old                                                | New                                                                  |                                                                                                                                                            |
| -------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET v2/:course_type/details/?id=`                 | `GET CAIRA_LMS.../Masterclass_Course_Detail/<uuid>/`                 | ⚠️ `{status, course_details:{...}}`; entirely different field names; chapters are **nested inside** the detail response                                    |
| `GET v2/chapters/?id=&course_type=`                | — (folded into course detail `chapters[]`)                           | ⚠️ one fewer request                                                                                                                                       |
| `POST v2/user/myclassactivity/`                    | `POST CAIRA_LMS.../caira/masterclass/course-progress/<uuid>/update/` | ⚠️ body `{chapter_id, last_watched_position_seconds, max_watched_duration_seconds}`; `last <= max` enforced (400 otherwise); server auto-completes at 95 % |
| —                                                  | `POST CAIRA_LMS.../caira/masterclass/chapter/<uuid>/start/`          | ✅ new: must be called on chapter open; returns lock state + `reset_required`                                                                              |
| `POST user/customaction/set_cpe_mode/`             | —                                                                    | ❌ **GAP-04** — CPE-vs-Preview mode does not exist; seek/lock is server-driven via `is_video_seekable` / `is_locked`                                       |
| `POST v2/user/toggle-bookmark/`                    | `POST CAIRA_LMS.../caira/masterclass/<uuid>/bookmark/`               | ⚠️ no body, toggles on path param                                                                                                                          |
| `GET v2/course-content/?...` (transcript/glossary) | course detail `chapters[].transcript_text`, `glossary_file_url`      | ✅ folded in                                                                                                                                               |
| `GET v2/dashboard/:id/additional-resources/`       | course detail `exercise_file_url[]`                                  | ⚠️                                                                                                                                                         |
| `GET exercise-files/:id/download/`                 | direct URL from `exercise_file_url[].url`                            | ⚠️ no auth'd blob endpoint                                                                                                                                 |
| `POST v2/user/cart/` (add to cart)                 | —                                                                    | ❌ **GAP-05**                                                                                                                                              |
| `GET user-badges/:id/claim/`                       | `POST caira/level_based_badge_clicked/` `{credly_accept_url}`        | ⚠️                                                                                                                                                         |

### 2.3 Assessments — `assessment.model.ts`, `final-assessment-facade.ts`, `feedback-facade.ts`

| Old                                           | New                                                                                                      |                                                                                                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET chapter-quiz?chapter_id=`                | `GET CAIRA_LMS.../caira/masterclass/quiz/<chapter_uuid>/questions/`                                      | ⚠️ resumable partial attempts; answered items carry feedback inline                                                                              |
| `POST user-quiz-details/`                     | `POST .../quiz/<chapter_uuid>/submit/` `{question_id, selected_option_ids[]}`                            | ⚠️ **one question per call**, immediate per-question feedback                                                                                    |
| `GET masterclass/report_summary/?chapter_id=` | folded into the submit response (`answers_submitted`, `score_percent`)                                   | ⚠️                                                                                                                                               |
| `POST user-assessment/start_assessment/`      | —                                                                                                        | ❌ no session concept; call `assessment/questions/` directly                                                                                     |
| `GET final-assessment/?...&session_id=`       | `GET .../<course_uuid>/assessment/questions/`                                                            | ⚠️ returns `pass_threshold_percent`, `exam_rules`, `previous_attempts`; 403 `cool_off_active` with `cool_off_minutes_remaining` must be handled  |
| `POST user-assessment/`                       | `POST .../assessment/submit/` `{answers:[{question_id, selected_option_ids[]}]}`                         | ⚠️ bulk, count must equal `questions_to_show`, no duplicate ids                                                                                  |
| `POST user-assessment/assessment_report/`     | `GET .../assessment/result/`                                                                             | ⚠️                                                                                                                                               |
| `GET feedback-category/`                      | `GET .../<course_uuid>/feedback/questions/`                                                              | ⚠️                                                                                                                                               |
| `POST user-feedback/submit_feedback/`         | `POST .../feedback/submit/` `{responses:[{question_id, rating, text_response}], optional_feedback_text}` | ⚠️ response `{feedback_submitted, cpe_awarded, badge_issued, certificate_triggered}` — feedback is the trigger for the whole credential pipeline |
| `GET user-feedback/?master_class__id=`        | course detail `feedback_submitted` / `feedback_average`                                                  | ⚠️                                                                                                                                               |

### 2.4 CPE tracker, badges, certificates — `cpe-tracker.model.ts`, `cpe-tracker-facade.ts`, `badge-facade.ts`

| Old                                               | New                                                                                                                                  |                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `GET usercredits/statistics/?year=`               | `GET caira/get_badges_tracker_web/` (`totals`)                                                                                       | ⚠️ **no year dimension** — CAIRA aggregates by CAIRA level, not by calendar year → **GAP-06** |
| `GET usercredits/?year=&status=`                  | `GET caira/get_badges_tracker_web/` + `GET caira/cpe-progress/?level=<uuid>`                                                         | ⚠️ report table restructures from year-rows to level-groups                                   |
| `GET user-badges/`                                | `GET caira/badges_catalog/` (+ `?section=level\|webinar\|masterclass`)                                                               | ⚠️ richer: `state` enum + `cta` object per badge                                              |
| —                                                 | `GET CAIRA_LMS.../caira/levels_progress/`                                                                                            | ✅ new: per-level Credly card, array rotated so the active level is first                     |
| `POST user-assessment/download_certificate/`      | certificate URLs embedded per-context (`masterclass_certificate_url`, `webinar_certificate_url`, `credly_pdf_certificate_for_level`) | ⚠️ no download endpoint — render a link, drop jsPDF for these                                 |
| `POST user-assessment/download_bulk_certificate/` | —                                                                                                                                    | ❌ **GAP-07**                                                                                 |
| `GET download_nasba_template`                     | —                                                                                                                                    | ❌ **GAP-08**                                                                                 |
| —                                                 | `GET caira/get_alumni_badges/`, `POST caira/claim_alumni_badge/` `{badge_id}`                                                        | ✅ new surface worth adding                                                                   |

### 2.5 Library and discovery — `course-facade.ts`, `instructor-facade.ts`, `feature-facade.ts`, `global-search.ts`

| Old                                                                                | New                                                                                                                                    |                                                                                                               |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `GET v2/library-filters/`, `v2/filters/`                                           | `GET caira/masterclass/filters/`                                                                                                       | ⚠️ bare dict, CAIRA field names, adds `tools`/`skills`/`tags`                                                 |
| `GET v2/library/?...`                                                              | `GET caira/masterclass/?level=&track=&topic=&field_of_study=&instructor=&tag=&skill=&tool=&cpe_credit=&page=&page_size=`               | ⚠️ DRF page envelope; filters are **UUID exact-match only**, no text query                                    |
| `GET badge-categories/`, `course-badges/`                                          | `GET caira/badges_catalog/`                                                                                                            | ⚠️                                                                                                            |
| `GET instructor/` (list)                                                           | —                                                                                                                                      | ❌ **GAP-09** — detail-only (`caira/masterclass/instructor/<uuid>/`); instructor library page cannot be built |
| `GET instructor/:id/`, `instructor/:id/courses/`                                   | `GET CAIRA_LMS.../caira/masterclass/instructor/<uuid>/`                                                                                | ⚠️ courses come from course detail's `instructor_related_courses`                                             |
| `GET v2/dashboard/suggestion/?search_key=`                                         | —                                                                                                                                      | ❌ **GAP-10** — no search endpoint exists anywhere in the backend                                             |
| `GET tracks/`, `v2/tracks/:id/courses/`                                            | `caira/masterclass/home/` `tracks[]`                                                                                                   | ⚠️ read-only rail, no dedicated track page data                                                               |
| `GET v2/dashboard/?filter=…` (5 rails)                                             | `GET CAIRA_LMS.../Top_Section/` + `Masterclass_Course_Section/`                                                                        | ⚠️ two endpoints replace five filter variants                                                                 |
| `GET v2/user/recently_viewed/`, `last_viewed/`, `completed_classes/`, `bookmarks/` | `GET caira/masterclass/home/` (`continue_watching`, `bookmarks`, `completed`, `coming_soon`) + `Completed_Masterclass_Course_Section/` | ⚠️ `last_viewed` (footer continue card) has no equivalent                                                     |
| `GET recommendation/`, `user/because_you_watched/`, `complimentary-course/`        | —                                                                                                                                      | ❌ **GAP-11** — no recommendation engine                                                                      |
| `GET v2/dashboard/related_content/`                                                | course detail `related_courses[]`                                                                                                      | ✅                                                                                                            |

### 2.6 Webinars — `webinar-facade.ts`, `webinar-registration-form.ts`

| Old                                                        | New                                                                           |                                                                                                                             |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `GET webinar/filter/`, `?type=futured`                     | `GET CAIRA_LMS.../caira/all_webinars_web/` → `{upcoming, expired, completed}` | ⚠️ one call, three buckets                                                                                                  |
| `GET webinar/details/?id=`                                 | `GET CAIRA_LMS.../caira/webinars_web/<int:id>/`                               | ⚠️ **integer** id                                                                                                           |
| `GET webinar/enrollments/?type=`                           | per-card `is_registered` + `registration{}`                                   | ⚠️                                                                                                                          |
| `POST enrollment/register/`, `POST webinar/registrations/` | `POST registerV4/` + poll `GET registerV4/<uuid:attempt_id>/status/`          | ⚠️ **fire-and-forget + polling** — the UI must add a pending state; a synchronous success/failure response no longer exists |
| `POST webinar/registrations/verify-otp/`                   | —                                                                             | ❌ **GAP-12** — guest webinar registration with OTP is gone; registration now requires a logged-in user                     |

### 2.7 Micro-learning, podcast, home/landing, profile, misc

| Old                                                                                                           | New                                                                                                                                      |                                                                                     |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `GET v2/nano-learning/?cursor=`, `v2/nano-learning/:id`                                                       | `GET caira/reel/?page_name=` — page-layout blocks of `media_files`, **no chapters/quiz/assessment/per-course CPE, no cursor pagination** | ❌ **GAP-15** — micro-learning as a CPE course type does not exist                  |
| podcast course detail / chapter / assessment                                                                  | `GET caira/podcast/?page_name=` — same block/media shape                                                                                 | ❌ **GAP-16**                                                                       |
| `PATCH user/profile/update/`                                                                                  | `POST v2/update`                                                                                                                         | ⚠️                                                                                  |
| `GET user/companies/`, `user/professional-course/`, `professions/`, `user/state-boards/`, `user/job-sectors/` | —                                                                                                                                        | ❌ **GAP-17** — all five profile dropdowns                                          |
| `GET v2/locations/autocomplete/?search=`                                                                      | `GET account/city-autocomplete/`                                                                                                         | ⚠️ city only                                                                        |
| `POST apply-partner-code/`, `promotion/subscription/firm-sponsorship/`                                        | —                                                                                                                                        | ❌ **GAP-18**                                                                       |
| `POST utm/track_utm/`                                                                                         | —                                                                                                                                        | ❌ **GAP-19** — drop UTM attribution or move it to GA4 only                         |
| all 20 `PAYMENT_ROUTES` (cart, coupons, addresses, checkout, orders, plans, Stripe)                           | `checkouts/*` + `catalogues/*` exist but model **one-time product purchase**, not subscriptions/plans/coupon-on-plan                     | ❌ **GAP-20** — not a rebind, a re-architecture                                     |
| all 22 `reports/*` Partner Platform endpoints                                                                 | —                                                                                                                                        | ❌ **GAP-21** — zero `partner-admin` / network / sub-company concept in the backend |

---

## Part 3 — Feature coverage verdict

| Frontend surface                                                        | Verdict                                                                 |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Auth (phone OTP), profile read                                          | **Rebind**                                                              |
| Masterclass listing, detail, chapter player, progress, bookmark         | **Rebind**                                                              |
| Chapter quiz, final assessment, feedback                                | **Rebind** (behaviour changes: per-question quiz, cool-off, no session) |
| CPE tracker, Credly badges, per-context certificates                    | **Rebind** (year dimension lost)                                        |
| Webinars (list, detail, registration)                                   | **Rebind** (registration becomes async+polling)                         |
| Course library with filters                                             | **Rebind** (UUID filters only)                                          |
| Home rails                                                              | **Partial rebind** — 4 of 12 rails have no source                       |
| Instructor library, global search, recommendations                      | **Disable** — no backend                                                |
| Micro-learning, podcast (as CPE courses)                                | **Disable** — content-listing only                                      |
| Payment / cart / plans / orders                                         | **Disable** — no subscription model                                     |
| Partner Platform (`reports/*`)                                          | **Disable** — no backend at all                                         |
| Faculty registration, guest webinar OTP, firm sponsorship, partner code | **Disable**                                                             |
| Admin SEO console, leads, RBAC, admin auth (Supabase)                   | **Untouched**                                                           |
| Blog (WordPress)                                                        | **Untouched**                                                           |

"Disable" means: route removed from the router or guarded to a 404, nav entry hidden, facade + model + route constants deleted, and a `docs/CAIRA_GAPS.md` entry linking to the §7 backend ask. It never means leaving a component pointed at a dead URL.

---

## Part 4 — Phases

Each phase ships to `master` on its own and is written up as its own `prompts/*.md` before implementation. `pnpm build:prod` must stay green at every phase boundary.

### P0 — Contract freeze (no app code)

1. Confirm prod + UAT CAIRA hosts with backend. Confirm whether `/api/` prefix will ever be added.
2. Resolve the **CORS header blocker** (§1.2): drop `x-app-type`/`x-platform`/`x-country-code`, or get them added to `CORS_ALLOW_HEADERS`.
3. Run every endpoint in Part 2 against UAT with a real SSO token; capture the actual JSON into `docs/caira-contracts/*.json`. The PRD is accurate but is not a substitute for a live capture — several endpoints are documented only by code.
4. Write `docs/CAIRA_GAPS.md` from §7 and get product sign-off on the disable list in Part 3.
5. Confirm the SSR/SEO regression (§1.6) is accepted, or escalate GAP-14.

**Exit:** signed contract capture + a decision on every ❌ in Part 2.

### P1 — Core plumbing

`environment*.ts` (new base URLs, drop dead keys) · `http.model.ts` (delete `CommonResponse`, add `isCairaError` + the five envelope types) · `app-interceptor.ts` (drop the three headers) · `auth-interceptor.ts` (handle `{detail}` 401 body) · `api-client.ts` (unchanged if possible — verify).

### P2 — Auth rewrite

`auth.model.ts` rewritten against `login-with-phone-otp` / `verify-otp` / `refresh` / `v2/status` · `auth.ts` · `auth-facade.ts` · login/signup pages lose the email path · `isExistingUserGuard` rebinds to `onboarding` · `forget-password` route removed (OTP-only auth has no password).

### P3 — Entitlement

Delete `CurrentPlanData` / `fetchCurrentPlan` / `isPlanActive` / `activePlanGuard`. Add `Auth.hasFullAccess` + `cairaAccessGuard`. Rewire every route that used `activePlanGuard`. Redirect target moves off `/payment/plan`.

### P4 — Masterclass domain

`course.model.ts` + `masterclass.model.ts` rewritten to CAIRA shapes · `masterclass-facade.ts`, `chapter-facade.ts` · course listing, course detail, chapter player · progress heartbeat swapped to the unified update contract (mind `last <= max`) · `chapter/start/` called on chapter open · `reset_required` (365-day enrolment expiry) handled with a dialog · sequential lock + `is_video_seekable` driven from the server, replacing local CPE-mode logic.

### P5 — Assessments

`assessment.model.ts` rewritten · `final-assessment-facade.ts`, `feedback-facade.ts` · quiz becomes per-question submit-and-reveal · exam loses the session id and gains cool-off handling · feedback submit surfaces `cpe_awarded` / `badge_issued` / `certificate_triggered` in the success state · `:sessionId` removed from routes + legacy redirects.

### P6 — CPE tracker, badges, certificates

`cpe-tracker.model.ts` rewritten from year-rows to level-groups · `cpe-tracker-facade.ts`, `badge-facade.ts` · badge cards driven by the `state` enum + `cta` object · certificate links rendered from embedded URLs · NASBA + bulk-certificate buttons removed · alumni badge claim added.

### P7 — Webinars, home, library

`webinar-facade.ts` against `all_webinars_web/` + `webinars_web/<int:id>/` · registration becomes submit → poll `registerV4/<attempt_id>/status/` with a pending UI state · `feature-facade.ts` reduced to the rails that have a source · `course-facade.ts` + filters against the catalog endpoint.

### P8 — Decommission

Delete: `payment.model.ts` + `payment-facade.ts` + payment routes/components · all `reports/*` facades + `partner-mock-interceptor.ts` + `adminTokenInterceptor` + `IS_ADMIN_REQUEST` · `micro-learning-course.model.ts` + micro-learning/podcast course routes · `instructor-facade.ts` (library) · `global-search.ts` · `utm.ts` · `track.model.ts` · `search.model.ts` · `nano-learning.model.ts` (already an empty file) · faculty pages · firm-sponsorship + partner-code services. Add legacy redirects, hide nav entries, update `app.routes.server.ts` render modes, rewrite `docs/api-and-routes.md`.

### P9 — Gap backlog

Turn §7 into backend tickets in `Miles-USP-Backend/prompts/` following its own AGENTS.md workflow.

---

## Part 5 — Files that will change

Abbreviated; each phase's own prompt carries the exact list.

| Area             | Create                                              | Modify                                                                                                                                                             | Delete                                                                                                                                 |
| ---------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Config           | `docs/caira-contracts/*.json`, `docs/CAIRA_GAPS.md` | `src/environments/*.ts`                                                                                                                                            | —                                                                                                                                      |
| Core HTTP        | —                                                   | `shared/core/models/http.model.ts`, `interceptors/app/*`, `interceptors/auth/*`                                                                                    | `interceptors/admin-token/*`                                                                                                           |
| Auth             | `shared/core/guards/caira-access/*`                 | `models/auth.model.ts`, `services/auth/auth.ts`, `auth/shared/services/auth-facade.ts`, login/signup pages, `is-existing-user.guard.ts`                            | `guards/active-plan/*`, `auth/shared/pages/forget-password/*`                                                                          |
| Masterclass      | —                                                   | `models/{course,masterclass}.model.ts`, `masterclass-facade.ts`, `chapter-facade.ts`, course/chapter components + templates                                        | —                                                                                                                                      |
| Assessment       | —                                                   | `models/assessment.model.ts`, `models/feedback-model.ts`, `final-assessment-facade.ts`, `feedback-facade.ts`, exam/report/quiz components, `masterclass.ts` routes | —                                                                                                                                      |
| CPE / badges     | —                                                   | `models/cpe-tracker.model.ts`, `cpe-tracker-facade.ts`, `badge-facade.ts`, tracker + badge components                                                              | —                                                                                                                                      |
| Webinar          | —                                                   | `webinar-facade.ts`, webinar list/detail/registration components                                                                                                   | `webinar-registration-form` OTP path                                                                                                   |
| Home / library   | —                                                   | `feature-facade.ts`, `course-facade.ts`, `section-filters-facade.ts`, home rails                                                                                   | `instructor-facade.ts`, `global-search.ts`, `utm.ts`, `models/{track,search,micro-learning-course,nano-learning}*.ts`                  |
| Payment          | —                                                   | `features.ts` (route removal)                                                                                                                                      | `features/payment/**`, `models/payment.model.ts`                                                                                       |
| Partner Platform | —                                                   | `admin/admin.routes.ts`                                                                                                                                            | `admin/partner-platform/**`, `admin/users/**` partner facades, `partner-mock-interceptor.ts`, `docs/PARTNER_PLATFORM_API.md` (archive) |
| Routing / SSR    | —                                                   | `app.routes.server.ts`, `src/legacy-redirects.ts`, `src/seo.ts` (drops the `webinar/filter/` prerender call), `docs/api-and-routes.md`                             | —                                                                                                                                      |

---

## Security requirements

- No new secret reaches the browser. CAIRA is Bearer-token only; the SSO signing key, `X-LMS-OPEN-API-KEY` and every `devops_api/*` route stay server-side. **The `caira/*_lms` endpoints must never be called from this app** — they authenticate with a shared API key, and shipping that key to a browser would expose an unauthenticated read of all CAIRA content.
- Tokens continue to flow through interceptors only. No hand-attached `Authorization` header anywhere.
- The two Supabase clients stay split (AGENTS.md §7) — this programme does not touch them.
- `communication_method: 5` (OTP returned in the response body) must be impossible in the production build. Gate it on `!environment.production` and assert it in a unit test.
- `ALLOWED_HOSTS = ['*']`, `CORS_ALLOW_ALL_ORIGINS = True`, `DEBUG = True` (hardcoded, not env-gated) and **no throttling on OTP/login/refresh** are all live in `USP/settings.py`. None is a frontend defect, all four are raised to the backend team before a public web client points at this API — see GAP-13.
- PII stays out of URLs and query strings — CAIRA's own rule, and the frontend must not violate it when building filter query strings.

---

## Part 7 — Gap register (backend asks)

| #      | Gap                                                                                   | Severity     | Proposed ask                                                                                                |
| ------ | ------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------- |
| GAP-01 | Email-based OTP login                                                                 | High         | Extend `login-with-phone-otp` / add `login-with-email-otp`                                                  |
| GAP-02 | Subscription / plan status                                                            | High         | Either accept entitlement-only, or add a plan endpoint                                                      |
| GAP-03 | Faculty self-registration                                                             | Low          | New endpoint or drop the feature                                                                            |
| GAP-04 | CPE vs Preview playback mode                                                          | Medium       | Confirm server-driven lock is the replacement                                                               |
| GAP-05 | Add-to-cart from a course page                                                        | High         | Depends on GAP-20                                                                                           |
| GAP-06 | CPE credits by calendar year                                                          | High         | Add a year dimension to `get_badges_tracker_web` — compliance reporting is year-based, CAIRA is level-based |
| GAP-07 | Bulk certificate download                                                             | Medium       | New endpoint returning a zip or a URL list                                                                  |
| GAP-08 | NASBA CSV template                                                                    | Medium       | New endpoint                                                                                                |
| GAP-09 | Instructor list                                                                       | Medium       | `GET caira/masterclass/instructors/`                                                                        |
| GAP-10 | Text search / suggestions                                                             | High         | No search exists anywhere in the backend                                                                    |
| GAP-11 | Recommendations, because-you-watched, complimentary                                   | Medium       | No recommendation engine exists                                                                             |
| GAP-12 | Guest webinar registration with OTP                                                   | Medium       | Registration now requires auth                                                                              |
| GAP-13 | No throttling on OTP/login/refresh; `DEBUG = True` hardcoded                          | **Critical** | Backend security review before a public web client points at this API                                       |
| GAP-14 | Course detail requires JWT → not crawlable                                            | High         | Add a public course-detail endpoint (like `Masterclass_Course_Section`) for SEO                             |
| GAP-15 | Micro-learning as a CPE course type                                                   | High         | Reels have no chapters/quiz/assessment/CPE                                                                  |
| GAP-16 | Podcast as a CPE course type                                                          | High         | Same                                                                                                        |
| GAP-17 | Profile dropdowns (company, profession, state board, job sector, professional course) | High         | Five reference-data endpoints                                                                               |
| GAP-18 | Partner code redemption, firm sponsorship                                             | Medium       |                                                                                                             |
| GAP-19 | UTM attribution                                                                       | Low          | Or move to GA4 only                                                                                         |
| GAP-20 | Subscriptions, cart, coupons, plans, orders, invoices                                 | **Critical** | `commerce/` models one-time product purchase — this is a re-architecture, not a rebind                      |
| GAP-21 | Partner Platform (networks, firms, sub-companies, partner-admin RBAC, coupon tracker) | **Critical** | Zero backend counterpart                                                                                    |
| GAP-22 | Country / profession scoping of content, pricing and copy                             | High         | No country or profession dimension anywhere in the backend                                                  |

---

## Acceptance criteria

- [ ] `grep -rn "milesmasterclass.com/api" src/` returns nothing.
- [ ] No source file references any endpoint from the old API. `docs/api-and-routes.md` lists only CAIRA, WordPress and Supabase paths.
- [ ] Every remaining route either resolves against a live CAIRA endpoint or is removed from the router.
- [ ] `CommonResponse`, `CurrentPlanData`, `activePlanGuard`, `IS_ADMIN_REQUEST`, `adminTokenInterceptor`, `partnerMockInterceptor` no longer exist.
- [ ] `pnpm build:prod` is green and the initial bundle is at or below its current size (the programme deletes more than it adds).
- [ ] `pnpm lint` / `pnpm test` are no worse than the `master` baseline.
- [ ] A logged-in user can: log in by phone OTP → browse masterclasses → open a course → play a chapter with progress persisting across reload → pass a chapter quiz → pass the final assessment → submit feedback → see CPE credit, the Credly badge and the certificate link appear.
- [ ] A logged-out user can load `/us/cpa/masterclass` server-rendered with correct meta tags.
- [ ] `docs/CAIRA_GAPS.md` exists and every ❌ in Part 2 maps to a numbered gap.
- [ ] No production build path can send `communication_method: 5`.

---

## Checks to run

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm format:fix
pnpm test
pnpm build:prod
pnpm build && pnpm serve:ssr:miles-masterclass-v3
curl -s http://localhost:4000/us/cpa/masterclass | grep -E '<title>|og:|twitter:|canonical'
```

Routes, SSR render modes and SEO all change, so the SSR run is mandatory at every phase boundary — not optional.

---

## How to verify it

1. `pnpm start` (port **4100**).
2. `http://localhost:4100/us/cpa` → redirects to `/us/cpa/home` while logged out.
3. Log in with a UAT phone number. In UAT the OTP is returned in the `login-with-phone-otp` response body (`communication_method: 5`); read it from the network tab.
4. DevTools → Network: confirm every XHR goes to the CAIRA host, carries `Authorization: bearer …`, and that **no request is blocked by CORS preflight**.
5. `/us/cpa/masterclass` → cards render from `Masterclass_Course_Section/`; a logged-out reload still renders them server-side.
6. Open a course → `Masterclass_Course_Detail/<uuid>/` fires once; chapters render from the nested `chapters[]`; locked chapters show no `hls_video_url`.
7. Play a chapter 30 s, reload → the player resumes at the same position (`course-progress/<uuid>/update/` then GET).
8. Watch past 95 % → the quiz unlocks without a client-side rule (`show_quiz` flips server-side).
9. Answer a quiz question → feedback reveals immediately; a second answer to the same question is rejected.
10. Complete all chapters → final assessment unlocks. Fail it → the response carries the retry message; re-open immediately → a 403 with `cool_off_minutes_remaining` renders as a countdown, not an error toast.
11. Pass it → submit feedback → the response's `cpe_awarded` / `badge_issued` / `certificate_triggered` drive the success state.
12. `/us/cpa/cpe-tracker` → credits and badges render from `get_badges_tracker_web/`; the certificate link opens the S3 PDF.
13. Log out, hit `/us/cpa/payment/cart`, `/us/cpa/library/instructor-library`, `/us/cpa/micro-learning` → each 404s or redirects; none issues a failing XHR.
14. `pnpm build && pnpm serve:ssr:...` → load `/us/cpa/masterclass` and confirm no `window`/`document` leak and no `Cannot read properties of undefined` from the reshaped models.

---

## Risks

1. **Model rewrite blast radius.** Decision 3 means every component and template reading a course, chapter, assessment or badge changes. This is the dominant cost. Mitigation: phase order is deliberately dependency-first (`http` → `auth` → `course` → everything else) so a broken model shape surfaces in P1/P2, not in P7.
2. **No dual-path rollback.** Decision 4 means each phase's merge is one-way. Mitigation: `build:prod` green at every phase boundary, phases merged individually, and every phase's verification steps run on UAT before merge.
3. **CORS preflight (§1.2) will fail on day one** unless P0 resolves it. This is the single most likely cause of "nothing works" at the start.
4. **The critical gaps (GAP-20, GAP-21, GAP-13) are not frontend work.** If payment or the Partner Platform must stay live, this programme cannot fully remove the old API and Decision 4 has to be revisited before P8.
5. **Server-side caching** (600 s / 30 s on web course detail) will look like a bug to QA. Document it before test starts.
