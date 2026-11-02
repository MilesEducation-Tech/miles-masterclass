# Bookmark on the masterclass course cards

Status: **approved and implemented (2026-10-27).** See "Changes from the plan" at the end. Ticket: MIL-129. Branch: `feat/MIL-129-course-card-bookmark`.

## Goal

A bookmark icon on every masterclass course card on the masterclass page and the home page: the track rails, signed in
or out, and the signed-in rails (Continue Watching, Recommended For You, Complimentary, Because You Watched, My List,
Courses you've mastered). One click toggles it. Signed out, the click goes to sign-in and back, as the course page's
bookmark does. Signed in, the icon flips at once, every card of that course flips with it, and My List gains or loses
the course.

## What I read

- `shared/components/cards/masterclass-course-card/`: its doc says "Not yet here, deliberately: bookmark (no web route
  in scope)". Its layouts are the shared `app-vertical` / `app-horizontal` designs, class for class.
- `shared/components/cards/vertical|horizontal`: the icon this card copies (top-right, `size-9`, `bg-black/50`,
  `matBookmarkRound` / `matBookmarkBorderRound`, labels "Add bookmark" / "Remove bookmark"). Those cards call an
  older route through `Utils.toggleBookmarkCourse`. Neither they nor that route change here.
- `features/offerings/services/course-detail-facade.ts`: the course page's toggle (sign-in redirect, an optimistic
  flip, `POST`, re-read `course-detail/`).
- `features/offerings/masterclass/services/masterclass-library-facade.ts`: My List is `library/`'s `bookmarked` rail,
  narrowed to masterclasses.
- `core/services/masterclass-home-facade/`: root, holds `tracks-page/` for the home page and the masterclass page.
- `masterclass.routes.ts` and `app.config.ts`: route injectors are never cleaned up (no `withAutoCleanupInjectors`),
  so `MasterclassLibraryFacade` and its `library/` read outlive a visit to the course page.
- Postman `web-masterclass-bookmark-v1` and live UAT (see the endpoint map).

## Endpoint map

| Call                                                | Verb | Auth              | Notes                                                                                                                                                                                                                               |
| --------------------------------------------------- | ---- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web-api/v1/masterclass/bookmark/<course uuid>/`    | POST | `IsAuthenticated` | A toggle, no body. Postman now has a captured 200: `{ success, message: "Bookmarked successfully.", data: { status: "success", bookmarked: true } }`. 404 for an unknown course; 403 with no token. Already in `COURSE_DETAIL_API`. |
| `tracks-page/`, `highlight/`, `filter/`, `ai-labs/` | GET  | —                 | Every card carries `is_bookmarked` (UAT, signed out: all `false`). Postman shows it on `library/`, `instructor-detail/` and `filter-based-masterclass-list/` too.                                                                   |
| `completed-course-section/`                         | GET  | signed in         | No captured body, so `is_bookmarked` is unconfirmed there. The guard treats the key as optional for that reason.                                                                                                                    |
| `library/`                                          | GET  | signed in         | Re-read after a confirmed toggle so My List is the server's.                                                                                                                                                                        |

No new route is invented; no `app-api/`.

## Locked decisions

1. **One root store, in core:** `core/services/masterclass-bookmarks/masterclass-bookmarks.ts`, `@Service()`. Three
   features read the same state (the home page, the masterclass page, the course page), so it can't live in one of them.
   - `isBookmarked(course)`: this visit's answer for that id if there is one, else the card's `is_bookmarked`.
   - `toggle(course)`: signed out, sign-in and back. Signed in, it flips the id at once, `POST`s through `ApiClient`
     (`SKIP_LOADING`: the icon is its own indicator), then keeps the server's `bookmarked`. A failure flips it back
     and toasts. A second click on the same course while its `POST` is in flight is ignored.
   - `record(id, bookmarked)`: for the course page, which keeps its own `POST`.
   - `changed$`: emits after each confirmed change.
   - The answers reset when the session's `isAuthenticated()` changes (`linkedSignal`), so a sign-out never shows the
     previous learner's bookmarks.
2. **The card stays presentational.** New inputs `showBookmark` (default `false`) and `bookmarked`, and a `bookmark`
   output, like `showInfo` / `info`. The page binds `[bookmarked]="bookmarks.isBookmarked(course)"` and
   `(bookmark)="bookmarks.toggle($event)"`.
3. **Where it shows:** the masterclass page (every rail, through the shared `#railTpl`) and the home page's tracks. Not
   the course library or the instructor page: both read signed out (`pre_login`) on purpose, so their `is_bookmarked`
   is always `false` and the icon would lie.
4. **My List follows:** `MasterclassLibraryFacade` subscribes to `changed$` and calls `library.reload()`. `reload()`
   keeps the current rails on screen while it reads. Because the facade outlives a visit to the course page, a
   bookmark made there shows in My List on the way back.
