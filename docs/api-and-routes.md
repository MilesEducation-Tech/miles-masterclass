# API Endpoints & Frontend Routes

A reference of every backend API path the app calls and every Angular router path it serves.

- **Backend API base URL:** `https://api.milesmasterclass.com/api/` (`BASE_API_URL` in `src/environments/environment.ts`)
- `:param` / `${...}` segments are placeholders filled at call/runtime.
- Typed API routes are defined as `RouteConfig` objects in `src/app/shared/core/models/*.model.ts`; inline paths live directly in their services.

---

## Part 1 — Backend API Paths

### Auth — `src/app/shared/core/models/auth.model.ts`

| Method | Path                   |
| ------ | ---------------------- |
| POST   | `send-otp-to-phone`    |
| POST   | `v2/verify-otp/`       |
| GET    | `v2/user/myprofile/`   |
| POST   | `refresh_token/`       |
| GET    | `v2/user/active-plan/` |

### Profile — `src/app/shared/core/models/profile.model.ts`

| Method | Path                                       |
| ------ | ------------------------------------------ |
| GET    | `user/companies/`                          |
| GET    | `user/professional-course/`                |
| GET    | `professions/`                             |
| GET    | `user/state-boards/`                       |
| GET    | `user/job-sectors/`                        |
| PATCH  | `user/profile/update/`                     |
| POST   | `apply-partner-code/`                      |
| POST   | `promotion/subscription/firm-sponsorship/` |

### Payment — `src/app/shared/core/models/payment.model.ts`

| Method | Path                                 |
| ------ | ------------------------------------ |
| GET    | `user/cart/mybucket/`                |
| POST   | `user/cart/`                         |
| POST   | `user/cart/remove_item/`             |
| GET    | `promotion/coupons/`                 |
| POST   | `promotion/coupons/apply_coupon/`    |
| POST   | `promotion/coupons/remove_coupon/`   |
| GET    | `user/address/`                      |
| POST   | `user/address/`                      |
| PUT    | `user/address/:id/`                  |
| DELETE | `user/address/:id/`                  |
| POST   | `user/order/proceed_checkout/`       |
| GET    | `user/order/order_details/`          |
| GET    | `user/order/my_orders/`              |
| POST   | `promotion/subscription/reactivate/` |
| POST   | `promotion/subscription/cancel/`     |
| POST   | `stripe/force-subscription/`         |
| POST   | `user/order/create_customer_portal/` |
| GET    | `lms/check-and-subscribe/`           |
| GET    | `promotion/subscription/`            |

### Feature / Dashboard — `src/app/shared/core/models/feature.model.ts`

| Method | Path                         | Notes                                                                                   |
| ------ | ---------------------------- | --------------------------------------------------------------------------------------- |
| GET    | `v2/dashboard/`              | active_plan, popular, highlight, latest, newlyAdded (same path, different query params) |
| GET    | `instructor/`                |                                                                                         |
| GET    | `v2/user/recently_viewed/`   | inprogress                                                                              |
| GET    | `v2/user/completed_classes/` | completed                                                                               |
| GET    | `v2/user/bookmarks/`         | bookmark                                                                                |
| GET    | `webinar/filter/`            | upcoming & premiere                                                                     |
| GET    | `v2/library/:id/about/`      |                                                                                         |
| GET    | `recommendation/`            |                                                                                         |
| GET    | `user/because_you_watched/`  |                                                                                         |
| GET    | `complimentary-course/`      |                                                                                         |

### Masterclass / Chapter — `src/app/shared/core/models/masterclass.model.ts`

| Method | Path                                           |
| ------ | ---------------------------------------------- |
| GET    | `v2/:course_type/details/`                     |
| GET    | `v2/chapters/`                                 |
| POST   | `user/customaction/set_cpe_mode/`              |
| POST   | `v2/user/myclassactivity/`                     |
| POST   | `user-quiz-details/`                           |
| GET    | `masterclass/report_summary/`                  |
| GET    | `chapter-quiz`                                 |
| POST   | `user-assessment/start_assessment/`            |
| POST   | `v2/user/toggle-bookmark/`                     |
| POST   | `v2/user/cart/`                                |
| GET    | `v2/course-content/`                           |
| POST   | `user-assessment/download_certificate/`        |
| GET    | `v2/dashboard/:courseId/additional-resources/` |

