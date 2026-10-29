# Coming Soon rail on the masterclass page

Status: **approved and implemented (2026-10-27).** See "Changes from the plan". Ticket: MIL-147. Branch: `feat/MIL-147-masterclass-coming-soon`.

**2026-10-29: the rail asks for `course_type=course`, and Remind Me is added to this PR (the user's call). Both are approved and implemented; see "Remind Me" at the end.**

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
- **2026-10-29, `course_type=course` on the rail's request** (the user's call). Since 2026-10-28 `coming-soon/` also
  returns podcast and micro-learning teasers unless `course_type` narrows it. Checked on UAT: `course` gives the one
  masterclass teaser, `podcast` none, and an unknown value is a 400.

## Remind Me (2026-10-29, approved and implemented)

### Goal

Each Coming Soon card gets a **Remind Me** button under Trailer. A learner turns a reminder on, and the backend tells
them when the course launches. They can turn it off again. The button shows the learner's own state on every visit.

### What I read

- **The new Postman collection** (`postman/`, 2026-10-29):
  - `POST api/v1/masterclass/coming-soon/<id>/notify-me/` (`masterclass-coming-soon-notify-me-v1`, shared by app and
    web) takes `{"notify_me": true}` or `{"notify_me": false}`. It is one verb, with no DELETE or PATCH, because a
    browser's preflight refused DELETE.
  - The answers:
    - `201` (newly on) or `200` (already on, or off), with `{status, coming_soon_course_id, notify_me}`;
    - `404` `coming_soon_course_not_found`: an unknown or unlisted teaser;
    - `409` `coming_soon_course_launched`: the course is live, with `course {id, slug, name, course_type}`;
    - `400` for a non-boolean;
    - `401` without a token.
  - Off is a soft delete, idempotent.
  - `GET web-api/v1/masterclass/coming-soon/` rows carry `notify_me` per learner since 2026-10-28 (`false` signed out).
    Checked on UAT: present on every row.
  - `GET web-api/v1/masterclass/coming-soon/notify-me/` lists a learner's reminders. **Not used:** the rail's rows
    already carry the flag.
- **On UAT, without a token:** both new routes answer `401` ("credentials were not provided"), an unknown route `404`,
  so they exist. There is no `web-api` twin of the POST (`404`); `api/v1/` is one of this app's two surfaces
  (AGENTS.md §6).
- **`MasterclassBookmarks`:** the card flips at once, keeps the server's answer, ignores a second click while one is in
  flight, flips back and toasts on failure, and skips the loading bar. Remind Me copies that shape.
- **The micro-learning page's `app-coming-soon` card:** "Remind Me" with a bell, then "Reminded". It used the bookmark
  toggle and was one-way. It isn't reused: it takes the older course shape (see the plan above).

### Endpoint map

| Call                                                       | Verb | When                 |
| ---------------------------------------------------------- | ---- | -------------------- |
| `web-api/v1/masterclass/coming-soon/?course_type=course&…` | GET  | the rail (unchanged) |
| `api/v1/masterclass/coming-soon/<id>/notify-me/`           | POST | each Remind Me click |

### Locked decisions

1. **The model:** `MasterclassComingSoonCourse` gains `notify_me: boolean`, checked like every other key, so a row
   without it fails the rail rather than showing a wrong button. `parseNotifyMe(raw)` reads `data.notify_me`.
2. **The route** is a `RouteConfig<{ notify_me: boolean }>` in the feature's constants,
   `MASTERCLASS_COMING_SOON_NOTIFY_ROUTE`, beside the rail's URL.
3. **`MasterclassLibraryFacade` owns it.** It already owns the rail's resource. `toggleReminder(course)` sets
   `notify_me` to the opposite at once by updating the resource's value, ignores clicks while that course is in
   flight, posts with `SKIP_LOADING`, then keeps the server's answer:
   - **success:** a toast, "We'll remind you" / "Reminder removed", naming the course;
   - **409 (launched):** a toast saying the course is now available, and the rail reloads, so the teaser drops out;
   - **404 (gone):** a toast, and the rail reloads;
   - **anything else:** the button flips back, and a toast says "Reminder not saved. Please try again."

   The copy lives in constants, as the bookmark toasts do.

4. **The card:** Remind Me sits under Trailer, full width, at every width. It shows on hover and on keyboard focus,
   like Trailer, and on a card with no trailer it shows alone.
   - Off: a bell and "Remind Me". On: "Reminded".
   - `aria-pressed` carries the state, and the button is disabled while a click is in flight.
   - The hover fade now covers every card, since every card has a button.
5. **No sign-in path:** the rail only renders signed in.
6. **The constant's doc changes:** the rail's answer is no longer "the same for every caller"; `notify_me` is per
   learner.

### Files

- `masterclass/constants/masterclass.ts`: the route, the toast copy, the URL's doc.
- `masterclass/models/masterclass-library.model.ts`: `notify_me`, `parseNotifyMe`.
- `masterclass/services/masterclass-library-facade.ts`: `toggleReminder`.
- `masterclass/pages/masterclass/masterclass.ts|html`: the button.
- `docs/refactor/STATE.md`, this plan.

About 130 changed lines, which brings #210 to about 500. That's over the ~400 guideline; the user chose one PR.

### Security

Signed in only, through `ApiClient` and the interceptors (no hand-attached token). The id comes from the rail's own
row, never from the URL or user input, and the body is a boolean.

### Acceptance criteria

1. Each card has Remind Me under Trailer (alone when there's no trailer), on hover and on focus.
2. A card whose row says `notify_me: true` shows "Reminded".
3. A click turns it on: the button changes at once, one POST with `{"notify_me": true}`, a toast; after a reload it's
   still "Reminded". A second click turns it off the same way.
4. A double click sends one request.
5. A failed POST puts the button back and toasts; a 409 or 404 toasts and reloads the rail.
6. No page-wide loading bar on a click.
7. Layout: 375 / 768 / 1440 with no horizontal scroll; the rail's height doesn't change when the card is hovered.

### Checks

`pnpm lint`, `pnpm format:fix`, `pnpm check:structure`, `pnpm build:prod`. In the browser (dev 4101), signed in with a
stub session, I'll stub `notify-me/` to answer 201 / 200, 409, 404 and 500. A real sign-in sends a real OTP, so the
POST against UAT itself is for you to try in Postman or the app.

### Risks

- **The POST isn't exercised against UAT by me:** it needs a real session. Its contract is from the Postman
  collection's examples.
- **`200` vs `201`:** both are success; only `data.notify_me` is read.

### Assumptions (please confirm)

1. **A toggle:** a learner can turn a reminder off again. The older card was one-way only because it rode on the
   bookmark toggle.
2. **Labels and icons:** "Remind Me" with a bell, then "Reminded" with a check. The older card showed a bookmark icon
   for "Reminded".
3. **The toast copy:**
   - on: "We'll remind you" with the course name;
   - off: "Reminder removed" with the course name;
   - launched: "This course is now available";
   - failed: "Reminder not saved" / "Please try again."

### Changes from the Remind Me plan

- **Trailer is full width too,** so the two buttons stack at one width, as in the layout agreed for MIL-147.
- **The 404 toast reads "This course is no longer listed"** (the plan said only "a toast"). The 409 and 404 toasts use
  the info style; success uses the success style, and failure the error style.
- **Size:** about 160 changed source lines with the `course_type` line, which brings #210 to about 520.
