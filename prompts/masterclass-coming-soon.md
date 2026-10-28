# Coming Soon rail on the masterclass page

Status: **approved and implemented (2026-10-27).** See "Changes from the plan" at the end. Ticket: MIL-147. Branch: `feat/MIL-147-masterclass-coming-soon`.

## Goal

Signed in, a "Coming Soon on Masterclasses" rail is the last rail on the masterclass page: after My List and "Courses
you've mastered", before the FAQ. It has the line "Hit the bell icon for updates and never miss a new CPE course
drop!" under the heading. Each card shows the course artwork with its rank number, and a Trailer button on hover when
the course has a trailer. Signed out, the rail isn't requested or shown. A "Coming Soon" sidenav entry scrolls to it.

## What I read

- **The UAT route:** `GET web-api/v1/masterclass/coming-soon/` (Postman `web-masterclass-coming-soon-v1`).
  - It's `AllowAny`, and the payload is the same for every caller.
  - `results` comes as the standard pagination block: default 6, ceiling 100, bare `page_size` accepted. Any other
    query parameter is a 400.
  - On 2026-10-27 UAT holds 1 row:
    `{ id, slug, name, thumbnail_url, trailer_url (HLS), priority, fields_of_study }`.
  - The row's id is not a course: `course-detail/` and `about-course/` both answer 404 for it.
- **`shared/components/cards/coming-soon/`:** the rail's design (the rank number in outlined type, 9:16 artwork, and
  Trailer plus Remind Me on hover). Its title, field-of-study, instructor and "2 CPE Credits" block carries the class
  `hidden`, so it never shows. The card takes the older course shape (number `id`, `title`, `thumbnail`,
  `trailer_link`) and calls the older bookmark route for Remind Me. Only the micro-learning page uses it.
- **`micro-learning.html`:** its Coming Soon rail (`app-partner-content-list` heading, `app-carousel` with
  `swiperConfigComingSoon`, filter off, `@defer` on viewport).
- **`MasterclassLibraryFacade`:** the signed-in, browser-only rails, and `sectionIds` for the sidenav.
- **`masterclass-nav.ts`:** says "Coming Soon is not bound yet; add its entry only with the section it points at".
  `SectionNav` already provides `lucideRocket`.

## Endpoint map

| Call                                                | Verb | When                    | Notes                                                            |
| --------------------------------------------------- | ---- | ----------------------- | ---------------------------------------------------------------- |
| `web-api/v1/masterclass/coming-soon/?page_size=100` | GET  | signed in, browser only | `httpResource`, parsed at the boundary; hidden on empty or error |

No new route is invented; no `app-api/`.

## Locked decisions

1. **Data:** `MasterclassLibraryFacade` gets a `comingSoon` `httpResource`, gated like `library/` on the session's
   boolean and the browser. The facade exposes a `comingSoon` computed (`[]` until the read lands), adds the
   section id to `sectionIds` when the rail has rows, and logs a failure. This is the facade that owns the signed-in
   rails, so no new facade is needed.
2. **Model:** `MasterclassComingSoonCourse { id, name, thumbnail_url: string | null, trailer_url: string | null }` in
   `masterclass-library.model.ts`. These are only the keys the rail reads, checked by `parseComingSoon`.
   `fields_of_study` isn't shown, so it isn't read.
3. **No new component** (reviewer rule: no component without logic).
   - The card is markup in the page's Coming Soon carousel template. It copies the shared `app-coming-soon` card's
     visible design class for class: the rank number, the 9:16 artwork and the hover Trailer.
   - The artwork moves from a CSS background to `ngSrc` with `fill` (reviewer rule: `NgOptimizedImage`).
   - Trailer is the shared `app-button`.
   - The shared card isn't reused: it takes the older course shape and has Remind Me built in, and the micro-learning
     page still depends on both.
4. **Heading:** `app-partner-content-list`, as the micro-learning page uses it. The heading and line live in
   constants.
5. **Carousel:** `swiperConfigComingSoon`, `filterEnabled: false`, inside `@defer (on viewport; prefetch on idle)` with
   a sized `@placeholder`. There's no rail filter: these rows have no instructors, levels or credits to filter by.
