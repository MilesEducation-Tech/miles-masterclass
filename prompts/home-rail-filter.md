# The rail filter on the home page

Status: **approved and implemented (2026-10-29).** PR 1 merged as #213; PR 2 is MIL-132. Two tickets, two PRs (a
refactor, then the feature):

- PR 1, MIL-156: `refactor/MIL-156-shared-rail-filter`
- PR 2, MIL-132 (logged as a bug): `fix/MIL-132-home-rail-filter`

Both branches come off `master`; PR 2 branches off once PR 1 is merged.

## Goal

The home page's masterclass track rails get the same filter icon as the masterclass page's rails:

- the same dialog and groups (Instructor, Field of Study, Additional Category, CAIRA Level, Credits);
- a count on the icon;
- a selection per rail that lasts the visit;
- "No courses match these filters." when nothing matches.

## What I read

- **`features/offerings/masterclass/services/masterclass-rail-filter-facade.ts`** (MIL-128): the filter's state and
  reads.
  - Each rail's selection, keyed by rail id.
  - `narrow(rails)` gives each rail its `shown` courses and `selectedCount`.
  - `open(rail)` opens the shared `FilterDialog`.
  - The first open reads `GET web-api/v1/masterclass/filter/` (public): every masterclass, then one read per CAIRA
    level. A visitor who never filters makes none.
  - It's route-scoped (`autoProvided: false`), listed on the masterclass route.
- **Its helpers, all inside the masterclass feature:**
  - `models/masterclass-rail-filter.model.ts`: types and `parseFilterPage`;
  - `utils/masterclass-rail-filter.ts`: pure functions;
  - `constants/masterclass.ts`: the `filter/` route and params, the groups, the credit buckets and the empty line;
  - `models/masterclass-library.model.ts`: `MasterclassRail` and `trackRail`.

  The model and the utils import their payload checks from `features/offerings/utils/contract-guards.ts`.

- **`features/home/pages/home/home.ts|html`:**
  - The home page renders the same tracks from the root `MasterclassHomeFacade`, one `app-carousel` per track,
    with no filter.
  - It already opens an offerings dialog through a core token (`MASTERCLASS_COURSE_INFO_DIALOG`), because it may
    not import the offerings feature.
- **The blocker, from AGENTS.md §3 and the `boundaries` lint rule:** `features/home` can't import
  `features/offerings`. A dynamic `import()` counts too. So the filter has to move below both features before home
  can use it.
- **`core/models/masterclass-home.model.ts`:** `MasterclassTrack` lives here, so `MasterclassRail` and `trackRail`
  belong beside it.
- **`shared/services/course-ai-kit.ts`:** a shared service that opens a dialog. This is the shape the filter takes.

## Locked decisions

### PR 1: refactor, no behaviour change

Move the filter below the features:

| From (`features/offerings/…`)                                            | To                                                        |
| ------------------------------------------------------------------------ | --------------------------------------------------------- |
| `masterclass/services/masterclass-rail-filter-facade.ts`                 | `shared/services/masterclass-rail-filter.ts`              |
| `masterclass/utils/masterclass-rail-filter.ts`                           | `shared/utils/masterclass-rail-filter.ts`                 |
| `masterclass/models/masterclass-rail-filter.model.ts`                    | `core/models/masterclass-rail-filter.model.ts`            |
| `MasterclassRail`, `trackRail` (`masterclass-library.model.ts`)          | `core/models/masterclass-home.model.ts`, beside the track |
| the filter's constants and `RAIL_PAGE_SIZE` (`constants/masterclass.ts`) | `core/constants/masterclass.ts`                           |
| `utils/contract-guards.ts`                                               | `core/utils/contract-guards.ts`                           |

1. **The facade becomes a shared service, `MasterclassRailFilter`.** Nothing in `shared/` is a facade (§3). It
   stays `@Service({ autoProvided: false })`, so each page that lists it gets its own selections. Its code doesn't
   change. It still loads `FilterDialog` with `import()`, now from inside `shared/`.
2. **The model goes to `core/models`, because two features will read its types.**
   - The pure helpers go to `shared/utils`, the lowest level that uses them (only the shared service does).
   - The constants go to `core/constants/masterclass.ts`, next to the bookmark route.
3. **`contract-guards.ts` moves to `core/utils`, because the core model imports it.** That's a file move plus each
   importer's path: 8 files in offerings (the webinar ×3, the offerings models ×4, the library model), besides the
   moved filter files. No guard changes.
   - The CAIRA tracker's model keeps its own copy of the guards. Its comment named the old path and gave a reason
     the move makes untrue, so the comment changes. Moving the copies onto the core file is a separate cleanup.
4. **The masterclass page and route only change their imports and the class name.** The page's doc comment names
   `MasterclassRailFilter`.

### PR 2: the feature

