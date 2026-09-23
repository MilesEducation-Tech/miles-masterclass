# Phase 5 — session 4: `home`

Run 2026-09-23 on `refactor/structure-5`. Part A, structure only.
Fourth session of the sequence in [PHASE-05-REMAINING.md](../PHASE-05-REMAINING.md).

## 1. Summary

**17 of the 23 remaining `features -> features` import lines were cleared in this one session.**
`partners -> home` (14 lines across 7 files) and `home -> offerings` (3 lines) are both gone. What
survives repo-wide is `offerings -> payment` (2 lines, surviving Part A by decision) and the
caira/cpe tracker cycle (4 lines, next session).

25 files moved, 11 edited. `features/home/` is now three files plus one component folder.

| Promotion                               | From                                          | To                                   |
| --------------------------------------- | --------------------------------------------- | ------------------------------------ |
| `offerings.{ts,html,css}`               | `home/components/offerings/`                  | `shared/components/offerings/`       |
| `laptop/` (4 files)                     | `home/components/offerings/components/`       | `shared/components/laptop/`          |
| `floating-assets/` (3)                  | `home/components/offerings/components/`       | `shared/components/floating-assets/` |
| `offerings.config.ts`                   | `home/components/offerings/`                  | `core/constants/`                    |
| `micro-learning-hero-phone-mockup/` (4) | `offerings/micro-learning/shared/components/` | `shared/components/`                 |
| `micro-learning-hero-reel-card/` (4)    | `offerings/micro-learning/shared/components/` | `shared/components/`                 |
| `hero-reel-item.model.ts`               | `.../micro-learning-hero/`                    | `core/models/`                       |
| `home.{ts,html,css,spec.ts}`            | `features/home/`                              | `features/home/pages/home/`          |

### The `partner-icons` trap fired for a third time

`micro-learning-hero-phone-mockup.ts:4` imports its sibling `MicroLearningHeroReelCard`, which was
**not** on the move list. Promoting the mockup alone would have created precisely the
`shared -> features` edge the promotion exists to remove. The reel-card has one consumer in the whole
repo — the mockup — so it moved too.

**Every promotion in this refactor so far has had at least one of these.** `partner-icons.ts` in the
first magnet promotion, and now this. The rule that keeps catching it is the same: before promoting a
component, read its own import list, not just its importers'.

The same check cleared `laptop` and `floating-assets` in the other direction — `offerings.ts:5,6`
imports them, so they had to be promoted alongside it rather than left in `home`.

### PROMPT.md section 4.4 is wrong about `laptop` and `floating-assets`

The spec lists them among the "three.js scenes" to defer in Phase 11. **Neither imports `three`,
`gsap`, `lenis`, or `motion`.** `laptop` is `Renderer2` DOM manipulation plus `setTimeout` staggering,
guarded by `isPlatformBrowser`; `floating-assets` is an `input()`-driven template with CSS
`@keyframes`. The only match for "motion" anywhere in that tree is the literal
`prefers-reduced-motion` media query in their stylesheets.

This mattered here rather than being trivia: it is the reason promoting them into `shared/` carried
no eager-bundle risk. The actual three.js consumer near this code is `surround-carousel`, already
behind a `@defer (on viewport)` in `home.html:71-75` — a different component entirely. **Phase 11
should not plan deferral work for `laptop`/`floating-assets` on the strength of that line.**

### The `laptop` re-export chain was preserved, not tidied away

`offerings.ts:12` re-exports `OfferingData`, `FloatingAsset` and `OfferingMockType` from the config,
purely so `laptop.ts:14` can import `OfferingData` from the component file. The auditor confirmed
laptop is the **only** consumer of that re-export, which made deleting it tempting — every other
consumer, including `floating-assets.ts:3` and all 7 partner pages, imports from the config directly.

It was kept. Removing a public export is an API change, and Part A forbids logic changes however
dead the export looks. Both halves were repointed and the explanatory comment updated to name the new
path, so the comment does not become a quiet lie. Worth revisiting in Phase 12 or 14.

## 2. Verification

`verifier` subagent, full run — **8/8 GREEN**.

| Gate            | Result | Time |
| --------------- | ------ | ---- |
| lint            | pass   | 5s   |
| unit tests      | pass   | 22s  |
| build (local)   | pass   | 27s  |
| build (prod)    | pass   | 31s  |
| storybook build | pass   | 23s  |
| format check    | pass   | 14s  |
| bundle report   | pass   | 0s   |
| ssr smoke       | pass   | 4s   |

**Bundle — this was the session's real risk and it did not materialise.** Five component folders were
lifted out of lazy feature chunks into `shared/components/`, and a ~600-line data file into
`core/constants/`. Anything landing in `core/` or `shared/` can be pulled into the eager graph.
Initial is **12 files / 501.5 KB raw / 101.5 KB gzip — identical to baseline, +0.0%**. Lazy
**271 chunks, unchanged**, -0.7 KB raw / -0.2 KB gzip. No chunk created or removed; no chunk in the
top ten moved by more than 0.6 KB.

**SSR smoke** — all four routes match baseline. The `cpacanada` route is the meaningful one: it
renders the promoted `Offering` component and reads `PARTNER_OFFERINGS` from its new `core/constants/`
home, so a 200 with a populated title shows the rewrites resolve at runtime, not just at typecheck.

