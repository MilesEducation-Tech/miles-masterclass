# Analytics Measurement Plan — Miles Masterclass

### User-journey + platform-wide event taxonomy for GA4 + Netcore

**Scope:** What to track across the whole platform, mapped to the real routes/flows, plus the click-event catalog.
**Built on:** the `Analytics` service already in the app — `trackPageView()`, `trackEvent(name, params)`, `trackClick(data)`, `identify()`. Everything here is **production-only, consent-gated (Consent Mode v2 / Netcore opt-in), and excluded on `/admin/**`** by that service. GA4 is delivered via GTM; Netcore via its web SDK.
**Last updated:\*\* 2026-06-20

---

## 1. What the analytics must answer

1. **Acquisition** — where do users come from, which landing pages/partners convert?
2. **Activation** — do signups finish OTP + onboarding and reach first value?
3. **Engagement** — what content gets discovered, watched, and completed?
4. **CPE value** — are users earning credits, downloading certificates, claiming badges?
5. **Monetization** — free→paid conversion, cart abandonment, revenue, renewals.
6. **Retention** — who comes back, who is at risk, who to re-engage (push/email/SMS).
7. **UX** — which CTAs/links get clicked, where do journeys stall (click-event layer).

Two engines, two jobs: **GA4** = product analytics, funnels, revenue, attribution. **Netcore** = identity-stitched behavioural data feeding **segments → journeys** (web push, email, SMS, WhatsApp) and on-site web messages.

---

## 2. The platform & journey map (mapped to real routes)

Locale prefix everywhere: `/:country/:profession_type/…` (canonicalised to `/us/accounting`).

| Stage           | Where it happens (routes)                                                                                                  | Primary intent                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Acquisition** | `/home`, UAE CAIRA `home`, `/caira`, `/cpe-for-corporate`, `/partners/*`, `/blog`, instructor pages                        | Land, understand value            |
| **Activation**  | `/auth/login`, `/auth/signup`, OTP, `/auth/profile` (onboarding)                                                           | Create account, complete profile  |
| **Discovery**   | `/masterclass`, `/podcast`, `/webinar`, `/micro-learning`, `/library/{course,instructor,badge}-library`, `/instructor/:id` | Browse, search, filter, bookmark  |
| **Consumption** | `…/:courseId/:courseTitle`, `…/chapter/:chapterId`, `…/final-assessment/:sessionId/{exam,report}`, `…/feedback`            | Watch, complete, assess, earn CPE |
| **Conversion**  | `/payment/plan`, `/payment/cart`, `/payment/billing`, `/payment/review`, `/payment/invoice/:id`                            | Subscribe / buy                   |
| **Retention**   | `/cpe-tracker`, `/payment/order-history`, continue-learning overlay, web push                                              | Track CPE, return, renew          |

Course types in the catalog: **masterclass (video), podcast, micro_learning, nano_learning, webinar.**

---

## 3. Identity & user properties

Set once on login and whenever the profile changes (already wired: `identify()` keys on `miles_user_id`). Send these as **GA4 user properties** (register as user-scoped custom dimensions) and **Netcore user attributes** (for segmentation). **No raw PII** (no email/name/phone) — ids + categorical attributes only, and only after consent.

| Property                                     | Source (`User`)                                         | Used for            |
| -------------------------------------------- | ------------------------------------------------------- | ------------------- |
| `user_id`                                    | `miles_user_id` (fallback `id`)                         | identity stitching  |
| `account_type`                               | `account_type` (UGA/CPA)                                | segment by audience |
| `profession` / `country`                     | route params                                            | locale segments     |
| `sector`, `job_role`                         | `sector.name`, `job_role.name`                          | persona segments    |
| `license_status`, `qualification_status`     | profile                                                 | CPE relevance       |
| `plan_status`                                | `currentPlan.subscription_status` (active/none/loading) | free vs paid        |
| `is_beta_access`, `has_platform_free_access` | profile                                                 | access tier         |
| `profile_completed`                          | `is_profile_completed`                                  | activation          |
| `creation_platform`, `app_source`            | profile (Masterclass/LMS/Mobile; WA/IOS/AN)             | source split        |

