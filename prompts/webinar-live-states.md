# Webinar live room: Zoom meeting states, SDK review and fixes

Status: **approved and merged.** PR 1 (#200, MIL-141), PR 2 (#201, MIL-139) and PR 3 (§8, #202, MIL-140) are on
`master`. PR 3 uses route guards (`webinar/guards/live-document-guard.ts`) rather than editing each Join and Back call
site, so every way in and out of `/live` is covered.

## Goal

The `/live` room must always show what is actually happening in Zoom:

- the webinar hasn't started yet
- the learner is in the waiting room / on hold until the host admits them
- the learner is in the session
- the connection is reconnecting
- the host removed the learner, or ended the session

Today the room says **"You are in the session."** as soon as `client.join()` resolves, whatever Zoom is really doing.
This prompt also covers the rest of a full review of the SDK integration: versioning, security, and the bugs found
along the way.

## What I read

- `features/offerings/webinar/`: `services/{live-session-facade,meeting-session,zoom-meeting-client,webinar-facade}.ts`,
  `pages/webinar-live/*`, `components/meeting-stage/*`, `models/meeting-session.model.ts`, `constants/live-session.ts`,
  `utils/{join-target,webinar-error}.ts`, `webinar.routes.ts`
- `vercel.json` headers, `app.routes.server.ts`, `environment*.ts`
- `node_modules/@zoom/meetingsdk/embedded.d.ts` (6.5.0): `Participant.isHold`, `getCurrentUser()`, `user-updated`,
  `connection-change`, the `IMPROPER_MEETING_STATE` reasons (`closed` / `on hold` / `reconnecting`)
- Zoom's Web SDK error-code table, and devforum threads on 3008 (webinar not started / practice session) and on
  waiting-room join races
- Live headers on `miles-masterclass.vercel.app`

## Review findings

### Bugs (fix in this work)

| #   | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **High** | **"Try again" after a failed Zoom join shows a false "You are already in a session" screen.** When `zoom.join()` fails, `start()` keeps the lease and the Web Lock. `retry()` then calls `acquire()`, and `navigator.locks.request(..., { ifAvailable: true })` refuses this tab its own lock (locks aren't re-entrant). The page renders `conflict: local-tab` ("open in another tab") about itself. This is the path the CSP failure took.                                                                                                                                                                                                                     |
| B2  | **High** | **A retry reuses a half-initialised SDK client.** `join()` calls `ZoomMtgEmbedded.createClient()` + `init()` again without destroying the previous client. The Component View client is a singleton, so a second `init()` can fail as a duplicated operation.                                                                                                                                                                                                                                                                                                                                                                                                    |
| B3  | **High** | **Not started / waiting room / reconnecting are not modelled.** `phase` jumps to `in-meeting` when `join()` resolves. A learner held in the waiting room is told they are in the session. A webinar the host hasn't started (or is still in practice mode) rejects with **3008**, which becomes a generic "We could not connect you" with a manual retry. `Reconnecting` is ignored.                                                                                                                                                                                                                                                                             |
| B4  | Medium   | **Zoom error codes aren't used.** `toSdkError` shows Zoom's raw `reason` string and treats everything as retryable. Some codes need their own handling: 3009 (removed by host), 4004 (ended), 4005 (full), 3705/3712 (signature expired/invalid, so re-mint), 3099 (registration required) and 3603/3611 (browser join not allowed, so hand off to the `join_url`).                                                                                                                                                                                                                                                                                              |
| B5  | Medium   | **The cross-origin-isolation headers never apply on in-app Join.** `vercel.json` sets COOP `same-origin` + COEP `credentialless` on `/:country/:profession/webinar/:id/live`, and the live headers confirm it. But Join goes through `router.navigate()`, a client-side navigation, so the document keeps the detail page's headers. `crossOriginIsolated` is then `false`, and Zoom loses SharedArrayBuffer, which it needs for gallery view and HD video. The reverse also holds: after a hard reload on `/live`, "Back to webinar" stays in-app, so the whole SPA keeps running under COEP afterwards and cross-origin iframes (YouTube, Calendly) can break. |

### Version

- Installed and locked: **6.5.0**. `package.json` allows `^6.2.0`, but the lockfile pins 6.5.0. Latest on npm is
  **6.10.0**, published 2026-10-23 (4 days ago).
- **Recommendation:** stay on 6.5.0 for this work. Upgrade to 6.10.x in its own PR once its changelog has been read
  and it has been out a couple of weeks. Raise the `package.json` floor to `^6.5.0` in the same PR, so a fresh
  install can't resolve below what is tested.
- `patchJsMedia: true` loads media-layer hotfixes from `source.zoom.us` at runtime, so that code isn't pinned by the
  lockfile. That's Zoom's recommended setting; keep it, and know that the media layer can change without a deploy.

### Security

Nothing exploitable found on the client.

- The JWT is minted server-side, and only for the lease holder.
- The SDK secret never ships.
- `sdk_key` is public by design.
- The beacon release is `AllowAny`, but it's keyed on a `crypto.randomUUID()` session id.
- The mobile `join_url` link has `rel="noopener"`.
- Templates only interpolate (no `innerHTML`).

Items for the backend, to confirm rather than fix here:

1. **The signature's `role` claim must be hard-coded to `0` (attendee).** A `1` would let a learner start or host the
   webinar. This is the one claim worth checking in the minting code.
2. Add `appKey` to the JWT. The SDK warns that `sdkKey` there is deprecated, and its typings say join will be refused
   without it.
3. Keep `exp` short: Zoom's minimum is `iat + 1800`, and the client re-mints on every retry anyway.
4. The release route must end a lease only while that exact `session_id` holds it. The client already assumes this.

App-wide, not part of this work: `script-src` already allows `'unsafe-inline' 'unsafe-eval' https:`, so the CSP is
weak overall. Tightening it is its own ticket. Adding `blob:` didn't change that.

### Small details / noise

- **`Permissions policy violation: unload is not allowed` (×17):** Chrome is retiring `unload`. Our
  `leaveOnPageUnload: true` relies on it, so on Chrome it's effectively a no-op. Our own `pagehide` beacon still
  releases the lease, and Zoom times the participant out. No change.
- **Stale comment:** `webinar.routes.ts` and `join-target.ts` say `liveEnabled` is "off in production until QA signs
  off", but `environment.ts` has `liveEnabled: true`, so **the in-app room is live in production**. Fix the comments
  to match. Confirm this is intended (see Questions).
- `[Laplace] Report batch stalled` and `PubSub already loaded` are Zoom's own logging. Ignore them.

## Locked decisions (proposed)

1. **One join state machine, owned by `ZoomMeetingClient`**, extending `JoinPhase`:
   `idle → preflight → joining → (waiting-for-host | on-hold | in-meeting) ⇄ reconnecting → left | ejected | failed`.
   `waiting-for-host` and `on-hold` are new, and so is `reconnecting`.
2. **Waiting for host (3008):** keep the lease (the heartbeat keeps running) and tear the SDK client down. Re-join
   automatically every **15 s**, re-minting the signature each time so expiry never matters. The room shows "Waiting
   for the host to start the webinar" with the scheduled start time and a Leave button. No retry cap: the server's
   join window bounds it, and Leave is always there.
3. **On hold (waiting room):** after `join()` resolves, read `client.getCurrentUser()?.isHold`. Then follow
   `user-updated` for the current user's `userId`: `isHold: true` means `on-hold`, `false` means `in-meeting`.
   Reading the state after join, not only on the event, covers the race where the host admits the learner before the
   SDK has finished loading. Zoom renders its own waiting-room UI inside `#zoomRoot`; we only stop claiming
   "in session" and show "Waiting for the host to let you in".
4. **Reconnecting:** `connection-change` `Reconnecting` means `reconnecting`, and `Connected` restores the previous
   in-room phase. `Closed` and `Fail` are handled as today.
5. **Zoom error codes are mapped in one table** (`constants/live-session.ts`, next to `JOIN_REFUSAL_KINDS`), never by
   matching on reason strings:

   | Code                   | Outcome                                                             |
   | ---------------------- | ------------------------------------------------------------------- |
   | 3008                   | `waiting-for-host` (auto re-join)                                   |
   | 3009                   | exit `removed`: "The host removed you from this session", no rejoin |
   | 4004                   | exit `meeting-ended`                                                |
   | 4005                   | refusal `full`: "This session is full", with retry                  |
   | 3705, 3712, 3265, 3623 | re-mint the signature and re-join **once**, then `failed`           |
   | 3099                   | refusal `not-registered`                                            |
   | 3603, 3611             | refusal `web-unsupported`, with "Open in Zoom" (`join_url`)         |
   | anything else          | `failed`: generic copy, retry, logged as `error`                    |

   The user never sees Zoom's raw `reason` text.

6. **Fix B1 at the root, in `MeetingSession.acquire()`:** if this surface already holds the lease for the same
   webinar, skip the lock and the claim and just mint a fresh signature. This covers every retry path, not just one
   button. On a non-retryable failure (`failed`, `removed`, `web-unsupported`) the facade releases the lease.
7. **Fix B2 in `ZoomMeetingClient.join()`:** destroy any previous client before `createClient()`.
8. **Fix B5 with full-document navigation into and out of `/live`.**
   - `WebinarFacade.join` uses `location.assign(url)` for `embedded`, so the COOP/COEP headers apply.
   - `LiveSessionFacade.backToWebinar` / `allWebinars` do the same, so isolation ends with the room.
   - The room is `RenderMode.Client`, so nothing is lost; the SDK chunk loads either way.
   - Also log `crossOriginIsolated` once at join, so the state shows up in our logs.

## Files touched

| File                                                        | Change                                                                                                                                                                                                                                 |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `webinar/models/meeting-session.model.ts`                   | `JoinPhase` + `waiting-for-host`, `on-hold`, `reconnecting`; `EjectionReason` + `removed`; `JoinRefusalKind` + `full`, `web-unsupported`                                                                                               |
| `webinar/constants/live-session.ts`                         | `ZOOM_ERROR_OUTCOMES` table, `WAITING_FOR_HOST_RETRY_MS = 15_000`                                                                                                                                                                      |
| `webinar/services/zoom-meeting-client.ts`                   | destroy before re-create; read `isHold` after join; `user-updated` + `Reconnecting`/`Connected` handling; return a typed join outcome from the error code instead of a free-text error                                                 |
| `webinar/services/meeting-session.ts`                       | `acquire()` short-circuit when the lease is already ours for this webinar                                                                                                                                                              |
| `webinar/services/live-session-facade.ts`                   | drive the outcome: auto re-join loop for `waiting-for-host` (cancelled on leave, evict or destroy); single signature re-mint; release on a terminal failure; `statusText` for the new phases; full-document navigation out of the room |
| `webinar/services/webinar-facade.ts`                        | full-document navigation into `/live`                                                                                                                                                                                                  |
| `webinar/pages/webinar-live/webinar-live.html`              | `removed` exit copy; `full` and `web-unsupported` refusals                                                                                                                                                                             |
| `webinar/components/meeting-stage/meeting-stage.html`       | status line for waiting-for-host / on-hold / reconnecting; keep `#zoomRoot` mounted throughout (Zoom draws its waiting UI there)                                                                                                       |
| `webinar/webinar.routes.ts`, `webinar/utils/join-target.ts` | correct the stale `liveEnabled` comments                                                                                                                                                                                               |

No new files, routes or API calls. The endpoints are unchanged (`claim`, `meeting-sdk-signature`, `heartbeat`,
`release`). Estimated ~250 changed lines.

## PR split (One ticket = one PR)

1. **PR 1, already built:** `fix/MIL-???-zoom-csp-blob`, the CSP `blob:` fix plus `sdkKey` dropped from `join()`.
   Ship first: today nothing joins at all.
2. **PR 2, this prompt §§1–7:** `fix/MIL-???-webinar-live-states`, covering B1–B4.
3. **PR 3, this prompt §8:** `fix/MIL-???-live-room-isolation`, covering B5. Small, and separate because it changes
   navigation behaviour.
4. **Later, its own PR:** SDK upgrade to 6.10.x and the `^6.5.0` floor.

## Acceptance criteria

- Join before the host starts: the room says "Waiting for the host to start the webinar", holds the lease, and joins
  by itself within 15 s of the host starting. No "We could not connect you", no manual retry needed.
- Webinar with the waiting room on: the room says "Waiting for the host to let you in" until admitted, then "You are in
  the session". It never says "in the session" while `isHold` is true.
- Dropped network: "Reconnecting…", then back to the previous state.
- Host removes the learner: exit screen "removed", no Rejoin button. Host ends the webinar: the existing "session has
  ended" screen.
- A failed Zoom join followed by **Try again** re-joins in the same tab. The "already in a session" screen never
  appears for the learner's own tab.
- Entering `/live` from the detail page: `crossOriginIsolated === true` in the console. Leaving: `false` on the detail
  page.
- Two tabs, two browsers, takeover and bfcache restore behave exactly as today (no regression in `MeetingSession`'s
  three layers).

## Checks

```bash
pnpm lint
pnpm format:fix
pnpm build:prod   # SDK must stay in its own lazy chunk; initial bundle unchanged
```

## How to verify (needs a Zoom test webinar on UAT, with the host account available)

1. `pnpm start` (port 4101), then sign in as a registered learner.
2. Host **not** started: open `/us/cpa/webinar/<id>/live`. Expect the waiting-for-host state, with a signature mint
   every 15 s in Network. Start the webinar from the host account; expect a join within 15 s.
3. Turn the waiting room on in the webinar settings and rejoin. Expect on-hold, then admit from the host and expect
   in-session.
4. DevTools → Network → Offline for ~10 s, then back online. Expect reconnecting, then in-session.
5. Host removes the learner: expect the removed exit. Host ends the webinar: expect the ended exit.
6. Block `source.zoom.us` in DevTools to force a join failure, then click **Try again**: it re-joins, with no
   conflict screen.
7. Prod preview: `crossOriginIsolated` in the console on `/live` after clicking Join.

COOP/COEP and the CSP only exist on Vercel, so steps 6–7 need a preview deploy.

## Risks

- **Zoom's Component View behaviour for webinars before start isn't documented beyond error 3008.** If 6.5.0 instead
  resolves `join()` and shows its own "waiting for host" screen, the state comes from `getCurrentMeetingInfo()` /
  `isInMeeting`, not 3008. Step 2 of the verification decides which; the state machine is the same either way.
- The `connection-change` `reason` text for "removed" vs "ended" is undocumented. That's why removed is driven by error
  code 3009 and the `Closed` mapping stays as it is.
- Full-document navigation into `/live` costs one app boot (~1 s). It's the only way the isolation headers can apply.

## Assumptions

- Practice-session joins by registrants are refused by Zoom by design (3008). They are treated as waiting-for-host.
- No retry cap is needed for waiting-for-host, because the server's join window and the Leave button bound it.

## Questions

1. Is `liveEnabled: true` in **production** intended? The code comments say it should be off until QA signs off.
2. Ticket numbers for PRs 1–3?
