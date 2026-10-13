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

### Q9. The CAIRA levels for signed-out visitors (asked 2026-10-12)

The home page's CAIRA section reads `web-api/v1/masterclass/levels/` for every visitor now. Signed in it
answers 200 with the three CAIRA levels. Signed out it answers **401** ("Authentication credentials were
not provided."), so guests get no CAIRA section. The ladder is the same for everyone. Can `levels/` be
`AllowAny`? No frontend change is needed when it is.

**Status (2026-10-13): DONE.** `GET web-api/v1/masterclass/levels/` with no Authorization header
answers **200** with the three levels. MIL-61 is live on UAT; nothing is pending on the frontend.

### Q10. The CAIRA tracker's badge states (asked 2026-10-13)

`GET web-api/v1/badges/page/` replaced `v2/caira-badges/`, `v2/caira-badges/:id/`,
`v2/course-badges/` and `v2/webinar-badges/`, all four of which now answer 404. The page is
rebound to it (MIL-62). Three of its fields are enums we can only half see, because the only
account we can read it with has zero progress — every row comes back `LOCKED` or
`COMING_SOON`, every `badge_claim.state` is `NOT_ISSUED`, every `cta.action` is `NONE` or
`OPEN_COURSE`.

Please send the full vocabulary for `state`, `cta.action` and `badge_claim.state`, or a UAT
account that has earned and claimed a badge. Until then the frontend's guards accept any
string for those three and derive the UI from `badge_claim.awarded` / `claimed` and
`cta.enabled` instead, so an unseen value renders as a disabled card rather than failing the
whole response.

### Q11. How does a learner claim a badge now? (asked 2026-10-13)

The old flow was `GET user-badges/:id/claim/`, keyed on `user_badge.id`. That route answers
**404**, and the block that replaced `user_badge` — `badge_claim` — carries no id, only
`{state, awarded, claimed, status_raw, accept_url, assertion_id}`.

We have assumed the server now mints the Credly acceptance URL itself and the client only
opens `badge_claim.accept_url` once it is populated. Please confirm. If a claim request still
has to be made, what is the route and what identifies the badge?

### Q12. `badges/page/` gaps (asked 2026-10-13)

1. **`next_session` is `{}`** on every webinar badge, and `upcoming_sessions_count` is 0. The
   card used to show "Nov 12, 2026 • 7:00 PM EST" from v2's `session.start_time`. Is
   `next_session` meant to be populated, and what is its shape?
2. **No `podcast` or `nano_learning` section.** The tracker used to draw a row for each,
   from `v2/course-badges/?course_type=`. Both rows are removed. Gone for good, or coming?
3. **Masterclass badge rows carry no credits**, while webinar rows carry
   `total_cpe_credits` + `credits_label`. Intentional?
4. **No `description` or `content`** on a level badge. v2's `caira-badges/:id/` served the
   ⓘ modal's three tabs (`what_you_will_learn` / `how_will_you_learn` / `what_will_you_get`);
   with no source the modal has been removed. Is that content coming back anywhere?
5. **Paging parameters are namespaced** (`?webinar_badges.page=2&webinar_badges.page_size=6`).
   Confirmed working, just noting it differs from every other list on this API — worth
   documenting in Postman, since the obvious `?page=2` is silently ignored.

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
