---
name: media-players
description: The Video.js and audio players in Miles Masterclass v3 — PlayerMode.CPE vs DEFAULT, HLS and YouTube sources, playback progress tracking, source swapping, and the live-update-over-reinit rule. Read before touching video-js.ts, audio-js.ts, video-chapter, audio-chapter, or anything that plays or tracks media.
---

# Media players

Video.js 8 (+ `@videojs/http-streaming` for HLS, `videojs-youtube` for YouTube). Two wrappers:

- `shared/components/video-js/video-js.ts` — video
- `shared/components/audio-js/audio-js.ts` — audio (podcasts)

Consumers: `offerings/shared/components/video-chapter/`, `audio-chapter/`, and the micro-learning reel player.

## Public API

```ts
// inputs
videoSource = input.required<VideoSource | VideoSource[]>(); // { type, src }
mode = input<PlayerMode>(PlayerMode.DEFAULT);

// outputs
stateChange: VideoState; // READY|PLAYING|PAUSED|ENDED|BUFFERING|ERROR
playing / paused / ended;
metadataLoaded: {
  duration;
}
timeUpdate: {
  (currentTime, duration);
}
error: {
  (code, message);
}
playbackRateChange: number; // video only
```

`VideoSource.type` selects the engine: `video/mp4`, `application/x-mpegURL` (HLS), `video/youtube`.

## PlayerMode — the CPE rule

`shared/core/models/video-player.model.ts`

| Mode      | Behaviour                                                                          |
| --------- | ---------------------------------------------------------------------------------- |
| `DEFAULT` | All configured controls enabled.                                                   |
| `CPE`     | Only play/pause and fullscreen work. Other controls stay **visible but disabled**. |

This is a compliance requirement, not a UX preference: CPE credit requires the learner to actually watch. Weakening it — enabling seek, restoring the progress bar, allowing playback-rate changes in CPE mode — invalidates the credit.

How it's enforced:

- `isCpeMode = computed(() => mode() === PlayerMode.CPE)`
- `cpeRestricted = computed(() => isCpeMode() && !hasEnded())` — restriction **lifts once the media has ended**, so a finished chapter is freely scrubbable for review. Both the CSS and the keydown handler follow the same rule: available iff `!cpe_mode || completed`.
- Control bar preset: `CPE_CONTROL_BAR` vs `DEFAULT_CONTROL_BAR` (`shared/core/constant/video-player.ts`).
- A `vjs-cpe-mode` class plus a keydown handler blocks arrow-key seeking.

**Detach the previous keydown handler before attaching a new one.** `cpeRestricted()` changes when `mode` changes _and_ when `hasEnded` flips, so this runs more than once per player; stacking handlers is a known live bug in both files.

## Live updates, not reinit

When mode or config changes, use the player's setters and `player.one(...)` for one-shot listeners. **Do not dispose and rebuild the player** — it drops playback position, resets state, and flashes the poster.

## Swapping the source

`player.load()` has two side effects that must be undone:

1. It **pauses** playback.
2. It **resets playback rate to 1×**.

Capture both before the swap and restore them on `loadeddata`. Reels chain sources constantly — miss this and speed silently resets between episodes.

## Progress tracking

`timeUpdate` drives progress, which is posted to `myclassactivity`.

- **Micro-learning reels**: completion is derived — 95% watched → `isReelCompleted()` in `micro-learning-course.model.ts`. Never add a second heuristic; grep `isReelCompleted` first.
- **Reels track by `chapter_id`, not `id`.** A reel has both. Using `id` silently breaks CPE credit accrual.
- Throttle progress posts. One request per `timeupdate` tick will flood the API.

## SSR

Video.js is browser-only. The players guard on `isPlatformBrowser` and initialise in an effect, never in a constructor. `video-poster/` renders the SSR/pre-init placeholder — keep it so the served HTML has something meaningful for crawlers and the first paint.

## Accessibility

The control bar is Video.js's own and is keyboard-accessible. In CPE mode controls are disabled, **not removed** — a removed control is invisible to a screen reader and changes the tab order mid-session. Keep `aria-disabled` semantics intact.

## Reference docs

`.claude/skills/videojs.md` has the Video.js documentation-fetching notes: append `.md` to any docs URL, or send `Accept: text/markdown`, and `videojs.org/docs/framework/html/llms.txt` indexes everything.

## Checklist

- CPE restrictions intact, and lifting only on `hasEnded`.
- Old keydown handler detached before attaching a new one.
- Mode/config change → setters, not dispose+rebuild.
- Source swap → restore paused-state and playback rate on `loadeddata`.
- Reel progress keyed on `chapter_id`.
- No `window`/`document` outside a browser guard.
- Verify by actually playing media at `http://localhost:4100` — type checks prove nothing here.
