# Podcast course and chapter pages on the web API (MIL-177)

Story 2 of the epic "Podcast: bind to the new web API". Branch `feat/MIL-177-podcast-course-chapter-binding`, cut
from `feat/MIL-176-podcast-landing-binding` (which has MIL-179 merged in). Open its PR only after MIL-176 merges.

## Goal

Rebind `/:country/:profession/podcast/:courseId/:courseTitle` (course page) and `…/chapter/:chapterId/:chapterTitle`
(chapter page) from the legacy `MasterclassFacade` / `ChapterFacade` to the shared `CourseDetailFacade` /
`CourseChapterFacade` on `web-api/v1/masterclass/…`. Podcast joins `COURSE_DETAIL_API` as the second offering. The
landing page's cards (MIL-176) already link here by UUID.

## What was read

- The podcast course and chapter pages, `PodcastCourseHero`, `podcast.routes.ts`.
- The masterclass course and chapter pages and their sections (`masterclass/components/*`), `masterclass.routes.ts`.
- `CourseDetailFacade`, `CourseChapterFacade`, `CourseChapterQuizFacade`, `FinalAssessmentFacade`,
  `CourseEvaluationFacade`, `CourseCertificateFacade`, `COURSE_DETAIL_API`, `course-detail.model.ts`,
  `CourseChapterPlayer`, `setupCourseSeo`, `app.routes.server.ts`.
- The old shared sections the podcast page used (`CourseAbout`, `CourseChapterList`, `CourseResources`,
  `CourseRelatedSection`) and how they branch for podcasts.
- **Live UAT (2026-11-10, signed out):** `course-detail/<uuid>` answers for both podcasts.
  - `course_type: "podcast"`, `content_type: "Podcast"`, 3 chapters each, the same shape as a masterclass.
  - Chapters carry `hls_video_url`, `square_thumbnail_url`, `horizontal_thumbnail_url`.
  - **No audio-or-video flag** (backend asked on 2026-11-06; not live yet).
  - Related rails are empty for both podcasts.
  - A masterclass's related card carries `course_type` (not read by the model today) and only `thumbnail_url`
    (landscape) and `vertical_thumbnail_url`; there's no square image.

## Findings that shape the plan

1. **Every `COURSE_DETAIL_API` route is the same for a podcast;** only `urlSegment` differs. The facades are
   offering-agnostic apart from `urlSegment`.
2. **The chapter page needs the final assessment.** `CourseChapterQuizFacade` (which the chapter page provides)
   injects `FinalAssessmentFacade`: after the last chapter's quiz it starts the sitting and opens
   `final-assessment/:sessionId/exam`. The hero's Take Assessment / View Report / Give Feedback / Certificate buttons
   use the same facades. So the chapter page can't ship without the exam, report and feedback routes, and those
   routes are only route config over shared pages that already serve masterclass.
3. **The old podcast page used the masterclass About and Resources sections as they are** (`CourseAbout`'s type
   defaulted to `masterclass`). Only the chapter list (square artwork with a record disk) and the related rows
   (square cards) looked different.
4. **Related cards don't say which page they belong to** in the model: the facade links them with the page's
   `urlSegment`. A podcast's related course can be a masterclass (`course_type: "course"`), so it would link to
   `/podcast/…`.
5. **CPE mode is chosen when a chapter starts** (`CourseChapterFacade` → `setMode`), not by a hero toggle as on the
   old podcast page.

## Locked decisions (approved 2026-11-10)

1. **Option 2 (user, 2026-11-10):** every podcast chapter plays in the shared video player
   (`CourseChapterPlayer`), since `hls_video_url` is all the API sends. One computed on the chapter page decides the
   player, so the audio player can switch on when the backend sends a format.
2. **`COURSE_DETAIL_API.podcast`** = the masterclass routes with `urlSegment: 'podcast'`; `CourseOffering` gains
   `'podcast'`.
3. **The final assessment, report and feedback move into this story** (finding 2). The podcast course route mirrors
   masterclass's: `providers: [CourseDetailFacade, FinalAssessmentFacade, CourseEvaluationFacade,
