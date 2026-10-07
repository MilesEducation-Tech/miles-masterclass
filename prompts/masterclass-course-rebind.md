# Masterclass course page rebind (MIL-25)

Route: `/:country/:profession/masterclass/:courseId/:courseTitle` → `pages/masterclass-course/`.
Branch: `feat/MIL-25-masterclass-details-page-binding`.

**Status:** PR1–PR3 committed as `eadf218`. The data source is superseded by Revision 2 at the end (`course-detail`).

---

## Assumptions (read these first)

1. **`:courseId` is the course UUID and `:courseTitle` is its slug.** MIL-23's course cards link
   `[course.id, course.slug]`. Today the page does `Number(courseId)` and calls the legacy
   `v2/masterclass/details/?id=NaN`, so **the page is already broken for every card on `/masterclass`**.
2. **"Remove everything but the design"** means:
   - keep the markup and Tailwind classes of the hero, section nav, sections and FAQ;
   - delete and rewrite the page's and hero's TypeScript, its types and its API calls.
3. **The old `MasterclassFacade` stays.** It is provided at the offerings level and is still used by:
   - the podcast course page and podcast hero
   - the chapter player (`video-chapter`)
   - the shared `course-chapter-list` and `course-resources`

   Deleting it would break pages outside this ticket. This page simply stops using it.

4. **A facade, this time.** You asked for one for this page. The "no facade" memory applies only to the
   `/masterclass` landing page.
5. **The project skills named in AGENTS.md §10 don't exist on disk.** `.claude/skills/` holds only the
   refactor/release skills, so this plan follows AGENTS.md, CLAUDE.md and the MIL-23 precedent.

## Goal

The course page reads only `web-api/v1/masterclass/*`, fully typed, with:

- **Reads:** `httpResource` fields in a route-scoped `MasterclassCourseFacade`.
- **Writes:** `ApiClient.call()` on typed `RouteConfig`s.
- **Components:** inputs reshaped to the new response; no mapping back into the legacy `ContentDetails`.

Anything with no `web-api` endpoint yet is held back (see D2), not faked.

## What I read

- **The page:**
  - `pages/masterclass-course/masterclass-course.{ts,html}`
  - `components/masterclass-course-hero/masterclass-course-hero.{ts,html}` (295-line template)
  - `masterclass.routes.ts`
- **Old data layer:**
  - `features/offerings/services/masterclass-facade.ts` (519 lines)
  - `features/offerings/utils/course-load.ts`
  - `core/models/masterclass.model.ts` (`MASTERCLASS_ROUTES`: legacy `v2/...` paths, numeric ids)
  - `features.routes.ts`, which provides `MasterclassFacade` for all of offerings
- **Children, all shared with other pages:**
  - `offerings/components/course-chapter-list`: masterclass + podcast
  - `offerings/components/course-resources`: masterclass + podcast
  - `shared/components/course-about`: 5 consumers (podcast, micro-learning, webinar, course-info dialog)
  - `shared/components/course-related-section`: masterclass + podcast
- **SEO:** `shared/utils/seo/course-seo-setup.ts` and `course-seo-config.ts`. `CourseSeoSource` is the legacy
  `ContentDetails | Content`.
- **ApiClient:** `call()` + `RouteConfig` (`core/models/http.model.ts`), used by `auth-session` and `onboarding-api`.
- **Postman export** (`postman/`, refreshed 2026-10-06): folder "04. Masterclass - Learning Flow (web)".
- **Live UAT, anonymous, 2026-10-06:**
  - `about-course/` for all 64 courses on the landing page (64/64 → 200)
  - the auth-only reads (all → 403 without a token)

## Contract

### `GET web-api/v1/masterclass/about-course/?course_id=<uuid>`: AllowAny, LIVE-VERIFIED

`?slug=` works too and gives the identical body. The envelope is `{ success: true, message, data }`; Postman
says `status: "success"`, which is wrong, the same drift we saw on `home-page/`. Types across all 64
courses:

```
data: {
  id: uuid, slug, title, short_description, description: string
  thumbnails: { horizontal: string, vertical: string, square: string | null }
  trailer_url: string
  web_background_video_url: null        ← null on all 64 (Postman shows "")
  sample_video_url: null                ← null on all 64
  total_duration: string                ← preformatted, e.g. "1 hour 34 minutes"
  delivery_method: string, program_level: null
  subject: { id, name }
  fields_of_study: { id: uuid, name, cpe_credit: number }[]
  total_cpe_credits: number, has_individual_badge: boolean, included_for_caira: boolean
  has_additional_resources: { has_exercise_files, has_ai_kit, has_ai_labs, has_tools: boolean }
  miscellaneous_data: { has_course_navigation_video, has_glossary, has_exercise_files, has_ai_kit, has_tools: boolean }
  is_bookmarked: boolean, bookmark_id: null
  first_chapter: { id: uuid, slug, name }
  exam_rules, prerequisite_education, advance_preparation: string
  certificate_expiry_years: null, certifying_organisation: null
  learning_objectives: { id, title, description: string | null, order: number }[]
  instructors: { id, name, designation, bio, horizontal_image_url: string,
                 square_image_url: string | null, video_url: string | null }[]
  skills / topics: { id, name, image_url: null }[]
  tags: { id, name }[]
  chapter_count: number
}
```

Errors are `404 { code: not_found }` and `400 invalid_query`. Live errors use `{ success: false, message, data: null }`.

### Auth-only reads: Postman templates only, NOT captured

Each returns `403 { success: false, message: "Authentication credentials were not provided." }` without a
token.

