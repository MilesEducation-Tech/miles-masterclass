# AI Labs: the lab course video, trailer, instructors and AI kit (new `course/<id>/` contract)

## Goal

Bind the backend's revised `GET web-api/v1/ai-labs/course/<ai_lab_course_id>/` (pasted 2026-10-22) and its
FE flow:

1. Open the detail and show the **trailer**.
2. **Start** → `POST api/v1/ai-labs/course-start/<id>/`.
3. **Re-read the detail** and play `chapter.hls_video_link`.
4. While it plays, `POST api/v1/ai-labs/course-video-progress/`. `chapter.duration_seconds` is what the
   "watched enough" (95%) check measures against.

Rules from the notes: an unfilled admin field is `null`, never `""` (`video_url`, `profile_image`, `transcript_url`,
`ai_kit`, …); `instructors` can be `[]`; video, trailer and instructor fields exist **only** on the detail read.

## What was read

- The pasted contract and FE notes.
- `features/ai-labs/models/ai-labs.model.ts`: `AiLabCourseDetail` types `instructors: string[]` and has no `chapter`
  or `ai_kit`; its doc comment still says "carries no playable video (Q1)".
- `services/ai-lab-course-facade.ts`: `detailRes` is a plain `unwrap` (no shape guard, so nothing throws on the new
  shape); `start()` reloads only `course-started/`; `reportVideoProgress()` is wired (every 15 s + on `ended`,
  only once started) and learns `duration_seconds` from the progress answer; `progressPercent` falls back to
  `ai_lab_course_total_duration_seconds`.
- `pages/ai-lab-course/ai-lab-course.ts|html`: `videoSources` is a stub returning `[]` (the "Q1" ponytail); the
  player, `PlayerMode.CPE` until completed, `onTimeUpdate` / `onEnded` reporting, Play / Resume / Rewatch are all
  wired. The hero renders `reel.instructors.join(', ')` — **with the new objects that prints
  `[object Object]`**. `labMaterials` lists only the SharePoint link.
- `shared/components/video-js`: an effect swaps sources on input change (`player.src()` + `load()`), so trailer →
  chapter needs no remount. `detectVideoMimeType()` (`shared/services/utils.ts`) maps `.m3u8` → HLS.
- `testing/mocks/ai-labs.mock.ts`: `MOCK_AI_LAB_DETAIL` uses the old shape (stories would stop type-checking).
- `docs/AI_LABS_API.md` §course detail: the old sample (`instructors: ["Uttam Pai"]`, no `chapter` / `ai_kit`).

## Changes

### Model (`ai-labs.model.ts`)

- `AiLabInstructor` — `id`, `name`, `designation`, `bio`, `profile_image`, `horizontal_image_url`,
  `vertical_image_url`, `square_image_url`, `video_url`, `social_links: {title, url, icon_url}[]`, `linkedin_url`;
  every optional field `string | null`.
- `AiLabChapter` — `id`, `name`, `mini_description`, `description`, `hls_video_link`, `duration_seconds`,
  `transcript_url`, `transcript_text`, `order` (nullable as sent).
- `AiLabKit` — `id`, `name`, `description`, `icon_url`, `url`, `pdf_url`.
- `AiLabCourseDetail`: `instructors: AiLabInstructor[]`, `chapter: AiLabChapter | null`, `ai_kit: AiLabKit | null`.
  Doc comment updated (the video is `chapter.hls_video_link`; Q1 closed).

### Facade (`ai-lab-course-facade.ts`)

- `start()` success → reload **detail** as well as `course-started/` (FE note step 3: the chapter link arrives on the
  re-read). Error path unchanged.
- `progressPercent` denominator: progress answer's `duration_seconds` → **`chapter.duration_seconds`** →
  `ai_lab_course_total_duration_seconds`.

### Page (`ai-lab-course.ts` / `.html`)

- `videoSources`:
  - **started and `chapter.hls_video_link`** → the chapter, in CPE mode (as today), reporting progress.
  - **otherwise `ai_lab_course_trailer_url`** → the trailer.
  - neither → `[]` (the artwork, as today).
- New `isTrailer` computed. While the trailer is the source: `playerMode` is `DEFAULT` (a trailer is free to seek),
  the poster is `ai_lab_course_trailer_thumbnail` (falling back to the lab artwork), and `onTimeUpdate` / `onEnded`
  **don't report progress** — trailer seconds must never count as lab watching.
- `playbackCta` ("keep watching") counts only the chapter, so the trailer never turns the hero CTA into Play; the
  trailer is played from the player's own controls, and the CTA stays **Start AI Lab**.
- Instructors line → names: `instructorNames = instructors.map(i => i.name).join(', ')`. `[]` hides it (as today).
- `labMaterials` gains the **AI kit** when present: `{ label: kit.name, hint: 'Opens in a new tab', url: kit.url ?? kit.pdf_url }`.
  Skipped when both are `null`.

### Mocks and docs

- `MOCK_AI_LAB_DETAIL`: instructor objects, a `chapter` (null link for "not started"), `ai_kit: null`. Add a
  started-with-video variant so the course stories show the player.
- `docs/AI_LABS_API.md`: replace the course-detail sample with the pasted one and the FE notes.

## Not in this change

- **No new instructor UI** (cards, bios, social links, intro video). The page's design shows names only; the fields
  are typed so a later design can use them.
- **No transcript UI** (`transcript_url` / `transcript_text` are typed, not rendered).
- **No resume-from-position.** The chapter starts at 0 on each visit, as today; the server's watched seconds
  are the learner's real progress (see Risks).

## Security

Read-only display of a learner-scoped read. Media URLs come from the API and are bound to `[src]` / video.js
(Angular sanitises URLs). No new endpoints, no secrets.

## Acceptance

- **Not started, trailer set:** the frame plays the trailer with free seeking; no `course-video-progress/` calls;
  CTA **Start AI Lab**.
- **Start:** `course-start/` → detail and `course-started/` re-read → the frame switches to the chapter video in CPE
  mode; Play / Resume drives it; reports every 15 s and on end; at 95% (`just_completed`) the CTA moves to the quiz.
- **Instructors** render as names; `[]` hides the line. **AI kit** appears in materials only when it has a link.
- Nulls everywhere (no trailer, no chapter link, no kit) → the artwork and today's states, no errors.
- Lint, structure, Prettier, `build:prod`, `build-storybook` pass.

## How to verify

- Storybook: _AI Labs/Course page_ — not-started (trailer), started (chapter player), no-video (artwork).
- Dev 4101 signed in: open a lab with a trailer → play it, confirm no progress POSTs (DevTools Network) → Start →
  the chapter loads → watch 15 s → one `course-video-progress/` POST with `watched_duration_seconds`.

## Risks

- **Real UAT payload unseen.** The sample uses `cdn.example.com`; the probe needs a signed-in learner. The model
  follows the paste; if UAT's detail still sends the old `instructors: string[]`, names would be `undefined` —
  the first dev run will show it.
- **Resume.** Watched seconds restart at 0 per visit, so a learner who leaves at 60% and returns must watch from the
  start in CPE mode (seeking is locked). Seeking to `course-progress/`'s `video_watched_seconds` on load is a small
  follow-up if wanted.

## Size

About 120 lines across the model, facade, page, mock and doc. One PR on `feat/MIL-117-ai-labs-refactor`, committed
separately from the sign-in and the fan fix.
