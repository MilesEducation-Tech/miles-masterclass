# Masterclass course page (web API v1): open questions for the backend

**From:** Masterclass web (Angular SSR), ticket MIL-25.
**Against:** the Postman export in `postman/` (refreshed 2026-10-06), folder
`04. Masterclass - Learning Flow (web)`, and live UAT (`uat-api.milescaira.com`) on 2026-10-06.
**Page:** `/:country/:profession/masterclass/:courseId/:courseTitle`, the course details page.

The web app calls only `api/v1/` and `web-api/v1/`, never `app-api/`. Every gap below is something the
current production page shows that has no `web-api` source yet, so the page hides it until one exists.

## Blocking

### Q1. What does `course-detail/<course_id>/` return?

`GET web-api/v1/masterclass/course-detail/<uuid>/` is `IsAuthenticated`. Its Postman example is a
placeholder (`<**detail>` merged in, `chapters` as a paginated block of `<results>`), with no captured
response. We need the real field list to bind:

- the chapter list
- resume ("Watch Now" on the chapter in progress)
- the progress bar
- rating and "Submit Feedback"
- "Take / Retake Final Assessment"
- Download

Please attach a captured 200 for a started course and for an unstarted one.

### Q2. Chapters for signed-out visitors

Production lists every chapter (duration, quiz count) to anonymous visitors. On the web API, chapters
only come from `course-detail/`, which needs sign-in. `about-course/` gives only `chapter_count` and
`first_chapter`. Can `about-course/` (`AllowAny`) carry the chapter list, or can there be a public
chapters read?

## Missing from the web API

| Production page shows                      | Legacy source                     | Web API today                                                        | Ask                                                    |
| ------------------------------------------ | --------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------ |
| CPE / Preview mode badge and switch        | `user/customaction/set_cpe_mode/` | none; `enrollment/` describes a 365-day window instead               | Is CPE/Preview mode gone? If not, which route sets it? |
| Price, "Purchased", Add To Cart            | legacy details price fields       | none on `about-course/`                                              | Price and purchase state for a course                  |
| Created / Updated / Reviewed dates         | legacy details                    | none                                                                 | Add to `about-course/`                                 |
| Video duration (e.g. "1 hr 55 min 52 sec") | legacy details                    | only `total_duration` ("3 hours"), which matches the course duration | A video-duration field                                 |
| Program level ("Basic")                    | legacy details                    | `program_level` is `null` on all 64 UAT courses                      | Fill it                                                |
| CAIRA level badge ("CAIRA L2")             | legacy `caira_level`              | only `included_for_caira`; the badge needs the level, so it hides    | Add the course's CAIRA level                           |
| Learning pathway                           | legacy `learning_pathway_info`    | none                                                                 | Add, or confirm it is gone                             |
| Glossary, course-navigation video          | legacy course-content route       | `miscellaneous_data.has_*` flags only, no content                    | A route for the content                                |
| Exercise files, AI Kit                     | legacy download / resources       | `has_additional_resources.has_*` flags only                          | Routes for both                                        |
| Related courses, "More by <instructor>"    | legacy related / instructor feeds | `instructor-detail/` is auth-only with a placeholder example         | A public related / by-instructor read                  |
| Background video, Sample                   | `thumbnail_gif`, `sample_link`    | `web_background_video_url`, `sample_video_url` are `null` on all 64  | Fill them                                              |

## Contract drift (live vs Postman)

- **Envelope:** live is `{ success: true, message, data }`; Postman says `status: "success"`. Same as
  `home-page/`.
- **Unset fields:** live sends `null`; Postman shows `""`. Affected:
  - `thumbnails.square`
  - `web_background_video_url`, `sample_video_url`
  - `program_level`
  - `certificate_expiry_years`, `certifying_organisation`
- **Bookmark:** `POST bookmark/<id>/`'s body template "could not be resolved from the code". Is the
  body empty?
