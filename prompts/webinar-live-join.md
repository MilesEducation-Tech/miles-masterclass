# Webinar live join on the Events meeting-SDK API (MIL-43)

Story: **MIL-43**, `feat(offerings): join live webinars in the app, one session at a time`. This is also the PR
title.
Route: `/:country/:profession_type/webinar/:id/live` → `webinar/pages/webinar-live/`.
Branch: `feat/MIL-43-webinar-live-join`, from `master` at `741d0f7`.

**Status:** approved 2026-10-09 with D1, D2 and D4 as recommended and D3 as one PR. All three phases are
implemented and the gates are green. The browser check is partial, because UAT was down (see "Implementation
notes" at the end).

---

## Assumptions (read these first)

1. **Most of the client already exists, switched off.** The lease client (`MeetingSession`), the SDK wrapper
   (`ZoomMeetingClient`), the `/live` page and its route were written against this same spec and ship off
   behind `environment.WEBINAR.liveEnabled: false`. This ticket binds them to the real contract, makes them
   type-safe at runtime, fixes the gaps below and turns them on. It is not a rebuild.
2. **"Harness" means the AGENTS.md loop:** plan, approval, implement, gates, then browser verification. The
   repo has no tests (CLAUDE.md), so verification is the gates plus the running app, not a test harness.
3. **Production stays off in this ticket.** Vercel previews build with `development` (`vercel.sh`), so
   turning the flag on in `development` and `local` puts it on every preview for QA. Production
   (`environment.ts`) turns on in a one-line follow-up after QA signs off. See D1.
4. **The backend's own per-webinar switch still applies.** `registration.route_to_web_lms` must be `true`
   for the embedded path. The contract documents it as "true only for an internal test user on a CAIRA
   webinar today", so even with the flag on, real learners keep going to Zoom until the backend widens it.
   That makes the rollout safe, and it also means QA needs that test user (see Risks).
5. **The project skills named in AGENTS.md §10 don't exist on disk.** `.claude/skills/` holds only the
   refactor and release skills, so this plan follows AGENTS.md, CLAUDE.md, the reviewer's recorded
   preferences and the MIL-25 precedent.
6. **UAT was down when this was written** (2026-10-09). Every route answered `503`, including the known
   `webinar-main-page`, so the four routes being live on UAT is **not yet confirmed**. Re-probe before
   Phase 3 (see How to verify).

## Goal

Join on a webinar opens Zoom inside the LMS for a registered learner, with one live session per learner
across tabs, browsers and devices. Every response is parsed at the boundary. Every refusal renders a clear
state: no endless spinner and no unhandled promise. The Zoom secret never reaches the browser.

## Bugs in the existing code (the serious ones)

The full list is the 15 gaps under "Gaps in today's client". These four would reach learners the moment the
flag turns on, so they are fixed in P2 and each one has its own acceptance criterion.

1. **Closing the tab never releases the session (G1).**
   - **Where:** `services/meeting-session.ts`, `beaconRelease()` builds the beacon body as a `Blob` of
     type `application/json`.
   - **Why it fails:** a cross-origin `application/json` POST needs a CORS preflight, and `sendBeacon`
     can't make one. The browser drops the request silently while the tab closes.
   - **Effect:** the lease lives on until its 45 s TTL. A learner who closes the laptop tab and opens the
     webinar on their phone sees "already in a session" for up to 45 s.
   - **Fix:** pass the JSON string to `sendBeacon`, so the body goes as `text/plain;charset=UTF-8`, which
     the release route parses as JSON (per the spec and Postman).
   - **Proof:** acceptance criterion 4.
2. **Refusals leave an endless spinner (G4).**
   - **Where:**
     - `MeetingSession.acquire()` rethrows every refusal except `session_active`.
     - `WebinarLive.start()` has `try/finally` and no `catch`, and both of its callers fire it with
       `void`.
   - **Effect:**
     - `not_registered`, `join_window_not_open`, `webinar_ended`, `webinar_not_found`, an expired session
       and a network failure all leave the phase at `preflight`, so the page shows "Checking your seat…"
       forever.
     - Each one is also an unhandled promise rejection.
   - **Fix:** a typed `refusal` state on `LiveSessionFacade`, with its own copy and action per code (the
     "Room states" table below). If the signature step refuses after the claim succeeded, the lease is
     released first.
   - **Proof:** acceptance criterion 6.
3. **Responses are not checked (G2, G3, G8).**
   - **Where:** `api.post<ClaimResponse>`, `api.post<SignatureResponse>` and `api.post<HeartbeatResponse>`
     are type assertions, not checks. `readHolder()` casts the 409 body.
   - **Effect:**
     - A missing or renamed `signature`, `sdk_key` or `meeting_number` reaches Zoom as `undefined` and
       fails deep inside the SDK with an error that names none of them.
     - A bad `heartbeat_interval_seconds` can become `setInterval(fn, 0)`.
   - **Fix:** `parseClaim`, `parseSignature`, `parseHeartbeat` and `parseLeaseHolder` in
     `models/meeting-session.model.ts`, built on `@features/offerings/utils/contract-guards`. This is the
     same guard set the course page uses, applied through `map()` on `ApiClient.call()`.
     - A response that fails the contract becomes `unknown_error` with a log line that names the route.
     - `lease_expires_at` is optional on the signature: the spec sends it and Postman's example doesn't.
     - The interval is accepted only between 5 and 30 s (G5).
   - **Proof:** acceptance criterion 6 (the "other" row), plus `pnpm lint` with no casts on response
     bodies.
4. **Reloading `/live` loses the webinar (G7).**
   - **Where:** `WebinarLive` sets `webinar` once, from `facade.findById(id)`, when the page starts.
   - **Effect:** on a reload or a deep link, the feed hasn't loaded yet, so the lookup returns `null` and
     never runs again:
     - the title stays "Webinar"
     - on a phone, the "Open in Zoom" link never appears ("Your join link is not ready yet" forever)
   - **Fix:** a `computed` in the facade that reads the feed, and falls back to `showDetail(id)` →
     `detailWebinar()` for a webinar outside the feed. Both answers carry `registration.join_url`.
   - **Proof:** acceptance criterion 9.

## What I read

- **The spec:** `WEBINAR_API_SPEC.md` (the request you sent the backend): §1.1–1.4, lease rules and flow.
- **Postman:** `postman/Merged_Masterclass_Backend_All_APIs.postman_collection.json`, folder
  "06. Events and Bookings":
  - the four `UNIVERSAL POST` requests (claim, heartbeat, release, meeting-sdk-signature), with their
    descriptions, body templates and saved examples
  - every other request in that folder, sorted by role (19 requests in total):

    | Request                                                             | Role in MIL-43                                                                                                             |
    | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
    | `UNIVERSAL POST` claim, heartbeat, release, meeting-sdk-signature   | **Bound by this ticket**                                                                                                   |
    | `UNIVERSAL POST register-via-zoom` + `GET register-via-zoom-status` | Already bound (`WebinarRegistration`). A prerequisite: claim answers `not_registered` without a booking                    |
    | `WEB GET webinar-main-page`, `webinar-details-page`                 | Already bound (`WebinarFacade`). They supply `registration.route_to_web_lms` and `join_url`, which choose embedded or Zoom |
    | `WEB GET all-bookings`                                              | Not bound anywhere, and not part of the join flow. It is the web twin Q1/Q2 asked for: a follow-up                         |
    | `WEB GET highlight-webinars`                                        | Not bound. It is the home page's pre-login webinar rail, which belongs to a home-page ticket                               |
    | every `APP` request, e.g. `app-events-webinar-attendance-v1`        | `app-api/`, out of bounds for the web app (AGENTS.md §6)                                                                   |
- **The webinar code:**
  - `services/`: `meeting-session.ts`, `zoom-meeting-client.ts`, `webinar-facade.ts`
  - `models/`: `meeting-session.model.ts`, `webinar.model.ts` (guards, `registrationOf`)
  - `utils/`: `webinar-error.ts`, `join-target.ts`
  - `pages/`: `webinar-live/*`, plus `webinar-detail.ts` and `webinar-list.ts` (`onJoin`)
  - `components/meeting-stage/*`
  - `webinar.routes.ts`
- **Core:** `api-client.ts` (`call()`, `apiUrl()`), `http.model.ts` (`RouteConfig`, `SKIP_LOADING`),
  `features/offerings/utils/contract-guards.ts`, `app.routes.server.ts` (`*/live` is `RenderMode.Client`).
- **Config:**
  - the three `environment*.ts` files
  - `angular.json` `fileReplacements`
  - `vercel.sh`
  - `vercel.json`: CSP, COOP `same-origin`, COEP `credentialless`, and `Permissions-Policy` with camera
    and microphone set to `self`
- **Zoom:** `@zoom/meetingsdk` 6.5.0 `embedded.d.ts` (`InitOptions.leaveOnPageUnload`, `patchJsMedia`,
  `createClient`). Its React 18 and Redux peers are installed by pnpm inside the SDK's own folder, so they
  stay in the SDK's lazy chunk.
- **Docs and reviewer preferences:**
  - `docs/WEBINAR_API_QUESTIONS.md`: Q3, Q5 and Q6
  - the reviewer's recorded preferences: types in `models/`, config in `constants/`, components inject the
    facade, no input/output relay through a page

## Contract (Postman, 2026-10-09)

Successful bodies carry `"status": "success"` with the result **merged in at the top level**, not under
`data`. Requests go through a `StrictInputSerializer`, which **rejects undeclared keys with a 400** rather
than ignoring them, so we send exactly the declared fields.

### `POST api/v1/events/attendance-session/claim/` (IsAuthenticated)

```json
// request: device_label is in the template but missing from the spec
{ "webinar_id": "<uuid>", "session_id": "<uuid>", "takeover": false, "surface": "web", "device_label": "Chrome on macOS" }
// 200
{ "status": "success", "session_id": "<uuid>", "lease_expires_at": "<iso>", "heartbeat_interval_seconds": 15 }
```

- **404:** `webinar_not_found`.
- **409:**
  - `not_registered`
  - `join_window_not_open`, which may carry `join_opens_at`
  - `webinar_ended`
  - `session_active`, which carries `holder: { surface, webinar_name, started_at, last_seen_at, device_label }`
- A repeat claim from the same `session_id` answers 200.

### `POST api/v1/events/meeting-sdk-signature/` (IsAuthenticated, lease holder only)

```json
// request
{ "webinar_id": "<uuid>", "session_id": "<uuid>", "surface": "web" }
// 200: NO lease_expires_at, unlike the spec
{ "status": "success", "signature": "<jwt>", "sdk_key": "<key>", "meeting_number": "<string>", "password": "",
  "registrant_token": "<tk or null>", "user_name": "<full name, may be ''>", "user_email": "<registered_email>",
  "expires_at": "<iso>", "session_id": "<uuid>", "heartbeat_interval_seconds": 15 }
```

- **409:** `session_superseded`, `not_registered`, `join_window_not_open`, `webinar_ended`.
- `user_name` is `(get_full_name() or '').strip()`, so it **can be empty**, and Zoom refuses an empty
  `userName`.

### `POST api/v1/events/attendance-session/heartbeat/` (IsAuthenticated)

```json
{ "session_id": "<uuid>" } // → 200 { "status": "success", "lease_expires_at": "<iso>" }
```

- The only refusal is `409 session_superseded`. A lapsed lease that nobody else claimed is re-granted
  with a 200.
- Every other failure is transient by contract, so the client keeps beating.

### `POST api/v1/events/attendance-session/release/` (AllowAny, CSRF-exempt)

- **Body:** `{"session_id":"<uuid>"}`, sent as `text/plain;charset=UTF-8` from a beacon.
- **Response:** always `204`, including for an unknown id.
- **Two callers:**
  - Leave: a normal authenticated JSON POST.
  - Tab close: `navigator.sendBeacon` with no headers and a `text/plain` body. This avoids the CORS
    preflight a beacon cannot make.

### Error envelopes

`toWebinarError` already handles all four shapes:

- `400 { <field>: "Unrecognised field…" }`: undeclared key
- `400 { status, code: "invalid_request", errors }`
- `400 { status, message, details }`: release
- `403 { detail }`: no or bad token, which maps to `authentication_failed`

## Gaps in today's client

| #   | Gap                                                                                                                                   | Effect                                                                                                                                                 | Fix (phase)                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| G1  | The beacon release sends `application/json`                                                                                           | The cross-origin preflight can't run from a beacon, so tab-close **never** releases and the learner waits 45 s to rejoin elsewhere                     | Send the JSON **string**, so the body is `text/plain;charset=UTF-8` (P2)                          |
| G2  | Responses are cast (`api.post<ClaimResponse>`), not parsed                                                                            | A missing `signature`/`sdk_key` reaches Zoom as `undefined` and fails deep in the SDK                                                                  | `parseClaim`, `parseSignature`, `parseHeartbeat`, `parseLeaseHolder` on the offerings guards (P2) |
| G3  | `SignatureResponse.lease_expires_at` is declared but never sent                                                                       | A strict parser would reject every signature                                                                                                           | Make it optional (P2)                                                                             |
| G4  | `acquire()` rethrows non-conflict refusals. `start()` has `try/finally` and no `catch`, and is called as `void`                       | `not_registered`, `join_window_not_open`, `webinar_ended`, 404 and network errors leave **"Checking your seat…" forever**, plus an unhandled rejection | A typed `refusal` state with per-code copy and actions (P2)                                       |
| G5  | `heartbeat_interval_seconds` is trusted raw                                                                                           | `0` or a string becomes `setInterval(fn, 0)` and hammers the API                                                                                       | Accept 5–30 s; otherwise use the environment default (P2)                                         |
| G6  | An empty `user_name` is passed to Zoom                                                                                                | Zoom rejects the join                                                                                                                                  | Fall back to the part of `user_email` before the `@` (P2)                                         |
| G7  | `webinar.set(findById(id))` runs once                                                                                                 | A cold deep link or reload of `/live` has no feed yet, so the title is stuck on "Webinar" and the mobile link on "refresh in a moment"                 | A `computed` over the feed, falling back to `showDetail(id)` → `detailWebinar()` (P2)             |
| G8  | `readHolder` casts the 409 body                                                                                                       | A malformed `holder` renders `undefined`                                                                                                               | `parseLeaseHolder` guard (P2)                                                                     |
| G9  | The Zoom client is `createClient() as unknown as` a hand-written interface                                                            | No compile-time check against the real SDK                                                                                                             | `import type` the SDK's own types (erased at build, so no bundle cost) (P2)                       |
| G10 | Claim sends no `device_label`                                                                                                         | The other device's dialog can't say "open in Chrome on macOS", which is the point of `holder`                                                          | `utils/device-label.ts` (P2)                                                                      |
| G11 | bfcache restore after a tab-close beacon                                                                                              | The beacon gave the lease back and Zoom left on unload, but the page still shows the stage as live                                                     | On `pageshow.persisted` after a beacon, evict as `connection-lost` and offer Rejoin (P2)          |
| G12 | The host ending the webinar shows "You have left the session" next to a dead stage. The ejection screen's only action is a takeover   | A confusing dead end                                                                                                                                   | Use the existing `meeting-ended` reason, with a "Back to webinar" action (P2)                     |
| G13 | Endpoints are absolute strings built from `environment.BASE_API_URL` and sent through bare `api.post`                                 | They bypass the typed `RouteConfig` registry that AGENTS.md §6 requires                                                                                | `LIVE_SESSION_ROUTES` + `ApiClient.call()` (P2)                                                   |
| G14 | The page holds the join orchestration and relays `title`/`isPreparing`/`statusText`/`leave` into `MeetingStage` as inputs and outputs | Breaks "components display, facades decide" and the reviewer's no-relay rule                                                                           | `LiveSessionFacade` (P1)                                                                          |
| G15 | Comments, the environment docs and `WEBINAR_API_QUESTIONS.md` Q3/Q6 still say the endpoints don't exist                               | Stale docs                                                                                                                                             | Update (P3)                                                                                       |

## Decisions to confirm

- **D1: Turn on outside production only.**
  - `liveEnabled: true` in `environment.development.ts` and `environment.local.ts`. Every Vercel preview
    and `pnpm start` then gets it.
  - `environment.ts` stays `false` until QA signs off on a preview; that flip is a one-line follow-up PR.
  - Recommended. The alternative is turning production on in this PR, which is still gated per webinar
    by `route_to_web_lms`.
- **D2: Send `device_label`, built in the browser.**
  - The format is `"<Browser> on <OS>"`, e.g. "Chrome on macOS" or "Safari on iOS". It comes from
    `navigator.userAgentData` where available, otherwise a small UA match covering Edge, Chrome, Firefox
    and Safari on Windows, macOS, iOS, Android and Linux.
  - It is capped at 64 characters, and falls back to `"Web browser"`.
  - It describes the device, not the person, and only the same learner ever sees it.
- **D3: one PR on MIL-43 (decided 2026-10-09, no sub-task).** The three phases are three commits on
  `feat/MIL-43-webinar-live-join`, so the refactor still sits in its own commit, apart from the behaviour
  change. The PR runs to about 650 changed lines, over CLAUDE.md's ~400, as MIL-25 did. The PR
  description says so and points reviewers to the commits.

- **D4: The host ending the webinar is final.** Show "The session has ended" with **Back to webinar**,
  not a rejoin or takeover button.

## Locked decisions (from the rules)

- **Where code lives:**
  - Types go in `models/` and config in `constants/`, never inline in services, components or utils.
  - The live-room code stays in `features/offerings/webinar/`. Only webinars have live sessions, so the
    offerings-level placement rule doesn't apply. The shared guards come from
    `@features/offerings/utils/contract-guards`.
- **Requests:**
  - Mutations go through `ApiClient.call()` on typed `RouteConfig`s. Nothing here is a read, so there is
    no `httpResource`.
  - Heartbeat and release carry `SKIP_LOADING`. They run on timers or teardown and must never drive the
    global loading bar.
- **Facade wiring:**
  - `LiveSessionFacade` is `@Service({ autoProvided: false })` and provided on the `:id/live` route,
    together with `MeetingSession` and `ZoomMeetingClient`, so the lease lives exactly as long as the page.
  - The page and `MeetingStage` inject it; neither declares an `input()` or `output()` for facade data.
- **Zoom SDK:**
  - It stays a dynamic `import()` inside `ZoomMeetingClient.join()`, in its own lazy chunk; never raise
    the budget.
  - `/live` stays `RenderMode.Client`.
- **Error handling:**
  - Branch on `code`, never on status or `detail`.
  - New backend codes fall through to generic copy (`WebinarErrorCode` is already widened).
- **No `any`, no casts on untrusted data, no `eslint-disable`.**

## Target architecture

```
features/offerings/webinar/
  webinar.routes.ts                    :id/live providers → [MeetingSession, ZoomMeetingClient, LiveSessionFacade]
  constants/live-session.ts            NEW  LIVE_SESSION_ROUTES (4 × RouteConfig), lock and channel names,
                                            heartbeat bounds (5–30 s), takeover wait (3 s / 150 ms), device-label cap
  models/meeting-session.model.ts      request/response types (lease_expires_at optional on SignatureResponse),
                                       LeaseHolder, ChannelMessage, JoinRefusal, LiveRoomState, ZoomJoinParams,
                                       + parseClaim / parseSignature / parseHeartbeat / parseLeaseHolder
  services/live-session-facade.ts      NEW  the orchestration that now sits in the page:
                                            webinar (reactive, G7), state, statusText, isMobile, mobileJoinUrl;
                                            start() / takeover() / rejoin() / leave(); wires onEvict and
                                            onConnectionClosed; holds the stage root
  services/meeting-session.ts          the three layers unchanged; call() + parse; text/plain beacon;
                                       interval clamp; device_label; bfcache rejoin
  services/zoom-meeting-client.ts      SDK typed via `import type`; userName fallback in toJoinParams
  utils/device-label.ts                NEW  "Chrome on macOS"
  utils/webinar-error.ts               + joinOpensAt (from a 409 join_window_not_open)
  pages/webinar-live/                  thin: inject(LiveSessionFacade) and render one @switch over the state
  components/meeting-stage/            inject(LiveSessionFacade) for title/status/leave; registers its root
```

### Join sequence (unchanged order, cheapest refusal first)

```
Join ─▶ Web Lock ─busy─▶ local conflict (no request)
          │free
          ▼
        claim ─409 session_active─▶ remote conflict (holder dialog) ─Join here─▶ claim takeover:true
          │200            └─404/409 other─▶ refusal state (no spinner)
          ▼
        heartbeat every N s (5–30, from the server) ── 409 session_superseded ─▶ ejected
          ▼
        signature ─409─▶ release the lease ─▶ refusal state
          │200 (parsed)
          ▼
        desktop: import('@zoom/meetingsdk/embedded') ─▶ join      mobile: hold the lease, "Open in Zoom"
          ▼
        Leave ─▶ zoom.leave ─▶ release (JSON + bearer) ─▶ back to the webinar
        Tab close ─▶ pagehide ─▶ sendBeacon(text/plain)
```

### Room states (one `@switch` in the page)

| State                             | When                                    | Copy                                                                         | Action                                         |
| --------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------- |
| `preparing`                       | lock, claim, signature in flight        | Checking your seat…                                                          | none                                           |
| `conflict-local`                  | Web Lock held by a sibling tab          | This session is open in another tab of this browser.                         | Join here instead (takeover)                   |
| `conflict-remote`                 | 409 `session_active`                    | _{webinar_name}_ is open on _{device_label}_ since _{started_at, shortTime}_ | Join here instead (takeover)                   |
| `refused` `not_registered`        | 409                                     | You are not registered for this webinar.                                     | Back to webinar                                |
| `refused` `join_window_not_open`  | 409                                     | The session opens at _{joinOpensAt}_. Otherwise the existing fallback copy   | Try again · Back to webinar                    |
| `refused` `webinar_ended`         | 409                                     | This session has ended.                                                      | Back to webinar                                |
| `refused` `webinar_not_found`     | 404                                     | We could not find that webinar.                                              | All webinars                                   |
| `refused` `authentication_failed` | 403                                     | Your session has expired. Please sign in again.                              | Sign in (the same redirect `authGuard` builds) |
| `refused` (other)                 | network, 5xx, unknown code, parse error | Something went wrong. Please try again.                                      | Try again                                      |
| `joining` / `in-meeting`          | SDK import and join                     | Joining the session… / the stage                                             | Leave                                          |
| `zoom-failed`                     | SDK join rejected                       | Zoom's reason or the existing fallback                                       | Try again                                      |
| `ejected` local/remote            | sibling tab or 409 `session_superseded` | You joined from another window / device (existing copy)                      | Bring the session back here (takeover)         |
| `ejected` `connection-lost`       | bfcache restore after the beacon        | You were disconnected                                                        | Rejoin (no takeover)                           |
| `ended`                           | Zoom `connection-change: Closed`        | The session has ended                                                        | Back to webinar                                |
| `mobile`                          | handheld, lease held                    | Open this session in the Zoom app… (existing copy)                           | Open in Zoom (`join_url`)                      |

The markup and Tailwind classes of today's panels are kept. The `refused` and `ended` panels reuse the same
card shell; there are no new design tokens.

## Endpoint map

| Call                | `RouteConfig`                            | Method | Auth                 | Context        | Parse            |
| ------------------- | ---------------------------------------- | ------ | -------------------- | -------------- | ---------------- |
| Claim               | `LIVE_SESSION_ROUTES.claim`              | POST   | Bearer (interceptor) | none           | `parseClaim`     |
| Signature           | `LIVE_SESSION_ROUTES.signature`          | POST   | Bearer               | none           | `parseSignature` |
| Heartbeat           | `LIVE_SESSION_ROUTES.heartbeat`          | POST   | Bearer               | `SKIP_LOADING` | `parseHeartbeat` |
| Release (Leave)     | `LIVE_SESSION_ROUTES.release`            | POST   | Bearer               | `SKIP_LOADING` | none (204)       |
| Release (tab close) | `apiUrl(…release.path)` via `sendBeacon` | POST   | none (by design)     | n/a            | n/a              |

## Phases (each green on its own)

- **P1: `refactor(offerings): move the webinar live-room join flow into a facade`.** No behaviour change.
  - Add `services/live-session-facade.ts` and move `start`, `confirmTakeover`, `leave`, `statusText`,
    `isMobile`, `mobileJoinUrl`, the webinar lookup and the `onEvict`/`onConnectionClosed` wiring out of
    `WebinarLive` into it.
  - `WebinarLive` and `MeetingStage` inject the facade. `MeetingStage` drops its three inputs and one
    output, and registers its `#zoomRoot` with the facade (`afterNextRender`; clears it on destroy).
  - Move the local types out of the three live files into `models/meeting-session.model.ts`:
    - `ChannelMessage` (`meeting-session.ts`)
    - `ConnectionChangePayload` (`zoom-meeting-client.ts`)
  - Move the magic values into `constants/live-session.ts`: lock and channel names, the heartbeat
    context, and the 3 s / 150 ms takeover wait.
  - Add `LiveSessionFacade` to the `:id/live` `providers`.
- **P2: `feat(offerings): bind the webinar live room to the Events meeting-SDK API`.** Behaviour, flag
  still off.
  - **Routes:** `LIVE_SESSION_ROUTES` + `ApiClient.call()`, removing `MEETING_ENDPOINTS` and its
    `environment` import (G13).
  - **Contract types and parsing:**
    - parse every response (G2), and guard the `holder` (G8)
    - make `lease_expires_at` optional on the signature type: the spec sends it, Postman's example doesn't, and
      nothing reads it (G3)
    - send `device_label` (G10)
  - **Release and timers:**
    - the `text/plain` beacon (G1)
    - the interval clamp (G5)
    - the bfcache rejoin (G11)
  - **Room states:**
    - the `refusal` state, `joinOpensAt` and the room-state table above (G4, G12)
    - the reactive webinar lookup (G7)
  - **Zoom:** the typed SDK client and the `userName` fallback (G6, G9).
- **P3: `feat(offerings): turn on the in-app webinar join outside production`.**
  - `liveEnabled: true` in `environment.development.ts` and `environment.local.ts`.
  - Rewrite the "endpoints don't exist" comments in `environment*.ts`, `join-target.ts`,
    `webinar.routes.ts` and `meeting-session.model.ts` (G15).
  - In `docs/WEBINAR_API_QUESTIONS.md`, mark Q3 and Q6 answered on 2026-10-09. Q5 stays open, because
    `join_opens_at` comes only on the 409.

## Files touched

| File                                                                 | P1  | P2  | P3  |
| -------------------------------------------------------------------- | --- | --- | --- |
| `webinar/services/live-session-facade.ts` **(new)**                  | ✚   | ✎   |     |
| `webinar/constants/live-session.ts` **(new)**                        | ✚   | ✎   |     |
| `webinar/utils/device-label.ts` **(new)**                            |     | ✚   |     |
| `webinar/pages/webinar-live/webinar-live.ts` / `.html`               | ✎   | ✎   |     |
| `webinar/components/meeting-stage/meeting-stage.ts` / `.html`        | ✎   |     |     |
| `webinar/services/meeting-session.ts`                                | ✎   | ✎   |     |
| `webinar/services/zoom-meeting-client.ts`                            | ✎   | ✎   |     |
| `webinar/models/meeting-session.model.ts`                            | ✎   | ✎   | ✎   |
| `webinar/utils/webinar-error.ts`                                     |     | ✎   |     |
| `webinar/webinar.routes.ts`                                          | ✎   |     | ✎   |
| `webinar/utils/join-target.ts`                                       |     |     | ✎   |
| `src/environments/environment.development.ts`, `.local.ts`           |     |     | ✎   |
| `src/environments/environment.ts` (comment only, flag stays `false`) |     |     | ✎   |
| `docs/WEBINAR_API_QUESTIONS.md`                                      |     |     | ✎   |
| `docs/refactor/STATE.md` (handoff)                                   | ✎   | ✎   | ✎   |

No new dependency. `vercel.json`, `angular.json` and `app.routes.server.ts` are unchanged.

## Security

- **Server-only secrets:**
  - The SDK Secret stays on the server. The browser only receives the signed JWT and the public
    `sdk_key`.
  - The signature and `registrant_token` are held in memory only: never in a signal the template reads,
    never in storage or the URL, and never in a `Logger` call.
- **`session_id`:** `crypto.randomUUID()`, kept in memory. It is shared only over the same-origin
  `BroadcastChannel`. It is the only capability the unauthenticated release accepts, and the server ends
  a lease only while that id still holds it.
- **Takeover:** only on an explicit click. A silent takeover would let a stray tab eject the window
  someone is watching.
- **Access:**
  - `authGuard` on the route handles the redirect.
  - The server enforces registration, the join window and the lease on **both** claim and signature;
    the client gates are UX.
- **Untrusted input:** every response body is untrusted and passes through a guard before use, and
  `holder` text is rendered with interpolation only, never `innerHTML`.
- **CSP and headers on Vercel are unchanged:**
  - The SDK needs `https:`/`wss:` connects, `blob:` workers and `'unsafe-eval'` (WASM), and the current
    CSP allows all three.
  - COEP `credentialless` lets Zoom's CDN assets load without CORP headers.
  - `Permissions-Policy` allows camera and microphone for `self`, and Component View runs in our origin.

  This is verified on the preview, not assumed.

## Acceptance criteria

1. With `liveEnabled` on and `route_to_web_lms: true`, Join on the list or detail page opens `/live`, and
   a desktop browser joins the Zoom webinar embedded.
2. **A second tab in the same browser** shows the local conflict with **zero** network requests and
   without downloading the SDK. "Join here instead" moves the session, and the first tab shows "You
   joined from another window" immediately.
3. **A second browser or device** shows "_webinar_ is open on _Chrome on macOS_…". "Join here instead"
   moves the session, and the first surface is ejected within one heartbeat interval (≤ 15 s).
4. **Closing the tab** frees the session: a second browser joins at once with no conflict, not after
   45 s. The beacon is `text/plain`.
5. **Offline for 30 s** in DevTools mid-session does not eject. The heartbeat resumes after reconnecting.
6. **Each refusal renders its own state and action.** `not_registered`, `join_window_not_open`,
   `webinar_ended`, `webinar_not_found`, `authentication_failed` and a 5xx each show their own copy and
   action. None of them shows a spinner or produces an unhandled rejection.
7. **Leave** releases (204), tears down the SDK and returns to the webinar page. The host ending the
   webinar shows "The session has ended".
8. **On a handheld viewport** the lease is held and "Open in Zoom" links the registrant's `join_url`.
9. **A cold deep link** to `/live` (reload) shows the real webinar title once the feed or detail lands.
10. **No regressions.** `build:prod` is green, the initial bundle is unchanged, and the Zoom SDK is in its
    own lazy chunk. A preview shows **0** CSP violations and 0 console errors while in a session.
11. With the flag off (production), `/live` does not match and Join goes to `join_url`, exactly as today.

## Checks to run

```bash
pnpm lint
pnpm format:fix
pnpm check:structure
pnpm build:prod
```

`build:prod` stales a running dev server's Vite cache (Swiper 504s). I'll warn before running it, then you
restart 4101.

## How to verify

1. **Re-probe UAT before P3.** Unauthenticated `curl -X POST` claim should answer `403`, not `404`/`503`,
   and a `text/plain` release with a made-up id should answer `204`.
2. **Local run.** `pnpm start` (the `local` configuration, flag on), on `http://localhost:4101/us/cpa/webinar`,
   signed in as the backend's internal test user, on a CAIRA webinar with `route_to_web_lms: true` whose
   join window is open.
3. **Scenarios:** run AC 2–9 in Chrome plus a second browser (Safari, or a Chrome incognito window, which
   is a separate lock scope). DevTools → Network shows the four calls and the beacon's `Content-Type`.
4. **Production build:** `pnpm build:prod`, then confirm the Zoom chunk is lazy and the initial total
   hasn't moved.
5. **Vercel preview** (development config): join once and check the console for CSP violations.

## Risks

- **Endpoints not yet confirmed on UAT** (503 on 2026-10-09). P1 and P2 don't depend on that, because the
  flag is off. P3's verification does.
- **A test learner is needed.** `route_to_web_lms` is `true` only for an internal test user on a CAIRA
  webinar. Without those credentials and a webinar in its join window, AC 1–8 can't be run. Ask the
  backend for both.
- **`device_label`** appears only as a `""` placeholder in the template, with no length documented. If
  the server caps it below 64 characters, the 400 names the field and we lower the cap.
- **Release lists `JWTAuthentication` before `AllowAny`.** An _expired_ bearer on the in-app Leave release
  could 403 before `AllowAny` applies. The interceptor rotates the token before expiry, and the 45 s TTL
  is the backstop, so this is logged rather than surfaced.
- **Background-tab timer throttling.** Chrome's intensive throttling (hidden for more than 5 minutes)
  stretches timers to about 1 per minute, which is longer than the 45 s TTL. A page playing Zoom audio is
  exempt. If it ever applies, the heartbeat re-grants a lapsed lease nobody else claimed, so it costs
  nothing worse than a late eviction.
- **Zoom Component View is desktop-only**, which is why the mobile branch exists. Tablets count as
  handheld (`isHandheld` is anything other than `desktop`).
- **Safari:** Component View support depends on Zoom's media layer. `patchJsMedia: true` keeps us on their
  hot-fix branch. Verify on Safari before production.

## Follow-ups (not in MIL-43 unless you say so)

- Turn production on (`environment.ts`) after QA signs off: a one-line PR.
- Move the other webinar types still outside `models/` (`webinar-error.ts`, `webinar-status.ts`,
  `session-time.ts`, `join-target.ts`) in their own refactor PR. That is the reviewer's 2026-10-01 note,
  and it is too broad for this ticket.
- Q5 (`join_opens_at` on the feed and `server_time`) is still open with the backend.
- `WEB GET web-api/v1/events/all-bookings/` now exists (webinars only). Check whether it carries the
  attendance fields Q1 and Q2 asked for; if it does, binding it is its own ticket.
- `WEB GET web-api/v1/events/highlight-webinars/` is the home page's pre-login webinar rail: a home-page
  ticket.

## Implementation notes (2026-10-09)

Where the build departs from the plan above, and why:

- **G16, found while typing the SDK:**
  - The Component View client has `leaveMeeting()`, not `leave()`. The hand-written interface declared
    `leave()`, so Leave threw "is not a function", the error was swallowed, and Zoom never got a clean leave.
  - Typing the client with the SDK's own types (`import type`) caught it.
  - Separately, `init` and `join` are typed to _resolve_ to `{ type, reason }` on failure, so a resolved
    failure now counts as a failed join too.
- **The heartbeat body is not parsed.** Nothing reads it (the 200 is the whole answer), so its route is
  typed `unknown` and no `parseHeartbeat` exists. Parsing it would only add a warning every 15 s if the
  body drifted.
- **`device_label` comes from the user-agent string alone.** `navigator.userAgentData` isn't in the DOM
  typings and adds nothing the UA tables don't already cover.
- **The page keeps an `@if` / `@else if` chain rather than a single `@switch`.** `as` narrowing keeps each
  branch type-safe in strict templates; a `@switch` on a union's `kind` doesn't narrow the other fields.
- **Leave returns to the webinar's own page** (`:id`), per AC 7. It used to go to the list.
- **The shared `app-button` replaces the raw `<button>`s** in the page and the stage, following the
  reviewer's reuse rule.
- **Browser check, 4101 `local` config, UAT down:**
  - Signed out, `/live` matches and redirects to sign-in.
  - With a dummy session cookie on localhost (removed afterwards):
    - the claim carries exactly the five declared fields, with `device_label: "Chrome on macOS"`
    - the room shows "We could not connect you" with Try again instead of spinning
    - Try again re-claims
    - 0 unhandled rejections
  - Still to run once UAT is back, with the backend's `route_to_web_lms` test user: AC 1–5, 7–9 and 10's
    CSP check on a preview.

## Revision 2 (2026-10-09): the webinar feed breaks against today's UAT

Once UAT came back, the list and detail pages showed "does not match the Events contract", on `master`
as well. On your call, this is fixed in MIL-43, not a new ticket, because Join is unreachable without
those pages. Measured on `webinar-main-page` (pre_login, 14 cards) and all 11 `webinar-details-page`
rows:

| Live UAT                                                                          | The client expected        | Fix                                                                              |
| --------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------- |
| Every bucket is a paginated envelope `{slug, count, page, page_size, …, results}` | A bare array (Postman too) | `bucketCards()` reads `results`, and still accepts an array; only page 1 is read |
| `duration_seconds` (Postman since 2026-09-25)                                     | `duration_minutes`         | Model, guard, `effectiveEndAt` (`* 1_000`), and About through `duration: 'long'` |
| `short_description: null`, `vertical_thumbnail: null`                             | `string` (Postman too)     | `string \| null`; every reader already falls through on a falsy value            |
| `product.{horizontal,vertical,square}_image: null`                                | `string` (Postman: `""`)   | `string \| null`; nothing renders them                                           |

The live-session routes, probed unauthenticated after UAT came back:

- **All four are deployed.** The tab-close `text/plain` release answers `204` with the CORS header, and
  the claim preflight from localhost passes.
- **They wrap their answers as `{success, message, data}`.** No token gives `401 {"success": false,
"message": "Authentication credentials were not provided.", "data": null}`. A bad token gives **`401`**,
  not 403, with `{"success": false, "message": "Error decoding signature.", "data": null}`. So:
  - The parsers accept the result either merged into the body or wrapped in `data` (`resultOf`).
  - `toWebinarError` reads `code`, and `readHolder` reads `holder`, from the body or from `data`.
  - A code-less 401 maps to `authentication_required`, which opens the signed-out room.
- **Browser check:** with a dummy cookie on localhost, real UAT answers the claim with 401, and the room
  shows "Please sign in again" with Sign in.
- **Still to confirm with a signed-in test learner:** the exact 200 and 409 shapes.
