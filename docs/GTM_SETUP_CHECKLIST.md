# GTM + GA4 Setup Checklist — Miles Masterclass

Mechanical, click-by-click container config to make the **already-implemented** events show up in GA4. The app pushes everything to `window.dataLayer` (via the `Analytics` service) and sets Consent Mode v2 defaults itself — GTM only needs the tags/triggers/variables below.

|                        |                                                                              |
| ---------------------- | ---------------------------------------------------------------------------- |
| **GTM container**      | `GTM-TLGXMQSQ` (production)                                                  |
| **GA4 Measurement ID** | `G-F08HZV0NQ3`                                                               |
| **Microsoft Clarity**  | Injected by the app directly (analytics consent) — **nothing to add in GTM** |
| **Netcore**            | Injected by the app directly (marketing consent) — **nothing to add in GTM** |

> **App-side vendor toggles:** each environment file (`src/environments/*`) has `ANALYTICS.enabled` (master) plus a self-contained object per vendor — `ga4 { enabled, gtmId, measurementId }`, `clarity { enabled, projectId }`, `netcore { enabled, … }`. A vendor loads only when the master switch is on, its own `enabled` is `true`, **and** its key is set.

> The app already calls `gtag('consent','default',{...})` with everything **denied** (except `security_storage`) before GTM loads, and `gtag('consent','update',...)` when the user accepts. So in GTM you just build GA4 normally and tick the consent checks — Consent Mode is already feeding it.

---

## 0. One-time settings

- [ ] In **GTM → Admin → Container Settings**, enable **"Enable consent overview"** (Container Settings → Additional Settings) so you can verify consent on each tag.
- [ ] Confirm the app is loading the container (DevTools → Network → `gtm.js?id=GTM-TLGXMQSQ`) in production.

---

## 1. GA4 Configuration tag

- [ ] **Tags → New → Google Tag** (the unified config tag).
  - **Tag ID:** `G-F08HZV0NQ3`
  - **Configuration parameter:** add `send_page_view` = `false` (we fire page views ourselves on SPA navigation).
  - **Trigger:** **Initialization - All Pages** (Consent Initialization).
  - **Consent Settings (Advanced):** require `analytics_storage`. (Consent Mode handles cookieless pings when denied.)

---

## 2. page_view (SPA virtual pageview)

- [ ] **Trigger → New → Custom Event**, Event name = `virtual_page_view`. Name it **CE - virtual_page_view**.
- [ ] **Tag → New → GA4 Event**:
  - **Measurement ID / Config:** `G-F08HZV0NQ3`
  - **Event Name:** `page_view`
  - **Event Parameters:** `page_location` = `{{DLV - page_path}}`, `page_title` = `{{DLV - page_title}}`
  - **Trigger:** CE - virtual_page_view
  - **Consent:** requires `analytics_storage`

---

## 3. Data Layer Variables (create each once)

Create **Variables → New → Data Layer Variable** for every key below (Variable name suggestion in the left column; Data Layer Variable Name = the same string).

