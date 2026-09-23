# Phase 7 — Enforce boundaries

Part A's final phase. Turns PROMPT.md §3's import rules from prose into an `error`-level lint gate.

**Status: ⛔ blocked — by design, on your recorded decision.** 7 of 8 gates green; `lint` is red with
exactly 8 known architectural violations that Part B will fix. You chose to leave them at `error`
with no exemption rather than carry them as temporary warnings, so §6's "full green run" is not
reachable this phase and the tracker says ⛔ rather than ✅.

---

## 1. Summary

**12 files changed** (excluding `pnpm-lock.yaml`): 1 rename (100%, history preserved), 11 modified.
`public/version.json` and `core/version/app-version.ts` are build-generated — **exclude both from the
commit** (open question 6).

### Tooling

- `eslint-plugin-boundaries@7.2.0` and `eslint-import-resolver-typescript@4.4.5` installed as
  devDependencies. The plugin README in `node_modules` was read before configuring, per §5.
- `pnpm-workspace.yaml` gained `unrs-resolver: true` under `allowBuilds`. pnpm blocked that package's
  build script on install and wrote the literal placeholder `set this to true or false` into the file;
  left unresolved it breaks `pnpm install`. The resolver loads either way (its native binary arrives
  as an optional dependency, not from the build script), but approving it keeps a clean-checkout
  install honest on other platforms.

### `eslint.config.mjs`

Everything is scoped to the existing `files: ["**/*.ts"]` block — the Angular template AST carries no
import nodes, so enabling the rule on `**/*.html` would only cost time.

- **8 element descriptors**: `core`, `shared`, `layout`, `testing`, `admin`, `feature` (one element
  per top-level feature, captured), plus `app-root` and `bootstrap` catch-alls for the composition
  roots (`app.*.ts`, `configuration/`, `features/features.routes.ts`, and `src/main.ts`, `server.ts`,
  `seo.ts`, `legacy-redirects.ts`, `environments/`). Those two deliberately carry no outbound
  restriction.
- **`boundaries/dependencies`** at `error`, `default: "allow"`, with 6 `disallow` policies. Written
  with object selectors and `{{ }}` message templates; no deprecated syntax (`policies` not `rules`,
  `dependencies` not `element-types`, no `mode`, no `category`, no `importKind`).
- **`@typescript-eslint/no-restricted-imports`** covering all three extra bans in §5: relative
  specifiers climbing into a top-level folder, `@angular/aria`, and the class/style structural
  directives from `@angular/common`.
- TypeScript resolver wired via `settings["import/resolver"]`.

### Three settings that are load-bearing, not decoration

1. **`partialMatch: false` on every descriptor.** The v7 default (`true`) matches patterns
   right-to-left against path suffixes. This repo has the exact collision: `src/app/admin/core/**`
   would classify as element `core` and `src/app/admin/layout/**` as `layout`, inverting the admin
   rules and inventing false "core imports shared" errors while hiding real ones. It is also the
   plugin's announced future default, so there is no migration later.
2. **`boundaries/flag-as-external: { unresolvableAlias: false }`.** Flat config activates no resolver
   by default, and an unresolvable alias is classified `external`, which the rule skips. Left at the
   default, a broken resolver would have turned every violation into a silent, fully green lint run.
3. **The `{ category: "source", pattern: "src/**/*.ts" }` catch-all in `boundaries/files`.** An array
   query returns false against a null value, so without a category on ordinary files the
   `noneOf: ["test","story"]` selector never matches and `@testing/*` becomes importable from
   anywhere — silently.

### The resolver was proven live before any result was trusted

Three targeted canaries, none of which the gates cover:

| Probe                                                   | Expected                                  | Result       |
| ------------------------------------------------------- | ----------------------------------------- | ------------ |
| `eslint core/services/notification/notification.ts`     | 1 error at 3:46                           | ✅ exactly 1 |
| `eslint core/services/update-checker/update-checker.ts` | 1 error at **84:20 (dynamic `import()`)** | ✅           |
| `eslint shared/services/utils.ts`                       | 48:31 static **and 767:20 dynamic**       | ✅ both      |

