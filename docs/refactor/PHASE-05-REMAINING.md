# Phase 5 — remaining work

Written 2026-09-23, after the `dissolve app/pages/` session closed.
Companion to `PLAN.md` §3 "Phase 5", which this refines with counts re-derived from the current tree.
`PROMPT.md` still governs; this only sequences what is left and names the decisions each session needs.

## What is already done

`page-not-found` · `legal`+`compliance` · `connect-us`+`Faq` · `uae-caira` · magnet promotion ·
**dissolve `app/pages/`**. `src/app/pages/` is deleted.

## What is left — 8 units, ~460 files

| #   | Unit                                              | Files | Specs | Stories | Risk    |
| --- | ------------------------------------------------- | ----- | ----- | ------- | ------- |
| 1   | `app/auth/` → `features/auth/`                    | 11    | 1     | 0       | low     |
| 2   | `cpa-landing` + `features/shared/services/tracks` | 8     | 0     | 0       | low     |
| 3   | `library` (3 sub-features)                        | 37    | 7     | 0       | low     |
| 4   | `home` + `blog` normalisation                     | 49    | 1     | 0       | medium  |
| 5   | tracker merge (`caira-tracker`+`cpe-tracker`)     | 54    | 9     | 1       | medium  |
| 6   | `partners`                                        | 61    | 14    | 0       | medium  |
| 7   | `payment`                                         | 84    | 15    | 0       | high    |
| 8   | `offerings` (4 sub-features + shared)             | 150   | 25    | 3       | highest |

294 of those files sit under the 14 remaining feature `shared/` layers; 102 of them are the
26 `shared/pages/*` folders that move up to `pages/*`.

## Correction to the counts above (from the full structural sweep)

The routed-component problem is **16 components, not 12**, and the route-table splits are **7, not 6**
once `payment` is included. Two were missed on the first pass:

- **`features/payment/payment.ts`** — routed at `payment.routes.ts:75`, sits at the feature root.
- **`features/payment/shared/components/overview-wrapper/`** — a routed layout wrapper
  (`payment.routes.ts:80`) living in `components/`. It goes to `payment/pages/overview-wrapper/`,
  not `payment/components/`.

