# Remove the v2 bindings from the masterclass chapter page (MIL-66)

First of two subtasks under Story MIL-65 (`feat(offerings): bind the masterclass chapter page to the web API`), on
`feat/MIL-65-masterclass-chapter-page-binding`. MIL-67 then binds the page to `course-detail`, following
`prompts/masterclass-chapter-binding.md`. Both land in one PR.

## Assumptions

1. **This commit is a step, not a release.** On its own it leaves the page showing its loading skeleton and nothing
   else, which is what learners see today, because every read fails. It must not merge without MIL-67, and it won't,
   because both are in one PR.
2. **Only the masterclass chapter page and its route change.** `ChapterFacade`, `courseLoad`, `MASTERCLASS_ROUTES`,
   the shared player (`video-chapter`) and `ChapterQuiz` all stay as they are. The podcast chapter page, the
   micro-learning facade and AI Labs still use them. Their v2 calls go with those features' own tickets.
3. **The player's transcript call (`v2/course-content/` via `MasterclassFacade`) stays for now.** It lives in the
   shared player and only fires from a rendered chapter. After this commit the masterclass page never renders one, so
   the call can't fire from it. MIL-67 replaces it with `transcript_text` when it retypes the player.

## Goal

The masterclass chapter page makes no request to a retired endpoint and no longer depends on `ChapterFacade`. That
leaves MIL-67 a clean page to bind, rather than a rewrite that is half removal and half binding.

## What I read

- **`masterclass-chapter.ts|html`.** Every piece of data and every action goes through `ChapterFacade`:
  - `loadCourse({ id: Number(id) })`: the ids are UUIDs, so the request goes out as `id=NaN`.
  - `selectedChapterId.set(Number(chapterId))`, `chapterNavigation`, `courseDetails`, `courseChapters`.
  - `fetchQuizReport`, `trackActivity` (heartbeats and completion), and `selectCpeMode` from the
    "Switch to CPE Mode?" dialog.
  - The access check: `Utils.requireCpeModeAccess` and then `exitChapterToCourse`.
  - Final assessment: `Utils.startFinalAssessment`, and the report link from
    `user_assessment_details.session_id`.
- **`masterclass.routes.ts`:** the chapter route provides `ChapterFacade`.
- **`video-chapter`:** with `current` null it renders only `<app-chapter-skeleton />`. `ChapterQuiz`, the one child
  that injects `ChapterFacade`, sits inside the `@else` branch, so it never renders and nothing fails to inject.
  The player injects `MasterclassFacade`, which the offerings mount provides (`features.routes.ts`), so that's
  unaffected.
- **Other callers** of everything the page used: podcast chapter, micro-learning, `course-chapter-list` and AI Labs.
  Nothing becomes unused, so nothing else is deleted.

## Endpoint map: probed on UAT today, signed out

Every legacy route answers Django's HTML **"Page not found at /…"**: the route itself is gone, not just the record.
For comparison, a live route answers a JSON envelope: `course-detail` with an unknown id gives
`{"success":false,"message":"Course not found."}`.

| Call made from this page today                    | Via                         | UAT                   | After                         |
| ------------------------------------------------- | --------------------------- | --------------------- | ----------------------------- |
| `GET v2/masterclass/details/?id=NaN`              | `loadCourse` → `courseLoad` | route gone (404 HTML) | none                          |
| `GET v2/chapters/?id=NaN&course_type=masterclass` | `loadCourse` → `courseLoad` | route gone            | none                          |
| `GET masterclass/report_summary/?chapter_id=…`    | `fetchQuizReport`           | route gone            | none                          |
| `POST v2/user/myclassactivity/`                   | `trackActivity`             | route gone            | none                          |
| `POST user/customaction/set_cpe_mode/`            | `selectCpeMode`             | route gone            | none                          |
| `POST user-quiz-details/` (`ChapterQuiz`)         | `submitQuizAnswer`          | route gone            | none                          |
| `GET v2/course-content/` (player transcript)      | `MasterclassFacade`         | route gone            | none (no chapter is rendered) |

