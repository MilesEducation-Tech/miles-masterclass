# Live webinar room on Zoom's Client View: full page on every device, polls visible, beacon checked

## Jira ticket

**Summary:** `feat(offerings): run the live webinar room on Zoom's full-page Client View`
**Issue type:** Story
**Component / scope:** offerings
**Branch:** `feat/MIL-XXX-webinar-live-client-view` (rename with `git branch -m` once the ticket exists)
**Links:** relates to MIL-43 (`prompts/webinar-live-join.md`), `prompts/webinar-live-states.md` · `prompts/webinar-live-client-view.md`

### Context

The live room embeds Zoom's Component View in a bordered card. Component View can't fill the page: it ignores
our size during a screen share, keeps a fixed aspect, and is desktop-only. Learners need the meeting to fill
the page on phone, tablet and desktop, with polls visible.

### Current behaviour

- `meeting-stage.html` boxes the SDK: `rounded-xl border`, `min-h-[70vh]`, a header row.
- Under 1024px wide (tablets, narrow desktop windows) the room shows "Open in Zoom" instead of the meeting
  (`LiveSessionFacade.isMobile` = `Viewport.isHandheld()`).
- Resizing a desktop window across 1024px mid-session destroys the stage under a joined SDK.

### Expected behaviour

- The meeting fills the page with no border at every size, phones included, screen share included.
- Polls and Q&A reach attendees.
- The one-session lease still holds, and is released on leave and on tab close.

### Scope

- In: `ZoomMeetingClient` on Client View, `LiveSessionFacade`, `MeetingStage`, the `webinar-live` page, the
  model types.
- Out: backend changes.

### Acceptance criteria

- [ ] Once joined, Zoom fills the viewport at 375×812, 768×1024, 1024×768, 1440×900 and 1920×1080, with no
      page scroll.
- [ ] A launched poll shows to an attendee at each size, including during a screen share.
- [ ] Refusal, conflict and exit cards still render. Leave works while waiting for the host.
- [ ] Closing the tab releases the lease: a second browser joins within 45 s without a conflict.
- [ ] `pnpm lint`, `pnpm build:prod` green (local macOS).

### How to verify

Local `pnpm start` (4101), signed in, on a webinar inside its join window, started by a host. See
"Verification" below.

### Risks / assumptions / open questions

See "Risks" and "Live checks" below. `leaveRedirect` isn't in the SDK typings.

**Estimate:** M (100–400)

---

## Context

The live room (`/:country/:profession/webinar/:id/live`) embeds Zoom's **Component View** in a bordered card.
The user wants the meeting to fill the page on phone, tablet and desktop, at full width and height with no
border, with polls visible, and the `sendBeacon` release confirmed.

Reading SDK 6.10's Component View bundle showed it can't meet that:

- **Screen share:** while receiving a screen share it ignores our `viewSizes` and draws a fixed window,
  `height = 615` (`l = isReceiveSharing ? undefined : viewSizes…`).
- **Aspect:** it forces `height ≥ width × 400/568` in speaker view, so full width overflows any wide window.
- **Phones:** Zoom documents it as desktop-only.

**Client View** (`ZoomMtg` from `@zoom/meetingsdk`) is Zoom's full-page web client:

- It renders into its own body-level `#zmmtg-root`, sized to the page.
- It supports phones.
- Polls, Q&A and chat are on by default (`isSupportPolling`, `isSupportQA`).
- It ships an ESM build (`dist/esm/client-view.es.min.js`).

## Decisions

1. **Client View replaces Component View** for the in-page room.
2. **Phones embed too.** Client View is Zoom's supported phone path. The `isMobile` hand-off branch goes away;
   `mobileJoinUrl` stays for the `web-unsupported` refusal.
3. **No floating Leave over the meeting.** Client View has its own Leave in its footer. Our own Leave stays
   where Zoom isn't on screen: the waiting-for-host screen.
4. The room's architecture stays: `LiveSessionFacade` (claim → sign → join), `MeetingSession` (lease, Web
   Lock, channel, beacon) and `ZoomMeetingClient` (the SDK wrapper). Only the wrapper's internals and the
   stage change.

## How Client View reports the meeting (read from SDK 6.10)

- `onMeetingStatus` → `{ meetingStatus: 1 | 2 | 3 | 4 }` (connecting, connected, disconnected,
  reconnecting).
- `onUserIsInWaitingRoom` → `{ isInWaitingRoom, userId, self }`.
- `onUserLeave` for our own participant → `{ reason, reasonCode }`, where the code is 1 for host ended,
  2–4 for leaving themselves, and 6–7 for being removed. Other participants' leaves carry attendee data and
  no `reason`.
