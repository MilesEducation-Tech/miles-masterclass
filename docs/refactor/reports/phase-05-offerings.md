# Phase 5 — session 8: `offerings` (final)

Run 2026-09-23 on `refactor/structure-5`. Part A, structure only.
The last session of Phase 5.

## 1. Summary

**No `shared/` layer remains anywhere under `src/app/features/`.** That was Phase 5's structural
goal: 14 layers holding 294 files when the remaining-work plan was written, now zero.

This session did five of those layers at once, because they could not be split:

```
offerings/shared/{components,pages}/                 -> offerings/{components,pages}/
offerings/shared/services/<x>-facade/<x>-facade.ts   -> offerings/services/<x>-facade.ts   (x5, flat)
{masterclass,micro-learning,podcast,webinar}/shared/{components,pages}/ -> <sub>/{components,pages}/
```

Plus four route-table splits and one rename:

```
<sub>/<sub>.ts (a @Component AND a Route[])  ->  <sub>/pages/<sub>/<sub>.ts  +  <sub>/<sub>.routes.ts
offerings/offerings.ts                       ->  offerings/offerings.routes.ts
```

**87 files `R100`, 30 with import-only changes, 4 splits, 1 rename. ~65 specifiers rewritten.**

### Why all five layers had to move together

`masterclass`, `micro-learning` and `podcast` reach **up** into the parent's `shared/` with
four-level relatives like `../../../../shared/services/masterclass-facade/masterclass-facade`.
Flattening a sub-feature changes the source depth; flattening `offerings/shared/` changes the target.
Doing them in separate sessions would have rewritten those ~92 lines **twice**, with a window in
between where they were wrong in a way only the build catches.

The arithmetic: the source loses one segment and the target loses one, so `../../../../shared/X`
becomes `../../../X` — the up-count drops rather than staying put. That is the opposite of the
`partners` and `payment` cases, where dropping a symmetric layer left relatives untouched. **Both
results come from the same rule** — a relative import survives only if both endpoints move by the
same amount — and here they did not, because the source moved and the target moved _and collapsed_.

### The mistake I made, and what it teaches

The regex flattening `services/<x>-facade/<x>-facade` -> `services/<x>-facade` also matched
**`@core/services/feature-facade/feature-facade`** — a core service never in scope — collapsing it in
four files. Typecheck caught it immediately; it was restored and all import sites verified intact,
independently confirmed by the reviewer.

The pattern was `services/([a-z-]+-facade)/\1`. **It is path-agnostic**: it matches any
folder-per-service layout anywhere in the repo, including in `@core/` and `@shared/`. A bulk rewrite
during a move must be anchored to the directory being moved, or it reaches outside it. The file list
passed to `grep -rl` was scoped correctly; the _pattern_ was not, and the pattern is what decided
which lines inside those files changed.

Worth noting this is the only time in eight sessions that a rewrite touched something outside the
session's scope, and it was caught by the cheapest gate in under ten seconds.

### Staging restored the splits' git history

A split cannot be a git rename — one file becomes two. The four component halves first appeared as
delete+add, losing history. After `git add`, git pairs them at **R058-R070**, with the new
`.routes.ts` as the added half, and the `.html`/`.css`/`.spec.ts` all `R100`.

The reviewer independently hit the same effect from the other side: a _pathspec-restricted_
`git diff -M` broke rename detection for these files, and only an unrestricted diff paired them.
**Stage split outputs before review, and review splits with an unrestricted diff.**

## 2. Verification

`verifier` subagent, full run — **8/8 GREEN**.

| Gate            | Result | Time |
| --------------- | ------ | ---- |
| lint            | pass   | 5s   |
| unit tests      | pass   | 17s  |
| build (local)   | pass   | 26s  |
| build (prod)    | pass   | 30s  |
| storybook build | pass   | 20s  |
| format check    | pass   | 14s  |
| bundle report   | pass   | 0s   |
| ssr smoke       | pass   | 3s   |

152 test files, 443 passed / 1 pre-existing skip. 25 specs and 3 stories live in this tree.

**Bundle — the number that mattered most this session.** This changed lazy-loading structure more
than any other: four sub-feature route tables became separate modules from their landing-page
components, and every `loadComponent`/`loadChildren` specifier in the tree moved. **Lazy chunks:
271, unchanged. No chunk created or removed. No chunk moved by more than 0.6 KB.** Initial bundle
identical to baseline, +0.0%.

**SSR smoke** — all four routes match baseline, including
`/us/accounting/masterclass/154/adulting-in-business`, which exercises the masterclass route table
this session split.

`reviewer` subagent — **PASS, zero violations.** It verified all four component class bodies are
byte-identical to before the split, that each `Route[]` differs only in specifiers, that no import
was stranded or missing, that all 29 `path:` values across the five route tables are byte-identical,
that `src/seo.ts` / `src/legacy-redirects.ts` / `src/app/app.routes.server.ts` show zero diff, and
that every `@core/services/feature-facade/feature-facade` site is intact.

