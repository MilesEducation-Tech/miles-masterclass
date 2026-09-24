# Phase 8 — Services (`@Injectable` → `@Service()`)

Part B, first modernization phase. Run as **one session over the whole repo** on the user's scope
decision (recorded in STATE.md "Decisions"), not twelve per-feature sessions.

## 1. Summary

**100 files changed: 82 modified, 16 renamed, 2 deleted** (+243 / −347, net **−104 lines**) — the
multi-line decorators collapsing to one line, plus the two deletions. Excludes the build-generated
`public/version.json` and `core/version/app-version.ts`, which were restored to HEAD rather than
committed, per STATE.md's standing note.

### Three of PROMPT.md §5 Phase 8's four bullets were already no-ops

Verified against the tree rather than taken from PLAN.md's Phase-0-era claims:

| Bullet                                    | State on arrival                                                   |
| ----------------------------------------- | ------------------------------------------------------------------ |
| 1. constructor injection → `inject()`     | **no-op** — zero constructor-parameter DI in `src/`                |
| 2. `@Injectable` → `@Service()`           | **the work** — 60 files                                            |
| 3. class interceptors/guards → functional | **no-op** — 3 `HttpInterceptorFn`, 24 functional guards, 0 classes |
| 4. lint rule banning `Injectable`         | done, with an empty allowlist (see §3)                             |

PLAN.md §4 called bullets 1 and 3 no-ops at Phase 0 and was right; this phase re-checked rather than
assuming, because the tree has moved through six structural phases and a webinar port since.

### The conversion: 60 files, three shapes, zero residue

The edit surface was fully enumerated before a single edit — `grep` accounted for all 60 occurrences
with nothing left over, so nothing was discovered mid-flight:

| Shape (exact)                              | Count | Became                              |
| ------------------------------------------ | ----- | ----------------------------------- |
| `@Injectable({ providedIn: 'root' })`      | 24    | `@Service()`                        |
| `@Injectable({\n  providedIn: 'root',\n})` | 20    | `@Service()`                        |
| `@Injectable()`                            | 16    | `@Service({ autoProvided: false })` |

Repo totals after: **48 `@Service()`** (44 new + 4 pre-existing) and **22 `@Service({ autoProvided:
false })`** (16 new + 6 pre-existing), **0 `@Injectable`**. A 23rd `autoProvided: false` string exists
and is a pre-existing doc comment in `auth-facade.ts:60`, not a decorator — reconciled explicitly
rather than left as an unexplained off-by-one.

### Why no `@Injectable` was kept

Verified from the **installed** `@angular/core` 22.0.8 typings and runtime, not from memory:

- `ɵɵdefineService` sets `providedIn: opts.autoProvided === false ? null : 'root'`. So bare
  `@Service()` **is** `providedIn: 'root'`, and `@Service({ autoProvided: false })` **is** bare
  `@Injectable()` (which also compiles to `providedIn: null`). Behaviourally identical, not merely
  similar.
- `@Service` can express only `autoProvided` and `factory` — not `useClass` / `useValue` /
  `useExisting` / `useFactory` / `deps`, and not `providedIn: 'platform' | 'any' | <NgModule>`.
- **The repo uses none of those.** Zero `InjectionToken` declarations, zero `multi: true`, zero
  `providedIn` other than `'root'`. Every `useClass`/`useValue` hit in the repo is a spec or a story
  providing a mock _against the service class as its token_ — which keeps working untouched, because a
  `@Service` class is still a perfectly valid DI token.
- `Service` is `@publicApi` with no experimental or developer-preview tag.

AOT's own constraints were checked, not assumed: no constructor DI (there is no inheritance among
services at all, so the "walks base classes" rule is moot), no second Angular decorator on any of the
60, no static `ɵprov`, every decorator called with parens and a boolean literal.

There is **no official migration schematic** — `@angular/core/schematics/migrations.json` ships 8 v22
migrations and none touches `Injectable` — so this was hand-rolled, which PROMPT.md §7 requires anyway.

### The one risk, and how it was closed

The 44 root conversions are zero-risk: a wrong result fails loudly. The **16 scoped** ones fail
**silently** — drop `autoProvided: false` and the class quietly becomes a root singleton instead of
route-scoped, and nothing throws. That matters most where `Dialog` hands a caller's
`EnvironmentInjector` to a dialog so it can reach a route-scoped facade (`dialog.ts:33-39,192`);
9 call sites depend on it.