**This closes the Phase 5 warning** that "Phase 7's lint config must cover dynamic imports or it will
report seven and silently miss two". `boundaries/dependency-nodes` includes `dynamic-import` by
default, and both dynamic violations are reported. (Caveat for later: only string-literal dynamic
imports are analysed — `import(someVar)` is invisible to the rule.)

### Violations fixed (3 files)

- **`core/services/update-checker/update-checker.ts` → `shared/services/update-checker.ts`.** Clears
  one `core → shared` violation outright. Flat, per §3's "services and models are flat files" and the
  existing `shared/services/` shape (`utils.ts`, `engagement-dialog.ts`). Its two relative specifiers
  resolved inside `core/` and were rewritten to `@core/version/app-version` and
  `@core/services/dialog/dialog` — both `shared → core`, legal. Its one consumer, `app.config.ts:26`,
  was updated. Its line-84 dynamic import of a shared dialog is now `shared → shared`, i.e. internal.
- **`core/directives/html-to-pdf.directive.ts`** — 3 specifiers shortened from `../../core/services/…`
  to `../services/…`. The only file in the repo written this way: it climbed out of `core/` to
  `src/app/` and back in, so the new boundary rule flagged it. Same resolved modules, one segment
  shorter.
- **`shared/components/cards/badge-{level,course}-card`** — the two class-directive usages, fixed now
  rather than deferred to Phase 12. `[…]="statusTone()"` became `[class]="statusTone()"` and the
  import plus `imports:` entry were dropped. `statusTone()` returns a plain space-separated class
  string and both elements carry a static `class` attribute, which Angular merges with a `[class]`
  string binding — exactly equivalent. 4 files, 6 lines.

---

## 2. Verification

| Gate            | Result                                    | Time |
| --------------- | ----------------------------------------- | ---- |
| lint            | ❌ **fail — 8 known errors, by decision** | 6s   |
| unit tests      | ✅ pass                                   | 19s  |
| build (local)   | ✅ pass                                   | 30s  |
| build (prod)    | ✅ pass                                   | 40s  |
| storybook build | ✅ pass                                   | 29s  |
| format check    | ✅ pass                                   | 15s  |
| bundle report   | ✅ pass                                   | 0s   |
| ssr smoke       | ✅ pass                                   | 4s   |

**Lint is exactly the 8 expected errors and nothing else** — no extra error, no warning. Verified
against a written expected-set at every step, because a red gate would otherwise have masked new
breakage across four consecutive steps.

**Bundle: byte-identical to baseline.** 12 files, 501.5 KB raw / 101.5 KB gzip, +0.0%; lazy 271
chunks, matching baseline's 271. The three Angular budget warnings (2.08 MB initial, `briefing-session.css`,
`ai-labs.css`) are pre-existing and measure the whole eager module graph, not the harness's
`index.html` metric — the distinction that cost Phase 6 a cycle.

**SSR smoke: all 4 routes matched baseline.** **Baselines clean** — `git status docs/refactor/baseline/`
empty after the full run, so open question −1 did not recur.

### The 8 remaining violations

| #   | File:line                                                                           | Edge              | Owner      |
| --- | ----------------------------------------------------------------------------------- | ----------------- | ---------- |
| 1   | `core/services/notification/notification.ts:3` → `@shared/ui/toast/toast`           | core → shared     | Phase 10   |
| 2   | `shared/dialogs/subscription-dialog/subscription-dialog.ts:5` → `PaymentFacade`     | shared → feature  | Phase 11   |
| 3   | `shared/dialogs/subscription-dialog/subscription-dialog.ts:6` → `PlanSelectionCard` | shared → feature  | Phase 11   |
| 4   | `shared/services/utils.ts:48` → `PaymentFacade`                                     | shared → feature  | Phase 11   |
| 5   | `shared/services/utils.ts:767` → `cart-drawer-dialog` (dynamic)                     | shared → feature  | Phase 11   |
| 6   | `layout/footer-overlay/footer-overlay.ts:22` → `PaymentFacade`                      | layout → feature  | Phase 11   |
| 7   | `features/offerings/services/masterclass-facade.ts:29` → `PaymentFacade`            | feature → feature | Phase 9/11 |
| 8   | `features/offerings/services/micro-learning-course-facade.ts:40` → `PaymentFacade`  | feature → feature | Phase 9/11 |

