---
name: library
description: The learner library of Miles Masterclass v3 — course library with filters, instructor library, and badge library. Read before touching features/library.
---

# Library

The learner's personal collection: saved and in-progress courses, followed instructors, and earned badges. Three sibling pages under one shell.

## Files

```
features/library/
├── library.ts                                   # inline shell component + routes
├── course/
│   ├── course.ts
│   └── shared/
│       ├── services/course-facade/
│       └── components/{course-filters,course-filters-drawer}/
├── instructor/
│   ├── instructor.ts
│   └── shared/services/instructor-facade/
└── badge/
    ├── badge.ts
    └── shared/
        ├── services/badge-facade/
        └── components/{badge-library-hero,badge-spot-animation}/
```

## Routes

```
/:country/:profession_type/library/
  course-library
  instructor-library
  badge-library
```

The shell (`Library` in `library.ts`) is an inline component — `app-backward` + `<router-outlet>` in a container. There is no `/library` index; each child is entered directly from the header menu. Adding one means adding a redirect.

## The three facades

Each page has its own route-scoped facade — `CourseFacade`, `InstructorFacade`, `BadgeFacade`. They don't share state; they're separate collections that happen to live under one nav item. Don't merge them into a "LibraryFacade."

Models: `shared/core/models/library.model.ts`, `library-filters.model.ts`, `badge.model.ts`.

## Filters

`course-filters` (desktop) and `course-filters-drawer` (mobile) drive the same filter state on `CourseFacade`. Two presentations, one source of truth — if you add a filter, add it to the state and both surfaces, never to one component's local state.

`SectionFiltersFacade` (`features/shared/services/section-filters-facade/`) is the shared filter machinery used across offering sections. Check it before writing new filter logic. `dialog/filter-dialog` is the generic filter dialog.

## Badges

`badge-library` shows earned Credly badges with `badge-library-hero` and `badge-spot-animation` (canvas-confetti). Cards come from `shared/components/cards/badge-*`. Claiming happens in the **CPE tracker**, not here — this page displays. See the `cpe-tracker` skill.

## Gotchas

- Bookmarks are toggled through `Utils`, which broadcasts via `FeatureFacade.applyBookmarkChange()`. Calling the bookmark API directly leaves the offering pages showing the old state.
- Every page needs a real empty state — a new user's library is empty by default, and that's the most common first view.
- Facades are route-scoped; keep them out of `providedIn: 'root'`.
- The pages are authenticated. Confirm the guard chain before assuming a user exists.

## Verify

```bash
pnpm start
```

1. Each of the three library routes renders.
2. Course library: filters work on desktop and in the mobile drawer, and they agree.
3. Bookmark a course from an offering page → it appears here; unbookmark here → the offering page updates.
4. Instructor library lists followed instructors and links to instructor detail.
5. Badge library shows earned badges with the animation.
6. Empty states render for a fresh account.
7. 375 / 768 / 1280 — the filter drawer swaps in at mobile.
