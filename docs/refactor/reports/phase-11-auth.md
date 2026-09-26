# Phase 11 — `features/auth`

## 1. Summary

1 file changed, no new files, no moves.

- **`profile.canDeactivate()`: the "Leave without saving?" `UtilsDialog` lazy-loads** (§4.4).
  - The dialog opens as soon as its chunk arrives, inside the import's `then`.
  - The guard still returns `Observable<boolean>`, now `from(opened).pipe(switchMap(ref => ref.afterClosed), map(...))`.
  - The early `return true` paths (clean, or saving) are unchanged.
  - The data and result types are `import type`.
  - On a chunk-load failure, the guard stream errors into a `NavigationError`, which `app.config.ts`'s
    `recoverFromStaleChunk` already handles with a one-shot reload.
- **Survey:** no heavy library, no heavy children, no `@defer` needed. `AuthFacade` is auth/session, which the
  §4.5 exclusion keeps on plain `inject()`.

## 2. Verification

`verifier`, full `verify.mjs`, first run:

| Gate            | Result                                   |
| --------------- | ---------------------------------------- |
| lint            | pass                                     |
| unit tests      | pass: 190 files / 698 passed + 1 skipped |
| build (local)   | pass                                     |
| build (prod)    | pass                                     |
| storybook build | pass                                     |
| format check    | pass                                     |
| bundle report   | pass                                     |
| ssr smoke       | pass: 4 of 4 routes                      |

The baseline dir was clean after the run.

**Bundle:** the initial bundle is unchanged (88.0 KB gz, −1.3% vs baseline; "Initial total" 242.43 kB).
`app-utils-dialog` is no longer in the profile page chunk (`chunk-PQBVIGYM`, 0 matches).

## 3. Decisions needed / skipped / suspicious

None. No `@Injectable`, no CSS files, no heavy-library service left eager.

## 4. Visual QA list

- `/…/profile`: edit an answer, then navigate away. The "Leave without saving?" dialog appears (after a short
  load). "Keep editing" stays on the page, and "Leave" navigates.
- With no edits, navigating away shows no dialog.

## 5. Commit message

```
perf(auth): lazy-load the profile leave-without-saving dialog

canDeactivate loads UtilsDialog with import() and still returns the same
Observable<boolean> to the router; only the dialog types stay static.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
