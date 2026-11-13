# Remove the legacy reels code (MIL-184)

Clean-up Task under the reels epic (MIL-180). Branch `refactor/MIL-184-remove-legacy-reels-code`, cut from
`master` at `6a64d867` (MIL-183, #258).

## Goal

MIL-181, MIL-182, MIL-185 and MIL-183 moved the reels landing page, the reel player, its progress and mode, and the
steps after a reel onto the web API. The legacy code those pages used now has no caller. Delete it, with no change to
any page.

**Scope rule:** code whose last caller one of the four reels PRs removed, plus whatever only that code used. Code that
was already dead before the epic is listed under "Found, not removed" and left for a later chore.

## What was checked (2026-11-12, on this branch)

- Every public member of `Utils` and `FeatureFacade`, every `MASTERCLASS_ROUTES` and `FEATURE_ROUTES` key, the reel
  feature's components and models, and the shared cards. Each was grepped across `src/**/*.ts|html`.
- `git log -S` found the commit that removed each candidate's last caller.
- Everything the candidates import was then checked again, until nothing new turned up.

### Deleted: no caller left

| Code                                                                                                                                                                                                                                                     | Lines | Last caller removed by                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------ |
| `FeatureFacade`'s listing cache: `FeatureResource`, `FeatureResourceOptions`, `ResourceRequest`, the list unwrapping, `getResource`, the `resources` map, `refreshPersonalized`, `applyBookmarkChange` and their bookmark helpers                        | ~840  | #254 (reels landing): `getResource` has had no caller since              |
| `FEATURE_ROUTES`: every key but `about` (`comingSoon`, `instructor`, `inprogress`, `completed`, `bookmark`, `upcoming`, `premiere`, `popular`, `recommended`, `becauseYouWatched`, `complimentary`, `highlight`, `latest`, `newlyAdded`)                 | ~180  | only `FeatureResource` read them                                         |
| `library-filters.model.ts` → `selectionsEqual`, `appendFilterParams`                                                                                                                                                                                     | ~35   | only `FeatureResource` used them                                         |
| `core/utils/offering-type.ts`                                                                                                                                                                                                                            | 33    | only fed `refreshPersonalized`                                           |
| `Utils.startFinalAssessment`, `StartFinalAssessmentParams`, `toApiCourseType`                                                                                                                                                                            | ~110  | #256 (reel player)                                                       |
| `Utils.requireCpeModeAccess`, `Utils.canAccessCpeMode`, and `shared/utils/cpe-mode-access.ts`                                                                                                                                                            | ~70   | #256                                                                     |
| `Utils.openCertificateDownloadDialog` and its `openPurchaseGateDialog`                                                                                                                                                                                   | ~90   | #256                                                                     |
| `MASTERCLASS_ROUTES`: `setCpeMode`, `myClassActivity`, `getCourseContent`, `startFinalAssessment`, plus `CourseContentData` / `CourseContentResponse`                                                                                                    | ~65   | #256                                                                     |
| `MASTERCLASS_ROUTES`: `getCourseDetails`, `getCourseChapter`, `downloadExerciseFile`                                                                                                                                                                     | ~15   | #251 (podcast clean-up), which kept them for micro-learning              |
| `core/models/course.model.ts` → `FinalAssessmentExamResponse`                                                                                                                                                                                            | 6     | only the two `startFinalAssessment`s used it                             |
| `shared/components/cards/coming-soon/` (`app-coming-soon`, with its story)                                                                                                                                                                               | 179   | #254: the reels landing was its last user                                |
| The reel player's commented-out search and field-of-study filter: `micro-learning-filter-sheet/`, the top bar's `placeholder` / `searchValue` / `filterToggled` / `handleFilterClick`, the page's `filters` / `openFilters`, `MicroLearningFilterOption` | ~160  | the button that opens it is commented out, and nothing fills its options |
| `core/models/nano-learning.model.ts` (an empty file)                                                                                                                                                                                                     | 0     | —                                                                        |

About 1,800 lines, all deletions.

### Edited: the call sites of what goes

- **`Utils.toggleBookmarkCourse`:** drops the `applyBookmarkChange` fan-out. The map it walked is always empty now,
  because nothing calls `getResource`.
- **`EngagementDialog`:** drops the `refreshPersonalized` call after the profile dialog saves, with its `FeatureFacade`
  and `offering-type` imports. That call was also a no-op.
- **`pages/course-feedback/course-feedback.ts`:** drops the `nano-learning` / `micro-learning` / `ai_lab` arm of
  the id key. Webinar is the only route left on this page (AI Labs has its own).
- **`feedback-model.ts`:** drops `FeedbackRequest.nano_learning_id`. `UserFeedbackData.nano_learning` stays,
  because it describes the server's response.
- **`FeatureFacade`** keeps `getAbout` and `dropIdOnlyFieldsOfStudy`. The legacy cards' info dialog still reads
  `about/`. Its class comment is rewritten.
- **Comments:**
  - `features/features.routes.ts` says `FeatureFacade` must stay one instance so the broadcasts reach the offering
    pages' resources. There are no broadcasts now, so that comment goes.
  - The `FeatureFacade` comments in `masterclass-home-facade.ts` and `footer-overlay.stories.ts` are checked and
    reworded only if they name deleted code.

### Kept: still used

- **`FeedbackFacade`, `pages/course-feedback`:** the webinar feedback route.
- **`MASTERCLASS_ROUTES.toggleBookmark`, `downloadCertificate`, `additionalResources`, `claimBadge`:** the legacy
  cards, the certificate dialog and the badges page.
- **`ContentDetails`, `CourseChapter`, `QuizQuestion`:** the course-about components, `CourseChapterFacade`,
  `FeedbackFacade` and the SEO config.
- **`Utils.getApiCourseType`:** `toggleBookmarkCourse` uses it.
- **`FeatureApiKey` and the types built on it:** `core/config/feature.config.ts` still references them (see below).
- **`micro-learning-course.model.ts` → `MicroLearningOptionId`:** the reel card's menu.
- **`swiperConfigComingSoon`, `app-coming-soon-card`:** the masterclass, podcast and reels landing pages. This is a
  different component from `app-coming-soon`.
- **The `nano_learning` tokens in badges, the CPE tracker, search and library filters:** these are the server's
  course types, not legacy code.

### Found, not removed (dead before the epic)

| Code                                                                                                                              | Dead since                          |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `Utils.getCourseIdKey`, `Utils.getCourseDetailsSegment`                                                                           | #175 (masterclass final assessment) |
| `Utils.routeParams`                                                                                                               | before the refactor                 |
| `core/config/feature.config.ts` (no importer), and with it `FeatureConfigItem` / `FeatureConfigMap`                               | before the refactor                 |
| `feature.model.ts` → `PaginationInfo`, `ApiResponseWithPagination`, `FeaturePaginationMap`, `FeatureResponseMap`, `FeatureApiMap` | before the refactor                 |
| `library-filters.model.ts` → `FEATURE_KEY_TO_SECTION`                                                                             | before the refactor                 |

A later `chore` can take these. They aren't reels code.

## Assumptions (reviewer, read first)

1. **The listing cache goes in this PR.** Its last user was the reels landing page (#254), so it falls under the
   scope rule. Both broadcasts walk a map that nothing fills, so removing them changes no behaviour.
2. **The commented-out search box and filter go too.** MIL-182 deleted the reel player's commented-out episode grid
   the same way. Bringing them back would mean a new filter against `reels-feed/`, not this sheet, because nothing
   feeds its options.
3. **`AGENTS.md` §5:** the `nano-learning.model.ts` row goes. §6 already says content-type routes use the API token
   `nano_learning`, not the URL token `micro-learning`.

## Docs

- **`AGENTS.md` §5:** drop the `nano-learning.model.ts` row.
- **`docs/MASTERCLASS_PODCAST_AND_REELS.md` §9, "Still to rebind":**
  - drop the clean-up Task, `toApiCourseType` and the empty model;
  - note the reels epic is done, except the backend follow-ups.
- **`docs/refactor/STATE.md`:** MIL-183 merged; a MIL-184 entry.
- **`docs/refactor/` history and `PLAN.md`** stay as written.
- **`.claude/skills/`** is yours. If a skill names `getResource`, `FeatureResource`, `startFinalAssessment` or
  `offering-type`, it needs your edit; I can't read that folder from a shell here.

## Checks to run

`pnpm exec tsc -p tsconfig.app.json --noEmit` · `pnpm lint` · `pnpm format:fix` · `node scripts/check-structure.mjs`
(`--prune` if it reports the baseline out of date) · `pnpm build:prod` · `pnpm build-storybook`

## How to verify

Dev server 4101 (check the port first), in English:

1. **Reels regression:** re-run the MIL-181 (landing), MIL-182 (player), MIL-185 (progress, mode) and MIL-183 (steps)
   checks.
2. **The edited call sites:**
   - a legacy card's bookmark toggles and toasts, and its info dialog opens (reads `about/`);
   - the profile-completion dialog saves and closes;
   - a webinar's feedback page submits with `webinar_id`.
3. **Everything else that touched `Utils` or `FeatureFacade`:** the masterclass, podcast and home pages load signed
   out and signed in with no console errors.
4. **Bundle:** `build:prod` shows the initial bundle no larger than `master`'s 230.47 kB.

## Risks

- **A dynamic `import()` or a string key the grep missed.** `tsc`, the production build and Storybook all fail on a
  missing file or member, and the page checks cover the routes.
- **The personalised rails don't refresh after the profile dialog saves a sector or job role.** That's true today
  too: the refresh it called reached nothing. Removing the dead call makes the gap visible. A fix belongs to the
  home-rails facade, in its own ticket.

## Jira text

**Title:** Reels clean-up: remove the legacy reels code

**Description:** The reels landing page, reel player, progress and mode, and the steps after a reel now run on the
new Postman collection (MIL-181, MIL-182, MIL-185, MIL-183). This removes the code they replaced, with no change to
any page:

- the legacy listing cache in `FeatureFacade`;
- the old exam start, CPE-mode gate and certificate dialog in `Utils`;
- the old course routes;
- the shared Coming-soon card;
- the reel player's commented-out search and filter;
- the reel arm of the legacy feedback page;
- the empty nano-learning model.

## As built (2026-11-12)

Implemented as planned, about 1,920 lines of source deleted (27 files, +23 / −1,921).

**Small additions found while building:**

- `Utils` lost the fields and imports that only the deleted methods used: `Storage`, `Injector`,
  `SUBSCRIPTION_DIALOG`, `AccountApi`, `RawCredlyBadge`, `HttpContext`, `RouteParams` and `SKIP_ERROR_NOTIFICATION`.
- `FeatureFacade` has no `any` left, so it comes off `LEGACY_ANY_FILES` in `eslint.config.mjs`, as that list's
  comment asks. `payment/pages/plan/plan.ts` is also `any`-free, but it isn't this PR's, so it stays.
- `structure-baseline.json` was pruned: the deleted card's and route file's relative imports.
- The profile-completion branch in `EngagementDialog` can't run today: `resolveNext()` always returns `null`
  (its polling is parked). So the removed refresh is unreachable as well as a no-op.
- The legacy horizontal card's info button has no accessible name. This was already true and is left as is.

**Checks:**

- `tsc` ✔;
- lint 0 errors (74 warnings, down from 97);
- structure ✔ (pruned);
- `build:prod` ✔: initial 999.36 kB / 225.86 kB, down from 1.01 MB / 230.47 kB; only `ai-labs.css` warns;
- `build-storybook` ✔.

**Verified (dev 4101, English):**

- MIL-181 (38), MIL-182 (37), MIL-185 (26) and MIL-183 (48) re-run green.
- New run, 35 checks:
  - home, masterclass, podcast, micro-learning, webinar and a partner page load with no page errors, signed out and
    signed in, and send none of the deleted code's requests;
  - on stubs, a legacy card's info dialog reads `about/` and opens;
  - its bookmark posts `toggle-bookmark/`, toasts and flips;
  - a webinar's feedback submits with `webinar_id` and no other id key.
- One check failed on its own expectation: it wanted the number `501`, and the page sends the route param, the
  string `"501"`, the same as `master`.
