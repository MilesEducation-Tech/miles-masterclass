# Netcore Smartech — Integration & Go-Live Checklist

Derived from the actual integration in [`analytics.ts`](src/app/shared/core/services/analytics/analytics.ts), [`environment.ts`](src/environments/environment.ts), and [`service-worker.ts`](src/service-worker.ts). Everything Netcore-related is **prod-only, marketing-consent-gated, and `/admin/**`-excluded** by the `Analytics` service.

> Two halves to every item: **CODE** = already shipped in this repo; **PANEL** = must be configured in the Netcore Smartech dashboard for the code to actually do anything. The SDK calls silently no-op when the panel side is missing.

---

## 0. How it's wired (reference)

| Call                                     | Code                | Panel meaning                                              |
| ---------------------------------------- | ------------------- | ---------------------------------------------------------- |
| `smartech('create', siteKey)`            | `injectNetcore()`   | Panel/account id — `ADGMOT35…SGIG`                         |
| `smartech('register', appId)`            | `injectNetcore()`   | Website id (siteid) — `6c3aae6d…b9e5` (prod)               |
| `smartech('identify', key)`              | `setNetcoreUser()`  | Contact identity = `miles_user_id` (fallback numeric `id`) |
| `smartech('contact', listId, {...})`     | `setNetcoreUser()`  | Contact-attribute sync — **gated on `netcore.listId`**     |
| `smartech('dispatch', name, params)`     | `trackEvent()`      | Activity/event ingestion                                   |
| `smartech('dispatch', 'Page Browse', …)` | `trackPageView()`   | Page-browse activity                                       |
| `/sw.js` (FCM + siteid)                  | `service-worker.ts` | Web-push service worker                                    |

SDK script: `//cdnt.netcoresmartech.com/smartechclient.js`. SW: `//cdnt.netcoresmartech.com/swv4.js` via the served `/sw.js`.

---

## 1. Panel / account setup

- [ ] **Confirm `siteKey` (panel id)** matches the Netcore panel — `ADGMOT35CHFLVDHBJNIG50K96976B8VTENB58JOU9LNN0KVISGIG`.
- [ ] **Confirm `appId` (website/siteid)** per environment — already split: prod `6c3aae6d023e873fc9bf2863a30bb9e5`, UAT/dev `ef86e2c70627d3e863c7fe3381488e05`. Verify each maps to the right website in the panel so non-prod traffic stays out of prod contacts.
- [ ] **Data center**: `scriptUrl` uses the default DC (`//cdnt.netcoresmartech.com/...`). Confirm the panel lives on the default DC, not a regional one (`ap*`). If regional, update `scriptUrl` **and** the `importScripts` URL in `service-worker.ts`.
- [ ] **Whitelist domains** in the panel (Settings → Website) for every prod/UAT origin so the SDK accepts hits.

---

## 2. Contact identity & attributes ⚠️ currently disabled

- [ ] **`netcore.listId` is empty (`''`)** in `environment.ts` → `smartech('contact', …)` **never fires**, so **no user attributes reach Netcore today**. Identity (`identify`) works; segmentation attributes do not.
- [ ] Create a **Contact List** in the panel (Data → Contacts), put its id into `netcore.listId`.
- [ ] In the panel, **pre-create every contact attribute** below (Data → Contacts → Attributes) — Netcore drops attributes that don't exist. These are the keys sent by `userProperties()`:
  - [ ] `pk^customerid` (primary key)
  - [ ] `profile_completed`
  - [ ] `plan_status`
  - [ ] `currently_working`
  - [ ] `sector`
  - [ ] `job_role`
  - [ ] `license_status`
  - [ ] `qualification_status`
  - [ ] `state_board`
  - [ ] `company`
  - [ ] `country`
  - [ ] `profession`
- [ ] Verify the **primary key** strategy: identity = `miles_user_id || id`. Confirm GA4 `user_id` and Netcore `customerid` use the **same** key so cross-system stitching holds.
- [ ] Confirm **logout** behaviour: code does `gtag set user_id null` but does **not** call `smartech('identify','')` on logout (only on anonymous SDK boot). Decide if a Netcore de-identify on logout is needed for shared devices.

---

## 3. Events / activities to register in the panel

Every `trackEvent()` / `trackPurchase()` / `trackPageView()` dispatches to Netcore. Register each as an **activity** (Data → Activities) so it's usable in segments/journeys. **Param caveat:** `flattenParams()` strips arrays/objects — so **`items[]` never reaches Netcore**; ecommerce events arrive with scalar fields only (`value`, `currency`, `transaction_id`, `coupon`).

**System**

- [ ] `Page Browse` — `{ page_url }`
- [ ] `element_click` — `{ click_tag, type_tag, click_text, click_id, click_element }` (fires on every `[data-click-tag]`)
- [ ] `consent_update` — `{ analytics, marketing, functional }`

**Activation**

- [ ] `otp_requested` — `{ method }`
- [ ] `login` — `{ method }`
- [ ] `sign_up` — `{ method }`
- [ ] `profile_completed` — `{}`
- [ ] `logout` — `{}`

**Discovery**