6. **Trailer:** `Utils.openVideoDialog(trailer_url, name)`, shown only when `trailer_url` is set.
7. **Sidenav:** a "Coming Soon" entry (`lucideRocket`, section id `masterclass-coming-soon`) between "Completed
   Courses" and "FAQ". It's visible only while the rail is.
8. **No Remind Me and no bookmark.** The row has no flag, and its id isn't a course, so the bookmark route can't take
   it. This waits on the backend.

## Old bindings

- **On the masterclass page: none left.** Its Coming Soon read through `FeatureFacade.getResource('comingSoon',
'masterclass')` (`v2/dashboard/?filter=coming_soon`, a 404 on UAT) went with the tracks rebind.
- **They stay because other pages use them:**
  - the `comingSoon` route in `core/models/feature.model.ts`;
  - the shared `app-coming-soon` card and its story;
  - `swiperConfigComingSoon`.

  The podcast and micro-learning pages still read and render Coming Soon through them, and they go with those
  pages' own rebinds.

- **Dead and out of scope:** `core/config/feature.config.ts`. Nothing imports `featureConfig`, and its `home` and
  `masterclass` entries still list `comingSoon`. Deleting it, and its `FeatureConfigMap` / `FeatureConfigItem` types,
  is a separate `chore` cleanup, so this feature doesn't carry a refactor.

## Files

- `src/app/features/offerings/masterclass/constants/masterclass.ts`: URL, params, section id, heading copy.
- `src/app/features/offerings/masterclass/constants/masterclass-nav.ts`: the sidenav entry.
- `src/app/features/offerings/masterclass/models/masterclass-library.model.ts`: the type and `parseComingSoon`.
- `src/app/features/offerings/masterclass/services/masterclass-library-facade.ts`: the read, `comingSoon`,
  `sectionIds`, the error log.
- `src/app/features/offerings/masterclass/pages/masterclass/masterclass.ts|html`: the rail and the trailer handler.
- `docs/refactor/STATE.md`.

About 150 changed source lines.

## Security

A public read through `httpResource` + `apiUrl()`. No user input reaches it, and nothing is written.

## Acceptance criteria

1. **Signed in:** one `coming-soon/` read. The rail is last, after My List and "Courses you've mastered" and before
   the FAQ, with the heading and the bell line.
2. **Cards:** each shows its artwork and rank number. Hovering shows Trailer, which plays the trailer.
3. **Hidden when there's nothing to show:** no rows or a failed read hide the rail and its sidenav entry, and a failure
   is logged.
4. **Signed out:** no `coming-soon/` request and no rail.
5. **Sidenav:** "Coming Soon" scrolls to the rail.
6. **Not added:** no Remind Me, no bookmark, no filter icon.
7. **Layout:** 375 / 768 / 1440 px with no horizontal scroll; the micro-learning Coming Soon rail is unchanged.

## Checks

`pnpm lint`, `pnpm format:fix`, `pnpm check:structure`, `pnpm build:prod`. Then the running app (dev 4101):

- signed out, against UAT;
- signed in, with stubbed answers (as for MIL-129), using UAT's real Coming Soon row;
- with an empty `coming-soon/` and with a 500.

## Risks

- **One row on UAT, and its trailer is another course's.** The rail plays whatever the API sends; that's a backend
  data question.
- **`thumbnail_url` / `trailer_url` nullability isn't documented.** Both are typed `string | null`. A card with no
  artwork shows the rank and a dark tile.

## Assumptions (please confirm)

1. The rank number counts from 1 in the API's order (its `priority`), as the shared card does.
2. The rail's sidenav label is "Coming Soon".

## Changes from the plan

- **The Trailer button also shows on keyboard focus** (`focus-within`), not only on hover, so it can be reached
  without a mouse.
- **Hovering a card with a trailer fades the bottom of its artwork to dark** (the course cards' hover gradient),
  so the Trailer button reads over busy artwork. Added at the user's request.
- **A card with no artwork shows a dark tile** (`bg-secondary`), as the plan's risk note expected.
- **The `@placeholder` is 680 px tall,** the rail's measured height at 375 / 768 / 1440 (662–688 px), so nothing
  shifts when it loads.
- **Size:** about 170 changed source lines.