### Assessment — `src/app/shared/core/models/assessment.model.ts`

| Method | Path                                 |
| ------ | ------------------------------------ |
| GET    | `v2/:course_type/details/`           |
| POST   | `user-assessment/start_assessment/`  |
| GET    | `final-assessment/`                  |
| POST   | `user-assessment/`                   |
| POST   | `user-assessment/assessment_report/` |

### Feedback — `src/app/shared/core/models/feedback-model.ts`

| Method | Path                             |
| ------ | -------------------------------- |
| GET    | `v2/:course_type/details/`       |
| GET    | `feedback-category/`             |
| POST   | `user-feedback/submit_feedback/` |
| GET    | `user-feedback/`                 |

### CPE Tracker — `src/app/shared/core/models/cpe-tracker.model.ts`

| Method | Path                                         |
| ------ | -------------------------------------------- |
| GET    | `usercredits/statistics/`                    |
| GET    | `usercredits/`                               |
| GET    | `user-badges/`                               |
| GET    | `user-badges/:id/claim/`                     |
| GET    | `download_nasba_template`                    |
| POST   | `user-assessment/download_bulk_certificate/` |

### Micro / Nano-learning — `src/app/shared/core/models/micro-learning-course.model.ts`

| Method | Path                   |
| ------ | ---------------------- |
| GET    | `v2/nano-learning/`    |
| GET    | `v2/nano-learning/:id` |

### Tracks / Related content / Search

`track.model.ts`, `related-content.model.ts`, `search.model.ts`

| Method | Path                            |
| ------ | ------------------------------- |
| GET    | `tracks/`                       |
| GET    | `v2/tracks/:id/courses/`        |
| GET    | `v2/dashboard/related_content/` |
| GET    | `instructor/:id/courses/`       |
| GET    | `v2/dashboard/suggestion/`      |

### Inline paths (defined in services, not model files)

| Method | Path                                | Location                                                                                                                                                                                      |
| ------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `v2/filters/`                       | `section-filters-facade.ts`                                                                                                                                                                   |
| GET    | `webinar/details/`                  | `feedback-facade.ts` (v1; the webinar surfaces moved to v2)                                                                                                                                   |
| GET    | `v2/webinar/details/?id=`           | `webinar-course.ts` — detail page: card fields + user state (registration, badge, feedback)                                                                                                   |
| GET    | `v2/webinar/:id/about/`             | `webinar-course.ts` + `webinar-facade.ts` (More Info dialog) — long-form content only, no user state                                                                                          |
| GET    | `v2/webinar/home_section/`          | `webinar-facade.ts` — hero, `?section=highlight`                                                                                                                                              |
| GET    | `v2/webinar/filter/`                | `webinar-facade.ts` — paginated, `?type=this_month` (rail 2) and `?type=past` (rail 5). NOTE: `type` is not validated server-side — unknown values silently return the default `futured` list |
| GET    | `v2/webinar/enrollments/`           | `webinar-facade.ts` — paginated, `?type=completed\|absent`                                                                                                                                    |
| POST   | `enrollment/register/`              | `webinar-facade.ts`                                                                                                                                                                           |
| POST   | `webinar/registrations/`            | `webinar-registration-form.ts`                                                                                                                                                                |
| POST   | `webinar/registrations/verify-otp/` | `webinar-registration-form.ts`                                                                                                                                                                |
| POST   | `utm/track_utm/`                    | `utm.ts`                                                                                                                                                                                      |
| GET    | `v2/library/`                       | `uae-caira-facade.ts`                                                                                                                                                                         |
| GET    | `reports/partner-admin/users/`      | `partner-users-facade.ts` (admin / Django reports API)                                                                                                                                        |

### Blog / WordPress (separate API via `/blog-api` proxy → `wp-json/wp/v2`)

`src/app/features/blog/services/blog-api.ts` — browser base `/blog-api/wp/v2`, SSR base `https://wp.milesmasterclass.com/blog/wp-json/wp/v2`