Two mitigations, both mechanical:

1. The conversion was **shape-driven** — a bare `@Injectable()` is the only input that can produce
   `autoProvided: false` — so the two groups could not cross-contaminate.
2. The exact 16-file list was pinned **before** the edit and diffed against the result afterwards:
   **exact match, zero drift.**

All 16 were also audited to a specific `providers:` line each, so none is a dead service: 10 admin
facades (9 in `admin.routes.ts`, 1 in a component's `providers`), 5 offerings facades, and
`UaeCairaFacade` at `features.routes.ts:36`.

### Step 0 — Part A naming cleanup (pulled in on the user's decision)

`location.service.ts` violated PROMPT.md §1 outright and this phase edits its decorator anyway, so the
whole suffix family was cleaned **first, as its own verified step**, keeping the Part A move separable
from the Part B rewrite (PROMPT.md's "never mix the two").

Targets were settled by the installed `@schematics/angular` 22.0.8, not by taste — and they match the
repo's already-correct files (`can-deactivate-exam-guard.ts`, `duration-pipe.ts`, `safe-html-pipe.ts`):

| Kind      | Schematic                     | Rename                                 | Count |
| --------- | ----------------------------- | -------------------------------------- | ----- |
| guard     | `typeSeparator` default `"-"` | `x.guard.ts` → `x-guard.ts`            | 10    |
| pipe      | `typeSeparator` default `"-"` | `x.pipe.ts` → `x-pipe.ts`              | 2     |
| directive | `type` has **no default**     | `x.directive.ts` → `x.ts`              | 1     |
| service   | `type` has **no default**     | `location.service.ts` → `location.ts`  | 1     |
| specs     | follow their subject          | `onboarding.guard.spec.ts` → `-guard.` | 2     |

`import-auditor` found **150 references, 30 of them load-bearing import specifiers**. The rewrite
changed **exactly 30** — matching the audit precisely, which is the check that the sweep was complete.
All 16 landed as git `R` (renames), so history is intact. No suffixed file remains anywhere in `src/`.

One stale in-code comment (`onboarding-guard.ts:13`, naming its own spec file) was corrected. Stale
mentions inside historical `docs/refactor/reports/*` were **left alone** — they are a record of what
was true then, not documentation to keep current.

### The lint rule (bullet 4)

One entry added to the existing `@typescript-eslint/no-restricted-imports` `paths` array in
`eslint.config.mjs`, beside the `@angular/common` and `@angular/aria` bans — 21 lines, most of them the
comment explaining what would justify an exception.

**Proved with a canary before being trusted**, following the Phase 7 and `app-api/` precedents: a
temporary file importing `Injectable` took lint **8 → 9**, the error landed on column 10 (the
`Injectable` specifier itself), a control importing `Service` from the _same_ statement stayed silent —
confirming the rule is specifier-scoped, not statement-scoped — and deleting the canary returned lint
to **exactly 8**.

## 2. Verification

`verifier` verdict at the time Phase 8's conversion landed: **GREEN**, 6 of 8. **Superseded — after
the follow-on work in §2a–2c all 8 gates are green; see §2b.**

**Phase 8 closes ⛔, not ✅, on the user's decision (2026-09-24)** — consistent with Phase 7, which
closed the same way under the identical lint condition. The work is complete and verified; it is
PROMPT.md §6's "full green run" that is unreachable while Phase 7's 8 errors stand.

**It also cannot be committed as things stand, and that is a consequence this phase's plan missed.**
`.husky/pre-commit` runs `lint-staged`, which runs `eslint --fix` over staged `*.{ts,html}`. Four of
the six files carrying the 8 violations — `notification.ts`, `masterclass-facade.ts`,
`micro-learning-course-facade.ts`, `utils.ts` — are in Phase 8's staged set, because all four held an
`@Injectable`. `eslint --fix` exits **1** on them (reproduced directly; a clean Phase 8 file exits 0),
so the hook rejects the commit.

Phase 7's report recorded that the hook "is NOT blocked" — **true for Phase 7 only**, because that
phase touched no violating file. A phase that converts every service in the repo cannot avoid them.
**Every remaining Part B phase that edits one of those 6 files will hit the same wall**, so it wants
settling once. The options are in STATE.md "Decisions"; bypassing the hook is not among them, and
AGENTS.md §9 bans it.

| Gate          | Result                  | Detail                                                         |
| ------------- | ----------------------- | -------------------------------------------------------------- |
| lint          | **FAIL (expected)**     | exactly **8 errors, 0 warnings** — the Phase 7 residue, no 9th |
| unit tests    | **PASS**                | **158 files / 500 passed + 1 skipped** — identical to baseline |
| build local   | **PASS**                |                                                                |
| build prod    | **PASS**                | 3 pre-existing budget warnings, unchanged                      |
| storybook     | **PASS**                |                                                                |
| format        | **PASS**                |                                                                |
| bundle report | **PASS**                | see below                                                      |
| ssr smoke     | **FAIL (pre-existing)** | 3 of 4 routes OK; the 1 failure is the known course-API route  |

**Neither red is attributable to this phase.**

- `lint` is red with **exactly the 8 known Phase 7 boundary errors and nothing else** — 7 `PaymentFacade`
  edges plus `notification.ts:3`. The user's recorded Phase 7 decision leaves them at `error`
  unexempted, and Phase 8 has no means to fix them (they are Phase 10/11 work). So PROMPT.md §6's
  "full green run" is unreachable, exactly as in Phase 7. **That the count stayed at 8 is itself the
  result that matters**: a 60-file decorator conversion plus 16 renames added no boundary edge.
- `ssr smoke` fails only on `/us/accounting/masterclass/154/adulting-in-business`, which a previous
  session proved pre-existing against a clean `master` worktree — this machine cannot reach the course
  API, so the page falls back to `{{title}}` with 0 JSON-LD blocks. The other three routes pass.

### Bundle

**Initial: 12 files / 504.4 KB raw / 101.7 KB gzip.** Lazy: 277 chunks.

Initial gzip is **identical to the post-webinar state** (101.7 KB) and raw is **0.2 KB smaller**, which
is the two deleted files. The `+0.2 KB vs baseline` the report prints is the Tailwind-token growth the
webinar work already recorded and explained; **Phase 8 itself contributes nothing.** That is the
expected result — `@Service()` and `@Injectable({ providedIn: 'root' })` compile to the same
`providedIn`, so there is no reason for the output to move.

### `reviewer`: PASS, zero violations

It independently confirmed the two things that matter most: the 60 conversions map **1:1** with
**zero mismatches** — no root singleton wrongly scoped, no scoped facade wrongly left unscoped — and
**no method body, field, or `changeDetection` line changed anywhere** in the diff. It also confirmed
all 16 renames carry git rename similarity (`R100`/`R09x`/`R084`, not delete+add), both deletions have
zero remaining references, and no off-limits path was touched.

Its one flagged item — `public/version.json` and `core/version/app-version.ts` carrying new build
hashes — was read **before** those two were restored to HEAD; they are not in the final change set.

### Independent check on the phase's real risk

Beyond the gates, two things were verified directly, because neither is something a gate can see:

1. **No logic changed.** Diffing every added line in `src/**/*.ts` against "is it an import member or a
   `@Service` decorator?" leaves **exactly one** line repo-wide — the stale comment in
   `onboarding-guard.ts:13` that was corrected on purpose. Nothing else was touched.
2. **The 16 scoped services kept their scoping.** The file list was pinned before the edit and diffed
   after: **exact match**. This is the phase's only silent failure mode, so it was checked rather than
   assumed.

## 2a. Follow-on: clearing Phase 7's boundary residue (option 2, parts A and B)

After Phase 8's conversion landed, the user chose to **fix the 8 boundary violations** rather than
exempt them, then — on the analysis below — scoped it to **A and B**, leaving C for Phase 11.
Result: **lint 8 → 3.**

### The finding that changes Phase 11's plan

**A dynamic `import()` does not clear a boundaries violation.** `shared/services/utils.ts:767` is
already `await import('@features/payment/...')` and lint flags it anyway, because
`boundaries/dependency-nodes` includes `dynamic-import` by default. **So PROMPT.md §4.5's
`injectAsync` / lazy-import technique — which PLAN.md and STATE.md both name as the fix for the seven
`PaymentFacade` edges — would not have fixed them.** Deferring an import is not inverting it. Phase 11
needs real inversion regardless of what happens here.

### A — `core → shared` (1 violation)

`NotificationService` needed the `ToastComponent` _class_ for `NgpToastManager.show()` and the
`ToastContext` _type_. Both were resolved without core naming shared:

- `ToastContext` moved into `core/models/notification.model.ts`, beside `ToastType` — which the shared
  toast already imported from core, so the direction was established.
- A new **`TOAST_COMPONENT`** injection token in `core/services/notification/notification.ts`, bound in
  `app.config.ts`. That file is element `app-root`, and the boundaries config has **no policy with
  `from: app-root`** — the composition root is the one place legally allowed to name both sides.

### B — read-only cart state (4 violations)

New **`core/services/cart/cart-store.ts`**. It can live in core because everything it needs already
does: `CartDetails` and the `PAYMENT_ROUTES` API registry are both in `core/models/payment.model.ts`,
and `ApiClient`/`Logger` are core services.

`CartStore` owns `cartData`, `cartItemRemoved`, `loading`, `error`, `cartFetched`, `setCartData()` and
`loadMyBucket()`. `PaymentFacade` **aliases** those signals under their original names — the same
signal objects, not copies — so its ~30 internal uses and every payment page, guard and resolver are
untouched. Rewired to `CartStore`: `masterclass-facade`, `micro-learning-course-facade`,
`footer-overlay`, `shared/services/utils.ts`.

**Behaviour is unchanged**, and the payment feature stayed lazy — verified by grepping all 11 initial
files for the literal selectors `cart-drawer-dialog` and `plan-selection-card`: zero hits in the
initial set, both only in lazy chunks.

### The token broke 60 spec files — worth knowing before the next one

`NotificationService` is injected transitively by most facades, so every one of those suites died with
`NG0201: No provider found for InjectionToken TOAST_COMPONENT`. Fixed by binding the token in
`src/test-setup.ts` to the same component `app.config.ts` binds — so a spec that shows a toast still
exercises the real path. **This supplies a dependency; it silences nothing.** Any future app-wide
token needs both bindings, app and test.

### Gates after A and B

`verifier` **GREEN**, 7 of 8. `lint` red with **exactly 3**, all deferred by design:
`subscription-dialog.ts:5,6` and `utils.ts:767`. Unit tests **158 / 500 + 1 skipped**, unchanged.
Initial bundle vs the last **committed** baseline: **501.5 → 506.6 KB raw, 101.5 → 102.3 KB gzip
(+0.79%)**, under the 3% threshold — `CartStore` and the token wiring are genuinely new eager code.

### What still blocks the commit: one line

Running exactly what the hook runs (`eslint --fix` over the 87 staged `.ts`/`.html` files) gives
**1 problem**: `utils.ts:767`, the dynamic import of `cart-drawer-dialog` inside
`Utils.openCartDrawer()`. **`subscription-dialog.ts` is not staged** — Phase 8 never touched it, as it
holds no `@Injectable` — so its 2 violations never reach the hook and block nothing today.

So the remaining decision is much smaller than the one that was declined: a single
`InjectionToken<() => Promise<Type<unknown>>>` in core bound in `app.config.ts` (~15 lines, the same
shape `TOAST_COMPONENT` already proves), versus the original C scope of two new files, moving
`SubscriptionDialog` and rewiring two openers.

## 2b. Final gates — ALL GREEN

| Gate          | Result   | Detail                                           |
| ------------- | -------- | ------------------------------------------------ |
| lint          | **PASS** | `All files pass linting.` — 0 errors, 0 warnings |
| unit tests    | **PASS** | 158 files / 500 passed + 1 skipped               |
| build local   | **PASS** |                                                  |
| build prod    | **PASS** | 3 pre-existing budget warnings, unchanged        |
| storybook     | **PASS** |                                                  |
| format        | **PASS** |                                                  |
| bundle report | **PASS** | see below                                        |
| ssr smoke     | **PASS** | all 4 routes OK                                  |

**`ALL GATES GREEN` — 8 of 8.** This is the first fully green run since the boundaries rule landed in
Phase 7, and it means a baseline-recording run now reaches `ALL GATES GREEN` instead of exiting 1.
**It also retro-closes Phase 7 ⛔ → ✅**: that phase's only failure was the 8 violations this one
cleared.

### Bundle — the initial bundle got SMALLER

Against the last **committed** baseline (501.5 KB raw / 101.5 KB gzip / 271 lazy):

|              | Baseline | Now          | Delta       |
| ------------ | -------- | ------------ | ----------- |
| initial raw  | 501.5 KB | 501.6 KB     | **+0.1 KB** |
| initial gzip | 101.5 KB | **100.6 KB** | **−0.9 KB** |
| lazy chunks  | 271      | 281          | +10         |

⚠️ **`verifier` reported this gzip delta as `+0.9 KB`. That sign is wrong** — 101.5 → 100.6 is a
_decrease_. Recomputed directly from the two figures it printed.

The decrease is the point, not a rounding artefact: `SubscriptionDialog` and `PlanSelectionCard` used
to be **eagerly** bundled, because `Utils` and `EngagementDialog` are root services in the initial
bundle and statically imported the dialog. Moving it into `features/payment` behind a loader token put
it in a lazy chunk. That outweighs the new eager code (`CartStore`, the two token files), so the app
ships slightly less JavaScript than before this phase started.

**Verified lazy, not assumed:** all 11 files `index.csr.html` references were grepped for the literal
selectors `cart-drawer-dialog`, `subscription-dialog` and `plan-selection-card` — **zero hits in every
file.** Selectors are string literals, so minification does not hide them.

## 2c. Part C: the last two violations

`SubscriptionDialog` moved `shared/dialogs/` → **`features/payment/dialogs/`** (`git mv`, 3 files,
history kept). It had to **move** rather than take a token, because it renders `PlanSelectionCard` as a
**template** import (`imports: [...]`), and a template import cannot be resolved through a token. Its
two openers — `utils.ts:433` and `engagement-dialog.ts:245` — now resolve it through
`SUBSCRIPTION_DIALOG`.

The loader tokens were consolidated into one home, **`core/services/dialog/feature-dialog-tokens.ts`**
(`CART_DRAWER_DIALOG` moved out of `cart-store.ts` to join it), so Phase 11 has an obvious place to add
more. The file header documents the pattern and the reason it exists.

**The rule, proven three times: every app-wide token needs TWO bindings — `app.config.ts` and
`src/test-setup.ts`.** `TOAST_COMPONENT` cost 60 spec failures and `CART_DRAWER_DIALOG` cost 56 before
each was bound in the test setup; `SUBSCRIPTION_DIALOG` was bound in both from the start and cost
nothing. The test bindings use the **real** loaders — they are functions, so nothing imports until
something opens the dialog.

### One behavioural nuance, stated rather than buried

`EngagementDialog` sets `this.openRef` inside `afterClosed()`, which now runs **after** the lazy chunk
resolves rather than synchronously. In the brief window between requesting the dialog and the chunk
arriving, `openRef` is `null`, so a navigation into a suppressed route during that window would not
auto-close the dialog that is about to appear. The returned stream is unchanged — it still emits once
and completes on close. `Utils.requireCpeModeAccess()` keeps its synchronous `boolean` signature: the
open is fired and deliberately not awaited.

## 3. Decisions needed / skipped / suspicious

### Kept `@Injectable`: **none**

PROMPT.md §5 asks for "a file allowlist for justified exceptions". **The audit found zero exceptions,
so the allowlist is empty** — that is the honest encoding, not an oversight. The config carries a
comment naming exactly what would justify one (`useClass`/`useValue`/`useExisting`/`useFactory`/`deps`,
or `providedIn` other than `'root'`) and how to add it, so a future exception is a scoped `files:`
override block, not a redesign.

### Deleted, with recorded approval (PROMPT.md §7)

Both confirmed dead by `import-auditor` **and** by the repo's own prior audits, and both orphan-free:

- `core/guards/cpa-landing-match.guard.ts` — residue from the `cpa-landing` cluster deleted in Phase 5
  under its own approval; the guard was missed. Zero routes wire it up. Already called dead by
  PLAN.md:488 and phase-05-auth.md:122.
- `core/directives/html-to-pdf.directive.ts` — the dead half of the "html-to-pdf service + directive"
  duplicate PLAN.md §2 flagged. Zero importers. Already called dead by phase-03.md:168 and
  PLAN.md:185,485. Deleting rather than renaming also avoided creating a second `html-to-pdf.ts`
  basename next to the live service.

### The Part B tracker is wrong and Phase 14 must fix it

The tracker's 12 Phase-8 cells **cannot be executed as written**: `core/services` (26 files) and
`shared/services` (3) have **no row at all** — 29 of 60 files, 48% of the work, owned by no session —
and bullet 4's lint rule is repo-wide, so a per-feature run could only enable it in session 12, leaving
eleven sessions unenforced. This is a defect in the table, not in the phase. The same gap will bite
**Phases 9, 11 and 12**, which also have real work in `core/` and `shared/services/`
(`utils.ts`, `engagement-dialog.ts`, `update-checker.ts` alone are three large ones).

### Logged, not fixed (PROMPT.md §7)

1. **4 admin v1 pages inject route-scoped facades from commented-out routes** —
   `partner-platform/pages/partner-dashboard`, `partner-platform/pages/reports`,
   `seat-tracker/pages/seat-tracker`, `users/pages/users`. Each would throw `NullInjectorError` if its
   route were re-enabled without `providers`. Equally broken before and after this phase; it becomes
   moot if the v1 cutover goes ahead.
2. **`assessment-result-dialog.ts:34` still uses `@Inject(PLATFORM_ID)` constructor-param injection** —
   the last old-style param decorator in the repo. It is a `@Component`, so outside Phase 8's
   `@Injectable` scope, but PROMPT.md §4.1's "constructor parameter injection is not allowed" arguably
   reaches it. Small, self-contained follow-up.
3. **AGENTS.md §6 contradicts PROMPT.md §7.** AGENTS.md line 149 says "Scaffold with `ng generate`; do
   not hand-write the file"; PROMPT.md §7 bans `ng generate` and all schematics outright. Both cannot
   be followed. **Phase 14 must resolve this**, not silently pick one.
4. **`core/services/location/location.ts` now duplicates its own parent directory name.** Harmless, and
   consistent with the rest of `core/services/*` (`logger/logger.ts`, `storage/storage.ts`), so it was
   left as-is rather than flattened — flattening single-file directories was never in scope.

### Not suspicious, but worth recording

`@Service` is **not** a cosmetic rename: it removes the ability to express `useClass`/`useValue`/
`useFactory`/`useExisting`/`deps` and non-root `providedIn`. The repo can afford that today because it
uses none of them. If a future feature needs one, the answer is a kept `@Injectable` plus a scoped lint
override — **not** reaching for `@Service`'s `factory` option, which additionally rewrites the
decorated class's _type_ to the factory's return type and is therefore not a drop-in substitute.

## 4. Visual QA list

**None — no template, style, or rendered output changed.** The decorator compiles to the same
`providedIn` either way, so there is nothing to look at by eye.

One **runtime** spot-check is worth doing anyway, because it is the only failure mode the gates cannot
see: open an **admin partner-v2 report dialog** (`admin/partner-platform-v2/pages/reports-v2`) and
confirm the dialog still sees the route-scoped facade's state. That exercises the
`EnvironmentInjector` hand-off described in §1.

## 5. Commit message

```
refactor(services): convert every @Injectable to @Service, and enforce it

Part B phase 8. Three of the phase's four bullets were already no-ops -
zero constructor-parameter DI, and all interceptors and guards are already
functional - so the work is the decorator conversion and the lint rule.

60 services converted: 44 `providedIn: 'root'` to `@Service()`, and 16 bare
`@Injectable()` to `@Service({ autoProvided: false })`. These are exactly
equivalent at runtime - `defineService` sets
`providedIn: autoProvided === false ? null : 'root'` - so nothing changes
behaviourally. No `@Injectable` is kept: the repo has zero InjectionToken,
zero `multi: true`, and zero `providedIn` other than root, so there is
nothing `@Service` cannot express. Every `useClass`/`useValue` in the repo
is a spec or story mocking against the service class as its token, which
keeps working.

The 16 route-scoped conversions are the ones that fail silently rather than
loudly, so the exact file list was pinned before the edit and diffed after:
exact match. All 16 were also traced to a specific `providers:` line.

eslint now bans importing `Injectable` from `@angular/core`, with an empty
allowlist because the audit found nothing to put in it. The rule was proved
with a canary before being trusted: lint 8 -> 9 -> 8, with a `Service`
import in the same statement staying silent.

Also drops the v19-style type suffixes that Part A left behind (16 renames,
30 import specifiers, matching the auditor's count exactly), and deletes two
files confirmed dead by both the auditor and the repo's own earlier audits:
`cpa-landing-match.guard.ts`, residue from the cpa-landing cluster deleted
in phase 5, and `html-to-pdf.directive.ts`, the dead half of a duplicate.

lint stays red with the same 8 known phase 7 boundary errors, which this
phase has no means to fix.
```
