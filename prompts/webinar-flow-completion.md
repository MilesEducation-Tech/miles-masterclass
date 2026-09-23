# Webinar flow — alignment audit and completion plan

**Status:** awaiting approval. Nothing in this document is implemented yet.
**Branch:** `feat/webinar` (the ported module, uncommitted).

---

## 1. Goal

Take the webinar module from "the design and the feed are bound" to "the flow you described works
end to end": register → countdown → join → attendance → eligibility → feedback → certificate →
badge, on both the landing page and the per-webinar detail page, with `app-api/` never called.

## 2. What was read

- `src/app/features/offerings/webinar/**` (the whole ported module, 44 files).
- `postman/Merged_Masterclass_Backend_All_APIs.postman_collection.json` — 118 requests, including
  the full `EVENTS_API_CONTRACT_V1` text embedded in the Events request descriptions.
- `src/app/features/tracker/**` — the existing feedback → certificate → badge chain.
- `src/app/shared/dialogs/**` — `certificate-download-dialog`, `badge-claim-upsell-dialog`,
  `badge-info-dialog`, `webinar-details-dialog`.
- `src/app/core/services/auth-session/auth-session.ts`, `@core/guards/auth/auth.guard.ts`.

## 3. Verdict

**The module is about 60% aligned.** The shape is right and nothing needs re-architecting. What is
missing splits cleanly in two, and the split matters because only one half is ours to build:

- **Seven gaps are client-side and buildable now** (§5).
- **Seven are blocked on API that does not exist** (§6). Four of them are load-bearing for steps you
  described as required, so the flow cannot be finished without backend work.

---

## 4. Already aligned — no work needed

| Your step                             | Where it lives                                                                                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero = highlight webinar              | `WebinarFacade.heroWebinar` — `highlight_webinars[0] ?? upcoming_webinars[0]`, and `upcomingWebinars` de-dupes against it so it never renders twice |
| List of upcoming webinars             | `WebinarRail` + `WebinarCard`, fed by `upcomingWebinars`                                                                                            |
| Register calls the API                | `WebinarRegistration.register()` — the `202` handshake, the `409 registration_in_progress` retry, and the capped status poll                        |
| Countdown exists                      | `WebinarCountdown` + `ServerClock`, driven by `needsCountdown(cta)`                                                                                 |
| Join button appears in a window       | `ctaFor()` → `'join-open'` once `now >= joinOpensAt(card)`                                                                                          |
| One session at a time                 | `MeetingSession` — Web Locks (same browser), BroadcastChannel (same origin), server lease (cross-device)                                            |
| Absent / Eligible / Not Eligible tags | `WebinarCard.statusTag` — plus `Missed` for the fourth bucket                                                                                       |
| Detail page on its own route          | `webinar/:id`, bound to `web-api/v1/events/webinar-details-page/`, hero reused                                                                      |
| Type safety                           | No `any` anywhere in the module; `strictTemplates` on; 490 tests green                                                                              |
| Loading / error states                | Feed, detail and bookings all distinguish loading from error; `hasValue()` guards everywhere `Resource.value()` would throw                         |

---

## 5. Gaps we can close ourselves

### 5.1 The join window is 50 minutes, you said 15 — **one line, do first**

`environment.WEBINAR.joinWindowMinutes: 50` in all three environment files. `joinOpensAt()` and the
registration success toast both read it, so changing the constant changes both. `webinar-status.spec.ts`
has cases pinned to the 50-minute boundary and will need its fixtures moved.

### 5.2 No login gate on Register — **the biggest functional gap on the happy path**

A signed-out visitor sees `Register Now` (correct — `ctaFor` returns `'register'` when the
`registration` block is absent), clicks it, and `WebinarFacade.register()` posts straight to
`register-via-zoom`, which answers `401`. They get a generic error toast.

Build: before posting, `if (!auth.isAuthenticated())` open a dialog — "Sign in to register for this
webinar" — with a primary action routing to `/auth/login` carrying `redirect` back to the current
URL, exactly as `authGuard` already builds it. Then the learner lands back on the webinar and
registers. Applies to the list page, the detail page and the hero, so it belongs in the facade, not
in three components.

### 5.3 Countdown copy does not match

`formatCountdown` renders `4d 03h` / `3h 05m`. You described "This webinar starts in 4 days" and
"in 4 hours and 30 minutes". Add a long-form formatter beside the compact one (the compact form is
right for a card strip; the long form for the hero and the detail page) and let the caller choose.

### 5.4 Remove `allBookings` entirely

`WEBINAR_ENDPOINTS.allBookings` points at `web-api/v1/events/all-bookings/`, which 404s — the
contract records it moved to `app-api/` on 2026-09-17 and "the web twin is not built". **Under your
app-api rule it can never be called**, so a dead resource, its `linkedSignal`, its `bookingsByWebinarId`
map and the `BookingRow` plumbing in `WebinarCard`/`WebinarRail` should go rather than sit there
failing on every signed-in page load. This is a deletion, not a feature.

### 5.5 Make the app-api ban enforceable, not a convention

Right now nothing stops the next person reaching for `app-api/`. Two cheap guards, both proposed
rather than assumed:

- An ESLint `no-restricted-syntax` rule banning the `app-api/` string literal under `src/app/`, with
  the message naming this decision. (Touches `eslint.config.mjs`, which Phase 7 owns — worth a
  separate look so it does not collide with the boundaries config.)
- A line in AGENTS.md §6 next to the existing Django / Supabase / Partner-Platform split.

### 5.6 Feedback → certificate → badge is absent from the webinar module

