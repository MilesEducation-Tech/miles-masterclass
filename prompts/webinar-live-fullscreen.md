# Live webinar room: Zoom always full screen, nothing draggable, and a clean wait until the start

## Goal

Users report three problems with the live room (`/:country/:profession/webinar/:id/live`):

- the meeting doesn't fill the screen;
- something inside it can be dragged around;
- joining before the webinar starts isn't a clean wait.

They also asked for the room to sit in no container, with the SDK full screen. This follows MIL-170 (#229, the
move to Zoom's Client View).

## What was read

- **Room code:** `zoom-meeting-client.ts`, `live-session-facade.ts`, `meeting-stage/*`, `webinar-live/*`,
  `webinar.routes.ts` (`layout: 'plain'`), `constants/live-session.ts`, `app.html` and `styles/styles.css`.
- **Zoom SDK 6.10 (`@zoom/meetingsdk`):**
  - `index.d.ts`, the init options.
  - `dist/esm/zoom-meetingsdk.css`:
    - `#zmmtg-root { position: fixed; top: 0; left: 0; width: 100%; height: 100% }`
    - `html, body { height: 100svh; overflow: hidden }`
  - `main-client.mjs`: Zoom's in-meeting component measures `window.innerWidth/innerHeight` on mount and on
    every `resize`.
- **What each site actually serves (2026-11-04):**

  | Site                           | Build                                        | Live room                                     |
  | ------------------------------ | -------------------------------------------- | --------------------------------------------- |
  | `miles-masterclass.vercel.app` | this repo, 4.0.0 (`bba0e91c`)                | Client View since 2026-11-03 17:07 IST        |
  | `www.milesmasterclass.com`     | another codebase (old `version.json` format) | none: Join opens the Zoom `join_url` in a tab |
  | `uat.milesmasterclass.com`     | another codebase, built before #229 merged   | none                                          |

## Findings

1. **Users on www or UAT never reach this room.** Their Join opens Zoom's own page in a new tab, so no change
   here reaches them until those domains serve this repo's build. Reports from before 2026-11-03 17:07 IST
   describe the old Component View, a bordered box that could be dragged.
2. **The draggable thing in Client View is Zoom's video tile.** `videoDrag` defaults to `true`, so
   the speaker's video can be dragged around, most visibly over a screen share.
3. **A screen share can show smaller than the screen.** `sharingMode` defaults to `'both'`, which offers
   Zoom's "original size" view. That view doesn't scale the share to the screen.
4. **The waiting screen flashes every 15 seconds.** While the host hasn't started, the room retries every 15 s.
   Each retry shows Zoom's black root for the length of the join attempt, then hides it again on 3008.
5. **Opening the room before the join window opens is a dead end.** The server's `join_window_not_open` is
   shown as "This session has not opened yet" with a manual Try again, rather than a wait.
6. **The room's own message screens sit in a container:** a centred `max-w-7xl` box with bordered cards.

Ruled out:

- Our app covering or shrinking Zoom: nothing in `app.html`, the plain layout or the global CSS transforms or
  boxes `#zmmtg-root`.
- A stale window size inside Zoom: it re-measures when its room mounts.

## Locked decisions

1. **`videoDrag: false`:** no Zoom video tile can be dragged.
2. **`sharingMode: 'fit'`:** a share always scales to the screen, and "original size" is gone.
3. **The waiting screen stays on top of Zoom while the room waits.** `MeetingStage` takes `z-10` while
   `waitingForHost()` is true. Zoom's root has no `z-index`, so retries happen underneath, unseen. When a join
   succeeds, `waitingForHost` turns false, the stage drops below and Zoom is revealed.
4. **"Not open yet" waits too.** `join_window_not_open` puts the room in the same waiting state and retries
   every `WAITING_FOR_HOST_RETRY_MS`. A retry that fails the same way keeps waiting; any other refusal ends the
   wait as today. No lease is held while waiting for the window, because the claim is what the server refused.
5. **No container.** The room page becomes one full-screen surface (`fixed inset-0`, scrolls if needed) with
   its message centred, without a border or card, like `MeetingStage`. Zoom itself is unchanged: it was never
   in a container. Its body-level root already covers the viewport.
6. **Not doing:**
   - `z-index` on `#zmmtg-root`: it would also lift the root above Zoom's own portaled pop-ups (polls).
   - A hand-dispatched `resize`: Zoom already measures on mount.
   - Hiding Zoom's own minimise control: no init option exists.

## Endpoint map

No change. The room still makes the same calls: claim, signature, heartbeat and release. A not-open wait repeats
the claim every 15 s, and the server answers it with the same cheap refusal.

## Files touched (`src/app/features/offerings/webinar/`)

| File                                        | Change                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| `services/zoom-meeting-client.ts`           | `videoDrag: false`, `sharingMode: 'fit'` in `init`, with why-comments         |
| `services/live-session-facade.ts`           | `not-open` → wait and retry, in `start()` and `rejoin()`; doc comment updated |
| `components/meeting-stage/meeting-stage.ts` | host `[class.z-10]` bound to `waitingForHost()`; doc comment                  |
| `pages/webinar-live/webinar-live.html`      | full-screen centred surface, no container or borders; `not-open` case removed |
| `docs/refactor/STATE.md`                    | NON-REFACTOR entry                                                            |

About 60 changed lines. No route, API, shared or core change.

## Security

Nothing new reaches the browser. The waiting loop runs only while the page is open and stops on leave or
eviction (`stopWaiting`).

## Acceptance criteria

1. **Joined:** Zoom's video tiles can't be dragged, and a screen share fills the screen with no "original size"
   option, at 375×812, 768×1024, 1024×768 and 1440×900.
2. **Waiting for the host:** the waiting screen stays steady for at least a minute (four retries), with no black
   flash. When the host starts, the learner is in the meeting within one retry.
3. **Window not open:** the waiting screen shows instead of the "not opened yet" card, and the room joins by
   itself once the window opens.
4. **Message screens** (refusal, conflict, exit) fill the viewport, centred, with no box, border or sideways
   scroll at 375 / 768 / 1440.
5. Leave and every exit still behave as in MIL-170.

## Checks

- `pnpm lint`, `pnpm format:fix` and `pnpm build:prod` (local macOS), with the initial bundle unchanged.
- **`pnpm start` (4101), signed in:**
  - Stub the claim with `join_window_not_open`, then let it through: the waiting screen shows, retries go out
    every 15 s, then the room joins.
  - Read the stage's computed `z-index` while waiting.
  - Check each message screen at the three widths.
- **Not verifiable locally:** criteria 1 and 2 need a webinar the host has started. Run them on a
  deployment of this repo (miles-masterclass.vercel.app), not on www or UAT.

## Follow-up from the live UAT run (2026-11-04, approved: "Yes, fix them")

A run against a host-started UAT webinar found three more bugs in the room. Each is fixed on this branch.

1. **Zoom's dialogs covered the room's screens.** Zoom draws its dialogs in body-level react-modal portals,
   outside `#zmmtg-root`. After a takeover, "You have joined this meeting on another platform" sat over "You
   joined from another window" and blocked its button.
   - **Fix:** `showZoom` also sets `data-zoom-hidden` on `<body>`, and a `styles.css` rule hides
     `body[data-zoom-hidden] > .ReactModalPortal`.
2. **Rejoining in the same page hung.** Once Client View has been in a meeting, a second `join` stalls on
   Zoom's "Webinar Disconnected" page and never calls back (Zoom logs `mainTaskType is not exist`).
   - **Fix:** `ZoomMeetingClient.spent` records the first successful join. After that, `takeover()` and
     `retry()` reload the room instead of joining in place.
3. **A quick reload hit a false "already in a session".** The reloaded page claims before the old page's
   release beacon lands, so it was told it was in a session on another device.
   - **Fix:** the beacon also stores the webinar id in `sessionStorage`, and so does a confirmed takeover
     before its reload. The first claim of the next page takes the seat over silently, but only for that
     webinar and only when the page load is a `reload`. A restored tab or a later visit still asks.

## Design-system pass (2026-11-04, asked: "Make sure all the UI matches the design system")

The room's own screens now follow the webinar pages' message pattern (`webinar-detail`) and use `shared/ui`
primitives only:

- **Headings:** `text-xl font-semibold`, was `text-lg font-medium`. Copy is `mt-2 text-sm
text-muted-foreground`, and actions sit `mt-6` below it.
- **Spinner:** the waiting and connecting spinner is `app-spinner size="xl"`, not a hand-made bordered circle.
  It is `aria-hidden`, since the stage's live status line already speaks.
- **Leave button:** plain `outline`, without its one-off red hover overrides.
- **Button roles:** joining actions (rejoin, take over, try again, sign in, Open in Zoom) are `primary`, like
  the Join button. Going back (Back to webinar, All webinars) is `outline`.
- **Open in Zoom:** now `a[app-button]`, not a hand-styled link. The shared `Button` selector gained
  `a[app-button]`; ngpButton supports anchors and reflects `aria-disabled` on them.

Not fixed: Zoom's "You are viewing …'s screen" banner can still be dragged sideways. It is Zoom's own UI, and
`videoDrag` doesn't control it.

## Risks

- **Silent reclaim on reload (follow-up 3):** a tab that held the seat and reloads takes it back without
  asking, even if another device took the seat in the second between. Accepted: it is the window the learner
  was watching, and the alternative is a conflict screen on every reload.
- **`sharingMode: 'fit'`** also removes "original size" for a learner who wanted to zoom into small text.
  Accepted: the ask is full screen.
- **Stage above Zoom while waiting:** if Zoom ever shows its own waiting screen instead of answering 3008, our
  screen covers it. That's harmless, since both say "waiting", and the room still joins when Zoom does.

## Jira

- **Summary:** `fix(offerings): keep the live webinar room full screen and wait cleanly for the start`
- **Type:** Bug. **Branch:** `fix/MIL-XXX-webinar-live-fullscreen`. **Estimate:** S.
- **Description:** Findings 2–6 above, the locked decisions, and acceptance criteria 1–5. Note finding 1
  separately: www and UAT need to serve this repo's build before their users see any of this.
