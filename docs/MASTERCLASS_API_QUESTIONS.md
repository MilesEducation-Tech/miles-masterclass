# Masterclass course page (web API v1): open questions for the backend

**From:** Masterclass web (Angular SSR), ticket MIL-25.
**Against:** the Postman export in `postman/` (refreshed 2026-10-07), folder
`04. Masterclass - Learning Flow (web)`, and live UAT (`uat-api.milescaira.com`) on 2026-10-07.
**Page:** `/:country/:profession/masterclass/:courseId/:courseTitle`, the course details page.

The web app calls only `api/v1/` and `web-api/v1/`, never `app-api/`. The page reads
`course-detail/<uuid>/?login_type=pre_login|post_login` (public since 2026-10-07). Every gap below is
something the production page shows that the page cannot show yet, so it hides it.

## Answered on 2026-10-07

- **What `course-detail/` returns:** captured live, `pre_login`, for all 64 UAT courses.
- **Chapters for signed-out visitors:** `course-detail/` now serves them with `?login_type=pre_login`.

## Open

### Q1. The hero's background video

Production loops a short muted preview clip in the hero, for example `…/media/static/gif/…Topic Content.mp4`,
66 s. The web API has no such clip:

- `about-course.web_background_video_url` is `null` on all 64 courses.
- `course-detail/` only has the full trailer (`trailer_video_url`, HLS).

The page loops the trailer, muted, for now. Can the preview clip be exposed, for example by filling
`web_background_video_url` and adding it to `course-detail/`?

### Q2. Credly badge for signed-out visitors

`course-detail.show_credly_icon` is `false` on all 64 courses pre-login. But `about-course.has_individual_badge`
is `true` on 6 of them, so those 6 lose the Credly icon on the course page when signed out. Which field is
right?

### Q3. Durations

- `masterclass_duration` ("3 hours") and `masterclass_duration_seconds` (6970) disagree on every course. The
  seconds equal the sum of the chapter videos.
- The page shows the string as Course Duration and the seconds as Video Duration, as production does.
- `nasba_section.video_duration` repeats the course-duration string rather than the video length. Please
  confirm it's meant to.

### Q4. Slugs

`course-detail/` carries no course `slug`, and its chapters carry none either. The page takes the course slug
from its URL and builds chapter slugs from the chapter name. Can both be added?

### Q5. Duplicated NASBA fields

`program_level` is `"Basic"` at the top level but `null` inside `nasba_section`. Which one is the source?

### Q6. Images on the GCS bucket answer 403

`storage.googleapis.com/miles-usp-bed/…` returns **403** for:

- 227 of 387 chapter thumbnails
- 19 of 42 related-course thumbnails
- 24 of 68 course thumbnails on the landing page

Those images show as broken; the S3-hosted ones load. Can the bucket be made public, or the images
moved to S3?

### Q7. CloudFront caches the CORS header

An HLS trailer segment (`…_720p_00002.ts` on `d2eoseju8m2c1y.cloudfront.net`) was served with
`Access-Control-Allow-Origin: http://localhost:3000` to a page on another origin. The browser blocked it,
which can stall the hero trailer and the trailer dialog. Please forward `Origin` in the cache key, or send
`Access-Control-Allow-Origin: *`, for the video distribution.

### Q8. The learner's last-viewed course (asked 2026-10-10)

The footer showed a "continue learning" card with the course the learner last watched, read from the legacy
`v2/user/last_viewed/`. That route now answers 404, and neither `api/v1/` nor `web-api/v1/` has a twin.
The only resume data is the per-course `continue_watching` block on `course-section/` cards. The card has
been removed. Can a route return the single most recently watched course (any offering), with its
`continue_watching` block?

## Still missing from the web API

| Production page shows               | Web API today                                                           | Ask                                                |
| ----------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------- |
| CPE / Preview mode badge and switch | `course_mode` / `is_preview_mode` read-only; `mode` query is post-login | Confirm the switch is `?mode=` on `course-detail/` |
| Price, "Purchased", Add To Cart     | none                                                                    | Price and purchase state for a course              |
| Learning pathway                    | none                                                                    | Add, or confirm it is gone                         |
| Course-navigation video             | `miscellaneous_data.course_navigation_video_url` is `null` on all 64    | Fill it                                            |
| Sample video (hero "Sample")        | `sample_video_url` is `null` on all 64, so the button is hidden         | Fill it                                            |
| Bookmark response                   | `POST bookmark/<id>/` body and response uncaptured; the page re-reads   | Capture a 200                                      |

## Contract drift (live vs Postman)

- **Envelope:** live is `{ success: true, message, data }`; Postman says `status: "success"`.
- **Examples:** `course-detail/`'s Postman examples are still placeholders (`<**detail>`).
- **Bookmark:** `POST bookmark/<id>/`'s body template "could not be resolved from the code". Is the body
  empty?
