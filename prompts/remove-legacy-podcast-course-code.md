# Remove the legacy podcast course code (MIL-178)

Task under the epic "Podcast: bind to the new web API". Branch `refactor/MIL-178-remove-legacy-podcast-course-code`,
cut from `feat/MIL-177-podcast-course-chapter-binding`. Open its PR after MIL-177 merges.

## Goal

MIL-177 moved the podcast course and chapter pages onto the shared web-API facades. The legacy course stack the
podcast pages used before now has no users. Delete it, with no change to any page.

## What was checked (2026-11-10, on this branch)

Every importer of each candidate, then everything the candidates import, repeated until nothing new turned up.
Then every shared-service method the candidates call (`Utils`, `FeatureFacade`) and doc comments that name them.

### Deleted: no user left

| File                                                                    | Lines | Its users before MIL-177                         |
| ----------------------------------------------------------------------- | ----- | ------------------------------------------------ |
| `features/offerings/services/masterclass-facade.ts`                     | 486   | the podcast pages; now only the components below |
| `features/offerings/services/chapter-facade.ts`                         | 192   | the podcast chapter page                         |
| `features/offerings/components/course-chapter-list/`                    | 238   | the podcast course page                          |
| `features/offerings/components/course-resources/`                       | 196   | the podcast course page                          |
| `features/offerings/components/video-chapter/`                          | 491   | the podcast chapter page                         |
| `features/offerings/components/audio-chapter/`                          | 411   | the podcast chapter page                         |
| `shared/components/course-related-section/`                             | 256   | the podcast course page                          |
| `features/offerings/utils/course-load.ts`                               | 106   | `MasterclassFacade`, `ChapterFacade`             |
| `core/models/related-content.model.ts`                                  | 53    | `CourseRelatedSection`                           |
| `shared/utils/blob-download.ts` → `fileNameFromContentDisposition` only | ~10   | `CourseResources`                                |

About 2,440 lines (3,250 if `AudioJs` goes too, see below). None of the deleted components has a story.

### Kept: still used elsewhere

- **`FeedbackFacade` and `pages/course-feedback`:** the micro-learning and webinar feedback routes.
- **`ChapterWiseDetails`** (`core/models/course.model.ts`): the legacy `CourseDetails.chapter_wise_details` field.
- **`sanitizeFileName`:** `buildPdfFileName` uses it, for the CPE tracker's certificates.
- **Every `Utils` / `FeatureFacade` method the dead code calls** (`startFinalAssessment`, `toggleBookmarkCourse`,
  `requireCpeModeAccess`, `navigateToCourse`, `openCourseInfoDialog`, `buildCourseUrl`, `getAbout`, …): micro-learning
  and the shared cards still call each one.
- **`MASTERCLASS_ROUTES`, `ContentDetails`, `CourseChapter` and the other legacy models** the deleted files import:
  still used by micro-learning and the shared cards.
- **`app-hover`, `app-square`, `app-coming-soon`, `swiperConfigPodcast`, `FeatureFacade`:** partners, related
  sections and micro-learning.

### Comments and docs that name the deleted code (reworded, no behaviour)

- `masterclass-chapter-list.ts`, `masterclass-course-resources.ts`, `masterclass-course-related.ts` ("class for class
  … that one stays on the legacy facade for podcast").
- `course-detail-facade.ts` ("podcast still uses that one").
- `micro-learning-course.ts` ("Mirrors `VideoChapter.openTranscript`", "Mirrors `CourseResources.openGlossary`").
- `testing/mocks/content.mock.ts`.
- `docs/MASTERCLASS_PODCAST_AND_REELS.md` §190 (loaders) and §227–228 (`AudioChapter` / `VideoChapter`).
- `docs/refactor/STATE.md` history and `docs/refactor/PLAN.md` stay as written: they record what was true then.

## Decision (user, 2026-11-10)

**`shared/components/audio-js/` (`AudioJs`, 811 lines) is kept.** It's the audio player. Its only user was
`AudioChapter`, but the podcast audio player comes back when the backend sends the audio-or-video flag (option 2,
MIL-177), and that follow-up needs it. The PR lists it as the one deliberate exception.

## Checks to run

`pnpm lint` · `pnpm format:fix` · `node scripts/check-structure.mjs` (prune) · `pnpm build:prod` ·
`pnpm build-storybook` · `pnpm exec tsc -p tsconfig.app.json --noEmit`

## How to verify

Dev server 4101 (check the port first): re-run the MIL-176 (podcast landing), MIL-177 (podcast course, chapter,
assessment, report, feedback) and MIL-179 (masterclass, home) checks. Then the micro-learning and webinar pages, which
share `FeedbackFacade`, the cards and `Utils`: load a reel course and a webinar detail page, signed out, with no
console errors.

## Risks

- **A dynamic `import()` or a string reference the static check missed.** The type check, the production build
  and Storybook would all fail on a missing file, and the page checks cover the routes.