| Variable                 | DLV name                                  |
| ------------------------ | ----------------------------------------- |
| DLV - event              | `event`                                   |
| DLV - page_path          | `page_path`                               |
| DLV - page_title         | `page_title`                              |
| DLV - user_id            | `user_id`                                 |
| DLV - method             | `method`                                  |
| DLV - course_id          | `course_id`                               |
| DLV - course_name        | `course_name`                             |
| DLV - course_type        | `course_type`                             |
| DLV - chapter_id         | `chapter_id`                              |
| DLV - session_id         | `session_id`                              |
| DLV - percent            | `percent`                                 |
| DLV - passed             | `passed`                                  |
| DLV - score              | `score`                                   |
| DLV - feedback_count     | `feedback_count`                          |
| DLV - search_term        | `search_term`                             |
| DLV - result_id          | `result_id`                               |
| DLV - result_type        | `result_type`                             |
| DLV - instructor_id      | `instructor_id`                           |
| DLV - instructor_name    | `instructor_name`                         |
| DLV - badge_id           | `badge_id`                                |
| DLV - certificate_type   | `certificate_type`                        |
| DLV - count              | `count`                                   |
| DLV - base_price         | `base_price`                              |
| DLV - selling_price      | `selling_price`                           |
| DLV - product_discount   | `product_discount`                        |
| DLV - paid_amount        | `paid_amount`                             |
| DLV - page_name          | `page_name`                               |
| DLV - cart_id            | `cart_id`                                 |
| DLV - is_trial           | `is_trial`                                |
| DLV - transaction_id     | `transaction_id`                          |
| DLV - value              | `value`                                   |
| DLV - currency           | `currency`                                |
| DLV - items              | `items`                                   |
| DLV - coupon             | `coupon`                                  |
| DLV - sha256_email       | `user_data.sha256_email_address`          |
| DLV - click_tag          | `click_tag`                               |
| DLV - type_tag           | `type_tag`                                |
| DLV - click_text         | `click_text`                              |
| DLV - click_id           | `click_id`                                |
| DLV - click_element      | `click_element`                           |
| DLV - up.\* (user props) | `user_properties` (read sub-keys, see §6) |

---

## 4. The event forwarder (one tag for all custom events)

Rather than one tag per event, use a single GA4 Event tag that forwards every custom event with its name and a superset of parameters (GA4 drops params with no value).

- [ ] **Trigger → New → Custom Event**, **Event name** (use matches RegEx):
      `^(otp_requested|login|sign_up|profile_completed|logout|view_item|view_instructor|search|bookmark_add|bookmark_remove|start_course|chapter_complete|course_complete|video_start|video_progress|video_complete|assessment_start|assessment_submit|feedback_submit|certificate_download|badge_claim|webinar_register|continue_learning_click|consent_update|element_click)$`
      Name it **CE - app events**.
- [ ] **Tag → New → GA4 Event**:
  - **Config:** `G-F08HZV0NQ3`
  - **Event Name:** `{{DLV - event}}`
  - **Event Parameters** (add the rows; unused ones are ignored per event):
    `method, course_id, course_name, course_type, chapter_id, session_id, percent, passed, score, feedback_count, search_term, result_id, result_type, instructor_id, instructor_name, badge_id, certificate_type, count, click_tag, type_tag, click_text, click_id, click_element` → each = the matching `{{DLV - …}}`.
  - **Trigger:** CE - app events
  - **Consent:** requires `analytics_storage`