| Route                                | What it is for                   | Postman shape                                                                                                                                                                               |
| ------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET course-detail/<uuid>/`          | chapters + per-user course state | `{ status: true, course_details: { <**detail> merged in, chapters: { …paginated…, results } } }`. **Placeholder only, so the fields are unknown.**                                          |
| `GET enrollment/<uuid>/`             | 365-day window                   | `{ course_id, is_enrolled, is_course_closed, started_at, expires_at, days_remaining, is_expired }`                                                                                          |
| `GET course-progress/<uuid>/`        | badge + certificate              | `{ badge_url, badge_image_url, badge_allocated, badge_status, badge_claimed, certificate_url }`                                                                                             |
| `GET feedback-responses/?course_id=` | rating / feedback submitted      | `{ course_id, submitted, submitted_at, question_count, answered_count, responses }`                                                                                                         |
| `GET assessment-result/<uuid>/`      | final-assessment outcome         | `{ attempt_id, passed, score_percent, … }`. **404 "No assessment attempt found" before any attempt**, so it is not a cheap status read. The 365-day reset is `{ reset_required, message }`. |
| `POST bookmark/<uuid>/`              | toggle bookmark                  | `{ status, message, bookmarked }`. The body template "could not be resolved".                                                                                                               |

## Current page vs the new API

| On screen today                                                                     | Today's source                                | New source                                                                    | Plan                            |
| ----------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------- |
| Hero: title, overview, fields of study, CPE, badges                                 | `v2/masterclass/details/`                     | `about-course/`                                                               | PR2                             |
| Hero: "By …" instructors                                                            | `instructor_details` + `other_instructors`    | `about-course.instructors[].name`                                             | PR2                             |
| Hero: background video / poster                                                     | `thumbnail_gif` / `horizontal_thumbnail`      | `web_background_video_url` (null everywhere) / `thumbnails.horizontal`        | PR2: poster only while null     |
| Hero: Trailer / Sample                                                              | `trailer_link` / `sample_link`                | `trailer_url` / `sample_video_url` (null)                                     | PR2: Sample shown only when set |
| Hero: Share                                                                         | client-side `Utils.openShareDialog`           | no API needed                                                                 | PR2                             |
| Hero: Bookmark                                                                      | legacy toggle, numeric id                     | `POST bookmark/<uuid>/` + `is_bookmarked`                                     | PR5                             |
| Hero: Watch Now                                                                     | CPE-mode picker → first or resume chapter     | `first_chapter`; resume needs `course-detail`                                 | PR2 first chapter, PR4 resume   |
| Hero: progress bar, rating, Submit Feedback, Take/Retake Final Assessment, Download | `course-detail` + `user_*_details`            | `course-detail`, `feedback-responses`, `assessment-result`, `course-progress` | PR4, blocked on D3              |
| Hero: CPE / Preview mode badge and switch                                           | `user/customaction/set_cpe_mode/`             | **none**; the new backend uses a 365-day enrollment window                    | D2: hold back                   |
| Hero: price, Purchased, Add To Cart                                                 | legacy price/cart fields                      | **none** on `about-course`; cart is `api/v1/commerce/cart/lines/`             | D2: hold back                   |
| Created / Updated dates                                                             | legacy dates                                  | **none**                                                                      | D2: hold back                   |
| Masterclass section (chapter list)                                                  | `v2/chapters/`                                | `course-detail.chapters` (auth)                                               | PR4, blocked on D3              |
| Resource section (navigation video, glossary, exercise files, AI Kit)               | legacy content/download routes                | only `has_*` flags; **no content or download endpoint**                       | D2: hold back                   |
| About section                                                                       | shared `course-about` on `ContentDetails`     | `about-course/`                                                               | PR3                             |
| Related section (related + "More by" carousels)                                     | legacy related/instructor routes, numeric ids | **none** (`instructor-detail` is auth-only and uncaptured)                    | D2: hold back                   |
| FAQ                                                                                 | static                                        | unchanged                                                                     | n/a                             |

## Decisions to confirm

**D1. The shared child components: new masterclass-owned ones (recommended) or restructure the shared ones?**

`course-about`, `course-chapter-list`, `course-resources` and `course-related-section` also serve podcast,
micro-learning, webinar and the course-info dialog.

- **Recommended:** new components under `masterclass/components/` whose inputs are the new types, copied
  class-for-class from the shared ones (the MIL-23 `masterclass-course-card` precedent). Each copy keeps only
  the masterclass branch; `course-about` alone is 442 lines across four content types. The shared ones stay
  untouched.
- **Alternative:** restructure the shared interfaces to the new response and port every other consumer.
  That is several pages outside MIL-25, and their APIs haven't moved yet.

**D2. Hold back what has no `web-api` endpoint (recommended), rather than keep legacy calls.**

The legacy routes take numeric ids, which a UUID route can't supply, so keeping them means broken buttons.
Held back until the backend ships them:

- CPE/Preview mode
- price and Add To Cart
- created/updated dates
- the Resource section
- the Related section

I'd log them in `docs/MASTERCLASS_API_QUESTIONS.md`, the same way as `docs/WEBINAR_API_QUESTIONS.md`. The
section nav hides held-back sections.

**D3. A signed-in `course-detail` response (blocker for PR4).**

Postman has only a placeholder, and I can't sign in. Please capture one from UAT while signed in:

1. Open DevTools → Network.
2. Request `course-detail/<uuid>/`.
3. Copy the Response.

Ideally capture two: one for a course you've started and one you haven't. If you can, also capture
`assessment-result/` for a course with an attempt. PR1–PR3 don't need it.

**D4. Facade shape (recommended as below).**

`MasterclassCourseFacade` is `@Service({ autoProvided: false })` in `masterclass/services/`, listed in
`providers` on the `:courseId/:courseTitle` → `''` route. It owns every read and action for the page. Child
components get data through inputs and emit events; they never inject the facade.

**D5. SEO: add a structural branch for the new shape to `courseToSeoConfig` (recommended).**

`setupCourseSeo` takes the legacy `ContentDetails | Content`. I'd add a typed `about-course` branch: title,
`short_description`, `thumbnails.horizontal` and the first instructor's name. That is about 15 lines in
`shared/utils/seo/`, and podcast and micro-learning are untouched.

**D6. The hero background is a still image for now.**

`web_background_video_url` and `sample_video_url` are null for all 64 courses. The hero shows
`thumbnails.horizontal` as the poster, and Sample appears only when a URL exists. It will animate as soon
as the backend fills the field.

## Locked decisions (from the rules)

- **Reads:** `httpResource` + `apiUrl()` with `parse` guards in the facade. A drifted body lands in `error()`
  and is logged, never shown.
- **Writes:** `ApiClient.call(ROUTE, body)` on typed `RouteConfig`s, then update the resource.
- **`about-course` runs on the server too** (AllowAny), for crawlers, SEO and the transfer cache. Auth reads
  are gated on the boolean `isAuthenticated()` and skipped on the server, as `home-page/` does.
- **Placement:** types in `models/masterclass-course.model.ts`, endpoints and routes in
  `constants/masterclass.ts`, `@alias` imports throughout.
- **Template rules:** no `any`, `NgOptimizedImage`, pipes for formatting.
- **Defer:** the hero is above the fold and never deferred. Below-the-fold sections use
  `@defer (on viewport)` with sized placeholders.
- **No tests** (the repo removed them). Verification is in the running app plus the gates.

## Target architecture

```
features/offerings/masterclass/
  constants/masterclass.ts        + MASTERCLASS_ENDPOINTS.aboutCourse / courseDetail / … (absolute, web-api)
                                  + MASTERCLASS_COURSE_ROUTES.toggleBookmark (RouteConfig)
  models/masterclass-course.model.ts   (new)
      MasterclassAboutCourse, MasterclassInstructor, MasterclassChapterRef, LearningObjective, …
      parseAboutCourse(raw): MasterclassAboutCourse      ← trust boundary
      (PR4) MasterclassCourseDetail + parseCourseDetail, from the D3 capture
  services/masterclass-course-facade.ts  (new, route-scoped)
      courseId = signal<string | null>        set by the page from the route input
      about    = httpResource(about-course)   SSR + browser
      detail   = httpResource(course-detail)  browser + signed in only (PR4)
      course   = computed (hasValue-guarded), isLoading, loadError, reload()
      openTrailer(), openSample(), share(), watch(), toggleBookmark() (PR5)
  components/masterclass-course-hero/        inputs: course, (PR4) state; outputs: trailer, sample, share, watch, bookmark
  components/masterclass-course-about/       new (PR3), input: course
  components/masterclass-chapter-list/       new (PR4), inputs: chapters, state; output: open
  pages/masterclass-course/                  injects the facade, binds the inputs, keeps the section nav and FAQ