The tracker already implements this chain for courses — `CpeRowAction = 'download' | 'feedback' |
'view_badge'`, `certificate-access-policy`, `certificate-download`, `certificate-download-dialog`,
`badge-claim-upsell-dialog`. The webinar cards have none of it: a `completed_webinar` row with
`eligible: true` renders a `CPE earned` label and stops.

The client half is straightforward reuse. **The server half is §6.4–6.6 and is not resolved**, so
this cannot be finished in the same pass — build it behind the same kind of capability flag as
`liveEnabled` if you want the UI ready ahead of the endpoints.

### 5.7 The detail page needs the same tail as the cards

Register / countdown / join already work there through the shared hero. Attendance status,
eligibility, feedback, certificate and badge do not — the detail page renders hero + about + FAQ
only. Once §5.6 exists, the same block goes here.

---

## 6. Blocked on the backend — raise these before committing to a date

### 6.1 "Waiting for attendance" is not expressible — **blocks your step G**

You asked for a waiting state after a webinar ends, until the real status arrives. The feed cannot
express it. `attended_status` is **not emitted on the card at all**; it only decides the bucket:

| `attended_status`                | Bucket              |
| -------------------------------- | ------------------- |
| `1` attended                     | `completed_webinar` |
| `2` not attended                 | `absent_webinar`    |
| `3` registered                   | `absent_webinar`    |
| `""` **MF has not reported yet** | `absent_webinar`    |
| `4` cancelled                    | `missed_webinar`    |

So a webinar that ended ten minutes ago and a genuine no-show are **the same bucket with the same
fields**. `webinar-card.ts` already carries this as a known defect in a comment. Ask for either
`attended_status` on the card, or a sixth bucket / boolean for "attendance pending".

### 6.2 "What did the user miss" has no data source — **blocks your step H**

`eligible` is a bare boolean on `completed_webinar`, and the contract is explicit that it is
deliberately NOT recomputed from durations. The numbers that would explain a `false` —
`attended_webinar_duration`, `total_webinar_duration`, poll counts — exist **only on
`app-api/v1/events/all-bookings/`**, which you have ruled out. Ask for them on the web surface.

### 6.3 The Meeting SDK has no endpoints — **blocks your steps E and F**

Already established and already gated behind `environment.WEBINAR.liveEnabled: false`. The contract
has **zero** `attendance-session/claim|heartbeat|release` and **zero** `meeting-sdk-signature`; the
strings `sdk` and `meeting` do not appear anywhere in 118 requests. The strict one-tab rule you want
is designed and coded, but its cross-device arbitration is the server lease — without it, only the
same-browser layers work.

### 6.4 Webinar feedback may not have an endpoint

Only `api/v1/masterclass-web/feedback-questions/{course_id}/` and
`.../feedback-submit/{course_id}/` exist. Webinars are UUID-keyed and are not masterclass courses.
**Question for the backend: does a webinar id work as `course_id` there, or is a webinar feedback
route still to be built?**

### 6.5 No webinar certificate endpoint on the web surface

The only certificate route in the collection is `api/v1/masterclass/webhooks/certificate/{id}/`, a
webhook in the app group. How a learner downloads a webinar certificate is unspecified.

### 6.6 Badge applicability is unconfirmed

`api/v1/caira/other-badge-status/` and `api/v1/masterclass-web/level-badge-clicked/` exist. Whether
either accepts a webinar is not stated.

### 6.7 The join window should be a server rule

`join_opens_at` appears **0 times** in the contract, so the 15-minute rule will be computed
client-side from `start_date_time`. That means a clock-skewed browser can show Join early and have
the server refuse it. `ServerClock` already syncs off `server_time` in the feed, which limits the
damage — but the window belongs on one side of the wire. Ask for `join_opens_at`.

---

## 7. Proposed order

| Phase | Contents                                                                           | Depends on                        |
| ----- | ---------------------------------------------------------------------------------- | --------------------------------- |
| **A** | §5.1 window → 15m, §5.2 login gate, §5.3 countdown copy, §5.4 delete `allBookings` | nothing — ship immediately        |
| **B** | §5.5 app-api guard (lint rule + AGENTS.md)                                         | a look at Phase 7's eslint config |
| **C** | §5.6 + §5.7 feedback → certificate → badge, behind a capability flag               | §6.4, §6.5, §6.6 answered         |
| **D** | Attendance-pending state + "what you missed"                                       | §6.1 and §6.2 shipped             |
| **E** | Flip `liveEnabled`, verify the lease end to end                                    | §6.3 shipped                      |

**Phase A is the whole of what can be finished today**, and it closes the one gap that breaks the
happy path for a signed-out visitor.

## 8. Acceptance criteria for Phase A

- Signed out, clicking Register opens the sign-in dialog and never fires `register-via-zoom`.
- After signing in, the learner returns to the webinar they came from.
- A registered webinar shows the long-form countdown; Join appears at **start − 15 min**, not 50.
- No request to `all-bookings` is made on any page load, signed in or out.
- `pnpm lint` stays at exactly the 8 known Phase 7 errors; `pnpm test` green with updated
  boundary fixtures; `tsc --noEmit` exits 0; `build:prod` green.
- The three budget warnings stay at their documented pre-existing values.

## 9. Risks

- **§5.4 is a deletion across four files** (`webinar.model.ts`, `webinar-facade.ts`,
  `webinar-card.ts`, `webinar-rail.ts`). `BookingRow` is an input on two components; removing it
  changes their public surface. Contained, but not a one-liner.
- **§5.1 moves a documented boundary.** `webinar-status.spec.ts` asserts around 50 minutes; those
  fixtures must move with it or the suite goes red for the right reason.
- **§5.2 must not double-prompt.** `authGuard` already redirects on `/live`; the dialog is for the
  Register action, and the two should not both fire.
