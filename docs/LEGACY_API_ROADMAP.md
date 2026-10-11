# Legacy API roadmap

Every API call the app still makes that is **not in the backend's Postman collection**
(`postman/Merged_Masterclass_Backend_All_APIs.postman_collection.json`, 2026-10-09 export). The
collection mounts only `api/v1/`, `web-api/v1/` and `app-api/v1/`. Everything below calls `v2/*`,
`user/*`, `promotion/*`, `partners/*` and other legacy paths, which answer 404 on UAT. Each feature is
its own ticket: **rebind** it to the Postman twin, or **delete** the call and the UI that depends on it
when there is none.

Measured 2026-10-11 on `master` (`ca87d50`): the app calls 20 of the 238 Postman requests, and there
are **165 non-Postman call sites** (~44k lines would go if all were deleted outright). Never `app-api/`
— that surface is the mobile app's (AGENTS.md §6).

## Already handled (2026-10-11)

| Call                                      | Where it was                      | Now                                                             |
| ----------------------------------------- | --------------------------------- | --------------------------------------------------------------- |
| `v2/dashboard/?filter=popular`            | `/masterclass` hero               | rebound → `web-api/v1/masterclass/highlight/`                   |
| `v2/library/:id/about/`                   | hero slider "Learn More"          | rebound → the about-course dialog (`about-course/`)             |
| `v2/tracks/7/courses/?course_type=ai_lab` | home AI Labs ring                 | rebound → `web-api/v1/masterclass/ai-labs/`                     |
| `v2/caira-badges/`                        | home CAIRA stack                  | rebound → `web-api/v1/masterclass/levels/` (signed in only)     |
| —                                         | home webinar ticket (never wired) | bound → `web-api/v1/events/highlight-webinars/`                 |
| `v2/library/`, `instructor/`              | `/sitemap.xml` (server)           | deleted; course and instructor URLs are item 12 below           |
| `utm/track_utm/`                          | every page load with `?dXRt=`     | deleted; no twin (backend ask)                                  |
| `user/cart/mybucket/`                     | payment flow                      | deleted; the commerce rebind (item 2) brings the cart read back |
| `v2/user/last_viewed/`                    | footer overlay                    | deleted earlier (PR #103, 3.3.1)                                |

## Rebind: a Postman twin exists

Ordered by reach. File:line refs are from `master` at the date above.

1. **Global search** (⌘K, every page; fires when the user types).
   - Today: `v2/dashboard/suggestion/` (`core/models/search.model.ts:61` → `core/services/global-search/global-search.ts:28`).
   - Twin: `web-api/v1/masterclass/global-search/?q&types`.
2. **Payment** (`/payment/*`). One ticket; the whole flow moves together.
   - Cart: `user/cart/` POST, `user/cart/remove_item/` → `api/v1/commerce/cart/lines/`,
     `cart/line/{id}/`; the cart read → `GET api/v1/commerce/cart/`.
   - Coupons: `promotion/coupons/apply_coupon/`, `remove_coupon/` → `api/v1/commerce/cart/coupon/` (POST / DELETE).
   - Addresses: `user/address/`, `user/address/:id/` → `api/v1/commerce/addresses/`, `address/{id}/`.
   - Orders: `user/order/my_orders/`, `order_details/` → `api/v1/commerce/orders/`, `order/{id}/`.
   - Checkout: `user/order/proceed_checkout/` → `api/v1/commerce/checkout/`; customer portal →
     `api/v1/commerce/payment/session/` (unverified).
   - Plans: `promotion/subscription/` → `api/v1/subscriptions/plans/?product_id`.
   - Declared in `core/models/payment.model.ts`, called from `features/payment/services/payment-facade.ts`.
3. **Course detail, chapter player, quiz, exam, feedback** (masterclass and podcast).
   - `v2/:type/details/`, `v2/chapters/` (`features/offerings/utils/course-load.ts:36,57`) →
     `web-api/v1/masterclass/course-detail/{id}/`.
   - `v2/user/myclassactivity/` (progress, `chapter-facade.ts:92`) → `course-progress-update/{id}/`, `course-progress/{id}/`.
   - `user-quiz-details/`, `chapter-quiz`, `masterclass/report_summary/` → `quiz-questions/{chapter_id}/`, `quiz-submit/{chapter_id}/`.
   - `user-assessment/start_assessment/`, `final-assessment/`, `user-assessment/`, `user-assessment/assessment_report/`
     → `assessment-questions/{id}/`, `assessment-submit/{id}/`, `assessment-report/{id}/`, `assessment-result/{id}/`.
   - `feedback-category/`, `user-feedback/submit_feedback/`, `user-feedback/` → `feedback-questions/{id}/`,
     `feedback-submit/{id}/`, `feedback-responses/`; webinar feedback → `web-api/v1/webinar/{id}/feedback/*`.
   - `user/customaction/set_cpe_mode/` → `enrollment/{id}/` (unverified — ask the backend).
4. **Library and instructors.**
   - `v2/library-filters/`, `v2/library/` (`features/library/course/services/course-facade.ts:38,69`) → `web-api/v1/masterclass/filter/`.
   - `instructor/`, `instructor/:id/`, `instructor/:id/courses/` → `all-instructors-page/`, `instructor-detail/{id}/`.
   - `badge-categories/`, `course-badges/` (`features/library/badge/services/badge-facade.ts:41,63`) → `web-api/v1/badges/page/?section=`.
5. **CAIRA tracker** (`/caira-tracker`).
   - `v2/caira-badges/`, `v2/caira-badges/:id/`, `v2/webinar-badges/`, `v2/course-badges/`
     (`features/tracker/caira/**`) → `web-api/v1/badges/page/?section=level|webinar|masterclass` and
     `web-api/v1/masterclass/levels-progress/`.
6. **Card actions on the legacy cards** (hover, horizontal, vertical, coming-soon, course-info dialog).
   - `v2/library/:id/about/` (`core/services/feature-facade/feature-facade.ts:773`) → `about-course/?course_id|slug`.
   - `v2/user/toggle-bookmark/` (`shared/services/utils.ts:688`) → `web-api/v1/masterclass/bookmark/{id}/`.
7. **Podcast and micro-learning landings** (`FeatureFacade.getResource`, `core/models/feature.model.ts`).
   - `tracks/`, `v2/tracks/:id/courses/` → `tracks-page/`; `v2/dashboard/?filter=coming_soon` → `coming-soon/`;
     `v2/user/completed_classes/` → `completed-course-section/`; `v2/dashboard/?filter=popular` → `course-section/` or `highlight/`.
   - No web twin: `v2/user/recently_viewed/`, `recommendation/`, `complimentary-course/`,
     `user/because_you_watched/`, `v2/user/bookmarks/` (app-api only) — ask the backend or drop the rails.
8. **UAE CAIRA home** — `v2/library/?caira_levels=1|2|3` (`features/uae-caira/services/uae-caira-facade.ts:18`) → `courses-by-level/?level_id`.
9. **Partner pages** — `tracks/`, `v2/tracks/:id/courses/`, `v2/library/`
   (`features/partners/components/partnership-content/partnership-content.ts:188,225,279`) → `tracks-page/`, `filter/`.
10. **AI Labs account** — `ai-lab/account/`, `ai-lab/account/retrigger-email/` (`features/ai-labs/pages/ai-labs/ai-labs.ts:595,645`)
    → `api/v1/ai-labs/account-create/`, `account-reset-password/`; `v2/chapters/` for the sections → `web-api/v1/ai-labs/course/{id}/`.
11. **Enquiry form** — `partners/leads/` (`core/services/enquiry/enquiry.ts:26`) → `api/v1/account/enquiry/` or `talk-to-us/`.
12. **Sitemap course and instructor URLs** (`src/seo.ts`) → `tracks-page/?login_type=pre_login` (masterclass
    `/:uuid/:slug`) and `all-instructors-page/`.
13. **Webinar bookings** — `web-api/v1/events/all-bookings/?window=` now exists; the comments in
    `features/offerings/webinar/services/webinar-facade.ts:184` and `webinar-card.ts:156` still say there is no web twin.
    Its past rows carry `attendance` (the Q1/Q2 numbers).

## Delete, or ask the backend: no Postman twin

| Feature              | Calls                                                                                                                                                                                                                            | Call sites                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| CPE tracker          | `v2/cpe-tracker/`, `v2/cpe-tracker/summary/`, `download_nasba_template`, `user-assessment/download_bulk_certificate/`                                                                                                            | `features/tracker/cpe/**`                                                                       |
| Certificates         | `user-assessment/download_certificate/`                                                                                                                                                                                          | `shared/dialogs/certificate-download-dialog/certificate-download-dialog.ts:252`                 |
| Badge claim          | `user-badges/:id/claim/` (maybe `api/v1/badges/badge-claimed-by-user/`)                                                                                                                                                          | `shared/services/utils.ts:544`                                                                  |
| Nano-learning feed   | `v2/nano-learning/`, `v2/nano-learning/:id/`                                                                                                                                                                                     | `features/offerings/services/micro-learning-course-facade.ts:315,352`                           |
| Course content       | `v2/course-content/` (transcript, glossary), `v2/dashboard/:id/additional-resources/`, `exercise-files/:id/download/`                                                                                                            | `features/offerings/services/masterclass-facade.ts:427,490`, `utils.ts:750`                     |
| Related content      | `v2/dashboard/related_content/`                                                                                                                                                                                                  | `shared/components/course-related-section/course-related-section.ts:79`                         |
| Carousel API filters | `v2/filters/` (falls back to client-side filters)                                                                                                                                                                                | `core/services/section-filters-facade/section-filters-facade.ts:54`                             |
| Faculty signup       | `v2/faculty/register/`, `v2/faculty/verify/`                                                                                                                                                                                     | `features/faculty/pages/faculty/faculty.ts:40-41`                                               |
| Payment extras       | `promotion/coupons/` (list), `promotion/subscription/cancel/`, `reactivate/`, `firm-sponsorship/`, `apply-partner-code/`, `user/companies/`, `user/profile/update/` (→ `PATCH api/v1/account/profile/`)                          | `payment-facade.ts`, `firm-sponsorship-dialog.ts`, `core/services/partner-code/partner-code.ts` |
| UTM attribution      | `utm/track_utm/` (deleted 2026-10-11)                                                                                                                                                                                            | —                                                                                               |
| Admin                | every `partners/panel/*`, `partners/superadmin/*`, `reports/user-report/`, `user/{professional-course,state-boards,job-sectors,companies}/`, `professions/` (offline payment → `api/v1/subscriptions/internal/offline-payment/`) | `admin/**` (~48 sites)                                                                          |

## Dead code (nothing reaches it): delete

- `promotion/coupons/` loader in `features/payment/components/promo-coupons/promo-coupons.ts:40` and `payment-facade.ts:407`.
- `shared/dialogs/profile-completion-dialog/*`, `core/services/job-sectors/job-sectors.ts` — only the
  unstarted `EngagementDialog` opens them.
- `core/services/location-autocomplete/location-autocomplete.ts` (`v2/locations/autocomplete/`) — no injector.
- `micro-learning-course-facade.ts:854` `submitQuizAnswer` — no caller.
- `admin/partner-platform/pages/network-tracker/*` — its route is commented out.
- Unused keys in `FEATURE_ROUTES` (`core/models/feature.model.ts`): `instructor`, `upcoming`, `premiere`
  (`webinar/filter/`), `highlight`, `latest`, `newlyAdded`; `ASSESSMENT_ROUTES.startFinalAssessment`;
  `PAYMENT_ROUTES` `stripe/force-subscription/`, `retryPayment`, `lms/check-and-subscribe/`.

## Backend asks (open)

- **`levels/` has no guest variant**, so guests never see the home CAIRA section.
- **Storage:** 5 of the 10 pinned courses (`highlight/`) have artwork on `storage.googleapis.com/miles-usp-bed`
  that answers **403** (horizontal, vertical and square alike); the track rails show the same broken images.
- **CORS:** `milesone-backend-assets.s3.ap-south-1.amazonaws.com` sends no `Access-Control-Allow-Origin`,
  so the home AI Labs ring cannot upload its artwork as WebGL textures and renders the cards without
  images (the CloudFront CDN, `d1pp0977rsxmiq.cloudfront.net`, sends `*`).
- `web_background_video_url` is null on every course (MASTERCLASS Q1), so the hero shows posters only.
- UTM attribution has no web route.
