# Phase 5 — session 1: `auth` (+ the dead-cluster deletion)

Run 2026-09-23 on `refactor/structure-5`. Part A, structure only.
First session of the sequence in [PHASE-05-REMAINING.md](../PHASE-05-REMAINING.md).

## 1. Summary

Two units: a user-approved **deletion of 8 dead files**, and the move of **`src/app/auth/` into
`features/auth/`** with its inline route table split out.

**`src/app/auth/` is gone** — the last top-level folder outside the target structure. Feature
`shared/` layers drop from **14 to 12** (294 -> 289 files).

| Unit                                      |  Files | Result                                   |
| ----------------------------------------- | -----: | ---------------------------------------- |
| Delete `features/cpa-landing/`            |      6 | `D`                                      |
| Delete `features/shared/services/tracks/` |      2 | `D`; `features/shared/` no longer exists |
| `app/auth/` -> `features/auth/`           |     11 | 9 x `R100`, 2 edited                     |
| Split `authRoutes` out of `auth.ts`       | +1 new | `features/auth/auth.routes.ts`           |

Final shape, exactly per section 3 and decision D2:

```
features/auth/
  auth.{ts,html,css}        <- the Auth SHELL stays at the feature root (D2)
  auth.routes.ts            <- NEW, exports authRoutes
  pages/login/              pages/profile/
  services/auth-facade.ts   services/auth-facade.spec.ts   <- flat files
```

### The deletion

Approved by the user 2026-09-23 as a **narrow exception** to the standing "dead code: list only, do
not delete" rule, recorded in STATE.md "Decisions" as PROMPT.md section 7 requires. Evidence:
`cpa-landing` had **zero** references anywhere outside itself — no route, no import, no selector
usage — and `cpa-caira-section.ts:30` was the **only** injector of `Tracks` in the repo. `Tracks` was
provided at `features.routes.ts:21` but nothing reachable injected it.

**The 8-file list was not self-contained, and the auditor is the only reason that surfaced.** Two
lines outside those 8 go dead the instant `Tracks` does: `features.routes.ts:5` (the import) and
`:21` (`providers: [Tracks]`). Deleting only the 8 would have left a dangling import and failed the
build. A third line — a comment claiming "`Tracks` (above) is inherited by the levels section" —
would have survived as a quiet lie; it was corrected too.

Nothing the deleted files imported became an orphan. Worth recording specifically:
**`@core/models/track.model.ts` stays** — it has four other consumers (`feature-facade`,
`surround-carousel` + its spec, `partnership-content`). Deleting it would have been the easy mistake.

### The route split — the only operation here that is not a move

Part A forbids logic changes, and a file split is the one thing in this phase the gates cannot fully
police. Verified by diffing the halves against the original:

- the `Auth` component class body is **byte-identical**;
- the `authRoutes` array differs **only** in the two lazy specifiers that had to change
  (`./shared/pages/{login,profile}/...` -> `./pages/{login,profile}/...`).

Guard wiring, `providers: [AuthFacade]`, and both explanatory comments moved verbatim. The mixed
import line `{ ActivatedRoute, Route, Router, RouterOutlet }` was the only one that had to be split
across the two files, with `Route` following the table.

**Lint caught what the diff check could not.** `AuthFacade` was left behind in `auth.ts`, where it is
used _only_ by `providers: [AuthFacade]` inside the route table — so it became an unused import the
moment the table left. A split can strand an import in either direction and only the linter sees it.
Relevant to the six remaining splits (`library`, and the four offerings roots).

## 2. Verification

`verifier` subagent, full run — **8/8 GREEN**.

| Gate            | Result | Time |
| --------------- | ------ | ---- |
| lint            | pass   | 5s   |
| unit tests      | pass   | 18s  |
| build (local)   | pass   | 26s  |
| build (prod)    | pass   | 36s  |
| storybook build | pass   | 25s  |
| format check    | pass   | 14s  |
| bundle report   | pass   | 0s   |
| ssr smoke       | pass   | 3s   |

**Bundle.** Initial **12 files / 501.5 KB raw / 101.5 KB gzip — identical to baseline, +0.0%**.
Lazy **271 chunks, unchanged**; -0.7 KB raw / -0.2 KB gzip (noise). No chunk created or removed.
Deleting a whole feature and a route-level provider moved the bundle by nothing measurable, which is
itself the confirmation that the deleted code was already unreferenced and tree-shaken.

**SSR smoke** — all four routes match the recorded baseline exactly (`/` 302; `cpacanada` 200 with
1 JSON-LD block; the course route 200 at its known-degraded baseline title; `/admin/login` 200).

