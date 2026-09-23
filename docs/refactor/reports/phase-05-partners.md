# Phase 5 — session 6: `partners`

Run 2026-09-23 on `refactor/structure-5`. Part A, structure only.
Sixth session of the sequence in [PHASE-05-REMAINING.md](../PHASE-05-REMAINING.md).

## 1. Summary

A pure internal `shared/` dissolution. Nothing left the feature.

```
partners/shared/components/{for-firms-panel,for-partnership-tabs,
                            partner-level-panel,partnership-content}/  ->  partners/components/
partners/shared/pages/<12 partner landing pages>/                      ->  partners/pages/
partners/partner.routes.ts                                             ->  unchanged location
```

**61 files touched. 60 are `R100` renames with zero content diff. One file changed: `partner.routes.ts`.**
The reviewer confirmed this by comparing raw blob SHAs, not just similarity scores.

Feature `shared/` layers repo-wide: **7 -> 6** (230 -> 170 files).

### Why a 60-file session cost one edited line

The eleven partner pages contain 18 relative imports of the shape
`../../components/<name>/<name>`. Under the old layout, `shared/pages/<page>/` and
`shared/components/<name>/` are siblings under `shared/`. Under the new one, `pages/<page>/` and
`components/<name>/` are siblings under `partners/`. **Dropping a symmetric layer from both sides
preserves the distance exactly**, so all 18 are byte-identical before and after.

Only `partner.routes.ts` needed editing, because it stays at the feature root while its targets move
up: 11 active lazy specifiers went `./shared/pages/…` -> `./pages/…`.

The value of establishing that in advance is not the saved keystrokes. **Rewriting those 18 imports
"to be safe" would have broken all 18** — and typecheck would have caught it, but only after an
otherwise clean session turned into a debugging one.

### `ascpa/`, and an accident worth recording

`ascpa/` is a dead page: its route is commented out in `partner.routes.ts`. Under the standing "list
dead code, do not delete" rule it moved like live code, all four files `R100`.

Its commented-out specifier already read `./pages/ascpa/ascpa` — **not** `./shared/pages/ascpa/ascpa`
— and was deliberately not edited. It was wrong before this move and is correct after it, by
accident. Whoever uncomments it will now get a working route; before today they would not have.

## 2. Verification

`verifier` subagent, full run — **8/8 GREEN**.

| Gate            | Result | Time |
| --------------- | ------ | ---- |
| lint            | pass   | 8s   |
| unit tests      | pass   | 21s  |
| build (local)   | pass   | 24s  |
| build (prod)    | pass   | 24s  |
| storybook build | pass   | 19s  |
| format check    | pass   | 14s  |
| bundle report   | pass   | 0s   |
| ssr smoke       | pass   | 6s   |

**The SSR gate exercised this session directly — the first time in five sessions.**
`/us/accounting/partners/cpacanada` is one of the four smoke routes, and it served **200 with a real
title** after the move. The `library`, `home`, `tracker` and `auth` sessions all had zero smoke
coverage of the code they touched; here the strongest gate actually applied.

**Bundle.** Initial **12 files / 501.5 KB raw / 101.5 KB gzip — identical to baseline, +0.0%**.
Lazy **271 chunks, unchanged**: all twelve partner pages stayed separate lazy chunks, none fused.

All 14 spec files in the moved tree pass; the reviewer confirmed none retains a `shared/` path
segment.

`reviewer` subagent — **PASS, zero violations.** It verified the blob-SHA identity of all 60 renames,
that `partner.routes.ts` is the only content change and that its diff is import-path-only, that every
route `path` value is byte-identical, and that `src/seo.ts`, `src/legacy-redirects.ts` and
`layout/footer/footer.ts` — which all carry partner URL strings — show no diff at all.

**Recorded-baseline check:** clean.

## 3. Decisions needed / skipped / suspicious

### Correction to what I have been reporting