```

**Data flow:** the route input `courseId` feeds `facade.courseId`. That fires `about` on the server, then
the browser reuses it from the transfer cache. The page renders hero → (Masterclass) → About → FAQ.

## Endpoint map

| Use              | Method | Path (`BASE_API_URL` +)                        | Auth          | PR  |
| ---------------- | ------ | ---------------------------------------------- | ------------- | --- |
| Course content   | GET    | `web-api/v1/masterclass/about-course/`         | AllowAny      | 1   |
| Chapters + state | GET    | `web-api/v1/masterclass/course-detail/<id>/`   | Authenticated | 4   |
| Enrollment       | GET    | `web-api/v1/masterclass/enrollment/<id>/`      | Authenticated | 4   |
| Badge + cert     | GET    | `web-api/v1/masterclass/course-progress/<id>/` | Authenticated | 4   |
| Feedback state   | GET    | `web-api/v1/masterclass/feedback-responses/`   | Authenticated | 4   |
| Bookmark         | POST   | `web-api/v1/masterclass/bookmark/<id>/`        | Authenticated | 5   |

No `app-api/`, no `api/v1/` legacy.

## Phases (stacked PRs, each green on its own, each under ~400 lines)

- **PR1: data layer.**
  - Add the endpoints, model, `parseAboutCourse` and the facade with the `about` resource.
  - Add the route `providers`.
  - No UI change yet.
- **PR2: page + hero.**
  - Rewrite the page TS and the hero TS onto the facade.
  - Re-bind the hero template: same markup, new fields; held-back blocks removed.
  - Trailer, Sample (when set), Share, and Watch Now → `first_chapter`.
  - Wire SEO per D5. Hide the held-back sections from the nav.
- **PR3: About section.** A new `masterclass-course-about`, copied class-for-class from the masterclass
  branch of `course-about`.
- **PR4: signed-in state (blocked on D3).**
  - `course-detail`, `enrollment`, `course-progress` and `feedback-responses` resources.
  - The chapter list component.
  - Hero progress, rating, Submit Feedback, Final Assessment, Download and resume-aware Watch Now.
  - May split in two.
- **PR5: bookmark.** `POST bookmark/<id>/` via `ApiClient.call`, with an optimistic toggle and revert on
  failure. It also settles whether `is_bookmarked` must come from a signed-in read, given the transfer-cache
  risk below.

## Files touched

- **New:**
  - `masterclass/models/masterclass-course.model.ts`
  - `masterclass/services/masterclass-course-facade.ts`
  - `masterclass/components/masterclass-course-about/*` (PR3)
  - `masterclass/components/masterclass-chapter-list/*` (PR4)
  - `docs/MASTERCLASS_API_QUESTIONS.md`
- **Changed:**
  - `masterclass/constants/masterclass.ts`
  - `masterclass/masterclass.routes.ts`
  - `pages/masterclass-course/*`
  - `components/masterclass-course-hero/*`
  - `shared/utils/seo/course-seo-config.ts` (D5)
- **Untouched:**
  - `MasterclassFacade`, `course-load.ts`, `MASTERCLASS_ROUTES`
  - the four shared children
  - podcast, the chapter player and the final-assessment and feedback pages

## Security

- Tokens only via the interceptors. Auth reads are never issued on the server or when signed out.
- Route params are not trusted:
  - `courseId` must match a UUID before any request; otherwise the page shows "not found" without a call.
  - `courseTitle` is cosmetic, used for SEO and the canonical URL.
- `description`, `bio` and `exam_rules` are rendered as text, never `innerHTML`.

## Acceptance criteria

- Signed out, `/us/accounting/masterclass/<uuid>/<slug>`:
  - SSR HTML carries the title, overview and meta tags.
  - The browser makes no second `about-course` call.
  - No request goes to `v2/`, `app-api/` or legacy routes.
- **Hero:** title, fields of study, CPE total, CAIRA/Credly badge, instructors, overview, Trailer, Share,
  Watch Now → `chapter/<first_chapter.id>/<first_chapter.slug>`.
- A bad UUID or a 404 shows the not-found state. A contract drift shows the error + retry and logs
  `[MasterclassCourse]`.
- Held-back sections don't render and aren't in the section nav.
- Gates green: lint, format, `build:prod`, and `verify.mjs` (7 gates). Parity at 375 / 768 / 1440. No new
  horizontal scroll.

## Checks to run

```bash
pnpm lint
pnpm format
pnpm build:prod
node scripts/refactor/verify.mjs
```

I'll run `verify.mjs` via the verifier agent. Then `pnpm start` (4101): load a course page signed out, then
signed in, and capture the network log and screenshots.

## Risks

- **Watch Now lands on the chapter player, which still reads legacy numeric routes.** UUID chapters will
  fail there until the chapter page is rebound; that needs its own ticket.
- **`is_bookmarked` vs the transfer cache.** The server fetches `about-course` anonymously and the browser
  reuses it. A signed-in learner could see `is_bookmarked: false` until a signed-in read corrects it.
  Settled in PR5.
- **24 of 68 thumbnails** sit on the GCS bucket that returns 403 (known from MIL-23). The hero poster will
  be broken for those courses.
- **Removing the CPE/Preview switch changes the learning flow.** I'm assuming the 365-day enrollment model
  replaces it; please confirm with the backend.

## Follow-ups (not in MIL-25 unless you say so)

- Rebind the chapter player, final assessment and feedback pages to `web-api`.
- Delete `MasterclassFacade`, `course-load.ts` and the legacy routes once podcast moves too.
- MIL-23 PR3, the "i" button → `about-course` in the course-info dialog: the PR1 model and parser here can
  serve it.

---

# Revision 2 (2026-10-07): bind `course-detail` instead of `about-course`

**Status:** approved 2026-10-07. **Phases A–D done and browser-verified, uncommitted.** Phase E: Bookmark and the certificate Download are wired (verified signed out only); progress, CPE/Preview mode, feedback/rating and the final assessment are not started.

## Why

- **The hero:** production shows a poster, then a muted looping video. Our hero shows only a still image.
  `about-course` has no poster for the trailer, and `web_background_video_url` is `null` everywhere.
- **The backend change:** `course-detail` became `AllowAny` on 2026-10-07, with a required `?login_type=`.
  Signed out, it carries what the hero needs and most of what we held back.

## Contract (live UAT, pre_login, all 64 courses → 200)

`GET web-api/v1/masterclass/course-detail/<uuid>/?login_type=pre_login|post_login&chapters.page_size=100`

- **Envelope:** `{ success, message, data: { status, login_type, course_details } }`.
- **Errors:**
  - `post_login` without a token → **401**
  - a slug in the path → **404** (UUID only)
  - an undeclared parameter → 400
- **Hero:** `trailer_video_url` is a string on 64/64 and is **HLS `.m3u8`**. `trailer_thumbnail_url` is a
  string on 64/64. `level[].level_number` gives the CAIRA level, so the CAIRA badge can show.
- **About / NASBA:**
  - top level: `program_level`, `masterclass_duration` ("2 hour 20 minutes") and
    `masterclass_duration_seconds`, `expiration_date`, `sponser_identification_number` (sic),
    `instructional_delivery_method`
  - `nasba_section`: `created_on`, `reviewed_on`, `updated_on` (ISO dates) and `video_duration`
- **Chapters:** `chapters.results[]` with `id`, `name`, `mini_description`, `order`, `duration_seconds`,
  `total_quiz_questions`, `is_locked`, thumbnails and `user_chapter_progress`, which is all `null` signed out.
  **There is no chapter slug.**
- **Rails:**
  - `related_courses[]` (22/64 non-empty)
  - `instructor_related_courses[].courses[]` (37/64 non-empty)
  - each course has `id`, `name`, `mini_description`, `thumbnail_url`, `total_cpe_credits` and
    `field_of_study[]`; **no slug**
- **Resources** (`miscellaneous_data`):
  - `glossary`: an HTML string on 64/64
  - `exercise_files[]`: 2/64
  - `ai_kit`: 5/64
  - `tools[]`
  - `course_navigation_video_url`: `null`
- **Per-user (post_login):** `enrollment`, `course_mode`, `is_preview_mode`, `course_is_locked`, `show_*`,
  `feedback_*`, the certificate and Credly fields, and `is_bookmarked`.
- **There is no course `slug`** in the response.

## Decisions to confirm

**R1. One read for the page and the "i" dialog (recommended).** The facade's `about-course` resource
becomes `course-detail`.

- `pre_login` is fetched on the server (SSR, transfer cache).
- `post_login` is fetched in the browser once signed in, with `withPreviousValue` across sign-in so the page
  doesn't flash, the same as `tracks-page`.
- `masterclass-course-about` retypes to the new model.
- The dialog pays 41–81 KB per open (median 56 KB, uncompressed) instead of 9 KB, in exchange for one model.

**R2. Legacy numeric links resolve through `about-course?slug=` (recommended).** `course-detail` takes a
UUID only. A non-UUID route id first asks `about-course` for the id, then `course-detail`. That's two calls,
on old links only.

**R3. Slugs.**

- The course URL uses the route's `:courseTitle` on the page and `card.slug` in the dialog.
- The chapter URL uses `Utils.slugify(chapter.name)`, as the legacy flow did.
- Related cards link `[id, slugify(name)]`.

**R4. Hero video: poster, then the HLS trailer muted and looping (recommended).**

- **Poster:** a plain `<img ngSrc priority>` of `trailer_thumbnail_url`, server-rendered. It stays the LCP.
- **Player:** after the same 3 s `posterDelay`, browser only and only while the hero is on screen, the hero
  mounts the shared `app-video-js`:
  - video.js and its HLS support load lazily, inside the component
  - `trailer_video_url`, `muted`, `loop`, `controls: false`
  - it fades in over the poster once it plays; a failure leaves the poster
- **Buttons:** the hero's own play/pause and mute buttons call the player's `togglePlay()` and
  `toggleMute()`. The player pauses while a dialog is open, as `VideoPoster` does.
- **Not chosen:**
  - extending the shared `VideoPoster` with HLS (video.js re-wraps its DOM)
  - adding `hls.js` (a second video library)

**R5. Phases** (each its own commit, each green):

- **A: this request.**
  - the model and guard for `course-detail`
  - the facade swap (R1–R3)
  - the hero on `trailer_thumbnail_url` / `trailer_video_url` (R4) plus the CAIRA level
  - About gains program level, video duration, the created/reviewed/updated dates, the sponsor id and
    expiration from the API
  - SEO reads `name` / `mini_description` / `horizontal_thumbnail_url`
- **B:** the chapter list section (masterclass-owned, the shared `course-chapter-list` design).
- **C:** the Related and "More by <instructor>" rails.
- **D:** Resources: glossary (sanitised HTML in the existing `HtmlContentDialog`), exercise files, AI Kit.
- **E (post_login):** progress, CPE/Preview mode, feedback/rating, final assessment, certificate, bookmark.

## Risks

- **MIL-28 conflicts.** MIL-28 (the "i" dialog, `c7fd37b`) edits the same facade and the About input. Phase A
  on the MIL-25 branch will conflict when MIL-28 updates from it. I'll resolve that merge for you, or Phase
  A can go on MIL-28's branch instead.
- **HLS autoplay.** Muted autoplay is allowed in all major browsers. Low-power mode on iOS can block it, and
  the poster stays.
- **The trailer has speech.** Production loops a short preview clip; we loop the full trailer muted until
  the backend fills a preview field.
- **Payload.** 41–81 KB per course (median 56 KB, uncompressed; measured on all 64), mostly chapter transcripts. Fine for SSR, heavier for the dialog.