5. **The course page reports to the store:** `CourseDetailFacade.toggleBookmark` keeps its flow and, on success, calls
   `bookmarks.record(course.id, …)`. Without it, the tracks (held by the root `MasterclassHomeFacade`) would show the
   old icon after a bookmark on the course page.
6. **Toast:** "Added to My List" / "Removed from My List" on success, "Bookmark not saved" with "Please try again." on
   failure. The app interceptor shows no error toast, so the store does.

## Files

- **New:** `src/app/core/services/masterclass-bookmarks/masterclass-bookmarks.ts`.
- `src/app/core/constants/masterclass.ts`: `MASTERCLASS_BOOKMARK_ROUTE` (`RouteConfig`) and the toast copy.
- `src/app/core/models/masterclass-home.model.ts`: `MasterclassCourse.is_bookmarked?: boolean`, checked in
  `isMasterclassCourse` when present; `parseBookmarkToggle(raw): boolean` for the `POST`'s `data.bookmarked`.
- `src/app/shared/components/cards/masterclass-course-card/masterclass-course-card.ts|html|stories.ts`: the inputs,
  output and icon in both layouts, plus a `Bookmarked` story. In the horizontal layout the icon sits in a new
  `relative` wrapper beside the artwork link, because a button can't nest inside `<a>`.
- `src/app/features/offerings/masterclass/pages/masterclass/masterclass.ts|html`: inject the store, bind the card.
- `src/app/features/home/pages/home/home.ts|html`: the same.
- `src/app/features/offerings/masterclass/services/masterclass-library-facade.ts`: reload `library/` on `changed$`.
- `src/app/features/offerings/services/course-detail-facade.ts`: `record()` on success.
- `src/app/features/offerings/constants/course-detail.ts`: the `bookmark` entry stays (the course page uses it); only
  its comment changes, since the response is now captured.
- `docs/refactor/STATE.md`.

About 220 changed source lines.

## Security

- The `POST` goes through `ApiClient`; the bearer comes from the interceptor. Nothing hand-attaches a header.
- The path is built from the card's UUID, which came from our own API. No user input reaches the call.
- Signed out, no request is made: the click goes to sign-in.

## Acceptance criteria

1. **Signed out:**
   - every card on the masterclass page and the home page tracks shows the outline icon;
   - a click goes to `/auth/login?redirect=<this page>` and makes no `bookmark/` request.
2. **Signed in, adding a bookmark:**
   - the icon fills at once, then one `POST bookmark/<uuid>/` and one `library/` re-read follow;
   - the course appears in My List;
   - every other card of that course on the page fills too;
   - a toast says "Added to My List".
3. **Signed in, removing one:** the reverse, and the card leaves My List.
4. **If the `POST` fails:** the icon flips back and the error toast shows.
5. **From the course page:** after bookmarking there, the masterclass page and the home page show the filled icon, and
   My List has the course.
6. **Signing out** clears every filled icon that came from this visit.
7. **Not changed:** the course library and instructor cards show no icon; the hero is untouched.
8. **Layout:** the icon doesn't cover the "AI Kit" or Trailer buttons, and there's no horizontal scroll at 375 / 768 / 1440.

## Checks

`pnpm lint`, `pnpm format:fix`, `pnpm check:structure`, `pnpm build:prod`. Then the running app (dev 4101), signed out
against UAT, and signed in with stubbed `library/`, `completed-course-section/` and `bookmark/` answers (I can't sign
in). A real signed-in check on UAT is yours.

## Risks

- **`completed-course-section/` may not send `is_bookmarked`.** The key is optional in the guard, so the rail still
  renders; its cards would show the outline icon until clicked. A signed-in capture settles it.
- **`library/` re-reads after every toggle** (one read, every rail). That's the facade rule (mutate, then reload), and
  it keeps My List's order the server's.
- **The course page and the store hold separate answers.** `record()` keeps the store in step. Moving the course page
  onto the store fully is a separate refactor.

## Assumptions (please confirm)

1. A new root store in `core/services/` is OK. Nothing in core is a facade; this is a small cross-cutting store, like
   `AuthSession`.
2. The home page's tracks get the icon too, since they're the same cards from the same read.
3. The course-info ("i") dialog doesn't get a bookmark button in this ticket; it can follow on the same store.
4. The toast wording: "Added to My List" / "Removed from My List".

## Changes from the plan

- **The course page reads the store too.** Its `isBookmarked` is now its own toggle, then the visit's answer from a
  card, then `course-detail/`'s. Without it, a course bookmarked from a card and opened later in the same visit could
  show the old state, because its `course-detail/` read may be cached.
- **One toast for every confirmed bookmark.** The success toast lives in `MasterclassBookmarks.record()`, so the
  course page's Bookmark button shows the same "Added to My List" / "Removed from My List" as the cards. The course
  page also toasts "Bookmark not saved" on failure, which it never did before.
- **The in-flight list is a plain `Set`.** Nothing renders it, so it doesn't need to be a signal.
- **Size:** about 260 changed source lines, 115 of them the new store.