`reviewer` subagent — **PASS, zero violations.** It independently confirmed the re-export survived and
still resolves, that `partners -> home` and `home -> offerings` are gone, that none of the seven
promoted units introduced a new banned edge, and that no `changeDetection`, `eslint-disable` or
skipped test entered the diff.

**Recorded-baseline check:** clean after the full run.

## 3. Decisions needed / skipped / suspicious

### Correction to a previous report

1. **There are TWO `core -> shared` edges, not one.** The `pages/` dissolution report named only
   `core/services/notification/notification.ts:3`. The reviewer found a second:
   `core/services/update-checker/update-checker.ts:84`, `await import('@shared/dialogs/version-update-dialog/...')`.
   My own sweep missed it because it grepped for `from '@shared/`, and a **dynamic `import()` has no
   `from`**. Both are pre-existing and neither was touched here, but Phase 7's boundary rules will
   flag both — and the dynamic one is the sort a hand-written grep keeps missing. Worth making sure
   the Phase 7 lint config covers dynamic imports, not just static ones.

### Needs your attention

2. **The entangled diff cost real review time again, and this time it produced a false alarm.** The
   reviewer flagged the `video-list-wrapper` / `plan-scrolling-gallery` promotion as an unaccounted
   "fifth unit" needing confirmation before commit. It is **not** unaccounted — it is step 1 of the
   `pages/` dissolution, reported in
   [phase-05-pages-dissolve](phase-05-pages-dissolve.md) section 1. The reviewer could not tell,
   because its import-line changes sit **interleaved in the same partner files** that this session
   also edited (`allinial-global.ts`, `cpa-canada.ts`, and five more). No amount of care in scoping
   the review prompt fixes that; only committing does. **Four units are now uncommitted, and
   `partners` (60 files) is the next session but one.**

### Logged, not fixed (PROMPT.md section 2.7)

3. **`laptop.ssr.notes.ts` is documentation in a `.ts` file.** It exports one inert object,
   `LAPTOP_SSR_COMPATIBILITY`, that nothing imports; the real content is an 85-line comment block
   describing SSR fixes already made in `laptop.ts`. It moved with `laptop/` and is now in
   `shared/components/laptop/`, where it looks even more out of place. Either a `.md` beside the
   component or a doc comment inside `laptop.ts`.
4. **`home.css` and `offerings.css` are both empty** but still wired via `styleUrl` — Phase 12,
   joining the eight empty stylesheets already logged from `library`.
5. **`DEFAULT_OFFERINGS` has no consumer** other than `offerings.ts` itself, where it is the default
   value of the `offerings` input. Not dead, but worth knowing it is a default rather than shared data,
   now that it lives in `core/constants/` alongside the three partner arrays that genuinely are shared.

## 4. Visual QA list

Part A changes no markup; every moved `.html` and `.css` is byte-identical. The risk is runtime
resolution, and this session moved components that render on the most pages of any so far.

**Highest priority — the promoted `Offering` component renders on 8 pages:**

- **`/{c}/{p}/home`** — renders `Offering`, which in turn renders `laptop`, `floating-assets` and the
  promoted `micro-learning-hero-phone-mockup`. This one page exercises four of the seven promotions.
- **All 7 partner landing pages** — `allinial-global`, `cpa-canada`, `ctcpa`, `dscpa`, `hawaii`,
  `mgi-north-america`, `mgi-world`. Each reads a different constant (`PARTNER_OFFERINGS`,
  `MGI_PARTNER_OFFERINGS`, `CPA_CANADA_OFFERINGS`) from the relocated config. Only `cpa-canada` is
  covered by the SSR gate.

**Then:**

- **`/{c}/{p}/micro-learning`** — its hero still renders the phone mockup and reel card, now imported
  from `@shared/`. This is the side of the promotion that stayed behind, and nothing in the SSR set
  covers it.
- On `home`, check the **laptop mock swaps through its offerings** on the rotation interval — that is
  the path through the preserved `OfferingData` re-export, and a broken type import would not
  necessarily fail the build.

## 5. Commit message

```
refactor(structure): phase 5 home, and promote the offerings cluster

Clear 17 of the 23 remaining feature-to-feature import lines.

- promote the offerings cluster out of features/home/, which 7 partner pages
  imported: offerings.{ts,html,css} + laptop/ + floating-assets/ to
  shared/components/, offerings.config.ts to core/constants/
- promote the two magnets home depended on out of offerings/micro-learning/:
  micro-learning-hero-phone-mockup/ and micro-learning-hero-reel-card/ to
  shared/components/, hero-reel-item.model.ts to core/models/
- home.{ts,html,css,spec.ts} to features/home/pages/home/

laptop and floating-assets had to move with offerings.ts, which imports them;
micro-learning-hero-reel-card had to move with the phone mockup for the same
reason. Leaving either behind would have created the shared -> features edge
these promotions exist to remove.

The re-export at offerings.ts, which exists solely so laptop can import
OfferingData from the component file, was preserved and repointed rather than
dropped: removing a public export is an API change.

partners -> home (14 lines / 7 files) and home -> offerings (3 lines) are now
gone. Structure only: no logic, URL, selector or template change. Initial
bundle and lazy chunk count are unchanged from baseline.
```