---

## 4. Event taxonomy by journey stage

Conventions: GA4 **recommended** event names used where they exist; everything else snake_case custom. **Source** = how it fires: `auto` (already in service), `logic` (call `analytics.trackEvent(...)` from a component/facade), `click` (`data-click-tag` on the element → `element_click`). Mark ⭐ = GA4 **key event / conversion**.

### 4.1 Acquisition

| Event               | Fires when                                            | Key params                                                     | Source   |
| ------------------- | ----------------------------------------------------- | -------------------------------------------------------------- | -------- |
| `page_view`         | every route change                                    | `page_path`, `page_title`                                      | auto ✅  |
| `landing_view`      | first hit on a marketing/partner/CAIRA/corporate page | `landing_type` (home/partner/caira/corporate), `partner_slug`  | logic    |
| `element_click`     | any tagged CTA (hero, nav, partner)                   | `click_tag`,`type_tag`,`click_text`,`click_id`,`click_element` | click ✅ |
| `blog_article_view` | blog post opened                                      | `slug`,`category`                                              | logic    |

_Attribution (source/medium/campaign) comes from GA4 automatically via UTMs; mirror campaign into Netcore on first identify if needed._

### 4.2 Activation (auth + onboarding)

| Event               | Fires when                            | Key params                           | Source      |
| ------------------- | ------------------------------------- | ------------------------------------ | ----------- |
| `sign_up_start`     | signup page opened / "Create account" | `method`                             | logic+click |
| `otp_requested`     | SendOTP called                        | `method` (email/phone)               | logic       |
| `otp_verify_failed` | wrong/expired OTP                     | `reason`                             | logic       |
| `login`             | login success ⭐                      | `method` (otp/google/apple)          | logic       |
| `sign_up`           | new account created ⭐                | `method`                             | logic       |
| `profile_start`     | onboarding profile opened             | —                                    | logic       |
| `profile_completed` | `is_profile_completed` flips true ⭐  | `profession`,`sector`,`account_type` | logic       |
| `logout`            | user logs out                         | —                                    | logic       |

_On `login`/`sign_up`: call `identify()` (done) and push the §3 user properties._

### 4.3 Discovery

| Event                              | Fires when                         | Key params                                                                                                    | Source      |
| ---------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------- |
| `view_item_list`                   | a listing renders                  | `item_list_name` (masterclass/podcast/webinar/micro_learning/course_library/instructor_library/badge_library) | logic       |
| `select_item`                      | a course/instructor card clicked   | `item_id`,`item_name`,`course_type`,`item_list_name`                                                          | click+logic |
| `view_item`                        | course detail opened               | `item_id`,`item_name`,`course_type`,`instructor`,`is_free`                                                    | logic       |
| `view_instructor`                  | instructor detail opened           | `instructor_id`,`instructor_name`                                                                             | logic       |
| `search`                           | search submitted (⌘K / search box) | `search_term`                                                                                                 | logic       |
| `filter_apply`                     | filter/sort applied                | `filter_type`,`filter_value`,`list_name`                                                                      | logic+click |
| `bookmark_add` / `bookmark_remove` | toggle bookmark                    | `item_id`,`course_type`                                                                                       | logic       |
| `share`                            | share action                       | `method`,`content_type`,`item_id`                                                                             | logic+click |
| `load_more`                        | pagination (optional)              | `list_name`,`page`                                                                                            | click       |

### 4.4 Consumption / learning (the CPE core)

