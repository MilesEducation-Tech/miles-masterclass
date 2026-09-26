# Phase 9 — Data layer · `features/partners`

Date: 2026-09-26 · Branch: `refactor/structure-10`. **No source changes: nothing in this row converts under §4.2.**

## 1. Summary

- **The partner pages have no data calls of their own.** All 11 are static compositions of `partnership-content`
  plus presentational panels. The reviewer grepped every file in the feature.
- **`components/partnership-content` stays on RxJS, on purpose.** Its reads have a cardinality known only at runtime:
  - **Library sections:** one infinite-scroll list **per entry of the `content` input** (`fetchPage` / `fetchByType`
    / `fetchCourseLibrary`, ~231–284).
  - **TRACKS:** `tracks/` GET, then a `forkJoin` of one content GET **per track**, plus per-track paging
    (`loadTracks` ~185–218, `loadMoreTrack` ~151–179).

  This is the case [phase-09-core-shared](phase-09-core-shared.md) §1.4 kept on RxJS for `FeatureFacade`'s track
  fan-out: one `httpResource` is one request, and N is only known at runtime. The reviewer judged extending that
  precedent to the whole component consistent. Here the library branch has the same unknown-N problem, where the
  FeatureFacade's non-track branch, a single list, did not.

- **The upgrade path, logged:** one child component per section, each owning its own `httpResource`. That is a
  component/template split with visual risk on every partner page, so it is not a data-layer swap. It fits Phase 13
  (partner landing consolidation, if approved) better than this phase.

## 2. Verification

- **Gates:** `src/` is byte-identical to the tree verified for the `features/auth` close
  (`git diff 4a22760 HEAD -- src` is empty; the commits since are docs only). That run was
  `node scripts/refactor/verify.mjs`, local macOS / Node 24.15, **8/8 green** (184 files / 672 passed + 1 skipped,
  initial 88.8 KB gz, SSR smoke 4 of 4 routes including the CPA Canada partner page). It was not re-run for this
  docs-only close.
- **`reviewer`** (an audit, no diff): **PASS, no conversion needed**, on all three claims: the static pages, the
  RxJS carve-out, and leaving the bug logged.

## 3. Decisions needed / skipped / suspicious

- **Decision raised (not blocking): fix the `partnership-content` null-body crash?** In `fetchPage`'s subscribe
  (~245), `res.data ?? []` throws when the response body is null (an empty or 204 answer), before the fallback runs.
  - It was logged in an earlier session and stays logged here. §2.7 says log, not fix, and nothing in this row is
    converting, so there is no new resource code to guard.
  - The reviewer agreed this is distinct from the Phase 9 guard fixes, which were made as part of converting reads.
  - Proposed fix: `res?.data ?? []`, plus the same guard in `loadMoreTrack`, as its own `fix(partners)` commit.
- **Follow-up, logged:** the per-section child component (§1), for Phase 13 or later.
- No `@Injectable`, no CSS, and no heavy-library service.

## 4. Visual QA list

None: nothing changed.

## 5. Commit message

```
docs(refactor): close Phase 9 for features/partners (RxJS fan-out kept)

The partner pages are static compositions; partnership-content's reads
are N lists + a tracks fan-out with N known only at runtime, which stay
on RxJS per the FeatureFacade track precedent. Audit PASS; unchanged
src/ is the tree already verified 8/8 green.

Phase 9 (data layer), features/partners.
```