`reviewer` subagent — **PASS, zero violations.** It independently confirmed the deletion is exactly
8 paths and nothing more, that the route-table split is byte-identical apart from the two required
specifiers, that no import was stranded or duplicated across the two files, that all 11 moved files
are pure `git mv`, and that no `eslint-disable` / `ts-ignore` / skipped test entered the diff.

**Recorded-baseline check:** that directory was **clean** after the full run — see section 3.

## 3. Decisions needed / skipped / suspicious

### Settled before this session (no action)

1. **D1 — delete the dead cluster.** Executed exactly as scoped: 8 files, nothing more.
2. **D2 — shells stay at the feature root.** `Auth` has a `<router-outlet/>`, so it stayed at
   `features/auth/auth.ts` rather than moving to `pages/auth/`.

### Needs your attention

3. **My earlier baseline diagnosis was wrong, and the correction matters.** I reported that an
   ordinary `verify.mjs` run had overwritten the recorded baseline and would keep doing so. After
   you restored it, **this session's full run left it completely clean** — checked immediately
   afterwards. So an ordinary run does **not** rewrite it, and the `2026-09-23T06:00:54` overwrite
   came from something else, most likely an explicit recording run earlier that day. The cause is
   still unconfirmed, so it is worth a quick `git status` on that directory after each full run
   until it is understood — but the gate is not structurally broken as I first said.

4. **The pages-dissolve unit is still uncommitted, and this session now sits on top of it.** You
   chose to proceed rather than commit first. The two units are mostly separable by path, but
   **`app.routes.ts` and `features.routes.ts` are touched by both**, so they cannot be split cleanly
   by path any more. Either stage by hunk, or make one commit carrying both messages.

### Logged, not fixed (PROMPT.md section 2.7)

5. **`core/guards/cpa-landing-match.guard.ts` is dead** — exports `cpaLandingMatchGuard`, referenced
   by no route anywhere. Found by the auditor while proving the deletion safe. It is **not** covered
   by D1's 8-file scope, so it was left in place under the standing "list only" rule. It is now
   unambiguously orphaned, since the only thing that ever named it was the deleted `cpa-landing.ts`
   doc comment.
6. **All three environment files still set `redirectPath: '/auth/ai-labs-callback'`**, and
   `authRoutes` has no `ai-labs-callback` child — `login` and `profile` only. Dead config or a broken
   OAuth callback. Carried forward from the previous report; now doubly relevant, since this session
   moved the auth routes and someone will eventually blame that.
7. **`profile.ts` and `login.ts` have no specs.** `auth-facade.spec.ts` is the feature's only test.

## 4. Visual QA list

Part A changes no markup; 9 of the 11 moved files have zero content diff. The risk is runtime
resolution on routes the SSR gate does not cover — and it covers none of auth.

- **`/auth/login`** — the lazy `loadComponent` path changed. Check the page renders and the OTP
  identifier field still fires its async validator (the out-of-band feature work from `15335f5`).
- **`/auth/profile`** — same, plus it is behind `authGuard` + `canDeactivateExamGuard`; confirm the
  guards still fire and the leave-confirmation still appears.
- **`/auth`** with no sub-path — should redirect to `login`.
- **Any signed-out deep link**, e.g. a course page -> bounced to `/auth/login?redirect=...` -> land
  back after verify. This exercises the route table from the outside.
- **Header avatar menu -> Profile** (`header.html:242`, `user-avatar-menu.html:42`), which navigates
  to `/auth/profile` by URL string.

## 5. Commit message

```
refactor(structure): phase 5 auth, and delete the cpa-landing dead cluster

Move src/app/auth/ into features/auth/ and delete 8 dead files.

- auth/shared/pages/{login,profile} -> features/auth/pages/
- auth/shared/services/auth-facade.ts(+spec) -> features/auth/services/ as
  flat files
- the Auth shell stays at the feature root: it is a <router-outlet/> wrapper,
  not a page (recorded decision D2)
- split the inline authRoutes table out of auth.ts into
  features/auth/auth.routes.ts; app.routes.ts now loads @features/auth/auth.routes

Delete features/cpa-landing/ (6 files) and features/shared/services/tracks/ (2),
approved as a narrow exception to the "list dead code, don't delete it" rule:
cpa-landing had zero references anywhere outside itself, and its
cpa-caira-section was the only injector of Tracks in the repo. Also strip the
now-dangling Tracks import and route provider from features.routes.ts, and a
comment that claimed Tracks was inherited by the levels section.
features/shared/ no longer exists, retiring the @features/shared path segment.

Structure only: no logic, URL, selector or template change. The Auth component
body and the authRoutes array are byte-identical apart from the two lazy
specifiers the move required. Initial bundle and lazy chunk count are unchanged
from baseline.
```