| Method | Path                  |
| ------ | --------------------- |
| GET    | `{wpBase}/posts`      |
| GET    | `{wpBase}/categories` |

### SSR / Infra HTTP (not the app backend)

| Path                                                           | Location                           |
| -------------------------------------------------------------- | ---------------------------------- |
| `${API_BASE}/webinar/filter/`                                  | SSR prerender — `src/seo.ts`       |
| `/version.json`                                                | update checker — `src/server.ts`   |
| `/sitemap.xml`, `/sitemap_index.xml`, `/robots.txt`            | SEO crawler — `src/seo.ts`         |
| `/blog-api/*` → `https://wp.milesmasterclass.com/blog/wp-json` | WP reverse proxy — `src/server.ts` |

---

## Part 2 — Frontend Routes (Angular Router)

The main app lives under a dynamic `/:country/:profession_type` prefix (e.g. `/us/cpa/...`), written below as `{c}/{p}`.

### Top-level — `src/app/app.routes.ts`

| Path                            | Notes                                                                      |
| ------------------------------- | -------------------------------------------------------------------------- |
| `/auth/**`                      | auth area (lazy)                                                           |
| `/admin/**`                     | admin area (lazy)                                                          |
| `/page-not-found`               | 404 page                                                                   |
| `/maintenance`                  | maintenance (uses 404 component)                                           |
| `/compliance`                   | compliance page                                                            |
| `/blog-test`                    | blog home                                                                  |
| `/blog-test/all`                | blog browse / search                                                       |
| `/blog-test/:slug`              | blog post                                                                  |
| `/:country/:profession_type/**` | main app (guards: `validateProfessionCountryGuard`, `isExistingUserGuard`) |
| `/`                             | root → redirects via `rootRedirectGuard`                                   |
| `**`                            | → `/page-not-found`                                                        |

### Auth — `src/app/auth/auth.ts` (under `/auth`)

| Path                    | Guard                     |
| ----------------------- | ------------------------- |
| `/auth` → `/auth/login` | —                         |
| `/auth/login`           | guestGuard                |
| `/auth/signup`          | guestGuard                |
| `/auth/forget-password` | guestGuard                |
| `/auth/profile`         | canDeactivate: exam guard |

### Admin — `src/app/admin/admin.routes.ts` (under `/admin`)

| Path                       | Guard                |
| -------------------------- | -------------------- |
| `/admin/login`             | adminGuestGuard      |
| `/admin/forbidden`         | —                    |
| `/admin` → role landing    | adminAuthGuard       |
| `/admin/dashboard`         | `DASHBOARD_VIEW`     |
| `/admin/seo`               | `SEO_READ`           |
| `/admin/seo/edit/:slug`    | `SEO_WRITE`          |
| `/admin/reports/users`     | `REPORTS_USERS_READ` |
| `/admin/**` → role landing | —                    |

### Main app — under `/{c}/{p}` — `src/app/features/features.ts`

| Path                                                | Notes                                                          |
| --------------------------------------------------- | -------------------------------------------------------------- |
| `/{c}/{p}`                                          | → `masterclass` (logged in) or `home`                          |
| `/{c}/{p}/home`                                     | UAE-CAIRA landing (canMatch `ae`) or default Home (guestGuard) |
| `/{c}/{p}/faq`                                      |                                                                |
| `/{c}/{p}/terms-of-service`                         |                                                                |
| `/{c}/{p}/privacy-policy`                           |                                                                |
| `/{c}/{p}/connect-us`                               |                                                                |
| `/{c}/{p}/how-to-claim-credly-badge`                |                                                                |
| `/{c}/{p}/instructor/:instructorId/:instructorName` |                                                                |
| `/{c}/{p}/mobile/faq`                               | plain layout (WebView)                                         |
| `/{c}/{p}/mobile/terms-of-service`                  | plain layout                                                   |
| `/{c}/{p}/mobile/privacy-policy`                    | plain layout                                                   |
| `/{c}/{p}/mobile/compliance`                        | plain layout                                                   |

#### Library — `src/app/features/library/library.ts`