**Recorded-baseline check:** clean.

## 3. Decisions needed / skipped / suspicious

### Phase 5 is structurally complete

Everything the phase owed is done: `app/pages/` deleted, `app/auth/` moved, all 14 internal `shared/`
layers dissolved, `payment/shared/service/` renamed and flattened, the tracker merge, the route-table
extractions (PLAN.md named four; eight were done), and the `home` normalisation. `blog` needed no
work — it was already the reference shape.

**What Phase 5 did NOT fix, and never claimed to:** the nine banned import edges. Six of them are
`PaymentFacade`. They are all outside the features being restructured, and Phase 7 owns them:

| Class                  | Count | Locations                                                                 |
| ---------------------- | ----: | ------------------------------------------------------------------------- |
| `core -> shared`       |     2 | `notification.ts:3`, `update-checker.ts:84` (**dynamic**)                 |
| `shared -> features`   |     4 | `subscription-dialog.ts:5,6`, `utils.ts:48`, `utils.ts:767` (**dynamic**) |
| `layout -> features`   |     1 | `footer-overlay.ts:22`                                                    |
| `features -> features` |     2 | `masterclass-facade.ts:29`, `micro-learning-course-facade.ts:40`          |

**Two of the nine are dynamic `import()`.** Phase 7's lint configuration must cover dynamic imports
or it will report seven and quietly miss two.

### Logged, not fixed (PROMPT.md section 2.7)

1. **`offerings/components/document-chapter/` is dead** — 4 files, zero importers, zero selector
   usages. Confirmed in an earlier session and unchanged; it moved like live code under the standing
   "list dead code, do not delete" rule.
2. **The back-edge survives, legally.** `offerings/services/micro-learning-course-facade.ts` imports
   `../micro-learning/components/micro-learning-quiz-dialog/…` — a parent reaching into its own
   sub-feature. Section 3 does not ban that, and the reviewer confirmed it. The PHASE-05-REMAINING
   plan suggested pushing the facade down into `micro-learning/` to remove it; that was **not done**,
   because it is a placement refinement rather than a `shared/` dissolution and would have added risk
   to the largest session of the phase. Still available as a small follow-up.
3. **Three push-downs from the plan were likewise skipped** for the same reason: `audio-chapter` ->
   `podcast/`, `chapter-quiz` -> `micro-learning/`, and the facade above. Each has exactly one
   consuming sub-feature, so section 3's placement rule would move them down. None is a violation
   where it sits.
4. **`webinar` has no `webinar.spec.ts`**, unlike the other three sub-features, so its split is the
   one with no test covering the landing page.

## 4. Visual QA list

Every hunk is an import change; all templates and stylesheets are byte-identical. But this session
touched the routing structure of the app's largest feature, and only one offerings route is in the
SSR smoke set.

**The four landing pages, whose components and route tables are now separate modules:**

- `/{c}/{p}/masterclass`, `/{c}/{p}/podcast`, `/{c}/{p}/webinar`, `/{c}/{p}/micro-learning`.
  If a split went wrong, the landing page fails to load while the child routes still work — an
  unusual failure shape worth recognising.

**Then the deep routes, which exercise the flattened facades and cross-layer imports:**

- **A masterclass course -> a chapter** — `masterclass-course` and `masterclass-chapter` both reach
  three levels up into `offerings/components/` and `offerings/services/`. Only the course page is in
  the SSR set.
- **A podcast course -> a chapter** — the only consumer of `audio-chapter`.
- **A micro-learning course** — opens `micro-learning-quiz-dialog`, which is the back-edge target and
  reaches back into the parent's `components/chapter-quiz`.
- **A final assessment: exam -> report -> feedback** — the three pages that moved from
  `offerings/shared/pages/` and are lazy-loaded from all four sub-feature route tables. Feedback is
  reachable from every one of them.

## 5. Commit message

```
refactor(structure): phase 5 offerings

Dissolve the last five shared/ layers. No shared/ layer now remains anywhere
under src/app/features/.

- offerings/shared/{components,pages}/ -> offerings/{components,pages}/
- offerings/shared/services/<x>-facade/<x>-facade.ts(+spec) ->
  offerings/services/<x>-facade.ts, five facades flattened to flat files
- {masterclass,micro-learning,podcast,webinar}/shared/{components,pages}/ ->
  <sub>/{components,pages}/
- split the four <sub>.ts files that held both a @Component and a Route[]:
  component to <sub>/pages/<sub>/, route table to <sub>/<sub>.routes.ts
- offerings.ts -> offerings.routes.ts

All five layers had to move in one change: the sub-features reach up into the
parent's shared/ with ../../../../shared/..., so flattening them separately
would rewrite those lines twice.

Structure only: no logic, URL, selector or template change. All 29 route path
values across the five route tables are byte-identical. Initial bundle
unchanged and lazy chunk count still 271, despite four route tables becoming
separate modules from their landing-page components.
```
