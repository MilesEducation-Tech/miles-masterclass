# Phase 5 — The magnet promotion

Part A, structure only. Not a feature session: this resolves the cross-feature-edge decision raised by
the `uae-caira` move. The user chose **option (a) — promote all six**.

## 1. Summary

The largest single step of Phase 5 so far: **16 files moved, 26 import sites rewritten**, clearing
every `features → features` edge that these components created.

| #   | From                                                                      | To                   |
| --- | ------------------------------------------------------------------------- | -------------------- |
| 1   | `features/partners/shared/components/partner-content-list/`               | `shared/components/` |
| 2   | `features/partners/shared/components/caira-steps-grid/`                   | `shared/components/` |
| 3   | `features/partners/shared/components/caira-feature-grid/`                 | `shared/components/` |
| 4   | `features/home/components/app-download/`                                  | `shared/components/` |
| 5   | `features/offerings/webinar/shared/components/webinar-registration-form/` | `shared/components/` |
| 6   | `features/partners/shared/models/caira-step-icons.ts`                     | `core/constants/`    |
| 7   | `features/partners/shared/models/partner-icons.ts`                        | `core/constants/`    |

`features/partners/shared/models/` is now **deleted** — emptied by moves 6 and 7.

### The audit turned six moves into seven

The decision named six items. The `import-auditor`'s outbound-import check — the one thing that could
have blocked the whole step, since **`shared/` must never import `features/`** — found that
`partner-content-list.ts:4` imported `iconXPartner` from a sibling `partner-icons.ts` that was **not**
on the list and would have stayed behind in `features/partners/shared/models/`.

Promoting the component without it would have created exactly the `shared → features` edge this step
exists to eliminate. So `partner-icons.ts` was promoted too. It has **5 importers** — the promoted
component plus `for-firms-panel`, `corporate`, `illinois` and `bkn`, all of which stay in partners and
now import `@core/constants/partner-icons`. `features/partners → core` is a legal direction, so this
costs nothing.

**The other five were clean.** `caira-steps-grid` and `caira-feature-grid` import only
`@angular/core` and `@ng-icons/core`. `app-download` imports only `@core/constants/icon` and
`@core/models/footer.model`. `webinar-registration-form` — the one that looked riskiest, buried four
levels inside `features/offerings/webinar/shared/components/` — imports only `@shared/ui/*` and
`@core/*`, nothing from offerings at all. The two highest-risk promotions turned out to be the two
cleanest.

### Why the icon files went to `core/`, not `shared/`

Both are **plain SVG string constants with zero imports** — no Angular decorator, no UI. §3's placement
rule sends non-UI code to `core/`, and `core/constants/icon.ts` already holds exactly this shape
(`logo`, `logoIcon`, `appStoreIcon`, `googlePlayIcon` — all SVG strings). §3 also gives `shared/` only
`ui|components|dialogs|pipes|directives|utils`: **there is no `shared/models/`**, so the folder they
came from had no equivalent on the other side. `core/constants/` is both the rule-correct and the
convention-consistent home. The reviewer independently confirmed they contain no UI code.

### What this clears

All six edges the `uae-caira` report flagged are gone, and with them the same edges from every other
consumer — `partner-content-list` alone was reached cross-feature from `home`, `library`, `offerings`
(3 files) and `uae-caira`. The rewrite touched **26 import sites**: partners (11 landing pages +
`for-firms-panel`), offerings (`masterclass`, `podcast`, `micro-learning`, `webinar-hero`,
`webinar-registration-dialog`), `home`, `library/instructor`, and `uae-caira`.

**No new boundary violation was introduced.** A repo-wide check for `shared → features` returns only
the six **pre-existing** edges documented since Phase 4 — `subscription-dialog` ×2,
`ai-lab-agent-dialog` ×2, `utils.ts` ×2 — and none of the five newly-promoted components appears among
them. `core/` is clean.

## 2. Verification

`verifier`, full run, **8/8 GREEN**. No baseline flag; `docs/refactor/baseline/` untouched, verified.

| Gate            | Result | Time |
| --------------- | ------ | ---- |
| lint            | pass   | 5s   |
| unit tests      | pass   | 16s  |
| build (local)   | pass   | 23s  |
| build (prod)    | pass   | 26s  |
| storybook build | pass   | 23s  |
| format check    | pass   | 15s  |
| bundle report   | pass   | 0s   |
| ssr smoke       | pass   | 4s   |

**The real risk of this step did not materialise.** Promoting five components out of lazy feature
chunks into `shared/` could plausibly have pulled them into the eagerly-loaded initial bundle. It did
not: initial is **12 files / 501.5 KB raw / 101.5 KB gzip — identical to baseline, +0.0%** — and the
lazy chunk count is **unchanged at 271**. The promoted components stayed inside lazy feature chunks.
The largest lazy chunk is unchanged in size; only its content hash moved.

**SSR smoke — OK on all 4 routes.** The informative one here is
**`/us/accounting/partners/cpacanada` → 200** with a full populated title. That page exercises the
moved `partner-content-list` **and** the relocated `partner-icons`/`caira-step-icons` constants, so a
200 with real SEO — rather than a crash or a fallback title — is the strongest available evidence that
the 26 rewritten imports resolve at **runtime**, not merely at typecheck time.

