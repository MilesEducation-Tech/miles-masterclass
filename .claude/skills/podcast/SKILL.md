---
name: podcast
description: The Podcast feature of Miles Masterclass v3 — audio CPE courses that reuse the masterclass chapter structure with the audio player. Read before touching features/offerings/podcast.
---

# Podcast

Audio CPE courses. Structurally **a masterclass with an audio player** — same facades, same chapter model, same assessment flow. Read the `masterclass` skill first; this file only covers what differs.

## Files

```
features/offerings/podcast/
├── podcast.ts                                  # routes + list page
└── shared/
    ├── components/podcast-hero/                # list hero
    ├── components/podcast-course-hero/         # detail hero
    └── pages/
        ├── podcast-course/                     # detail page — owns its SEO
        └── podcast-chapter/                    # audio chapter player
```

Everything else is shared: `MasterclassFacade`, `ChapterFacade`, `FinalAssessmentFacade`, `FeedbackFacade`, `course-chapter-list`, `audio-chapter`, `chapter-quiz`, `course-resources`.

## Routes

```
/:country/:profession_type/podcast                                list
  /:courseId/:courseTitle                                         detail  ← leaf-owned SEO
    /chapter/:chapterId/:chapterTitle                             audio player
    /final-assessment/:session_id/exam                            RenderMode.Client
    /final-assessment/:session_id/report
    /feedback
```

**Podcast uses `:session_id` (snake_case); masterclass uses `:sessionId` (camelCase).** Both are declared in `app.routes.server.ts`. This drift is deliberate history, not a bug to tidy — normalising it breaks deep links unless every consumer changes together.

## What actually differs from masterclass

|            | Masterclass                     | Podcast                                            |
| ---------- | ------------------------------- | -------------------------------------------------- |
| Player     | `video-js` via `video-chapter`  | `audio-js` via `audio-chapter`                     |
| Chapter UI | Video-first, poster, fullscreen | Audio-first, `record-disk` / `wave-canvas` visuals |
| Exam param | `:sessionId`                    | `:session_id`                                      |
| Facades    | Same                            | Same                                               |

## Audio player

`shared/components/audio-js/audio-js.ts` — a Video.js instance in audio mode. Same outputs as the video player (`stateChange`, `timeUpdate`, `ended`, `metadataLoaded`, …) minus `playbackRateChange`.

`PlayerMode.CPE` applies identically: seeking disabled until playback ends. Audio makes it _more_ tempting to let people scrub — don't. The compliance rule is the same.

`audio-js.ts` still implements both `OnDestroy` and `DestroyRef`, and doesn't detach its previous CPE keydown handler before attaching a new one. Both are known bugs — fix them if you're already in the file, and don't copy the pattern.

## SEO

`podcast-course.ts` owns its SEO with the same `PendingTasks` gate as `masterclass-course.ts`. Any change to one almost always belongs in the other — check both before shipping. See the `seo` skill.

## Verify

```bash
pnpm start
```

1. `/us/cpa/podcast` — list renders.
2. Open a course — hero, chapter list, progress.
3. Play a chapter — audio plays, progress persists on reload, prev/next work.
4. CPE mode — seeking blocked until the track ends.
5. Complete the course → final assessment at `/final-assessment/:session_id/exam` (snake_case).
6. SEO: `pnpm build && pnpm serve:ssr:miles-masterclass-v3`, then curl the detail URL for `og:` tags.
