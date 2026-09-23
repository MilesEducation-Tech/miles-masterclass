# Webinar (Events v1) — open questions for the backend

**From:** Masterclass web (Angular SSR)
**Against:** `EVENTS_API_CONTRACT_V1`, as published in `postman/Merged_Masterclass_Backend_All_APIs.postman_collection.json`
**Date raised:** 2026-09-23

Every claim below is checkable against that collection — 118 requests. Where we say a field or route
does not exist, we mean it returns zero matches across the whole file, not that we could not find it.

## Context: one rule that shapes all of this

**The web app will not call `app-api/` routes.** That surface is the mobile app's. Two routes in the
collection are `app-api`-only today:

| Route                                     | Web twin?                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `app-api/v1/events/webinar-details-page/` | ✅ `web-api/v1/events/webinar-details-page/` — we use this one                              |
| `app-api/v1/events/all-bookings/`         | ❌ contract says "MOVED FROM `web-api/` ON 2026-09-17… App only; the web twin is not built" |

That second one is the root of questions 1 and 2.

---

## Blocking — these stop described product behaviour from being built

### Q1. We cannot tell "attendance not reported yet" from "did not attend"

**Wanted:** after a webinar ends, show _"attendance pending"_ until the real status arrives, then
resolve to eligible / not eligible.

**Why we can't:** `attended_status` is not emitted on the card at all — it only decides the bucket,
and three different meanings collapse into one:

| `attended_status` | Bucket           | What it actually means           |
| ----------------- | ---------------- | -------------------------------- |
| `2`               | `absent_webinar` | did not attend                   |
| `3`               | `absent_webinar` | registered, no attendance record |
| `""`              | `absent_webinar` | **MF has not reported yet**      |

A webinar that ended ten minutes ago and a genuine no-show arrive as byte-identical objects. Today
we are forced to label both **Absent**, which is wrong for the first and visible to the learner.

**Ask:** either emit `attended_status` on the card, or add an explicit `attendance_pending` boolean
(or a sixth bucket). Emitting the raw field is our preference — one value, no new bucket rules.

### Q2. "What did you miss?" has no data on any web route

**Wanted:** when a learner is **Not Eligible**, show why — the design's
`110/120 Minutes | 7 out of 8 Poll Questions Answered` line.

**Why we can't:** those four fields — `attended_webinar_duration`, `total_webinar_duration`,
`poll_questions_answered`, `total_poll_questions_available` — exist only on
`app-api/v1/events/all-bookings/`. `eligible` on `completed_webinar` is a bare boolean, and the
contract is explicit (§8.2) that it is deliberately not recomputed from durations, so we cannot
derive the numbers either.

We have **removed** the component that rendered that line rather than ship markup that can never
populate. Restoring it is a few lines once the data exists.

**Ask:** put those four fields on a web surface — either on the `completed_webinar` card in
`webinar-main-page`, or on `webinar-details-page`. A full `all-bookings` web twin also works but is
more than we need.

### Q3. The Meeting SDK has no endpoints

**Wanted:** Join opens an embedded Zoom session in our LMS, with a hard "one session at a time"
rule across tabs, windows and devices.

**Why we can't:** none of these exist in the contract:

- `meeting-sdk-signature` — 0 matches
- `attendance-session/claim` — 0 matches
- `attendance-session/heartbeat` — 0 matches
- `attendance-session/release` — 0 matches

For confirmation: the substrings `sdk` and `meeting` appear **zero times** in the entire collection.
`registration.route_to_web_lms` exists and is documented as "true only for an internal test user on
a CAIRA webinar today", which implies the surface is planned.

The client for all four is written and tested; it is disabled behind a flag and Join currently goes
to the registrant's `join_url` in Zoom instead. Flipping one boolean turns it on.

**Ask:** confirm these are planned and share the shapes. Three specifics we will need:

1. **Is the server lease the arbiter across devices?** Web Locks and BroadcastChannel only cover one
   browser. Without a server-side lease, "one session at a time" cannot be enforced across a phone
   and a laptop.