**`reviewer`: PASS, zero violations, no suppressions.** It confirmed the critical boundary check; that
15 of the 16 moved files are `R100` byte-identical renames, the sole exception being
`partner-content-list.ts` at `R096`, whose only diff is the one import specifier that had to change;
that the two icon files contain only exported string literals; that
`features/partners/shared/models/` is gone with all 5 importers correctly repointed; that **no
selector and no template markup changed**; and that `partner-content-list.spec.ts` moved with its
component, with no stories lost.

## 3. Decisions needed / skipped / suspicious

1. **None outstanding from this step.** It closes the decision the `uae-caira` session raised.
2. **Logged, not fixed — `app-download.ts:32` has `getIcon(iconName: string): any`.** AGENTS.md §8
   forbids `any`. Pre-existing, and Part A forbids logic changes — but it is now in `shared/`, so it is
   more visible and more likely to be copied. Worth fixing in Part B.
3. **Logged, not fixed — `webinar-registration-form` is a design-only shell.** A comment in the file
   flags `submit` / `verifyOtp` / `resendOtp` / `goToLogin` as inert. Promoting it to `shared/` makes it
   look like a finished, reusable primitive when it is not yet wired. **This is the item most likely to
   mislead someone later** — it should either be wired up or clearly marked before anyone new consumes
   it.
4. **Phase 0's separate `home/components/offerings/*` item (claimed 14 cross-feature importers) is
   still open and still unverified.** PLAN.md's counts have now been wrong twice; treat that figure
   with the same suspicion and re-derive it from the import graph before acting.
5. **`features/partners/shared/` still exists** with `components/` (5 remaining: `for-firms-panel`,
   `for-partnership-tabs`, `partner-level-panel`, `partnership-content`, `video-list-wrapper`) and
   `pages/`. Dissolving that internal `shared/` layer is still owed by Phase 5.
6. **Build churn cleaned** — `public/version.json` and `core/version/app-version.ts` restored to `HEAD`.
7. **This is still one entangled diff.** Four units of work are now uncommitted together:
   `connect-us` + the `Faq` promotion, `uae-caira`, the user's `compliance` move, and this promotion.
   They share edited files (`uae-caira.ts` is touched by three of them), so splitting by path is no
   longer practical. **Recommend one commit for the lot**, using the message below, which covers
   everything in the tree.

## 4. Visual QA list

This step has the widest visual blast radius of the refactor so far — `partner-content-list` renders on
**11 partner landing pages plus 5 other features**. The gates prove it compiles, builds and SSRs; they
do not prove it renders. With `pnpm start` (port **4101**):

- **`/us/accounting/partners/cpacanada`** — the SSR-verified one; confirm the partner logo strips and
  content lists actually render, not just that the page returns 200.
- **Two more partner pages**, ideally `/us/accounting/partners/bkn` and `/us/accounting/partners/illinois`
  — both import `partner-icons` directly and use `partner-content-list` heavily (6 and 6 template
  usages respectively).
- **`/us/accounting/home`** — uses both `partner-content-list` and `app-download`.
- **`/ae/accounting/home`** — the UAE page, which consumes **all seven** moved items; still not covered
  by the SSR smoke list.
- **A masterclass, podcast and micro-learning page** — each renders `partner-content-list`.
- **The webinar registration flow** — `webinar-hero` and the `webinar-registration-dialog` both render
  the promoted form.

## 5. Commit message

Covers the full working tree — four units of work that can no longer be cleanly separated.

```
refactor(structure): phase 5 connect-us, uae-caira and the magnet promotion

Continue dissolving pages/ and clear the cross-feature edges it exposed.
pages/ is down to 5 folders.

connect-us + Faq promotion:
- Faq is both the routed /faq page and a widget used by 13 pages across 7
  features, so it moves to shared/components/faq/ with faq-item alongside;
  this clears 13 banned edges outright rather than relabelling them
- pages/faq/ is gone, so there is no features/faq/ folder at all, and
  faq.model.ts and constants/faq.ts stay in core/
- pages/connect-us/ -> features/connect-us/pages/connect-us/, still lazy

uae-caira:
- pages/uae-caira/ -> features/uae-caira/{pages,components,services}/, the
  internal shared/ layer dissolved and the facade flattened to a flat file
- the duplicate local-time-zone.pipe.ts deleted in favour of the shared
  one (identical but for a doc comment), per PLAN.md's duplicates list

magnet promotion (all six, per the user's decision):
- partner-content-list, caira-steps-grid, caira-feature-grid, app-download
  and webinar-registration-form -> shared/components/
- caira-step-icons.ts and partner-icons.ts -> core/constants/, matching
  core/constants/icon.ts; they are plain SVG string constants, and
  PROMPT.md section 3 has no shared/models/
- partner-icons.ts was not in the original six but had to move: it is
  imported by partner-content-list, which would otherwise have become a
  shared -> features edge
- features/partners/shared/models/ deleted; 26 import sites rewritten

compliance stays at features/legal/pages/compliance/ per the user's revert.

All moves recorded as renames with zero content change beyond import
specifiers. Verifier 8/8 green, initial bundle unchanged at 501.5 KB raw /
101.5 KB gzip (+0.0%), lazy chunk count unchanged at 271, SSR smoke OK on
all 4 routes. Reviewer PASS on every step.
```
