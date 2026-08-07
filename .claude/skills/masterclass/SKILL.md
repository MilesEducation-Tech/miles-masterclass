---
name: masterclass
description: The Masterclass feature of Miles Masterclass v3 — multi-chapter video courses, course detail page, chapter player, MasterclassFacade and ChapterFacade, CPE mode selection and course launch. Read before touching anything under features/offerings/masterclass or the shared offering facades.
---

# Masterclass

Long-form, multi-chapter video courses. Each chapter has a video and optionally a quiz; the course ends with a final assessment that awards CPE credit and a certificate.

The **canonical** offering. Podcast and micro-learning reuse most of this machinery — understand it first.

## Files

```
features/offerings/masterclass/
├── masterclass.ts                                   # routes + list page
└── shared/
    ├── components/masterclass-course-hero/
    └── pages/
        ├── masterclass-course/                      # detail page — owns its SEO
        └── masterclass-chapter/                     # chapter player

features/offerings/shared/                           # shared with podcast + micro-learning
├── services/masterclass-facade/                     # 545 lines
├── services/chapter-facade/                         # 380 lines
├── services/final-assessment-facade/
├── services/feedback-facade/
└── components/{course-chapter-list,video-chapter,audio-chapter,document-chapter,chapter-quiz,course-resources}/
```

## Routes

```
/:country/:profession_type/masterclass                                   list
  /:courseId/:courseTitle                                                detail  ← leaf-owned SEO
    /chapter/:chapterId/:chapterTitle                                    player
    /final-assessment/:sessionId/exam                                    RenderMode.Client
    /final-assessment/:sessionId/report
    /feedback
```

`MasterclassFacade` is provided on the offerings route in `features.ts`, so masterclass and podcast share one instance across that tree. `:courseTitle` is a display slug — never parse behaviour out of it.

**Masterclass uses `:sessionId`.** Podcast and micro-learning use `:session_id`. Both spellings are live in `app.routes.server.ts`. Do not normalise without fixing every consumer.

## MasterclassFacade

State: `courseDetails`, `courseChapters`, `loading`, `error`, `downloadingExerciseFiles`, `currentProgress` (computed).

Actions: `loadCourse`, `launchCourse`, `navigateToChapter`, `selectCpeModeDialog`, `selectCpeMode`, `toggleCpeMode`, `startFinalAssessment`, `openCertificateDownloadDialog`, `submitFeedback`, `openShareDialog`, `openAdditionalResources`, `downloadExerciseFiles`, `fetchCourseContent`, `clear`.

`clear()` runs from the page's `DestroyRef.onDestroy`. Skipping it leaks the previous course into the next one, because the facade instance outlives the page.

## ChapterFacade

Owns the chapter player: `courseDetails`, `courseChapters`, `selectedChapterId`, `chapterNavigation` (computed prev/next).

- `trackActivity(chapterId, timeStatus, 'heartbeat' | 'completed' | 'exit')` — progress to `myclassactivity`. All three events matter: heartbeat keeps the session alive, exit records a partial watch. Throttle heartbeats.
- `submitQuizAnswer`, `fetchQuizReport`, `updateUserSelectedOption`, `updateChapterStatus` — the chapter quiz (see the `assessments` skill).
- `selectCpeMode`, `clear`.

## CPE mode

The learner picks CPE or Preview before launching, via `dialog/select-cpe-mode`.

- **CPE mode** — `PlayerMode.CPE`. Seeking and playback-rate changes are disabled until the media ends. This is a compliance requirement; weakening it invalidates the credit.
- **Preview mode** — full controls, no credit.

The choice flows through `selectCpeMode` → the player's `mode` input. See the `media-players` skill.

## The detail page owns its SEO

`masterclass-course.ts` is the reference implementation of the `PendingTasks` SSR gate: synchronous URL-derived `setSeo`, then `loadFromSupabase` with a `courseToSeoConfig` fallback, plus an error-path release and `seoManager.reset()` on destroy. Read the `seo` skill before touching it — and release the gate on every path, or SSR hangs.

## Chapter types

`course-chapter-list` dispatches on chapter type: `video-chapter`, `audio-chapter`, `document-chapter`. New type = new component + a case there; don't grow an `if` chain inside an existing chapter component.

## Gotchas

- `currentProgress` is **derived from chapters**. Never store a parallel progress field.
- Credits come from `FieldOfStudy` via `TotalCpeCreditsPipe`. Never sum by hand.
- `course-resources.ts` still injects `HttpClient` directly — known debt. Don't copy it; if you're already in there, push the call into the facade.
- Bookmark and cart actions go through `Utils`, which broadcasts through `FeatureFacade` so list pages update. Calling the API directly leaves stale cards behind.
- The detail page is `RenderMode.Server`; the exam is `RenderMode.Client`. Moving the detail page to Client silently kills its SEO.

## Verify

```bash
pnpm start
```

1. `/us/cpa/masterclass` — list renders, cards link correctly.
2. Open a course — hero, chapter list, progress, CPE-mode dialog.
3. Launch a chapter — playback, progress persists on reload, prev/next work.
4. CPE mode — seek and rate are blocked until the video ends, then unblocked.
5. Hard-refresh the chapter URL — deep links are where this breaks.
6. SEO: `pnpm build && pnpm serve:ssr:miles-masterclass-v3`, then curl the detail URL for `og:` tags.