| Event                          | Fires when                           | Key params                                | Source         |
| ------------------------------ | ------------------------------------ | ----------------------------------------- | -------------- |
| `start_course`                 | first chapter opened for a course ⭐ | `course_id`,`course_type`                 | logic          |
| `chapter_start`                | chapter/player opened                | `course_id`,`chapter_id`                  | logic          |
| `video_start`                  | playback begins                      | `course_id`,`chapter_id`                  | logic (player) |
| `video_progress`               | 10/25/50/75/90% reached              | `course_id`,`chapter_id`,`percent`        | logic (player) |
| `video_complete`               | 100% / ended                         | `course_id`,`chapter_id`                  | logic (player) |
| `chapter_complete`             | chapter marked/auto complete         | `course_id`,`chapter_id`                  | logic          |
| `course_complete`              | all chapters done ⭐                 | `course_id`,`course_type`                 | logic          |
| `assessment_start`             | final-assessment exam opened         | `course_id`,`session_id`                  | logic          |
| `assessment_submit`            | exam submitted                       | `course_id`,`session_id`,`score`,`passed` | logic          |
| `cpe_credit_earned`            | credit awarded ⭐                    | `course_id`,`credits`,`field_of_study`    | logic          |
| `certificate_download`         | certificate downloaded ⭐            | `course_id`,`credits`                     | logic+click    |
| `feedback_submit`              | course feedback submitted            | `course_id`,`rating`                      | logic          |
| `micro_learning_quiz_complete` | reel/quiz finished                   | `course_id`,`passed`                      | logic          |
| `webinar_register`             | webinar registration ⭐              | `webinar_id`,`webinar_title`              | logic+click    |
| `webinar_add_to_calendar`      | add-to-calendar                      | `webinar_id`                              | click          |

### 4.5 Conversion (GA4 ecommerce — use the `items[]` array)

| Event              | Fires when                                       | Key params                                                         | Source      |
| ------------------ | ------------------------------------------------ | ------------------------------------------------------------------ | ----------- |
| `view_promotion`   | subscribe/continue upsell shown (footer overlay) | `promotion_name`,`creative_slot`                                   | logic       |
| `select_promotion` | upsell CTA clicked                               | `promotion_name`                                                   | click       |
| `view_plan`        | `/payment/plan` opened                           | `items[]` (plan tiers)                                             | logic       |
| `select_plan`      | a plan chosen                                    | `plan_tier`,`price`                                                | click+logic |
| `add_to_cart`      | course/plan added ⭐                             | `items[]`,`value`,`currency`                                       | logic       |
| `view_cart`        | `/payment/cart`                                  | `items[]`,`value`                                                  | logic       |
| `remove_from_cart` | item removed                                     | `items[]`                                                          | logic       |
| `begin_checkout`   | proceed to billing ⭐                            | `items[]`,`value`,`coupon`                                         | logic+click |
| `add_payment_info` | billing/address confirmed                        | `items[]`,`payment_type`                                           | logic       |
| `purchase`         | order placed / payment success ⭐                | `transaction_id`,`value`,`currency`,`items[]`,`coupon`,`plan_tier` | logic       |
| `purchase_failed`  | payment failure                                  | `reason`                                                           | logic       |
| `apply_coupon`     | coupon applied                                   | `coupon`,`valid`                                                   | logic+click |

_`purchase` (and `add_to_cart`/`begin_checkout`) fire from `PaymentFacade` on the real state transition, never from a button alone — so refunds/failures don't inflate revenue._

### 4.6 Retention / re-engagement

| Event                                      | Fires when                     | Key params                           | Source      |
| ------------------------------------------ | ------------------------------ | ------------------------------------ | ----------- |
| `continue_learning_click`                  | resume card in footer overlay  | `course_id`                          | click       |
| `cpe_tracker_view`                         | `/cpe-tracker` opened          | `credits_earned`,`credits_required`  | logic       |
| `badge_claim`                              | Credly badge claimed ⭐        | `badge_id`                           | logic+click |
| `order_history_view`                       | `/payment/order-history`       | —                                    | logic       |
| `web_push_prompt_shown`                    | soft opt-in shown              | `source`                             | logic       |
| `web_push_optin` ⭐ / `web_push_dismissed` | permission granted / dismissed | `source`                             | logic       |
| `notification_click`                       | web push opened                | `campaign_id`                        | Netcore     |
| `consent_update`                           | consent saved                  | `analytics`,`marketing`,`functional` | logic       |