Two further misplacements inside `micro-learning`, both found by the sweep rather than by the folder
names: `shared/components/micro-learning-quiz-dialog/` is a **dialog** sitting in `components/`
(→ `dialogs/`), and `shared/components/micro-learning-hero/hero-reel-item.model.ts` is a **model**
buried in a component folder (→ `core/models/`, since it is also magnet #7).

## Three structural jobs that cut across every session

### A. Dissolve the internal `shared/` layer

14 of them. `shared/components/*` → `components/*`, `shared/pages/*` → `pages/*`,
`shared/services/*` → `services/*`, `shared/{utils,constants}/*` up one level.

### B. Flatten folder-per-service into flat files

§3 says services are flat files. **14 services are currently a folder wrapping one file:**

```
caira-tracker/shared/services/badge-actions/
cpe-tracker/shared/services/{certificate-access-policy,certificate-download,tracker-dialog-orchestrator}/
library/{badge,course,instructor}/shared/services/{badge,course,instructor}-facade/
offerings/shared/services/{chapter,feedback,final-assessment,masterclass,micro-learning-course}-facade/
payment/shared/service/payment-facade/          <- also singular -> plural
features/shared/services/tracks/
```

### C. Route tables — 7 files, and only ONE is a rename

This is the item `PLAN.md` understates. Six of the seven files hold a `@Component` **and** a
`Route[]` in the same file, so they are **splits**, not renames.

| File                                         | Contents                                                    | Action                              |
| -------------------------------------------- | ----------------------------------------------------------- | ----------------------------------- |
| `features/offerings/offerings.ts`            | `Route[]` only                                              | pure rename → `offerings.routes.ts` |
| `auth/auth.ts`                               | `Auth` **layout shell** (`<router-outlet/>`) + `authRoutes` | split                               |
| `features/library/library.ts`                | `Library` **layout shell** + `LibraryRoutes`                | split                               |
| `offerings/masterclass/masterclass.ts`       | `Masterclass` **landing page** + `masterclassRoutes`        | split                               |
| `offerings/podcast/podcast.ts`               | `Podcast` **landing page** + `podcastRoutes`                | split                               |
| `offerings/webinar/webinar.ts`               | `Webinar` **landing page** + `webinarRoutes`                | split                               |
| `offerings/micro-learning/micro-learning.ts` | `MicroLearning` **landing page** + `microLearningRoutes`    | split                               |

The distinction matters for where the component lands. `Auth` and `Library` are pure shells wrapping
a `<router-outlet/>` (verified: `library.ts` has zero `inject`/`signal`/`computed`/`effect`). The
other four are real landing pages routed as `{ path: '', component: X }`. See decision D2.

## Decisions needed before the sessions that hit them

- [x] **D1 — SETTLED 2026-09-23: DELETE the dead cluster.** User approved a narrow exception to the
      standing "dead code: list only, do not delete" rule, for this cluster only.
      **8 files go:** `features/cpa-landing/` (6) and `features/shared/services/tracks/` (2).
      Consequences: `features/shared/` disappears entirely, so the `@features/shared` path segment is
      retired; `features.routes.ts:5` (the `Tracks` import) and `:21` (`providers: [Tracks]`) are
      removed. Evidence on record: `cpa-landing` has zero external references, and
      `cpa-caira-section.ts:30` was the only injector of `Tracks` in the repo.
      **The other 11 dead files are NOT covered by this exception** and still follow the standing rule —
      `blog/pages/blog-list/` (3), `partners/shared/pages/ascpa/` (4),
      `offerings/shared/components/document-chapter/` (4). They get moved like live code.

- [x] **D2 — SETTLED 2026-09-23: shells stay at the feature root; everything else goes to `pages/`.**
      The test is mechanical — **does the component contain a `<router-outlet/>`?** Measured across all
      16 routed components outside `pages/`, it splits them cleanly 4 / 12:

  | Shell (stays at feature root, beside its `.routes.ts`) | router-outlet | lines |
  | ------------------------------------------------------ | ------------- | ----: |
  | `auth/auth.ts`                                         | yes           |    70 |
  | `features/library/library.ts`                          | yes           |    34 |
  | `features/payment/payment.ts`                          | yes           |    70 |
  | `payment/shared/components/overview-wrapper/`          | yes           |    11 |

  The other **12 move to `pages/`**: `home`, `badge`, `course`, `instructor`, `caira-tracker`,
  `course-badges`, `webinar-badges`, `cpe-tracker`, `masterclass`, `podcast`, `webinar`,
  `micro-learning`. All 12 have **no** `<router-outlet/>` and real state (3-16
  `inject`/`signal`/`computed`/`effect` calls each) — they are pages, not layout.

  **One sub-case to decide in the `payment` session:** `overview-wrapper` is a _nested_ shell (the
  layout for a child route at `payment.routes.ts:80`), not the feature's top-level shell, and it
  currently sits in `shared/components/`. "Feature root" is ambiguous for it. Least-surprising
  option is to leave it in `payment/components/` after the flatten — it is not a page, and inventing
  a `layouts/` folder would add a bucket §3 does not define.

- **D3 — tracker merge target shape.** Already agreed in principle:
  `features/tracker/{caira,cpe}/`. Needs confirming that the merge also breaks the circular
  dependency rather than relocating it. **Blocks session 5.**

## The cross-feature edge map (re-derived 2026-09-23, full scan of 398 files)

**There are only 23 genuine `features → features` import lines left, across 5 edges and 4 pairs.**
That is far smaller than the phase's remaining file count suggests, and it means the magnet
promotions are cheap — they were the part most likely to blow up a session.

| Source → Target                 | Lines | Source files |
| ------------------------------- | ----: | -----------: |
| `partners` → `home`             |    14 |            7 |
| `home` → `offerings`            |     3 |            2 |
| `offerings` → `payment`         |     2 |            2 |
| `caira-tracker` → `cpe-tracker` |     2 |            1 |
| `cpe-tracker` → `caira-tracker` |     2 |            1 |

**Twelve features have zero cross-feature edges in either direction**: ai-labs, blog, connect-us,
cpa-landing, faculty, how-to-claim-credly-badge, legal, library, milesverse, page-not-found,
partners (outbound only, to `home`), uae-caira. Their sessions are pure flattening.

Another 23 lines come from `features.routes.ts`, which is the router, not a feature — route wiring
is legal. Three of those are worth noting anyway because they are **eager, not lazy**:
`features.routes.ts:7,8,10` pull the three `legal/pages/*` components directly into the eager graph.

### The 10 magnets, and where each goes

Every one is a single-pair leak (owner + one consumer), which still clears §3's "2+ top-level
features" bar — the same count that justified promoting `app-download` in Phase 4.

| Target                                                           | Kind          | →                                 | Fix in session |
| ---------------------------------------------------------------- | ------------- | --------------------------------- | -------------- |
| `home/components/offerings/offerings.ts` (`Offering`)            | `@Component`  | `shared/`                         | 6 `partners`   |
| `home/components/offerings/offerings.config.ts` (7 consts/types) | plain         | `core/`                           | 6 `partners`   |
| `caira-tracker/…/badge-filter-chips/`                            | `@Component`  | `features/tracker/components/`    | 5 tracker      |
| `caira-tracker/shared/utils/tracker-links.ts`                    | plain         | `features/tracker/utils/`         | 5 tracker      |
| `cpe-tracker/shared/utils/slug.util.ts`                          | plain         | `features/tracker/utils/`         | 5 tracker      |
| `cpe-tracker/shared/utils/course.util.ts`                        | plain         | `features/tracker/utils/`         | 5 tracker      |
| `offerings/micro-learning/…/hero-reel-item.model.ts`             | plain         | `core/models/`                    | 4 `home`       |
| `offerings/micro-learning/…/micro-learning-hero-phone-mockup/`   | `@Component`  | `shared/`                         | 4 `home`       |
| `features/shared/services/tracks/tracks.ts`                      | `@Injectable` | `core/` or `cpa-landing` (**D1**) | 2              |
| `payment/…/payment-facade.ts` (`PaymentFacade`)                  | `@Injectable` | **do not move** (see below)       | —              |

**`PaymentFacade` is the one that must NOT be promoted.** It has 13 importers inside `payment` and
2 outside (both offerings facades). Moving it to `core/` would drag the payment domain into core —
the same error STATE.md already refused for this symbol. Part A forbids the real fix (a narrow
payment API for the two offerings callers), so the `offerings → payment` edge **survives Part A** and
joins the Phase 7 temporary-warning list beside the `utils.ts`/`subscription-dialog` cluster.

### The tracker merge dissolves its cycle exactly

The cycle is 4 import lines in 2 files, eager and static both ways:

- `caira-tracker/shared/utils/badge-action.ts:2,3` → cpe's `TRANSACTION_TO_URL`, `toSlug`
- `cpe-tracker/cpe-tracker.ts:33,34` → caira's `localeLink`, `BadgeFilterChips`

Those four symbols are magnets 3–6 above, and **no other symbol crosses**. Under
`features/tracker/{caira,cpe}/` they move to their nearest common parent — `features/tracker/utils/`
and `features/tracker/components/` (**not** a `features/tracker/shared/`; §3 forbids `shared/`
inside a feature). The cycle is then gone structurally, not relabelled.

### `offerings/shared/` is over-full — four files do not belong there

This is the finding that makes the `offerings` session tractable. Sorted by how many of the four
sub-features actually consume each file:

| Consumers | File                                                                                                             | Action                                                   |
| --------: | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
|         4 | `shared/services/feedback-facade/`, `shared/pages/course-feedback/`                                              | keep at `offerings/`                                     |
|         3 | `shared/pages/final-assessment-{exam,report}/`, `shared/services/{chapter,final-assessment}-facade/`             | keep                                                     |
|         2 | `shared/components/{course-chapter-list,course-resources,video-chapter}/`, `shared/services/masterclass-facade/` | keep                                                     |
|     **1** | `shared/components/audio-chapter/`                                                                               | **push into `podcast/`**                                 |
|     **1** | `shared/components/chapter-quiz/`                                                                                | **push into `micro-learning/`**                          |
|     **1** | `shared/services/micro-learning-course-facade/`                                                                  | **push into `micro-learning/`**                          |
|     **0** | `shared/components/document-chapter/`                                                                            | used only within `shared/` — keep, but verify it is live |

Pushing `micro-learning-course-facade` into `micro-learning/` also **kills the only back-edge inside
offerings**: `micro-learning-course-facade.ts:39` currently imports
`@features/offerings/micro-learning/shared/components/micro-learning-quiz-dialog/…`, i.e. the shared
layer reaching down into a sub-feature. There are **no** masterclass ↔ podcast ↔ micro-learning ↔
webinar direct edges at all; everything else routes through `shared`/`models`/`dialogs`/`services`.

### `library` needs no shared layer at all

**Zero** imports between `library/badge`, `library/course` and `library/instructor`. They are fully
independent; `library.ts` is only their route table. Nothing needs extracting to a `library/shared/`,
and the three `<sub>/shared/services/<x>-facade/` folders just flatten in place.

## Session sequence

Ordered so that **no session creates an edge a later session has to clear** — the mistake the
`uae-caira` session made, which turned six magnets into seven. Each session ends at a green
`verifier` run, a report, and a commit message, per `PROMPT.md` §6.

Per-session step lists are deliberately **not** pre-computed here. `PROMPT.md` §2.4 requires an
`import-auditor` sweep immediately before any move, and that sweep is what produces the file list.
Pre-writing one now would only go stale and invite trusting it over the audit — which is exactly how
the `partner-icons` and `subject.ts` `styleUrls` traps nearly got through.

|   # | Command                       | Scope                                                                                                             | Blocked by |
| --: | ----------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------- |
|   1 | `/refactor-phase 5 auth`      | `app/auth/` → `features/auth/`; split `auth.routes.ts` (`Auth` stays at root); **delete the 8-file dead cluster** | —          |
|   2 | _(folded into 1)_             | `cpa-landing` + `Tracks` + `features/shared/` removed outright                                                    | —          |
|   3 | `/refactor-phase 5 library`   | 3 sub-features; flatten 3 facades; split `library.routes.ts` (`Library` stays at root)                            | —          |
|   4 | `/refactor-phase 5 home`      | normalise `home`+`blog`; promote 2 magnets out of `offerings`                                                     | —          |
|   5 | `/refactor-phase 5 tracker`   | merge both trackers; dissolve the cycle via 4 promotions                                                          | —          |
|   6 | `/refactor-phase 5 partners`  | flatten 60 files; promote the 2 `home/offerings` magnets                                                          | —          |
|   7 | `/refactor-phase 5 payment`   | flatten 64 files; `service/` → `services/`; `Payment` stays at root                                               | —          |
|   8 | `/refactor-phase 5 offerings` | **all 5** shared layers at once, 150 files; 4 route splits; 3 push-downs                                          | —          |

### Why this order

- **1–3 are the cheap ones and they prove the two patterns** the rest depend on: the route-table
  split (`auth`, `library`) and the folder-per-service flatten (`library` ×3). Getting D2 answered
  against an 11-file feature is much better than discovering it wrong inside `offerings`.
- **4 before 6.** `home` is the target of the 14-line `partners → home` edge. Doing `home` first puts
  `Offering`/`offerings.config` in their final `shared/`+`core/` homes, so session 6 rewrites those
  7 partner files **once**. Reversed, session 6 would flatten them and session 4 would rewrite them
  again.
- **4 also clears `home → offerings`** by promoting `hero-reel-item.model` and
  `micro-learning-hero-phone-mockup`, so session 8 inherits an `offerings` with no inbound feature
  edge left to worry about.
- **5 is independent** of everything else — its 4 edges are entirely between the two trackers.
- **8 last**, and it is the one session that must NOT be split the obvious way — see "The hard
  constraint on the `offerings` session" below. 150 files, 25 specs, 3 stories, 5 shared layers,
  4 route-table splits, 3 push-downs, 92 rewrite lines.
- **Session 2 is gone.** D1 was answered "delete", so `cpa-landing`, `Tracks` and `features/shared/`
  are removed outright — 8 files and ~2 lines in `features.routes.ts`. Fold it into session 1.
- **Every session is now unblocked.** D1, D2 and D3 are all settled; nothing needs a further
  decision before session 8.

After session 8: **`src/app/features/` conforms to §3**, and Phase 5 closes with one residual
documented edge (`offerings → payment`, `PaymentFacade`) handed to Phase 7/11.

## Logged, not fixed

- **`offerings/shared/components/document-chapter/` is dead code** — 4 files (incl. a spec), **zero**
  importers and **zero** `app-document-chapter` selector usages repo-wide. Per the standing decision
  "dead code: list only, do not delete", it gets `git mv`'d with the rest of the flatten and stays.
  Verified 2026-09-23.
- **`features.routes.ts:7,8,10` import the three `legal/pages/*` components eagerly**, not lazily,
  unlike every other page route in that file. Not a Phase 5 concern, but a Phase 11 `@defer`/bundle
  one.
- **`payment/shared/service/payment-facade/payment-facade.ts` is 857 lines**, the largest file in
  `features/`. The `service/` → `services/` rename is trivial; that file is not.

## Dead code found (listed, not deleted — standing decision)

**15 files across 4 items**, all verified 2026-09-23 by reference sweep, not by inspection:

| Item                               | Files | Evidence                                                                         |
| ---------------------------------- | ----: | -------------------------------------------------------------------------------- |
| `features/cpa-landing/`            |     6 | zero external refs; `app-cpa-landing`/`app-cpa-caira-section` used nowhere       |
| `features/shared/services/tracks/` |     2 | only injector is `cpa-caira-section.ts:30`, itself dead                          |
| `features/blog/pages/blog-list/`   |     3 | `blog-list.ts` is literally `export {};` with a comment saying it can be deleted |
| `partners/shared/pages/ascpa/`     |     4 | its route is commented out at `partner.routes.ts:20`                             |

Plus `offerings/shared/components/document-chapter/` (4 files, noted above). **19 files total.**
**8 of them are deleted under D1** (`cpa-landing` + `tracks`). The remaining **11 stay** under the
standing "list only" rule and get moved like live code: `blog-list` (3) in the `home`/`blog` session,
`ascpa` (4) in `partners`, `document-chapter` (4) in `offerings`.

## Effort by session, measured

Import lines needing a rewrite, counted per shared layer (`../` inside + `./` siblings + inbound
alias references):

| Layer                      | Rewrite lines |
| -------------------------- | ------------: |
| `library/instructor`       |             1 |
| `cpa-landing`              |             1 |
| `library/badge`            |             3 |
| `library/course`           |             4 |
| `offerings/webinar`        |             7 |
| `cpe-tracker`              |            10 |
| `caira-tracker`            |            18 |
| `offerings/masterclass`    |            19 |
| `offerings/podcast`        |            21 |
| `offerings/shared`         |            22 |
| `offerings/micro-learning` |            23 |
| `partners`                 |            29 |
| `payment`                  |            29 |

Plus **17 `@features/.../shared/` alias references from outside `features/`** — in
`shared/services/utils.ts`, `layout/footer-overlay/footer-overlay.ts`,
`shared/dialogs/subscription-dialog/subscription-dialog.ts` and 10 others. Every session that
flattens a `shared/` layer must sweep these too; they are easy to miss because they live outside the
feature being worked on.

## The hard constraint on the `offerings` session

`offerings/{masterclass,podcast,micro-learning}/shared/**` reach **up** into `offerings/shared/` with
four-level relatives like `../../../../shared/…` (e.g.
`offerings/masterclass/shared/pages/masterclass-course/masterclass-course.ts:11`). Flattening a
sub-feature changes its depth, and flattening `offerings/shared/` changes the target — so doing them
in separate sessions rewrites those lines **twice**, with a window in between where they are wrong in
a way only the build catches.

**All five offerings layers must move in one session** (92 rewrite lines, 150 files). If context runs
out, stop at a green boundary _between_ sub-features, never between a sub-feature and
`offerings/shared/`.

## Two things worth flagging outside the refactor

- **The blog is routed at `path: 'blog-test'`** (`app.routes.ts:33`), top-level and outside the
  `:country/:profession_type` scope, with `BlogLayout`. If `/blog-test` is the real public URL that
  looks like a leftover; if it is not, the blog has no production route. Phase 5 must not change it
  either way — logged for you to confirm before Phase 14 documents the route map.
- **`LibraryRoutes` is PascalCase**, where every other route export is `authRoutes`,
  `offeringsRoutes`, `featuresRoutes`, `PAYMENT_ROUTES`, `AI_LABS_ROUTES`. The repo has two
  conventions (`camelCase` and `SCREAMING_SNAKE`) and this is neither. Renaming it is a one-line
  change in `features.routes.ts:48`, best done during the `library` session's route split.
