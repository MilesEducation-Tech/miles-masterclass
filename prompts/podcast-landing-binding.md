# Podcast landing page on the web API (MIL-176)

Story 1 of the epic "Podcast: bind to the new web API". Branch `feat/MIL-176-podcast-landing-binding`.
Story 2 (course and chapter pages) and Story 3 (final assessment and feedback) follow.

## Goal

Rebind `/:country/:profession/podcast` to the new API collection (`postman/`, export of 2026-11-03).
On the web API a podcast is a course (`course_type: "podcast"`, UUID id) served by the same
`web-api/v1/masterclass/…` routes as masterclass, with the same card. The podcast page shows the same
rows as the masterclass page, so it uses the same rails service, keyed by offering, instead of a second
copy.

Remove the page's current binding: the nine `FeatureFacade.getResource(…, 'podcast')` rows, the
legacy `Content` cards (`app-square`, the carousel's `app-hover` overlay, `app-coming-soon`), and the
legacy `filterConfig` filters.

## What was read

- The podcast feature: `podcast.routes.ts`, `pages/podcast/podcast.ts|html`, `components/podcast-hero`.
- The masterclass landing page, which already runs on these routes:
  - `pages/masterclass/masterclass.ts|html`;
  - `services/masterclass-library-facade.ts` and `masterclass-highlight-facade.ts`;
  - `constants/masterclass.ts` and `masterclass-nav.ts`;
  - `models/masterclass-library.model.ts`.
- Core and shared building blocks:
  - core: `masterclass-home.model.ts` (`MasterclassCourse`, `isMasterclassCourse`, `parseHomePage`, `trackRail`), `MasterclassHomeFacade`, `MasterclassBookmarks`, `core/constants/masterclass.ts`;
  - shared: `MasterclassRailFilter`, `CourseAiKit`, `Carousel`, `Square`, `Hover`, `ComingSoon`, `MasterclassCourseCard`, `RecordDisk`.
- `CourseDetailFacade` (`connect()` keyed by `COURSE_DETAIL_API`), the precedent for "one offerings-level service, keyed by offering".
- `app.routes.server.ts`: the podcast landing page falls under the `**` Server rule, so it's rendered on the server.
- Postman (new export): `web-masterclass-library-v1`, `-tracks-page-v1`, `-completed-course-section-v1`, `-coming-soon-v1`, `-filter-v1`, `-bookmark-v1`, `masterclass-coming-soon-notify-me-v1`.
- Diffed against the 29 Oct export: no route removed. The cards gained `vertical_trailer_url`, which is additive and passes the guard.
- **Live UAT, 2026-11-10, signed out:**

  | Read (`course_type=podcast`)   | Answer                                                                                                   |
  | ------------------------------ | -------------------------------------------------------------------------------------------------------- |
  | `tracks-page/`                 | 4 tracks; "Human Skills in the Age of AI" holds both podcasts, the other 3 are empty                     |
  | `library/`                     | `latest` = the 2 podcasts; **`popular` = 10 masterclass courses**; the learner rows are empty signed out |
  | `filter/?content_type=podcast` | the 2 podcasts                                                                                           |
  | `coming-soon/`                 | 200, empty                                                                                               |
  | `completed-course-section/`    | 401 signed out (needs a session)                                                                         |
  - A podcast card has exactly the `MasterclassCourse` shape (`isMasterclassCourse` passes) plus `course_type: "podcast"`, `first_chapter`, `bookmark_id`.
  - The page never shows `popular`: the slider that read it is commented out, and the hero is fixed copy. So the backend's `popular` bug (raised 2026-11-06) doesn't block this story. Like masterclass, the page asks for one `popular` row and ignores it.

## Locked decisions (proposed, for approval)

1. **One rails service for both offerings.**
   - `MasterclassLibraryFacade` moves to `features/offerings/services/` and gains `connect(offering)`, the same pattern as `CourseDetailFacade.connect()`.
   - The per-offering parts sit in one record, `LIBRARY_OFFERINGS`: the `course_type`, the filter's `content_type`, whether it reads its own tracks, and the Coming Soon heading.
   - Masterclass behaves exactly as today.
   - The class keeps its `Masterclass` prefix, like `MasterclassCourse` and `MasterclassBookmarks`: the names follow the API namespace (`web-api/v1/masterclass/`), which serves podcasts too. This keeps the diff small.
2. **Tracks.**
   - Podcast reads `tracks-page/?course_type=podcast` through the same facade, on the server too, signed out (so a crawler gets the podcast list), and signed in.
   - Masterclass keeps the root `MasterclassHomeFacade`, because the home page shares that read. Its config says `ownTracks: false`.
3. **Rows, same order as today:**
   1. Continue Watching
   2. Recommended For You
   3. Complimentary (names the firm)
   4. Because You Watched
   5. tracks
   6. My List
   7. Courses you've mastered
   8. Coming Soon

   Headings are as today. An empty row is hidden.

4. **Cards.** A new `PodcastCourseCard` (`features/offerings/podcast/components/`) renders a `MasterclassCourse` in today's podcast look:
   - square artwork and the CAIRA badge;
   - on hover, the record disk, title, short description, fields of study, CPE credits, Trailer, AI Kit (only when `has_ai_kit`) and the bookmark;
   - it links to `/<country>/<profession>/podcast/<uuid>/<slug>`.

   The carousel's `shouldHoverAnimate` / `app-hover` overlay is no longer used by this page. Partners and related courses still use it.

5. **Bookmarks** go through the root `MasterclassBookmarks` (`web-api/v1/masterclass/bookmark/<uuid>/`; a podcast is a course). My List keeps only `course_type === 'podcast'`, because `bookmarked` ignores `course_type`.
6. **Filters.** Every row gets the masterclass page's filter (`MasterclassRailFilter`): instructors, fields of study, categories, CAIRA level, credits. The filter learns a content type, `podcast` here, with `masterclass_course` as the default, so the home and masterclass pages don't change.
7. **Coming Soon** shows signed in only, with Remind Me (`api/v1/…/coming-soon/<id>/notify-me/`), as on the masterclass page.
   - Today's podcast page also shows it signed out, where Remind Me can't work. This is an intentional difference.
   - Its card, inline in `masterclass.html` today, becomes one `ComingSoonCard` component in `features/offerings/components/` for both pages.
8. **Hero and FAQ stay as they are.** `highlight/` isn't read.
9. **Deferred to Story 2:** the card's "i" (course info) button. That dialog reads through `CourseDetailFacade`, which serves masterclass only until Story 2 adds podcast to `COURSE_DETAIL_API`.

## Assumptions (reviewer, read first)

- **Placement.** Moving the rails facade, its model and its constants up to `features/offerings/` follows AGENTS §3: siblings that share code promote it to their common parent, and "move a model up only when a second feature needs it". It's needed because of this feature, but it is still a move of masterclass code. See **Split**.
- **Card links.** Until Story 2 merges, a card opens the course page at its UUID, and that page still reads through the legacy facade by numeric id. On UAT that page shows nothing today either. Story 2 fixes it.
- **The `popular` bug.** The page asks for `popular.page_size=1` and never shows it, so the backend's `popular` filter bug is invisible here.
- **SSR.** Signed in, the learner rows load in the browser only, as on masterclass, because the token lives there. The tracks render on the server signed out.

## Split (decided 2026-11-10: two PRs)

The work is about 1,100 changed lines, well over the ~400 limit, and CLAUDE.md says not to mix a refactor with a feature. So it goes in **two PRs**: the refactor first, under its own Task (`refactor/MIL-XXX-share-landing-rails`, which blocks MIL-176), then this story on top of it.

| PR  | Ticket                                             | What                                                                                                                                                                                                                                       | ≈ lines                                   |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| A   | new ticket, `refactor/MIL-XXX-share-landing-rails` | Promote the rails facade, model and constants to `features/offerings/` with `connect(offering)`; extract `ComingSoonCard`; give the rail filter a content type. No behaviour change: the masterclass and home pages look and act as today. | ~400                                      |
| B   | MIL-176 (this branch)                              | Add podcast to `LIBRARY_OFFERINGS`, add `PodcastCourseCard`, rewrite the podcast page on the facade, remove the old binding.                                                                                                               | ~700, mostly the old template's deletions |

PR A's plan is this file's Phase 1, the `constants`, `models`, `services` and `components` rows of
"Target code" and "Files touched", and Risk 1.

## Target code

```
features/offerings/
  constants/masterclass-library.ts       ← moved from masterclass/constants/masterclass.ts (library URLs, params,
                                            headings, section ids, toasts) + LIBRARY_OFFERINGS
  models/masterclass-library.model.ts    ← moved as is (git rename)
  services/masterclass-library-facade.ts ← moved; connect(offering), own tracks read when the offering has one
  components/coming-soon-card/           ← new, out of masterclass.html's inline teaser card
  podcast/
    components/podcast-course-card/      ← new
    pages/podcast/podcast.ts|html        ← rewritten on the facade
    podcast.routes.ts                    ← providers: [MasterclassLibraryFacade, MasterclassRailFilter] on ''
shared/services/masterclass-rail-filter.ts ← contentType signal (default masterclass_course)
```

```ts
// features/offerings/constants/masterclass-library.ts
export type LibraryOffering = 'masterclass' | 'podcast';
export interface LibraryOfferingConfig {
  courseType: 'course' | 'podcast';          // `course_type` on library/, completed/, coming-soon/, tracks-page/
  filterContentType: 'masterclass_course' | 'podcast'; // `content_type` on filter/
  ownTracks: boolean;                        // masterclass: false (root MasterclassHomeFacade)
  comingSoonHeading: PartnerContentItem[];   // "Coming Soon on Masterclasses" / "Coming Soon on Podcast"
}
export const LIBRARY_OFFERINGS: Readonly<Record<LibraryOffering, LibraryOfferingConfig>> = { … };

// services/masterclass-library-facade.ts (moved)
connect(offering: LibraryOffering): void;    // the page's constructor; every request fn returns undefined until then
readonly tracks: Signal<MasterclassTrack[]>; // ownTracks only; pre_login on the server, post_login in the browser
readonly tracksPending / tracksError / reloadTracks();
// unchanged: railsAboveTracks, railsBelowTracks (My List narrowed to config.courseType), comingSoon,
// toggleReminder, remindersInFlight, sectionIds, myListSync, error logs
```

```html
<!-- podcast.html, per row -->
<section [id]="rail.id">
  @defer (on viewport; prefetch on idle) {
  <app-carousel [cards]="rail.shown" [heading]="…" [swiperConfig]="swiperConfigPodcast">
    <button carouselAction … (click)="railFilter.open(rail)">filter icon + count</button>
    <ng-template let-course let-index="$index">
      <app-podcast-course-card
        [course]="course"
        [index]="index"
        [bookmarked]="bookmarks.isBookmarked(course)"
        (bookmark)="bookmarks.toggle($event)"
        (trailer)="openTrailer($event)"
        (aiKit)="openAiKit($event)"
      />
    </ng-template>
  </app-carousel>
  } @placeholder { square-card skeleton, fixed height }
</section>
```

## Endpoint map

| Row                                                                         | Route (all `course_type=podcast`)                                          | Auth                  | Read by                        |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------- | ------------------------------ |
| Continue Watching, Recommended, Complimentary, Because You Watched, My List | `GET web-api/v1/masterclass/library/?login_type=post_login`                | signed in             | facade `library`               |
| tracks                                                                      | `GET web-api/v1/masterclass/tracks-page/?login_type=pre_login\|post_login` | both                  | facade `tracks` (podcast only) |
| Courses you've mastered                                                     | `GET web-api/v1/masterclass/completed-course-section/`                     | signed in             | facade `completed`             |
| Coming Soon                                                                 | `GET web-api/v1/masterclass/coming-soon/`                                  | signed in (page rule) | facade `comingSoon`            |
| Remind Me                                                                   | `POST api/v1/masterclass/coming-soon/<uuid>/notify-me/`                    | signed in             | `toggleReminder`               |
| Bookmark                                                                    | `POST web-api/v1/masterclass/bookmark/<uuid>/`                             | signed in             | `MasterclassBookmarks`         |
| Filter                                                                      | `GET web-api/v1/masterclass/filter/?content_type=podcast`                  | public                | `MasterclassRailFilter`        |
| AI Kit                                                                      | the existing `CourseAiKit` read                                            | public                | `CourseAiKit`                  |

## Phases

1. **Promote** (PR A, or the first commit): move the model, facade and constants; add `connect()` and `LIBRARY_OFFERINGS`; extract `ComingSoonCard`; give the filter a content type. Then check the masterclass and home pages for no change.
2. **Podcast:** add the `LIBRARY_OFFERINGS.podcast` entry and the facade's own tracks read; build `PodcastCourseCard`; rewrite `podcast.ts|html`; route providers.
3. **Clean up:** drop the page's `FeatureFacade`, `Square`, `ComingSoon` and `swiperConfigComingSoon` imports. Nothing in `FeatureFacade` or the shared cards is deleted, because micro-learning, partners and related courses still use them.
4. **Write-up:** update `docs/refactor/STATE.md` and the step log, then run the checks and verify.

## Files touched

| File                                                                    | Change                                                                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `features/offerings/models/masterclass-library.model.ts`                | moved from `masterclass/models/` (rename)                                                      |
| `features/offerings/services/masterclass-library-facade.ts`             | moved; `connect()`, config-driven `course_type`, own tracks read                               |
| `features/offerings/constants/masterclass-library.ts`                   | new: the library constants out of `masterclass/constants/masterclass.ts` + `LIBRARY_OFFERINGS` |
| `features/offerings/masterclass/constants/masterclass.ts`               | loses the moved constants (keeps the hero trailer config)                                      |
| `features/offerings/masterclass/constants/masterclass-nav.ts`           | import path                                                                                    |
| `features/offerings/masterclass/masterclass.routes.ts`                  | import path                                                                                    |
| `features/offerings/masterclass/pages/masterclass/masterclass.ts\|html` | `library.connect('masterclass')`, import paths, `<app-coming-soon-card>`                       |
| `features/offerings/components/coming-soon-card/`                       | new (out of `masterclass.html`)                                                                |
| `shared/services/masterclass-rail-filter.ts`                            | `contentType` signal; `filter/` params read it                                                 |
| `features/offerings/podcast/components/podcast-course-card/`            | new                                                                                            |
| `features/offerings/podcast/pages/podcast/podcast.ts\|html`             | rewritten                                                                                      |
| `features/offerings/podcast/podcast.routes.ts`                          | providers on `''`                                                                              |
| `docs/refactor/STATE.md`                                                | Now entry + step log                                                                           |

## Security requirements

- Reads go through `httpResource` + `apiUrl()`; mutations through `ApiClient.call()`. No hand-attached headers.
- Signed-in reads are gated on the boolean `isAuthenticated()`, never the token.
- Every response passes a guard in `parse`; a drifted answer lands in `error()`, not on screen.
- No `app-api/`.

## Acceptance criteria

- **Network:** the podcast page sends no request outside the new collection's routes; every call is `web-api/v1/` or `api/v1/`.
- **Signed out:** hero, then the podcast tracks (UAT: "Human Skills in the Age of AI" with 2 podcasts), then the FAQ. No learner rows and no Coming Soon. The track list is in the server HTML.
- **Signed in:** the learner rows show podcasts only, in the order above, with the firm's name on Complimentary. Empty rows are hidden.
- **Cards:**
  - square artwork with the CAIRA badge;
  - the hover shows the record disk, title, description, fields of study, credits, Trailer, AI Kit when there is one, and the bookmark;
  - clicking opens `/<c>/<p>/podcast/<uuid>/<slug>`.
- **Bookmark:** toggles with a toast, and My List follows without a reload.
- **Filter:** opens on every row with podcast facets; selecting one narrows the row; "No courses match these filters." shows when nothing matches.
- **Coming Soon:** Remind Me flips and toasts. 404/409 re-read the row; any other failure reverts.
- **States:** loading skeletons hold the layout. A failed track read shows "We couldn't load the podcasts." with Try again. A failed learner read hides its rows and logs.
- **Masterclass and home pages unchanged:** same rails, filter, Coming Soon and Remind Me.
- **Layout:** 375 / 768 / 1440 match today's page, apart from the listed differences (no Info button until Story 2; Coming Soon signed in only).
- **Gates:** `pnpm lint` 0 errors; `node scripts/check-structure.mjs` green (prune if a relative import goes away); `pnpm build:prod` within budget.

## Checks to run

```bash
pnpm lint
pnpm format:fix
node scripts/check-structure.mjs
pnpm build:prod
```

## How to verify

- **Dev server:** `pnpm start` (4101), English. Restart it after `build:prod`.
- **Signed out, live UAT:** `/us/cpa/podcast`.
  - Tracks render.
  - The network shows only `tracks-page/` (+ `filter/` on a filter click).
  - `curl -s localhost:4000/us/cpa/podcast` after `pnpm build && pnpm serve:ssr:miles-masterclass-v3` carries the podcast titles.
- **Signed in, stubbed:** stub `library/`, `completed-course-section/` and `coming-soon/` with podcast cards from the live `tracks-page/` body.
  - Check every row, the Complimentary heading, empty-row hiding, bookmark toggle (stubbed 200 / 500), Remind Me (200 / 409 / 500), filter, and a 500 on `tracks-page/`.
- **Regression:** the masterclass page signed out and signed in (rails, sidenav, filter, Coming Soon, Remind Me), and the home page's tracks and filter.
- **Layout:** screenshots at 375 / 768 / 1440 before and after.

## Risks

1. **The masterclass page could regress** because of the move. Mitigation: PR A carries no behaviour change, and both pages are checked before and after.
2. **The bookmark route on a podcast UUID is unverified signed in** (no test account token). It's the same `Course` model; stubbed here, then one live click once a session is available.
3. **The signed-in `library/` with `course_type=podcast` is unverified live:** that's the learner rows' shape for a podcast. Stubbed from the signed-out shape, which is the same block.
4. **The card hover is redrawn, not reused** (`app-hover` reads the legacy `Content`), so the visual check at three widths matters.
5. **`popular`** stays wrong on the backend until they fix it; harmless here, and it matters to Story 2's related rows only if they read it.

## Out of scope

- The course page, chapters, assessment and feedback (Stories 2 and 3), and the card's Info button (Story 2).
- Deleting `FeatureFacade`, `app-hover`, `app-square` or `app-coming-soon`: micro-learning, partners and related courses still use them.
- Renaming the `Masterclass*` services and models to neutral names (a later `refactor/` PR if wanted).