> Ecommerce events (`add_to_cart`, `cart_view`, `begin_checkout`, `purchase`) are handled separately in §5 so they carry `items`/pricing — exclude them from the forwarder regex (they're not in it above).

---

## 5. Ecommerce events

The app pushes `items` (array), plus `value`/`currency`/`transaction_id` and the pricing params at the top level. Create **one GA4 Event tag per ecommerce event** (or one with a regex trigger) mapping those as parameters — GA4 reads an `items` array parameter as ecommerce items.

> **`items[]` sub-keys:** each entry is `{ course_id, course_type, price }` (the app uses `course_id`/`course_type`, **not** GA4's reserved `item_id`/`item_name`). GA4's built-in ecommerce item reports key off `item_id`/`item_name`, so they won't auto-populate — read these as the custom `items` array parameter instead.

- [ ] **Trigger → Custom Event**, RegEx: `^(add_to_cart|cart_view|begin_checkout|purchase)$` → **CE - ecommerce**.
- [ ] **GA4 Event tag** (you can do one tag with Event Name = `{{DLV - event}}`):
  - **Event Parameters:** `items` = `{{DLV - items}}`, `value` = `{{DLV - value}}`, `currency` = `{{DLV - currency}}`, `transaction_id` = `{{DLV - transaction_id}}`, `course_id` = `{{DLV - course_id}}`, `course_type` = `{{DLV - course_type}}`, `base_price` = `{{DLV - base_price}}`, `selling_price` = `{{DLV - selling_price}}`, `product_discount` = `{{DLV - product_discount}}`, `paid_amount` = `{{DLV - paid_amount}}`, `page_name` = `{{DLV - page_name}}`, `cart_id` = `{{DLV - cart_id}}`, `is_trial` = `{{DLV - is_trial}}`, `coupon` = `{{DLV - coupon}}`
  - **Trigger:** CE - ecommerce
  - **Consent:** requires `analytics_storage`

> _Optional upgrade:_ for GA4's native "Use Ecommerce data from Data Layer" toggle, the dataLayer needs the values nested under an `ecommerce` object. That's a small one-line code change per event — ask and I'll switch the `add_to_cart`/`cart_view`/`begin_checkout`/`purchase` pushes to the `ecommerce: { … }` shape.

---

## 6. User properties

### 6.0 How it works (data flow)

Whenever the signed-in user's profile or plan resolves/changes, `Analytics.identify()` does three things:

1. `gtag('set', { user_id })` — sets the GA4 User-ID (config-only, no hit).
2. `gtag('set', 'user_properties', { … })` — registers the attributes on the gtag layer.
3. **Once a consent decision exists**, pushes a `user_data` event to the dataLayer — this is the one GTM reads:

```js
window.dataLayer.push({
  event: 'user_data',
  user_id: '<miles_user_id or numeric id>',
  user_properties: {
    profile_completed,
    plan_status,
    currently_working,
    sector,
    job_role,
    license_status,
    qualification_status,
    state_board,
    company,
    country,
    profession,
  },
});
```

Notes on the values (all are **strings**):

- Booleans are stringified — `"true"` / `"false"` (`profile_completed`, `currently_working`).
- `plan_status` is lower-cased; defaults to `"none"` when the user has no plan.
- `sector`, `job_role`, `license_status`, `qualification_status`, `state_board`, `company` are `""` when unset; `country` / `profession` come from the `/:country/:profession` URL.
- `state_board` is the user's selected boards joined with `, ` (array → scalar); `company` is the user's first company name.
- On logout the app calls `gtag('set', { user_id: null })` to clear identity.
- The push **re-fires on every profile or plan change** (the `identify` effect reacts to `currentUser()` / `currentPlan()`) and is **de-duped by value** — so it pushes exactly when `user_id` or a tracked property actually changes, and not on plain navigation.

### 6.1 Create the supporting Data Layer Variables

- [ ] **DLV - user_id** → Data Layer Variable Name `user_id` (already in §3).
- [ ] One DLV per user property, reading the nested sub-key — Data Layer Variable Name = `user_properties.<key>`:

| Variable                      | DLV name                               |
| ----------------------------- | -------------------------------------- |
| DLV - up.profile_completed    | `user_properties.profile_completed`    |
| DLV - up.plan_status          | `user_properties.plan_status`          |
| DLV - up.currently_working    | `user_properties.currently_working`    |
| DLV - up.sector               | `user_properties.sector`               |
| DLV - up.job_role             | `user_properties.job_role`             |
| DLV - up.license_status       | `user_properties.license_status`       |
| DLV - up.qualification_status | `user_properties.qualification_status` |
| DLV - up.state_board          | `user_properties.state_board`          |
| DLV - up.company              | `user_properties.company`              |
| DLV - up.country              | `user_properties.country`              |
| DLV - up.profession           | `user_properties.profession`           |

### 6.2 Attach them to GA4 (set once on the Google Tag — covers every hit)

Setting user properties on the **Google Tag (§1)** means they persist on the GA4 session and attach to every subsequent event automatically — no per-event mapping needed.

- [ ] On the **Google Tag (§1)** → **Configuration settings / Shared event settings → User properties**, add a row per property (Property Name = the key, Value = the matching DLV):
      `profile_completed`=`{{DLV - up.profile_completed}}`, `plan_status`=`{{DLV - up.plan_status}}`, `currently_working`=`{{DLV - up.currently_working}}`, `sector`=`{{DLV - up.sector}}`, `job_role`=`{{DLV - up.job_role}}`, `license_status`=`{{DLV - up.license_status}}`, `qualification_status`=`{{DLV - up.qualification_status}}`, `state_board`=`{{DLV - up.state_board}}`, `company`=`{{DLV - up.company}}`, `country`=`{{DLV - up.country}}`, `profession`=`{{DLV - up.profession}}`
- [ ] On the **Google Tag (§1)** → set **User-ID** = `{{DLV - user_id}}` (enables cross-device / user-level reporting).

> Because the Google Tag fires on **Initialization - All Pages**, it may run _before_ the first `user_data` push on a cold load. The values still backfill on the next hit (they're sticky once set), but if you want them guaranteed-fresh you can additionally fire a lightweight **GA4 Event tag on a `user_data` Custom Event trigger** that only sets the User-ID + user properties.

### 6.3 Register them in GA4

- [ ] These must be registered as **user-scoped custom dimensions** to appear in reports — see §7 (User-scoped list). Without that, GA4 collects them but no report can break down by them.

---

## 6b. Enhanced Conversions (hashed email)

The app **SHA-256-hashes the user's email** and exposes it as user-provided data — `gtag('set', 'user_data', { sha256_email_address })` **and** a dataLayer push `{ user_data: { sha256_email_address } }` — on identify (login / profile / plan change). It is **gated on marketing consent** and the raw email is never sent. This powers Google Ads conversion matching; the hash is **not** a readable dimension and won't appear in GA4 reports.

- [ ] **GA4 → Admin → Data collection and modification → Data collection → Enhanced conversions** → **turn on Enhanced conversions**.
- [ ] In GTM, create **DLV - sha256_email** → Data Layer Variable Name `user_data.sha256_email_address`.
- [ ] On the **Google Tag (§1)** → **Include user-provided data from your website** → **Manual configuration** → **Email** = `{{DLV - sha256_email}}` (already hashed — GTM/GA4 accepts a pre-hashed SHA-256 value).
- [ ] **Consent:** the app emits the hash only under **marketing** consent; also require `ad_user_data` / `ad_personalization` on any Ads-side tag that consumes it.

> Already hashed in-app, so do **not** enable GTM's "automatic" email collection.

---

## 7. Register Custom Dimensions in GA4

In **GA4 → Admin → Custom definitions → Create custom dimension**. Without this, the params are collected but won't appear in reports.

**User-scoped** (Scope = User):

- [ ] `plan_status`, `profile_completed`, `currently_working`, `sector`, `job_role`, `license_status`, `qualification_status`, `state_board`, `company`, `country`, `profession`

**Event-scoped** (Scope = Event):

- [ ] `course_id`, `course_name`, `course_type`, `chapter_id`, `method`, `percent`, `passed`, `score`, `feedback_count`, `result_type`, `certificate_type`, `page_name`, `click_tag`, `type_tag`, `click_id`, `search_term`

_(GA4 allows 50 event-scoped + 25 user-scoped custom dimensions — well within limits.)_

**Event-scoped custom metrics** (Admin → Custom definitions → Create custom metric, Unit = Currency/Standard):

- [ ] `base_price`, `selling_price`, `product_discount` (pricing on `add_to_cart` / `cart_view` / `begin_checkout` / `purchase`), `paid_amount` (actual amount charged, on `purchase`)

---

## 8. Mark Key Events (conversions)

In **GA4 → Admin → Events → mark as key event** (or Configure → Events):

- [ ] `sign_up`
- [ ] `purchase`
- [ ] `begin_checkout`
- [ ] `course_complete`
- [ ] `certificate_download`
- [ ] `webinar_register`
- [ ] `profile_completed`

---

## 9. Publish & QA

- [ ] **GTM → Preview** → load the prod site, accept analytics consent in the banner.
- [ ] Walk a journey: view a course → start → 25/50% → add to cart → (test) checkout. In Tag Assistant confirm the GA4 tags fire and parameters populate.
- [ ] **GA4 → Admin → DebugView** (Preview mode auto-enables debug) → confirm events + params + user properties arrive.
- [ ] **GA4 → Realtime** → confirm `page_view`, `login`, `view_item`, etc.
- [ ] Confirm **nothing fires before consent** (reject → reload → no GA4 hits) and **nothing on `/admin/**`\*\*.
- [ ] **Submit / Publish** the container version.

---

## Appendix A — Implemented events → parameters (source of truth)

| Event                                               | Params                                                                                             | Where it fires                                          |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `virtual_page_view`                                 | page_path, page_title                                                                              | every route (post-SEO)                                  |
| `element_click`                                     | click_tag, type_tag, click_text, click_id, click_element                                           | any `[data-click-tag]`                                  |
| `consent_update`                                    | analytics, marketing, functional                                                                   | consent saved (user-driven)                             |
| `otp_requested`                                     | method                                                                                             | AuthFacade.sendOtp                                      |
| `login` / `sign_up`                                 | method                                                                                             | AuthFacade.verifyOtp                                    |
| `profile_completed`                                 | — (user props attached)                                                                            | profile save (first complete)                           |
| `logout`                                            | —                                                                                                  | user-avatar-menu                                        |
| `view_item`                                         | course_id, course_name, course_type                                                                | course detail (mc / podcast / micro-learning / webinar) |
| `view_instructor`                                   | instructor_id, instructor_name                                                                     | instructor detail                                       |
| `search`                                            | search_term, result_id, result_type                                                                | global search select                                    |
| `bookmark_add` / `bookmark_remove`                  | course_id, course_type                                                                             | Utils.toggleBookmarkCourse                              |
| `start_course`                                      | course_id, course_type                                                                             | MasterclassFacade.launchCourse                          |
| `chapter_complete`                                  | course_id, chapter_id, course_type                                                                 | ChapterFacade.trackActivity                             |
| `course_complete`                                   | course_id, course_type                                                                             | last chapter completes                                  |
| `video_start` / `video_progress` / `video_complete` | course_id, course_type, chapter_id, (percent) — audio/podcast omits course_id                      | video/audio players                                     |
| `assessment_start`                                  | course_id, session_id, course_type                                                                 | exam load                                               |
| `assessment_submit`                                 | course_id, session_id, course_type, passed, score                                                  | exam submit                                             |
| `feedback_submit`                                   | course_id, course_type, feedback_count                                                             | feedback submit                                         |
| `certificate_download`                              | course_id, course_type, certificate_type, count                                                    | certificate dialog                                      |
| `badge_claim`                                       | badge_id, course_id, course_name, course_type (cpe-tracker tier badges: badge_id only)             | badge claim                                             |
| `add_to_cart`                                       | course_id, course_type, base_price, selling_price, product_discount, items[]                       | PaymentFacade.addToCart                                 |
| `cart_view`                                         | page_name (cart/billing/review), base_price, selling_price, product_discount, items[]              | each payment step (Payment shell)                       |
| `begin_checkout`                                    | cart_id, is_trial, base_price, selling_price, product_discount, items[]                            | PaymentFacade.proceedToPayment                          |
| `purchase`                                          | transaction_id, value, currency, base_price, selling_price, product_discount, paid_amount, items[] | invoice `?status=success`                               |
| `webinar_register`                                  | course_id, course_name, course_type (=`webinar`)                                                   | WebinarFacade.enroll + registration form                |
| `continue_learning_click`                           | course_id, course_type                                                                             | footer-overlay resume                                   |

`items[]` entries carry `{ course_id, course_type, price }`.

**User properties** (set via gtag + `user_data`): `user_id`, `plan_status`, `profile_completed`, `currently_working`, `sector`, `job_role`, `license_status`, `qualification_status`, `state_board`, `company`, `country`, `profession`.