- [ ] `view_item` — `{ item_id, item_name, course_type, … }`
- [ ] `view_instructor` — `{ instructor_id, instructor_name }`
- [ ] `search` — `{ search_term }`
- [ ] `bookmark_add` / `bookmark_remove` — `{ item_id, … }`

**Learning**

- [ ] `start_course` — `{ course_id, course_type }`
- [ ] `chapter_complete` — `{ course_id, chapter_id }`
- [ ] `course_complete` — `{ course_id, course_type }`
- [ ] `video_start` / `video_progress` / `video_complete` — `{ course_id, chapter_id, percent }` (video **and** audio chapters)
- [ ] `assessment_start` — `{ course_id, session_id }`
- [ ] `assessment_submit` — `{ course_id, session_id, score, passed }`
- [ ] `feedback_submit` — `{ course_id, … }`
- [ ] `certificate_download` — `{ course_id, … }`
- [ ] `badge_claim` — `{ badge_id, … }`

**Commerce** (items[] dropped — scalars only)

- [ ] `add_to_cart` — `{ value, currency }`
- [ ] `cart_view` — `{ … }`
- [ ] `begin_checkout` — `{ value, coupon }`
- [ ] `purchase` — `{ transaction_id, value, currency, coupon }` (deduped by `transaction_id` client-side)

**Engagement**

- [ ] `webinar_register` — `{ webinar_id, webinar_title }`
- [ ] `continue_learning_click` — `{ course_id }`

**⚠️ NOT sent to Netcore (GA4/dataLayer only)** — `account_create`, `onboarding`, `profile_update` (via `emitLifecycle`), `virtual_page_view`, `user_data`. If Netcore journeys need onboarding/account-create signals, route them through `trackEvent` or add an explicit `smartech('dispatch', …)`.

---

## 4. Web push

- [ ] `netcore.webPush: true` and `swPath: '/sw.js'` set (done).
- [ ] **`/sw.js` is served by SSR**, not a static file — confirm `registerServiceWorkerRoute` runs in `server.ts` and `/sw.js` returns the `var config = {…}; importScripts("//cdnt.netcoresmartech.com/swv4.js")` body in **every** deployed env.
- [ ] Verify served `/sw.js` headers: `Content-Type: text/javascript`, `Service-Worker-Allowed: /`, `Cache-Control: no-cache`.
- [ ] **FCM credentials** in `netcore.push` (apiKey, messagingSenderId, appId, projectId=`miles-masterclass`) match the FCM project linked in the Netcore panel (Settings → Push → Web Push / FCM).
- [ ] Panel: upload the **same FCM server key / VAPID** config so Netcore can deliver to tokens.
- [ ] Confirm push only registers under **marketing consent** (it's inside `injectNetcore`, which only runs on marketing grant) — and that this is the intended gating.
- [ ] Test: grant consent → permission prompt → token registered → send a test campaign → `notification_click` lands.

---

## 5. Consent & privacy

- [ ] Netcore SDK loads **only on marketing consent** (`applyConsent` → `injectNetcore`). Verify denying marketing keeps `smartechclient.js` out of the DOM and fires no hits.
- [ ] `consent_update` activity is dispatched on user-driven changes — confirm it's an activity in the panel for suppression journeys.
- [ ] **No raw PII** in any attribute/event (ids + categories only). Audit confirms `userProperties()` sends no email/phone/name. Keep new attributes PII-free.
- [ ] Click text is truncated to 100 chars and suppressed on `[data-click-notext]` / `[data-clarity-mask]` — verify PII-bearing CTAs carry one of these.

---

## 6. QA / verification (per environment, prod-only)

- [ ] On a prod-config build, accept marketing consent → confirm `#smtclient_v1` script + `window.smartech` exist; on a dev build (`ANALYTICS.enabled=false`) confirm it does **not** load.
- [ ] Network: `smartechclient.js` loads from the correct DC; dispatch calls return 200.
- [ ] Log in → panel shows the contact under `miles_user_id` with all §2 attributes populated (only works once `listId` is set).
- [ ] Walk the funnel (view_item → start_course → video_progress → course_complete → certificate_download → badge_claim) → each activity appears on the contact timeline.
- [ ] Run a purchase → exactly **one** `purchase` activity (refresh the invoice page → still one, dedupe holds).
- [ ] `/admin/**` route → zero Netcore hits.
- [ ] Build a smoke **segment** (e.g. `start_course` and no `course_complete` in 7d) and confirm it populates → proves activities + attributes are queryable.

---

## 7. Action items (gaps found in code)

1. **Set `netcore.listId`** — without it, zero user attributes sync to Netcore. Highest priority.
2. **Pre-create all §2 attributes + §3 activities** in the panel before relying on segments.
3. **`items[]` is stripped** before Netcore — if cart/catalog segmentation needs item ids, send a flattened scalar (e.g. `item_ids: "a,b,c"`) alongside the array.
4. **Lifecycle events** (`account_create`/`onboarding`/`profile_update`) don't reach Netcore — add dispatch if journeys need them.
5. **Map each `appId` to the right panel website** — prod/UAT siteids are already split in the env files; just confirm the panel side matches.