- `/{c}/{p}/library/instructor-library`
- `/{c}/{p}/library/badge-library`
- `/{c}/{p}/library/course-library`

#### CPE Tracker — `src/app/features/cpe-tracker/cpe-tracker.routes.ts`

- `/{c}/{p}/cpe-tracker` _(authGuard + activePlanGuard)_

#### Partners — `src/app/features/partners/partner.routes.ts`

- `/{c}/{p}/caira`
- `/{c}/{p}/cpe-for-corporate`
- `/{c}/{p}/partners/boomer-knowledge-network`
- `/{c}/{p}/partners/connecticut-society-of-cpas`
- `/{c}/{p}/partners/delaware-society-of-cpas`
- `/{c}/{p}/partners/illinois-society-of-cpas`
- `/{c}/{p}/partners/hawaii-society-of-cpas`

#### Payment — `src/app/features/payment/payment.routes.ts`

- `/{c}/{p}/payment/plan`
- `/{c}/{p}/payment/invoice/:orderId` _(authGuard)_
- `/{c}/{p}/payment/order-history` _(authGuard)_
- `/{c}/{p}/payment` → redirects to `cart`
- `/{c}/{p}/payment/cart` _(authGuard)_
- `/{c}/{p}/payment/billing` _(authGuard + paymentGuard)_
- `/{c}/{p}/payment/review` _(authGuard + paymentGuard)_

#### Offerings — `src/app/features/offerings/offerings.ts` (`/{c}/{p}` defaults to `masterclass`)

**Masterclass** — `src/app/features/offerings/masterclass/masterclass.ts`

- `/{c}/{p}/masterclass` _(listing)_
- `/{c}/{p}/masterclass/:courseId/:courseTitle` _(course detail)_
- `/{c}/{p}/masterclass/:courseId/:courseTitle/chapter/:chapterId/:chapterTitle` _(authGuard, plain layout)_
- `/{c}/{p}/masterclass/:courseId/:courseTitle/final-assessment/:sessionId/exam` _(authGuard, plain layout)_
- `/{c}/{p}/masterclass/:courseId/:courseTitle/final-assessment/:sessionId/report` _(authGuard, plain layout)_
- `/{c}/{p}/masterclass/:courseId/:courseTitle/feedback` _(authGuard)_

**Podcast** — `src/app/features/offerings/podcast/podcast.ts`

- `/{c}/{p}/podcast`
- `/{c}/{p}/podcast/:courseId/:courseTitle`
- `/{c}/{p}/podcast/:courseId/:courseTitle/chapter/:chapterId/:chapterTitle`
- `/{c}/{p}/podcast/:courseId/:courseTitle/final-assessment/:sessionId/exam`
- `/{c}/{p}/podcast/:courseId/:courseTitle/final-assessment/:sessionId/report`
- `/{c}/{p}/podcast/:courseId/:courseTitle/feedback`

**Webinar** — `src/app/features/offerings/webinar/webinar.ts`

- `/{c}/{p}/webinar`
- `/{c}/{p}/webinar/:courseId/:courseTitle` _(detail)_
- `/{c}/{p}/webinar/:courseId/:courseTitle/feedback` _(authGuard)_

**Micro-learning** — `src/app/features/offerings/micro-learning/micro-learning.ts`

- `/{c}/{p}/micro-learning`
- `/{c}/{p}/micro-learning/:courseId/:courseTitle` _(course / reel)_
- `/{c}/{p}/micro-learning/:courseId/:courseTitle/final-assessment/:sessionId/exam`
- `/{c}/{p}/micro-learning/:courseId/:courseTitle/final-assessment/:sessionId/report`
- `/{c}/{p}/micro-learning/:courseId/:courseTitle/feedback`

---

### Notes

- `{c}/{p}` = `:country/:profession_type` (e.g. `us/cpa`, `ae/caira`). Every offering / library / payment / partner path nests under it.
- `data: { layout: 'plain' }` routes (chapters, assessments, `/mobile/*`) render without the site header/footer (WebView / embed).
- `/blog-test` is the current blog mount; per the comment in `app.routes.ts`, the intended permalink is `/blog`.
