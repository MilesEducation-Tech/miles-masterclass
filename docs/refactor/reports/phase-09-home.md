# Phase 9 — Data layer · `features/home`

Date: 2026-09-26 · Branch: `refactor/structure-10`. **No source changes: this row was already compliant.**

## 1. Summary

`features/home` has two source files, and neither makes a data call of its own.

- **`pages/home/home.ts`** reads only through `FeatureFacade.getResource('track' | 'premiere' | 'comingSoon',
'masterclass')` (`home.ts` 49, 72–74). That facade was converted in Phase 9 core/shared:
  - its list reads are an `httpResource`, guarded inside the facade;
  - its `track` fan-out stays on RxJS, by the approved decision in phase-09-core-shared §1.4.
  - The page reads only the facade's derived signals (`items()`) and calls its methods (`loadNextPage`,
    `loadNextTrackPage`, `setTrackFilters`).
  - It never touches a raw resource, so there is no unguarded `.value()` and no manual loading or error flag.
- **`components/home-hero`** makes no data calls. It uses static S3 media URLs and opens the app-download dialog on
  click.

The page's loading UI is its existing `@defer` blocks and skeleton placeholders, and there was never a manual flag to
replace. §4.2's "render `isLoading()`/`error()` explicitly" applies to components that consume a resource directly.
This page consumes a facade's already-guarded signals, the same pattern accepted in the library and tracker rows.

## 2. Verification

- **Gates:** `src/` is byte-identical to the tree verified for the `features/auth` close
  (`git diff 4a22760 HEAD -- src` is empty; the only commit in between is docs). That run was
  `node scripts/refactor/verify.mjs`, local macOS / Node 24.15, **8/8 green**:
  - 184 files / 672 passed + 1 skipped;
  - initial 88.8 KB gz;
  - SSR smoke 4 of 4 routes.

  It was not re-run for this docs-only close; the result would be the same tree's.

- **`reviewer`** (an audit against §4.2, not a diff review): **PASS, no conversion needed**, with the file:line
  evidence above.

## 3. Decisions needed / skipped / suspicious

- **No decision needed.**
- The home page's data layer lives in `FeatureFacade` (core). Its remaining RxJS path (`track`) is the documented
  exception, not debt owned by this row.

## 4. Visual QA list

None: nothing changed.

## 5. Commit message

```
docs(refactor): close Phase 9 for features/home (already compliant)

Home reads only through FeatureFacade.getResource(), converted in
Phase 9 core/shared; the hero makes no data calls. Audit PASS; the
unchanged src/ is the tree already verified 8/8 green.

Phase 9 (data layer), features/home.
```