### 4.7 System / quality (optional but useful)

`exception` (tracked JS errors), `app_update_prompt` (UpdateChecker), `search_no_results` (`search_term`).

---

## 5. Click-event catalog (`data-click-tag`)

The delegated listener auto-sends `element_click` with `click_tag`,`type_tag`,`click_text`,`click_id`,`click_element` for any element carrying **`data-click-tag`**. Use it for _intent_ clicks that aren't already a logic event.

**Naming:** `click_tag = <area>_<object>_<action>` (snake_case). **`type_tag` = controlled vocab:** `nav | cta | card | tab | filter | toggle | player | form | social | download | link | overlay`.

```html
<button data-click-tag="coursedetail_enroll" data-type-tag="cta" data-click-id="mc_detail_enroll">
  Enroll
</button>
<a data-click-tag="home_hero_explore" data-type-tag="cta">Explore Masterclasses</a>
```

| Area                   | Suggested `click_tag`s                                                                                                                       | `type_tag`             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Header / nav           | `nav_login`, `nav_signup`, `nav_search`, `nav_cart`, `nav_offering_<type>`, `nav_country_switch`                                             | nav                    |
| Home / landing         | `home_hero_explore`, `home_hero_signup`, `home_plan_cta`, `corporate_book_demo`, `partner_<slug>_cta`                                        | cta                    |
| Offerings list         | `<type>_card_open`, `<type>_filter_<facet>`, `<type>_sort`, `<type>_bookmark`, `list_load_more`                                              | card / filter / toggle |
| Course detail          | `coursedetail_enroll`, `coursedetail_addcart`, `coursedetail_play`, `coursedetail_bookmark`, `coursedetail_share`, `coursedetail_instructor` | cta / player / social  |
| Player / chapter       | `player_play`, `player_next_chapter`, `player_mark_complete`, `player_start_assessment`, `player_download_resource`                          | player                 |
| Assessment / feedback  | `exam_submit`, `report_download_certificate`, `feedback_submit`, `feedback_star_<n>`                                                         | form / download        |
| Plan / cart / checkout | `plan_select_<tier>`, `cart_checkout`, `cart_remove`, `billing_place_order`, `checkout_apply_coupon`                                         | cta / form             |
| CPE / badges           | `cpe_download_certificate`, `badge_claim`, `cpe_export`                                                                                      | download / cta         |
| Webinar                | `webinar_register`, `webinar_add_calendar`                                                                                                   | cta                    |
| Retention              | `overlay_subscribe`, `overlay_continue`, `pushprompt_allow`, `pushprompt_later`, `footer_cookie_settings`                                    | overlay / cta          |

> Where a `data-click-tag` sits on the same element as a logic event (e.g. `purchase`), keep **both**: the click measures _intent_, the logic event measures the _outcome_ — the gap between them is your drop-off.

---

## 6. Funnels, KPIs & what they power

**Funnels (build in GA4 Explore; mirror as Netcore segments):**

- **Activation:** `page_view`(home) → `sign_up_start` → `otp_requested` → `login`/`sign_up` → `profile_completed`.
- **Discovery→learning:** `view_item` → `start_course` → `video_progress`(50%) → `course_complete`.
- **CPE value:** `course_complete` → `cpe_credit_earned` → `certificate_download` → `badge_claim`.
- **Monetization:** `view_plan` → `add_to_cart` → `begin_checkout` → `add_payment_info` → `purchase`.
- **Push:** `web_push_prompt_shown` → `web_push_optin`.

**Headline KPIs:** signup conversion, activation rate (profile complete %), course-completion rate, CPE credits earned/user, **free→paid conversion**, ARPU, **cart-abandonment**, push opt-in rate, WAU/MAU + retention cohorts, consent opt-in rate.