- `init` reads a `leaveRedirect` flag that `index.d.ts` omits. `false` keeps the page after a leave.

## Changes (under `src/app/features/offerings/webinar/` unless noted)

1. **`services/zoom-meeting-client.ts`**: same public surface, rebuilt on `ZoomMtg`.
   - `import('@zoom/meetingsdk')`, `preLoadWasm()`, `prepareWebSDK()` and `init()` once per document.
   - Init options: `leaveUrl`, `leaveRedirect: false`, `disablePreview: true`,
     `isShowJoiningErrorDialog: false`, `patchJsMedia: true`, `leaveOnPageUnload: true`.
   - `#zmmtg-root` is shown only while joining or joined.
   - Join errors map through `ZOOM_ERROR_OUTCOMES`; Zoom-side exits map through `ZOOM_LEAVE_REASONS`.
2. **`models/meeting-session.model.ts`**: Client View types replace `ZoomEmbeddedClient` and
   `ConnectionChangePayload`. `ZoomExit` adds `left` (Zoom's own Leave button) to `ZoomCloseReason`.
3. **`constants/live-session.ts`**: `ZOOM_LEAVE_REASONS` and `ZOOM_MEETING_STATUS`.
4. **`services/live-session-facade.ts`**: drop `isMobile`, `Viewport`, `attachStage`/`detachStage`/
   `stageRoot` and the "no stage" refusal. Pass the detail-page URL as `leaveUrl`. A `left` exit leaves
   like our own Leave button.
5. **`components/meeting-stage/*`**: a full-screen status surface (connecting, waiting for host + Leave)
   with an `sr-only` title and live status. No `#zoomRoot`.
6. **`pages/webinar-live/webinar-live.html`**: delete the phone hand-off branch.
7. **`angular.json`**: swap `@zoom/meetingsdk/embedded` for `@zoom/meetingsdk` in
   `allowedCommonJsDependencies`, but only if `build:prod` warns.

## Live checks with a started test webinar (each has a fallback)

1. **Rejoin in place:** a second `ZoomMtg.join` after a failed join works without a new `init`.
   **Fallback:** reload `/live` for retries once the SDK is initialised.
2. **`leaveRedirect: false` is honoured:** the page stays after a leave or the host ending.
   **Fallback:** Zoom's own dialogs and the redirect to the detail page; the pagehide beacon releases.
3. **Exit reasons:** host ended, removed and left each land on the right screen.
4. **Rejoin after an in-room exit** works in place. **Fallback:** reload `/live`.
5. **Polls and Q&A** reach an attendee at 375×812, 768×1024, 1024×768, 1440×900 and 1920×1080, including
   during a screen share. Screen share fills the page.
6. **Zoom's CSS** doesn't break our cards (confined to the `/live` document). No CSP/COEP violations.

## sendBeacon (static review: correct; runtime check below)

- The body is a JSON **string**, sent as CORS-safelisted `text/plain`, so no preflight.
- It goes to the absolute `apiUrl(release.path)`, on `pagehide`, only while `holdsLease()`.
- Leave and the leave guard call the authenticated `release()` first, so no second beacon follows.
- COEP `credentialless` doesn't touch `cors`-mode beacons; CSP `connect-src https:` allows the API.
- A bfcache restore after a beacon evicts.

## Verification

1. `pnpm lint`, `pnpm format:fix`, `pnpm build:prod` on local macOS: initial bundle unchanged, Client View in
   a lazy chunk, only the known `ai-labs.css` warning.
2. `pnpm start` (4101), signed in, at `/us/cpa/webinar/<id>/live`, at 375 / 768 / 1024 / 1440: the
   connecting and waiting screens fill the viewport with no scroll; the cards render; Leave works while
   waiting; once joined, `#zmmtg-root` covers the viewport.
3. Live checks 1–6, with screenshots per size and one with a poll open.
4. Beacon: dispatch `pagehide` in the room and read the network log (expect a `ping` POST to
   `…/attendance-session/release/`, `text/plain` `{"session_id":…}`, 204). Then close the tab and open the
   room in a second browser within 45 s: no "already in a session" conflict.

## Risks

- The Client View chunk is large (14 MB raw), lazy, and loads only on `/live`.
- `leaveRedirect` isn't in the typings; its fallback is above.
- Zoom's own UI fills the page, so there's less brand control inside the meeting.
- Client View has some feature limits on iOS Safari (per Zoom).