Seven of the eight are one dependency: `PaymentFacade`. No move clears them — promoting it to `core/`
drags `coupon-dialog` (`payment-facade.ts:39`), `cart-drawer-dialog` (`:625`) and `cart-item` in
behind it, i.e. the payment domain into core, which STATE.md rejected on a 13-internal-vs-2-external
importer count. They need the dynamic-import / lazy-injection conversion that Phase 11 owns, and that
is a logic change Part A forbids.

### The pre-commit hook is NOT blocked

The plan warned this phase might be uncommittable, because `.husky/pre-commit` runs `lint-staged` →
`eslint --fix` on staged `*.{ts,html}`, which exits non-zero on unfixable errors. **It passes.**
`eslint --fix` over exactly this phase's changed files exits `0`, because none of the 8 violating
files is touched by Phase 7 — a direct consequence of dropping the `Notification` move (below). No
`--no-verify` needed, and nothing was weakened to achieve it.

---

## 3. Decisions needed / skipped / suspicious

### 3.1 The `Notification` move was planned, then dropped on evidence — this is why the count is 8, not 7

The plan promised **two** `core → shared` fixes. Only one shipped.

My pre-phase grep reported "`Notification`: 36 importers, **zero in `core/`**" and concluded the move
was free. That was **wrong** — it matched only the alias form `@core/services/notification/notification`.
The `import-auditor` sweep found two importers using a **relative** specifier:

- `core/services/network/network.ts:3` — `import { NotificationService } from '../notification/notification'`
- `core/services/partner-code/partner-code.ts:5` — same

Both are core singletons that cannot themselves move. So relocating `Notification` to `shared/` would
have **turned 1 violation into 2**: the inbound `core → shared` on `notification.ts:3` would vanish and
two fresh outbound `core → shared` edges would appear in its place. Net loss, so the move was abandoned.

**Consequence for Part B:** violation 1 has no move-only fix. `Notification` is an app-wide singleton
that renders a `shared/ui` component, and §3 forbids both a UI component in `core/` and a `core → shared`
import. Phase 10 (headless UI / toast migration) is the natural owner — it must either invert the
dependency (inject a token, not the component) or relocate the toast. **This retires STATE.md finding
1's "there is no Phase 11 plan for it" by naming an owner, but the fix is real work, not a move.**

### 3.2 Decisions you took this session, now in force

1. **8 violations at `error`, no exemptions.** Phase 7 closes ⛔. Reversing this later is a small,
   self-contained config block; nothing else depends on it.
2. **`admin/<x> → admin/<y>` is not banned.** §3 permits admin to import itself. Implemented as a
   single `admin` element, so all 18 such edges are intra-element and free. **Re-banning later is a
   one-line change** — `pattern: "src/app/admin/*", capture: ["adminFeature"]` — and the config says so
   at the call site.
3. **A `layout → features|admin` policy was added, extending §3.** §3 states outbound rules for core,
   shared, features, admin and testing but is **silent on `layout`**. A literal transcription would
   not report violation 6, which STATE.md has counted as banned since Phase 5. Flagged here as an
   extension, and **Phase 14 should add the layout rule to AGENTS.md §3** so the spec and the linter
   agree.
4. **Class/style directives fixed now, not in Phase 12.** Zero usages remain repo-wide.

### 3.3 Counts corrected

- **`admin/<x> → admin/<y>` is 18 lines, not the 7 STATE.md recorded.** The 7 from
  `partner-platform-v2` into `user-onboarding`/`seat-tracker`/`users` were counted; the **11 from v1
  `partner-platform` into v2** were not. All 18 die at the v1 cutover. Not banned, so none is a
  violation today.