## Locked decisions

1. **The page keeps its route inputs** (`courseId`, `courseTitle`, `chapterId`), the "Back to Course" link and
   `<app-video-chapter>` with no data bound. The skeleton is the visible state. MIL-67 binds the inputs.
2. **Everything that read or wrote through `ChapterFacade` is removed from the page:** the effects, the navigation,
   the final-assessment and report handlers, the CPE-mode dialog, and the activity tracking. MIL-67 rebuilds these on
   `CourseDetailFacade` in the shape that plan describes (`setMode`, `finalAssessmentEntry`, the lock redirects).
3. **The route stops providing `ChapterFacade`,** along with its import.
4. **No placeholder copy or "coming soon" state.** The intermediate state never ships.

## Files touched

| File                                                                                        | Change                                                 |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `src/app/features/offerings/masterclass/pages/masterclass-chapter/masterclass-chapter.ts`   | reduced to route inputs and the back link (~270 → ~20) |
| `src/app/features/offerings/masterclass/pages/masterclass-chapter/masterclass-chapter.html` | `<app-video-chapter>` with no bindings                 |
| `src/app/features/offerings/masterclass/masterclass.routes.ts`                              | drop `providers: [ChapterFacade]` and its import       |
| `docs/refactor/STATE.md`                                                                    | a "Now" entry for MIL-65/66                            |

About 260 lines removed and 10 added. No new files.

## Security

Nothing changes on access. The route is public on `master` today; MIL-62 adds `authGuard` to it. No request is added,
and no data reaches the page.

## Acceptance criteria

1. Opening `/us/accounting/masterclass/<courseId>/<slug>/chapter/<chapterId>/<slug>` shows "Back to Course" and the
   chapter skeleton, with no console error.
2. The network panel shows **no** request to `v2/`, `masterclass/report_summary/`, `user/customaction/set_cpe_mode/`,
   `user-quiz-details/` or `v2/course-content/` from that page. Today it shows the two `v2/` reads with `id=NaN`.
3. "Back to Course" returns to the course page.
4. The podcast chapter page is unchanged: same code, same requests.
5. No dead code is left behind: everything the page stops using still has another caller.

## Checks

- `pnpm lint` (0 errors), `pnpm format`, `pnpm check:structure`, `tsc -p tsconfig.app.json`.
- `pnpm build:prod`. **This breaks your running dev server's Vite cache**, so I'll ask before running it, or you can
  restart the server afterwards.

## How to verify

1. **Before:** on `master`'s code, which is this branch before the change, open a chapter URL on 4101. The network panel
   shows `v2/masterclass/details/?id=NaN` and `v2/chapters/?id=NaN…`, both 404.
2. **After:** the same URL shows the back link and the skeleton, and the network panel shows none of the requests in
   criterion 2.
3. **The back link** returns to the course page.
4. **Podcast:** a podcast chapter URL still makes its usual (also 404) requests. That is unchanged and out of scope.

Checked headless (Playwright) on your dev server, since this branch has no route guard yet and needs no cookie.

## Risks

- **A merge conflict with MIL-62.** This branch was cut from `master` before MIL-62 merged. Both change the chapter
  route in `masterclass.routes.ts`: MIL-62 adds `canMatch: [authGuard]` next to the `providers` line this removes, and
  adds an import next to the `ChapterFacade` import this removes. When syncing with `master`, keep the guard and drop
  `ChapterFacade`. It's a two-hunk conflict.
- **The branch has a dead page between the two commits.** It's harmless because they ship together, but don't open
  the PR after MIL-66 alone.

## Commit (MIL-66)

- **Summary:** `refactor(offerings): drop the retired v2 bindings from the masterclass chapter page`
- **Description:** names MIL-66, lists the removed calls, and notes that the page shows its skeleton until MIL-67.