1. **I have been under-counting the banned edges, because I was only ever sweeping `core/` and
   `shared/`.** The reviewer swept `layout/` too and found an edge I had never looked for. My claim
   that "only two banned edges remain repo-wide" was true of **`features -> features`** specifically,
   which is the number Phase 5 set out to reduce — but it is not the whole boundary picture. The
   complete census, all pre-existing, none introduced by this session:

   | Class                    | Count | Locations                                                                          |
   | ------------------------ | ----: | ---------------------------------------------------------------------------------- |
   | `core -> shared`         |     2 | `notification.ts:3` (static), `update-checker.ts:84` (**dynamic**)                 |
   | `shared -> features`     |     4 | `subscription-dialog.ts:5,6`, `utils.ts:48` (static), `utils.ts:767` (**dynamic**) |
   | **`layout -> features`** | **1** | **`footer-overlay.ts:22`** — newly found                                           |
   | `features -> features`   |     2 | `masterclass-facade.ts:29`, `micro-learning-course-facade.ts:40`                   |

   **Nine lines, and six of them import `PaymentFacade`.** That is the single biggest boundary
   problem in the codebase, and it is not a Phase 5 problem — every one of the six is outside the
   feature being restructured. Phase 7 will surface all nine; Phase 11 was already assigned the
   `utils.ts` and `subscription-dialog` pair. **`footer-overlay.ts:22` is not assigned to anything
   yet** and should be added to whichever list gets the `PaymentFacade` cluster.

   Two of the nine are **dynamic `import()`**, which a `from '@…'` grep cannot see. Phase 7's lint
   configuration must cover dynamic imports or it will report seven.

### Logged, not fixed (PROMPT.md section 2.7)

2. **All 12 partner page `.css` files are 0 bytes** and still wired via `styleUrl`; the two component
   CSS files have content. Phase 12 item, joining the ones logged from `library`, `home` and
   `tracker`.
3. **`partners/pages/mgi-world`, `mgi-north-america` and `allinial-global` are missing from
   `src/seo.ts` STATIC_PATHS**, while the other nine partner routes are present. `footer.ts` links to
   all three. Pre-existing and unrelated to this move, but it means three live partner landing pages
   are absent from the prerender/sitemap list.
4. **`partners` has no `.stories.ts` files at all**, despite twelve near-identical landing pages —
   relevant to the Phase 13 consolidation decision, which would benefit from visual regression cover.

## 4. Visual QA list

Every moved file is byte-identical and the one edited file only changed lazy import paths. The SSR
gate covers `cpacanada`; the other eleven pages are unverified by any gate.

- **All 11 partner landing pages not covered by SSR**: `/caira`, `/cpe-for-corporate`, and under
  `/partners/`: `boomer-knowledge-network`, `connecticut-society-of-cpas`,
  `delaware-society-of-cpas`, `illinois-society-of-cpas`, `hawaii-society-of-cpas`, `mgi-world`,
  `mgi-north-america`, `allinial-global`. Each is a separate lazy `loadComponent` whose specifier
  changed, so a broken one fails at navigation, not at build.
- **`bkn`, `corporate` and `illinois` first** — they are the three pages that import the most sibling
  components (`for-partnership-tabs`, `for-firms-panel`, `partner-level-panel`,
  `partnership-content`), so they exercise the unchanged `../../components/…` relatives most heavily.
  If the symmetric-layer reasoning were wrong, these break first.
- **`/caira`** — renders `partnership-content`, `caira-feature-grid` and `caira-steps-grid`, the
  widest component mix in the feature.

## 5. Commit message

```
refactor(structure): phase 5 partners

Dissolve the internal shared/ layer in features/partners/.

- shared/components/{for-firms-panel,for-partnership-tabs,
  partner-level-panel,partnership-content}/ -> components/
- shared/pages/<12 partner landing pages>/ -> pages/
- partner.routes.ts stays at the feature root; its 11 active lazy
  loadComponent specifiers change ./shared/pages/... -> ./pages/...

60 of the 61 files are pure renames with zero content diff. The 18
../../components/... relative imports inside the pages did not need rewriting:
pages/ and components/ were siblings under shared/ and are siblings under
partners/, so dropping one symmetric layer preserves the distance exactly.

ascpa/ is a dead page (its route is commented out) and was moved like live
code rather than deleted. Its commented-out specifier already read
./pages/ascpa/ascpa and was left untouched.

Structure only: no logic, URL, selector or template change. Every partner route
path is byte-identical and seo.ts, legacy-redirects.ts and footer.ts are
untouched. Initial bundle unchanged; all 12 partner pages remain separate lazy
chunks.
```