- **Relative imports crossing a top-level folder: 1, not 0.** My pre-phase measurement resolved each
  specifier and found none that changed folder. The rule bans the _specifier shape_, which is
  stricter and caught `html-to-pdf.directive.ts`'s out-and-back form. Fixed.
- **Class-directive usages: 2 files, not the ~25 a naive grep suggests** — `subHeadingClass`,
  `headingClass` and similar property names are false positives. Style directives: 0. `@angular/aria`:
  0 (one mention in a code comment at `shared/ui/checkbox-list/checkbox-list.ts:14`).

### 3.4 Logged, not fixed

1. **`Injectable` is still used throughout**, including on the moved `update-checker.ts`. Phase 8
   converts these to `@Service()`; untouched here because Part A changes no logic.
2. **`boundaries/dependencies` only analyses string-literal dynamic imports.** `import(someVar)` and
   template-literal forms are invisible to it. None exist today; worth remembering if Phase 11
   introduces one while converting the `PaymentFacade` edges.
3. **`no-unknown-dependencies` was considered as a permanent resolver canary and not enabled.** While
   the 8 violations exist they _are_ the canary: if the resolver ever dies, lint goes green, and a
   green lint is now the anomaly. That protection expires when Phase 11 fixes the 8 — enable the rule
   then, or the silent-external failure mode returns unguarded.
4. **`eslint.config.mjs` picked up a whole-file quote-style flip.** 32 of its original 67 lines
   changed from double to single quotes, inflating the diff. The editor's format-on-write hook did
   it, and it brings the file into line with the project's `singleQuote: true` prettier config —
   which it had never matched, because `pnpm format` only globs `src/**`. Left as-is: reverting
   means fighting the hook on every future edit of this file.

5. **pnpm reports peer-dependency warnings** for `eslint-import-resolver-typescript`, which lists
   `eslint-plugin-import`/`eslint-plugin-import-x` as peers. Neither is needed — `boundaries` reuses
   the resolver through `eslint-module-utils`, which it depends on directly. Confirmed working by the
   canaries.

---

## 4. Visual QA

Part A normally has none. One item this phase:

- **`shared/components/cards/badge-level-card` and `badge-course-card`** — the status pill's colour
  classes now come from a `[class]` binding rather than the class directive. Check the pill renders
  green for `earned`, accent for `unlocked`, muted otherwise, on both cards. Reachable from the badge
  library and the CPE tracker badge lists.

---

## 5. Commit message

```
refactor(structure): phase 7 boundaries

Encode PROMPT.md §3's import boundaries as error-level lint rules, the last
phase of Part A.

- Add eslint-plugin-boundaries@7.2.0 + eslint-import-resolver-typescript@4.4.5
- 8 element descriptors (core, shared, layout, testing, admin, per-feature,
  plus app-root/bootstrap composition roots), all partialMatch:false — the v7
  default would misclassify admin/core/** as element `core`
- boundaries/dependencies at error with 6 disallow policies, object selectors
  and {{ }} templates; no deprecated syntax
- flag-as-external.unresolvableAlias:false so a dead resolver fails loudly
  instead of silently passing every boundary check
- no-restricted-imports: relative specifiers crossing a top-level folder,
  @angular/aria, and the @angular/common class/style directives

Violations fixed:
- core/services/update-checker -> shared/services/update-checker.ts (clears a
  core -> shared edge; 100% rename)
- core/directives/html-to-pdf.directive.ts: 3 specifiers that climbed out of
  core/ and back in
- badge-level-card, badge-course-card: class directive -> [class] binding

8 boundary violations remain at error, unexempted, by decision. Seven are
PaymentFacade and need Phase 11's lazy-injection conversion; one is
Notification -> shared/ui/toast and needs Phase 10. lint is therefore red;
the other 7 gates are green and the bundle is byte-identical to baseline.
```

Exclude `public/version.json` and `src/app/core/version/app-version.ts` — both build-generated.
