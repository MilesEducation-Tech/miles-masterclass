# Masterclass homepage: send `course_type`, read the renamed trailer keys (MIL-XXX)

Status: **approved 2026-10-15** (plan approval; D1 and D4 chosen by the user). Implemented on
`fix/MIL-XXX-masterclass-course-type`, uncommitted.

## Jira ticket

**Summary:** `fix(offerings): send course_type on the masterclass list reads`

**Issue type:** Bug
**Component / scope:** offerings
**Branch:** `fix/MIL-XXX-masterclass-course-type` (rename with `git branch -m` once the ticket exists)
**Links:** relates to MIL-65 / draft PR #137 · Masterclass API Surface (2026-10-14), section "Course, podcast and
reel" · Postman `web-masterclass-highlight-v1`, `web-masterclass-tracks-page-v1`, `web-masterclass-ai-labs-v1`,
`web-masterclass-course-detail-v1` · `prompts/masterclass-course-type.md`

### Context

On 2026-10-13 the backend made `?course_type=` **required** on every `web-api/v1/masterclass/` list route. A
missing value is now a `400 invalid_query` ("Field required") instead of defaulting to courses. On 2026-10-14
`course-detail/` renamed `trailer_video_url` → `horizontal_trailer_url` and `trailer_thumbnail_url` →
`trailer_horizontal_thumbnail_image_url`. Both fixes are on draft PR #137, which is 41 files and not mergeable
soon, so the home and masterclass pages stay broken on `master` until then.

### Current behaviour (UAT, signed out, 2026-10-15)

- `/masterclass`: `highlight/` is a 400, so the hero is hidden. `tracks-page/` is a 400, so the page shows "We
  couldn't load the masterclasses".
- `/home`: the same `tracks-page/` error, and the AI Labs ring is empty (`ai-labs/` is a 400).
- On both pages the "i" dialog shows its error state: `course-detail/`'s answer fails the guard
  (`course-detail.model.ts:157-159, 299-300`). The course page fails the same way.

### Expected behaviour

The three list reads send `course_type=course` and get a 200: highlight 10 courses, tracks 4 tracks / 68
courses, ai-labs 2. `course-detail/` parses, and the hero poster, trailer, Trailer button and `og:video` read
the new keys.

### Scope

- In:
  - `course_type` on `highlight/`, `tracks-page/` and `ai-labs/`
  - the course-detail trailer rename (the same change as #137's `1d472cea`)
  - `docs/MASTERCLASS_PODCAST_AND_REELS.md`
- Out:
  - podcasts and reels on the rails (D1)
  - type-aware card links
  - the podcast and reel page rebind (future tickets; the gap list is in the doc)
  - everything else on #137

### Acceptance criteria

- [ ] `/us/cpa/masterclass` shows the hero slider and the track carousels. `highlight/` and `tracks-page/`
      requests carry `course_type=course` and answer 200.
- [ ] `/us/cpa/home` shows the track carousels and the AI Labs ring. `ai-labs/` carries `course_type=course`.
- [ ] The "i" dialog opens with the course's About content on both pages.
- [ ] A course page shows its hero poster, and its Trailer button plays.
- [ ] `pnpm lint`, `pnpm check:structure`, `pnpm build:prod` green (local macOS).

### How to verify

Run `pnpm start` (port 4101) and stay signed out. Open `/us/cpa/masterclass` and `/us/cpa/home`, check the
three list requests in DevTools → Network, and open "i" on any card. Then open a course page from a card.

### Risks / assumptions / open questions

- If #137 merges first, this PR shrinks to the doc. If this PR lands first, #137's rebase sees identical hunks.
- `course_type=course` deliberately hides any podcast or reel the backend later attaches to a track (D1).

**Estimate:** S (< 100 lines of code; the doc is extra)

## What was read

- The Masterclass API Surface export (`Masterclass API Surface (Copy).md`, 32 k lines, 71 routes), especially the
  summary table, "How this was taken", "Course, podcast and reel" and the `highlight/`, `tracks-page/`,
  `ai-labs/`, `course-detail/` and `filter/` cards.
- Live UAT probes (signed out, GET only): each list route with no `course_type`, with `course`, and with all four
  types; `filter/` and `reels-feed/` for podcasts and reels; `course-detail/` key names.
- Code:
  - `core/services/masterclass-home-facade/`, `features/offerings/masterclass/` (page, highlight facade, routes)
  - `shared/components/surround-carousel/`, the shared card and slider (links)
  - `features/home/services/home-facade.ts`
  - `features/offerings/models/course-detail.model.ts` and its readers
  - #137's diff for these files
- A code map of the podcast and micro-learning features, which feeds section 9 of the doc.

## Decisions

- **D1 (user):** `course_type=course` only. Cards link to `/masterclass/:id/:slug` (`masterclass-course-card.ts`,
  `slider.ts`), and the podcast and reel pages turn a UUID into `NaN`.
- **D2:** `MASTERCLASS_COURSE_TYPE` in `core/constants/masterclass.ts`, word for word as on #137, so the rebase
  is clean.
- **D3:** the trailer rename is #137's `1d472cea` without its STATE.md hunk.
- **D4 (user):** the podcast and reel reference is `docs/MASTERCLASS_PODCAST_AND_REELS.md`, not a skill,
  because `.claude/` belongs to the user.

## Endpoint map

| Route                                                                                                    | Reader                                     | Change                                                                  |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| `GET web-api/v1/masterclass/highlight/?all_courses.page_size=100`                                        | `MasterclassHighlightFacade`               | + `course_type=course`                                                  |
| `GET web-api/v1/masterclass/tracks-page/?login_type=…&tracks.page_size=100&tracks.courses.page_size=100` | `MasterclassHomeFacade`                    | + `course_type=course`                                                  |
| `GET web-api/v1/masterclass/ai-labs/?login_type=pre_login&page_size=…`                                   | `SurroundCarousel`                         | + `course_type=course`                                                  |
| `GET web-api/v1/masterclass/course-detail/<uuid>/?login_type=…`                                          | `CourseDetailFacade` (dialog, course page) | read `horizontal_trailer_url`, `trailer_horizontal_thumbnail_image_url` |
| `GET web-api/v1/masterclass/levels/`                                                                     | `HomeFacade`                               | none: the route takes no `course_type`                                  |

## Files

- Commit A:
  - new `src/app/core/constants/masterclass.ts`
  - `src/app/core/services/masterclass-home-facade/masterclass-home-facade.ts`
  - `src/app/features/offerings/masterclass/services/masterclass-highlight-facade.ts`
  - `src/app/shared/components/surround-carousel/surround-carousel.ts`
- Commit B:
  - `src/app/features/offerings/models/course-detail.model.ts`
  - `src/app/features/offerings/masterclass/components/masterclass-course-hero/masterclass-course-hero.ts`
  - `src/app/features/offerings/services/course-detail-facade.ts`
  - `src/app/shared/utils/seo/course-seo-config.ts`
- Commit C: `docs/MASTERCLASS_PODCAST_AND_REELS.md`, this prompt, `docs/refactor/STATE.md`

## Security

No change. All four reads are anonymous, `AllowAny` web reads. There are no new headers or tokens, and no
`app-api/`.

## Checks

`pnpm lint`, `pnpm check:structure`, `pnpm format:fix`, `pnpm build:prod`. Then check the running app on 4101 at
375, 768 and 1440 px.