5. **The home route lists `MasterclassRailFilter` in its `providers`**, beside `HomeFacade` (`features.routes.ts`,
   the standard `home` route; the UAE CAIRA route has no track rails).
6. **`Home` turns its tracks into rails the same way the masterclass page does:**
   `trackRails = computed(() => railFilter.narrow(home.tracks().map(trackRail)))`. Each carousel renders
   `rail.shown`.
7. **Each home carousel gets the masterclass page's markup, class for class:**
   - the `carouselAction` filter button: icon, count badge, `aria-label`, and disabled while a dialog is on its way;
   - the empty line under a rail its filter empties.

   No new component (reviewer rule: no component without logic).

8. **The home rails keep everything else they have:** `@defer` per rail, the sized placeholder, the image priority
   on the first rail, the info and bookmark buttons.
9. **Selections aren't shared between pages.** Home and masterclass each have their own, like two rails on one page.

### Found while building PR 2

10. **The first rail's image priority is picked by course, not by position.** Home's cards bound
    `[priority]="first && index < 3"`. A filter moves cards in and out of the first three places, and
    NgOptimizedImage throws NG02953 when `priority` changes after the image initialises. The throw cut the carousel's
    update short, and Clear All brought back 12 of 21 cards. `priorityCourseIds` holds the first track's three
    leading course ids, which are the same three images on first load, and never change for a rendered card.
11. **Each rail's carousel and its empty line share a wrapper `<div>`,** as the masterclass page's `<section>` does,
    so the line sits under its rail rather than one list gap below. The wrapper adds no height: the rails measure the
    same as on `master` (414 / 438 / 462 px at 375 / 768 / 1440).
12. **The cost of listing the service on the route:** `features.routes.ts` loads for every page under
    `/:country/:profession`, so its chunk grows by about 1.3 kB gzip (4 kB raw). The initial bundle doesn't change.
    Home and masterclass loaded the service already. Providing it on `Home` instead would keep it off the other
    pages, but its selections would reset on every return to home.

## Endpoint map

| Call                                                          | Verb | When                                             |
| ------------------------------------------------------------- | ---- | ------------------------------------------------ |
| `web-api/v1/masterclass/filter/?content_type=…&page_size=100` | GET  | first filter open on a page, then once per level |

Unchanged from MIL-128. No new route; no `app-api/`.

## Files

**PR 1:**

- the six moves above;
- the import paths in the 8 other `contract-guards` importers, and the tracker model's comment;
- `masterclass-library-facade.ts`;
- the masterclass page and route;
- the feature constants (the moved entries leave);
- `docs/refactor/STATE.md`.

About 250 changed lines across 19 files; git reads the four moves as renames.

**PR 2:**

- `features.routes.ts`;
- `features/home/pages/home/home.ts|html`;
- `docs/refactor/STATE.md`;
- this plan's status.

About 50 changed lines.

## Security

A public read, unchanged, through `ApiClient`. The selection never leaves the browser, and nothing is written.

## Acceptance criteria

**PR 1:**

1. The masterclass page's filter works exactly as before: the icon, the dialog, its groups, the count, narrowing,
   the empty line, one set of `filter/` reads on the first open, and the retry after a failure.
2. `pnpm lint` passes with no new boundary exception. The old files are gone, and nothing imports
   `features/offerings/utils/contract-guards` any more.

**PR 2:**

3. Every track rail on the home page has the filter icon. Opening it shows the same dialog as on the masterclass
   page. Applying narrows that rail only and shows the count.
4. A selection that matches nothing shows "No courses match these filters." under that rail.
5. Clearing the filter brings every card back.
6. The first open on home makes the `filter/` reads; a visitor who never filters makes none.
7. The masterclass page's filter is unchanged.
8. **Layout:** at 375 / 768 / 1440 px the icon sits beside the rail heading as on the masterclass page, with no
   horizontal scroll and no shift when a rail loads.

## Checks

For each PR: `pnpm lint`, `pnpm format:fix`, `pnpm check:structure`, `pnpm build:prod`. Then:

- **Dev (4101), signed out:**
  - the masterclass page's filter, for PR 1;
  - the home page's filter, the empty line and the masterclass page again, for PR 2.
- **Bundle:** the shared service and `FilterDialog` must not enter the initial bundle. The home and masterclass
  chunks pull the service, and the dialog still loads on first open.

## Risks

- **Two pages, two sets of reads.** A visitor who filters on home and then on masterclass makes the `filter/` reads
  twice. That's 1 + 3 small public reads, and a shared cache isn't worth a root singleton here.
- **The home page is signed-out only** (MIL-148). The `filter/` read is public, so that's unaffected.

## Assumptions (please confirm)

1. The home filter is the masterclass page's filter as it is: same groups, same per-rail behaviour.
2. Each page keeps its own selections; a filter set on home doesn't carry to the masterclass page.