**Netcore journeys these unlock:** abandoned-cart (`add_to_cart` no `purchase` in N hrs), course-progress nudge (`start_course` no `course_complete`), webinar reminders (`webinar_register`), certificate-ready + renewal reminders (plan expiry), re-engagement for dormant users, push opt-in nudge.

---

## 7. Implementation plan

### 7.1 In code (fire `trackEvent` at the real moment)

Put events where the state actually changes, not loosely in templates:

- **Auth** → `AuthFacade` (login/signup/OTP) + `Auth.fetchMyProfile` (profile_completed, identify + user props).
- **Listings/detail** → offering list components (`view_item_list`, `select_item`), detail pages (`view_item`), `instructor-details`.
- **Player** → the video/audio player components (`video_start/progress/complete`, `chapter_complete`); `start_course` on first chapter.
- **Assessment/feedback** → final-assessment + feedback pages.
- **CPE/badges** → cpe-tracker + badge/certificate components (`cpe_credit_earned`, `certificate_download`, `badge_claim`).
- **Commerce** → `PaymentFacade` (`add_to_cart`, `view_cart`, `begin_checkout`, `add_payment_info`, `purchase`).
- **Retention** → footer-overlay (`view_promotion`, `continue_learning_click`), Netcore push opt-in flow.
- **CTAs** → add `data-click-tag` per §5.

### 7.2 GTM container (`GTM-TLGXMQSQ`)

- **GA4 config tag** (`G-F08HZV0NQ3`) honoring Consent Mode; `send_page_view: false`; trigger `page_view` GA4 event on the `virtual_page_view` dataLayer event.
- **Data Layer Variables** for every param above; one **GA4 event tag per event** (or a lookup-driven generic tag) triggered on the matching custom event.
- **Ecommerce:** pass the `items[]` array for `add_to_cart`/`begin_checkout`/`purchase` so GA4 reports revenue natively.
- **Custom dimensions:** register user-scoped (`account_type`,`plan_status`,`profession`,`profile_completed`…) and event-scoped (`course_type`,`plan_tier`,`click_tag`,`type_tag`,`item_list_name`…).
- Mark ⭐ events as **Key events**.

### 7.3 Netcore

- `identify()` + set user attributes (§3) so events attach to the right contact.
- Map the §4 events as **activities**; build the §6 **segments → journeys**.
- Web push opt-in gated behind intent (soft prompt) — fire `web_push_prompt_shown` / `web_push_optin`.

### 7.4 Phasing

- **P0 (done/near):** `page_view`, `identify`, `element_click`, consent. → add `login`,`sign_up`,`profile_completed` + ecommerce core (`add_to_cart`,`begin_checkout`,`purchase`).
- **P1:** discovery (`view_item_list`,`view_item`,`search`,`filter_apply`,`bookmark_*`), learning (`start_course`,`video_*`,`course_complete`), CPE (`cpe_credit_earned`,`certificate_download`,`badge_claim`), feedback.
- **P2:** retention/push funnel, webinar, promotions, `consent_update`, error tracking, Netcore journeys.

### 7.5 Governance & privacy

- **No PII** in any param/property (ids + categories only); never tokens, email, phone, payment fields. Card fields stay masked (Clarity) and untracked.
- Everything stays **prod-only + consent-gated + admin-excluded** (handled by the `Analytics` service).
- One **naming registry** (snake_case events, controlled `type_tag` vocab) — keep this doc as the source of truth; review new events against it.

---

## 8. Open questions

1. Confirm the **CPE credit award** trigger/source (API field/event) so `cpe_credit_earned` fires accurately — it's the most important education metric.
2. Plan model: are courses bought individually, or is it **subscription-only**? Determines whether `add_to_cart`/`purchase` use course items, plan items, or both.
3. Video player library in use (video-js/custom) → where to hook `video_progress` milestones.
4. Is there a **referral / invite** flow to instrument (advocacy)?
5. GA4 — confirm currency + whether course "value" should be list price or plan-allocated.
6. Do we need **mobile-webview** routes (`/mobile/*`) tracked separately or excluded (they embed in the native app)?