2. **`attendance-session/release` and `sendBeacon`.** On tab close, a normal request is cancelled
   with the document, so the only reliable call is `navigator.sendBeacon`. It **cannot set headers**
   (so no `Authorization`), and a cross-origin `application/json` body needs a CORS preflight that
   `sendBeacon` cannot perform. Either the route accepts a release keyed on `session_id` alone with
   a `text/plain` body, or tab-close release cannot work and we rely on the lease TTL.
3. **What is the lease TTL and the expected heartbeat cadence?** We currently assume 45s / 15s.

### Q4. Webinar feedback, certificate and badge routes are unidentified

**Wanted:** eligible learner → submit feedback → download certificate → claim badge.

**What exists:**

| Purpose            | Route found                                                                       | Problem                                                 |
| ------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Feedback questions | `api/v1/masterclass-web/feedback-questions/{course_id}/`                          | Webinars are UUID-keyed and are not masterclass courses |
| Feedback submit    | `api/v1/masterclass-web/feedback-submit/{course_id}/`                             | Same                                                    |
| Certificate        | `api/v1/masterclass/webhooks/certificate/{id}/`                                   | A webhook, in the app group — not a learner download    |
| Badge              | `api/v1/caira/other-badge-status/`, `api/v1/masterclass-web/level-badge-clicked/` | Applicability to webinars not stated                    |

**Ask, three separate yes/no answers:**

1. Does a webinar UUID work as `{course_id}` on the two `masterclass-web` feedback routes, or is a
   webinar feedback route still to be built?
2. How does a learner download a **webinar** certificate on web? We found no route.
3. Do `other-badge-status` / `level-badge-clicked` accept a webinar?

---

## Non-blocking — correctness and robustness

### Q5. `join_opens_at` is documented client-side but never sent

The card type carries `join_opens_at` as optional and our code prefers it — but it appears **0
times** in the contract. So the join window is computed in the browser as
`start_date_time − 15 minutes`, which means a learner with a skewed clock can be shown **Join** before
the server will honour it. We mitigate with `server_time` from the feed, but the window is a business
rule and belongs on your side.

**Ask:** emit `join_opens_at` per registration.

### Q6. `registrant_token` is likewise absent

0 matches. We currently parse the `tk` query parameter out of `join_url`, which breaks the moment
Zoom changes that URL shape and gives no signal when it silently finds nothing. Needed by the SDK
path in Q3.

**Ask:** emit `registrant_token` alongside `join_url`.

### Q7. `product` vs `subject` — the open maintainer decision (contract §9.8)

`webinar-details-page` reports both, and the contract says which one wins has not been decided. The
detail page renders one of them. **Ask:** which is authoritative for display?

### Q8. `webinar-main-page` does not filter by enrolment (contract §9.2)

`show_webinar_as_per_enrollment` is not applied, so the signed-in upcoming list is wider than it
should be. Flagging that we are aware, and asking whether it is scheduled — a learner seeing a
webinar they cannot attend is a support ticket.

---

## Summary

| #   | Question                                      | Blocks                               |
| --- | --------------------------------------------- | ------------------------------------ |
| Q1  | `attended_status` / attendance-pending signal | "waiting for attendance" state       |
| Q2  | Duration + poll fields on a web route         | "what did you miss" for Not Eligible |
| Q3  | Meeting SDK signature + session lease routes  | embedded join, one-session-at-a-time |
| Q4  | Webinar feedback / certificate / badge routes | the whole post-attendance chain      |
| Q5  | `join_opens_at`                               | correctness of the join window       |
| Q6  | `registrant_token`                            | SDK join without URL parsing         |
| Q7  | `product` vs `subject`                        | detail page display only             |
| Q8  | Enrolment filtering                           | list relevance                       |

**Q1–Q4 are the ones that block shipping the flow as specified.** Everything else in the module is
built and working against the contract as it stands.
