# One set of payload guards

Status: **approved (2026-10-29).** Ticket MIL-158, branch `refactor/MIL-158-core-contract-guards`, based on
`refactor/MIL-156-shared-rail-filter` (#213), which put the guards in `core/utils/contract-guards.ts`. Its PR opens
once #213 is merged.

## Goal

Ten models carry private copies of the same payload guards (`isObject`, `isStr`, `isNum`, `listOf`, …). They import
them from `core/utils/contract-guards.ts` instead. No behaviour change.

## What I read

- **`core/utils/contract-guards.ts`** exports `Json`, `isObject`, `isStr`, `isNum`, `isBool`, `isStrOrNull`,
  `isNumOrNull`, `isBoolOrNull`, `listOf` and `contractError`. Its `contractError` prefixes `[offerings]`.
- **The ten copies**, compared line by line with the core file. Every copied guard is identical, `isNum`'s
  `Number.isFinite` included:

  | Model                                                            | Copied                                                                                 |
  | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
  | `core/models/commerce.model.ts`                                  | `isObject`                                                                             |
  | `core/models/course-resources.model.ts`                          | `Json`, `isObject`, `isStr`, `isNum`, `isStrOrNull`                                    |
  | `core/models/masterclass-home.model.ts`                          | `Json`, `isObject`, `isStr`, `isNum`, `isBool`, `isStrOrNull`, `isNumOrNull`, `listOf` |
  | `features/payment/models/commerce.model.ts`                      | `isObject`                                                                             |
  | `features/home/models/home-sections.model.ts`                    | `Json`, `isObject`, `isStr`, `isStrOrNull`                                             |
  | `features/library/course/models/course-library.model.ts`         | `Json`, `isObject`, `isStr`, `isNum`                                                   |
  | `features/library/instructor/models/instructor-library.model.ts` | `Json`, `isObject`, `isStr`, `isStrOrNull`, `isNum`                                    |
  | `features/offerings/webinar/models/webinar.model.ts`             | `Json`, `isObject`, `isStr`, `isNum`, `isStrOrNull`, `isNumOrNull`, `listOf`           |
  | `features/tracker/caira/models/caira-badge-page.model.ts`        | `Json`, `isObject`, `isStr`, `isNum`, `isBool`, `isStrOrNull`, `isNumOrNull`, `listOf` |
  | `features/tracker/cpe/models/cpe-credit.model.ts`                | `Json`, `isObject`, `isStr`, `isNum`, `isBool`, `isStrOrNull`, `isNumOrNull`, `listOf` |

- **What differs is `contractError`.** Four models name their own area in the log: `[masterclass]`, `[webinar] …
Events contract`, `[caira-tracker] badges/page …` and `[cpe-tracker] …`.
- **Three comments give the old reason for a copy:** the CPE tracker's ("a local copy of the CAIRA tracker's on
  purpose"), the CAIRA tracker's, and the home sections' ("the webinar feature's own guards cannot be imported").
- **Left alone, on purpose:**
  - `core/models/account.model.ts`'s `isNullableString` has another name and one use.
  - `features/offerings/webinar/utils/webinar-error.ts` has an object check that lets arrays through, so it isn't a copy.

## Locked decisions

1. **Each model imports exactly the guards it used** from `@core/utils/contract-guards` and deletes its copies.
   Callers don't change.
2. **Each model keeps its own `contractError`.** The log prefix says where an answer failed, so the messages stay
   word for word. The core `contractError` stays `[offerings]`.
3. **Guards only some models have stay local:** `pageOf`, `isLoginType`, `isStrList` and `isLevelOrNull`. Each
   has one owner, and a second user would justify promoting it.
4. **Comments:**
   - the three comments that explain the copies lose that part;
   - the trust-boundary comments that say why the guards exist stay;
   - the core file's doc says it serves every model and that a model keeps its own `contractError` when its log
     names another area.

## Endpoint map

None. No request changes.

## Files

The ten models above, plus `core/utils/contract-guards.ts` (doc only) and `docs/refactor/STATE.md`. About 15 lines
added and 90 removed.

## Security

None. These are the same checks on the same answers; nothing reaches the browser that didn't before.

## Acceptance criteria

1. `grep -rln "const isObject = (v: unknown)" src/app` finds only `core/utils/contract-guards.ts`.
2. Every model parses as before: the same pages render, and no contract error appears that `master` doesn't
   show.
3. Each log prefix is unchanged.
4. `pnpm lint` reports 0 errors, and the structure check passes.

## Checks

`pnpm lint`, `pnpm format:fix`, `pnpm check:structure`, `pnpm exec tsc -p tsconfig.app.json --noEmit`,
`pnpm build:prod`, which must show no change to the initial bundle beyond a few bytes.

## How to verify

Dev 4101, signed out:

- home (the tracks and the highlight webinar);
- the masterclass page and its filter;
- the course library and its filters, then one instructor;
- the webinar list.

There should be no `does not match the contract` errors in the console.

Signed in (stub session), the CPE and CAIRA trackers and the cart can't read real data. Those parsers lose only
their copies, and the type check proves their calls bind to the same signatures. I'll note them as not exercised.

## Risks

- **A copy that wasn't identical:** ruled out above, line by line. The type check would also catch a signature
  change.
- **Conflicts:** `masterclass-home.model.ts` and the CAIRA tracker's comment are also touched by MIL-156. This
  branch starts after MIL-156, so they stack cleanly.

## Assumptions (please confirm)

1. The per-area `contractError` messages stay. Folding them into the core one would change the log lines.