CourseCertificateFacade]`, children `''`, `chapter/…`, `final-assessment/:sessionId/exam` (leave guard),
   `final-assessment/report`, `feedback` (`CourseEvaluation`). Three `RenderMode.Client` entries in
   `app.routes.server.ts`, as masterclass has.
   - **Story 3 becomes the cleanup:** deleting what nothing uses any more (`MasterclassFacade`, `ChapterFacade`,
     `CourseChapterList`, `CourseResources`, `VideoChapter`, `AudioChapter`, `CourseRelatedSection` and their
     models and stories). This needs a Jira edit (see "Decisions needed").
4. **Sections:**
   - **About, Resources, Related are shared as they are.** `MasterclassCourseAbout`, `MasterclassCourseResources`
     and `MasterclassCourseRelated` move from `masterclass/components/` to `offerings/components/` (git renames,
     names kept per MIL-179's API-namespace rule). The masterclass page only changes import paths.
   - **Related cards link by their own `course_type`:** `MasterclassRelatedCourse.course_type` (optional;
     `course` → `masterclass`, `podcast` → `podcast`, otherwise the page's segment). They stay landscape cards: the
     contract has no square image.
   - **New `PodcastChapterList`** (`podcast/components/`): the masterclass list's rows and states with the podcast
     thumbnail (square artwork with the record disk, as before).
5. **`PodcastCourseHero` is rebuilt on the facades** with today's podcast look: record disk, title, instructors,
   fields of study, CAIRA badge, credits, progress.
   - Its actions are the masterclass hero's, through the same facades: Watch Now / Resume, Take Assessment,
     View Report, Give Feedback / rating, Trailer, Sample, Bookmark, Share, Certificate, and the plan page link.
   - The hero's CPE-mode toggle goes (finding 5).
6. **Pages mirror masterclass:**
   - `PodcastCourse` connects the facade and shows hero (or skeleton / not found / error), chapters, resources,
     about, related, FAQ, with SEO via `setupCourseSeo({ kind: 'podcast' })`.
   - `PodcastChapter` is `MasterclassChapter` with podcast copy.
   - The podcast page keeps no section nav (it never had one).

## Decisions (user, 2026-11-10)

- **A. Story 3's scope:** the assessment, report and feedback are in this story; Story 3 is now the Task "Remove the
  legacy podcast course code".
- **B. The three section moves:** in this PR, as git renames, flagged in the PR body.

## Files touched

| File                                                                            | Change                                                                  |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `features/offerings/models/course-detail.model.ts`                              | `CourseOffering` + `'podcast'`; `MasterclassRelatedCourse.course_type?` |
| `features/offerings/constants/course-detail.ts`                                 | `COURSE_DETAIL_API.podcast`                                             |
| `features/offerings/services/course-detail-facade.ts`                           | related links by `course_type`; doc comments                            |
| `features/offerings/components/masterclass-course-{about,resources,related}/`   | moved from `masterclass/components/`                                    |
| `features/offerings/masterclass/pages/masterclass-course/masterclass-course.ts` | import paths                                                            |
| `features/offerings/podcast/podcast.routes.ts`                                  | rewritten on the shared facades and pages                               |
| `app.routes.server.ts`                                                          | three `RenderMode.Client` podcast entries                               |
| `features/offerings/podcast/pages/podcast-course/*`                             | rewritten                                                               |
| `features/offerings/podcast/pages/podcast-chapter/*`                            | rewritten (mirror of `MasterclassChapter`)                              |
| `features/offerings/podcast/components/podcast-course-hero/*`                   | rebuilt on the facades                                                  |
| `features/offerings/podcast/components/podcast-chapter-list/*`                  | new                                                                     |
| `features/offerings/podcast/constants/podcast.ts`                               | podcast copy (not-found, errors)                                        |
| `docs/refactor/STATE.md`                                                        | Now entry + step log                                                    |

About 1,400 changed lines, half of them the old hero, course and chapter pages going. The masterclass binding PRs
were 700–2,300.

## Endpoint map (all `web-api/v1/masterclass/` unless noted; the same routes masterclass uses)

| What                              | Route                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Course (both sides of login)      | `GET course-detail/<uuid>/?login_type=&chapters.page_size=100`                                                                       |
| Old numeric link → UUID           | `GET about-course/?slug=`                                                                                                            |
| Bookmark                          | `POST bookmark/<uuid>/`                                                                                                              |
| Chapter start, CPE / preview mode | `POST chapter-start/<chapter uuid>/`, `POST course-mode/<uuid>/`                                                                     |
| Progress                          | `GET course-progress/<uuid>/`, `POST course-progress-update/<uuid>/`                                                                 |
| Chapter quiz                      | `GET quiz-questions/<chapter uuid>/`, `POST quiz-submit/<chapter uuid>/`                                                             |
| Final assessment                  | `POST assessment-start/`, `GET assessment-questions/`, `POST assessment-submit/`, `GET assessment-report/`, `GET assessment-result/` |
| Evaluation                        | `GET feedback-questions/`, `POST feedback-submit/`, `GET feedback-responses/?course_id=`                                             |

## Acceptance criteria

- No podcast course or chapter request goes outside the new collection; every course read is keyed by UUID.
- **Course page, signed out:** hero, chapters, resources (if any), about, FAQ; the server HTML carries the title and
  SEO tags (`kind: 'podcast'`).
- **Course page, signed in:** Watch Now / Resume, bookmark (persists), share, trailer and sample (toast when none),
  progress bar, assessment / report / feedback / certificate buttons by state.
- **States:** not found → "We couldn't find this podcast." with a link to the podcasts; load error → retry.
- **Old link:** `/podcast/<number>/<slug>` resolves to the UUID URL.
- **Chapter page:**
  - The video player plays the chapter and saves progress every interval and on exit; it resumes where the
    learner left off.
  - The CPE / preview mode dialog shows on the first start.
  - CPE mode locks the next chapter until this one and its quiz are done.
  - The quiz runs; after the last one the final assessment starts.
  - A locked or unknown chapter goes back to the course page.
- The exam (with its leave guard), report, feedback and certificate work for a podcast as they do for a masterclass.
- **Masterclass course page unchanged** (the moved sections), and related cards link by type.
- 375 / 768 / 1440: the hero and chapter list keep the podcast look; no sideways scroll.
- **Gates:** `pnpm lint` 0 errors; structure check green (prune if it improves); `pnpm build:prod` within budget.

## How to verify

Dev server 4101 (check the port first), English.

- **Live UAT signed out:** both podcasts' course pages, server HTML, an old numeric link.
- **Signed in, stubbed:** `course-detail/` post-login bodies built from the live pre-login ones with a stream URL,
  progress and quiz states. Then `chapter-start/`, `course-mode/`, `course-progress-update/`, `quiz-*`,
  `assessment-*`, `feedback-*` from the Postman examples: walk chapter → quiz → next chapter → assessment → report →
  feedback → certificate.
- **Masterclass regression:** course page sections and a related card's link.

## Risks

1. **Signed-in podcast course data is unverified live** (no test account token): the post-login shape is assumed to
   be the masterclass one, as the pre-login shape is.
2. **Audio podcasts play as video** until the backend sends a format (decision 1). If a podcast's stream is
   audio-only HLS, video.js plays it with a poster; the record-disk audio player returns with the flag.
3. **Related rows on UAT are empty for podcasts,** so the type-based link is checked with stubs only.
4. **Moving three masterclass sections** could regress that page; covered by the regression pass.

## As built (2026-11-10)

Differences from the plan, and what the live data turned up:

- **The live podcast `course-detail/` failed the contract check.** Both UAT podcasts send `exam_rules: null`, and
  one sends `masterclass_duration: null`; the model required strings, so the page showed "couldn't load". Both are
  now `string | null`:
  - The rules dialog shows only its introduction when there are no rules.
  - The About grid shows "—" for a missing duration.
  - Asked of the backend: are podcast `exam_rules` meant to be empty?
- **The shared exam, report and evaluation pages connected `CourseDetailFacade` to `'masterclass'`,** so a podcast's
  sitting would have linked back to `/masterclass/…`. They now read the offering from the course route's data
  (`routeOffering`, `data: { offering: 'podcast' }` on the podcast course route; the default stays masterclass).
- **The CPE / Preview picker said "Choose Your Masterclass Mode" for every offering.** `COURSE_DETAIL_API` entries
  now carry a `modeLabel` ("Masterclass" / "Podcast"), and `CourseChapterFacade` passes it.
- **Moved up with the About section** (each had it as its only user): `duration-parts.ts` → `offerings/utils/`,
  `masterclass-course.model.ts` → `offerings/models/`.
- **Optional artwork the API sends:** `square_thumbnail_url` on the course and the chapter (UAT sends it; Postman
  doesn't show it).
- **No player switch yet.** Option 2 has one branch, so `PodcastChapter` uses `CourseChapterPlayer` with a comment
  marking where the audio player goes; a computed with a single answer would be dead code.
- **The hero matches the masterclass hero's scope.** Price, Add To Cart / plan link and course progress are held
  back until the web API covers them; each chapter's progress shows in the chapter list.
- **An old numeric link** resolves through `about-course/?slug=` and opens the course with the URL unchanged, as on
  masterclass.
