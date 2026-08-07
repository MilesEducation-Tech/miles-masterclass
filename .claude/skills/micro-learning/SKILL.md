---
name: micro-learning
description: The Micro-Learning (reels) feature of Miles Masterclass v3 — short-form CPE reels, the nano_learning API token, MicroLearningCourseFacade, reel progress and sequential gating, cursor pagination. Read before touching features/offerings/micro-learning or the reel facade.
---

# Micro-Learning (reels)

Short, vertical, reel-style CPE videos. Same credit machinery as masterclass, very different navigation model: an infinite scrolling feed rather than a chapter list.

## The naming trap — read this first

| Context                    | Token                         |
| -------------------------- | ----------------------------- |
| API paths and route tokens | `nano_learning` (snake_case)  |
| Frontend URL segment       | `micro-learning` (kebab-case) |
| Folder names               | `micro-learning`              |

`shared/core/models/nano-learning.model.ts` holds `NANO_LEARNING_ROUTES`. Never conflate the two — using the URL token in an API call 404s, using the API token in a route breaks every link.

## The second trap

A `MicroLearningReel` has **both `id` and `chapter_id`**.

- `id` → selection, routing, list keys.
- **`chapter_id` → `myclassactivity` progress tracking.**

Using `id` for tracking silently breaks CPE credit accrual. Nothing errors; credits just never accrue.

## Files

```
features/offerings/micro-learning/
├── micro-learning.ts                              # routes + list page
└── shared/
    ├── pages/micro-learning-course/               # the reel feed
    └── components/
        ├── micro-learning-hero/  hero-reel-item.model.ts
        ├── micro-learning-hero-reel-card/  -hero-phone-mockup/
        ├── micro-learning-reel-card/  -reel-nav/  -top-bar/
        ├── micro-learning-episode-grid/  -about-panel/
        ├── micro-learning-filter-sheet/
        └── micro-learning-quiz-dialog/

features/offerings/shared/services/micro-learning-course-facade/   # 910 lines — the big one
```

## Routes

```
/:country/:profession_type/micro-learning                          list
  /:courseId/:courseTitle                                          reel feed
    /final-assessment/:session_id/exam                             RenderMode.Client
    /final-assessment/:session_id/report
    /feedback
```

Note `:session_id` (snake) here — masterclass uses `:sessionId`.

## MicroLearningCourseFacade

**State**: `detailsList`, `selectedReelId`, `loading`, `error`, `nextCursor`, `loadingMore`, `ctaLoading`.

**Computed**: `activeIndex`, `activeReel`, `actionStatus`, `currentProgress`.

**Request signals** — `scrollToIdRequest`, `rewatchRequest`, `pauseRequest`, each `{ id, token }`. The `token` is what makes a repeat request for the _same_ id fire again; a bare id wouldn't change the signal. Don't "simplify" it away.

**Actions**: `initForCourse`, `loadCourseDetails`, `loadNextPage`, `trackActivity`, `navigateToReel`, `onScrollSelect`, `toggleBookmark`, `addToCart`, `launchCourse`, `selectCpeMode`, `clear`.

**Gating**: `isReelComplete`, `getBlockingReel`, `findInProgressReel`, `canAdvanceTo`. Reels are watched in order — you can't skip ahead past an incomplete one. `getBlockingReel(targetIndex)` returns the reel standing in the way so the UI can say _why_.

## Completion

Derived, never stored: **95% watched → complete**, via `isReelCompleted()` in `micro-learning-course.model.ts`. Grep `isReelCompleted` before writing any completion check — a second heuristic guarantees the two disagree.

## Pagination

Cursor-based: `nextCursor` + `loadNextPage()`, with `loadingMore` separate from `loading` so the feed doesn't blank out while appending. `loadNextPage` must be a no-op when a request is already in flight or `nextCursor` is null — scroll handlers fire fast.

## The route-input double-fire

The route-input effect runs **twice per navigation**. `initForCourse` guards on `selectedReelId` to avoid a duplicate `:id` fetch. Keep that guard, and add the equivalent to any new route-driven effect here.

## The anchor-reel serializer gap

`GET v2/nano-learning/:id` (the anchor-reel response) omits the progress and CPE fields the full list response carries. On refresh or return-navigation the reel CTA therefore renders wrong. **This is a backend fix, not a frontend workaround** — don't paper over it with a second fetch or a guessed default without flagging it.

## Player integration

The feed swaps sources constantly. `player.load()` **pauses playback and resets playback rate to 1×** — capture both before the swap and restore on `loadeddata`. See the `media-players` skill.

## Gotchas

- The facade is route-scoped. Don't make it `providedIn: 'root'`.
- `clear()` on destroy, or the previous course's reels bleed into the next.
- `dialog/micro-learning-quiz-dialog` is the per-reel quiz; the final assessment is separate (`assessments` skill).
- Bookmark and cart go through `Utils` so list pages update.

## Verify

```bash
pnpm start
```

1. `/us/cpa/micro-learning` — list renders.
2. Open a course — reel feed plays, scroll selects the next reel.
3. Watch one past 95% — completion flips, the next reel unlocks.
4. Try to jump ahead past an incomplete reel — blocked, with the blocking reel named.
5. Scroll to the end — the next page appends without blanking the feed.
6. Reload mid-course — the correct reel is anchored and the CTA is right (watch for the serializer gap above).
7. Network tab: progress posts carry **`chapter_id`**.
