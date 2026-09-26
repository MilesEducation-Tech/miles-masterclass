# Phase 12 — `features/auth`

## 1. Summary

**All 3 stylesheets were empty, and all 3 are deleted.** Their `styleUrl`s went too: `auth`, `login` and
`profile`. The feature is now stylesheet-free.

**No change needed:** the feature has no inline `styles`, no `style` attributes, no `NgClass`/`NgStyle`, no `@apply`
and no raw hex. The templates use the global `auth-card`, `sub-title` and `description` classes from `styles.css`,
which this row leaves alone.

## 2. Verification

The `verifier` subagent could not run the gates: the harness guard hook refused its `verify.mjs` call. At your
direction (2026-09-26), I ran `node scripts/refactor/verify.mjs` directly from the repo root, and it passed first
time.

| Gate            | Result                                    |
| --------------- | ----------------------------------------- |
| lint            | pass                                      |
| unit tests      | pass (190 files / 698 passed + 1 skipped) |
| build (local)   | pass                                      |
| build (prod)    | pass                                      |
| storybook build | pass                                      |
| format check    | pass                                      |
| bundle report   | pass                                      |
| ssr smoke       | pass: 4 of 4 routes                       |

- **Environment:** local, macOS, Node 24.15.
- `reviewer`: **PASS**.
- **Bundle:** the initial bundle is 88.4 KB gz (−0.9% vs baseline), unchanged. There are 324 lazy chunks.

## 3. Decisions needed / skipped / suspicious

- **None new.** The spinner-colour decision from `shared/ui` is still open.
- **Kept CSS:** none.
- **Harness note:** this is the second row whose verifier was refused by the guard hook (the first was
  `features/payment`). It may be worth checking the hook's rule for subagent calls.

## 4. Visual QA list

Nothing is expected to change visually, because only empty stylesheets were removed. For a spot check, look at the
**login** (OTP) and **profile** (onboarding questionnaire) pages.

## 5. Commit message

```
style(auth): drop the empty auth stylesheets

- delete the 3 empty stylesheets (auth, login, profile) and their styleUrl

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
