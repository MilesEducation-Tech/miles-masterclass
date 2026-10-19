# CPE tracker — bind the portfolio summary and credits table to `web-api/v1/cpe-tracker/`

## Goal

"Your CPE Portfolio" (`/{country}/{profession}/cpe-tracker`) renders the learner's real credits.
The page, its table, its filters and its compliance dialog already exist and match Figma
`51200-36347`; only the data was missing, because `v1/cpe-tracker/` and `v1/cpe-tracker/summary/`
answer a plain-HTML 404.

This is subtask 1 of 2. Certificates, the NASBA export and badge claims are
`prompts/cpe-tracker-certificates.md`.

## What was read

- `Web_CPE_Tracker_API.md` (MO-2776, backend commit `3cd7dea`, rendered from the real code 2026-10-19).
- `features/tracker/cpe/**` — page, table, portfolio card, compliance dialog, certificate services,
  `credit-row.ts`, constants.
- `features/tracker/caira/models/caira-badge-page.model.ts` — the boundary-parse pattern this follows.
- `core/models/cpe-tracker.model.ts`, `core/models/course.model.ts` (`CategoryListItem`),
  `features/tracker/utils/course.util.ts`, `features/*/offerings/*.routes.ts`, `ai-labs.routes.ts`.

## Live-route check (2026-10-19)

Every route answers a JSON **401** without a token. A route that was never registered answers an
HTML 404 on this API, so 401 proves existence:

```
401 application/json  web-api/v1/cpe-tracker/summary/?year=2026
401 application/json  web-api/v1/cpe-tracker/credits/?ledger=caira&year=2026
401 application/json  api/v1/badges/badge-claimed-by-user/
```

## Locked decisions

1. **No facade.** One routed page, two reads, children on inputs and outputs. AGENTS.md §3 asks for a
   facade only where state is shared between siblings or a dialog.
2. **Boundary parse, open enums.** Hand-written guards in the model, in the house style. `course_type`
   and `badge.state` are received as plain `string` — the CAIRA rebind showed that closing an enum
   before a real payload exists fails the whole page for the one learner who earned something.
3. **Compliance uses the first configured state board**, keeping the dialog's single-gauge layout.
4. **Reels sends both tokens** (`nano_learning,micro_learning`) until the backend explains the split.

## Endpoint map

| Page element                           | Request                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| Credits Earned card, compliance dialog | `GET web-api/v1/cpe-tracker/summary/?year=`                                         |
| Credits table                          | `GET web-api/v1/cpe-tracker/credits/?ledger=&year=&course_type=&page=&page_size=15` |

`ledger` and `year` are required; **an unknown query parameter is a 400**, so `page_count` must go.
`course_type` is a comma list. The CAIRA ↔ Others chip re-calls `credits/` only — the summary carries
both totals and is keyed on `year` alone.

## Files touched

| File                                                    | Change                                                                                                                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cpe/models/cpe-credit.model.ts`                        | Rewritten: wire types for both routes, `parseCpeSummary` / `parseCpeCredits`, row actions, filter options. Deletes `DELIVERY_METHOD`, `CPE_TYPE_TO_TRANSACTION`, `CertificateTarget`, `UserBadgeStatus` |
| `cpe/pages/cpe-tracker/cpe-tracker.ts`                  | New URLs and params; reads gated on `isAuthenticated()`; paging off `data.credits`; compliance fed from `state_boards`                                                                                  |
| `cpe/components/tracker-table/tracker-table.ts\|html`   | `delivery_method` from the row; **`allocated_on` rendered in UTC**; actions re-derived; title links only when linkable                                                                                  |
| `cpe/components/tracker-table/tracker-table.stories.ts` | Mocks rebuilt on the new row shape                                                                                                                                                                      |
| `cpe/utils/credit-row.ts`                               | Uses `course.slug`; maps `course`→`masterclass`, both learning tokens→`micro-learning`; returns `null` when there is no page to open                                                                    |
| `cpe/constants/cpe-tracker.constants.ts`                | `DELIVERY_COLORS` gains `Group Live`; `DEFAULT_CPE_REQUIREMENT` deleted                                                                                                                                 |
| `cpe/dialogs/cpe-compliance-dialog/*`                   | `required` is nullable — "Requirement not configured" instead of a fallback                                                                                                                             |
| `core/models/cpe-tracker.model.ts`                      | `StudyModeBreakdown.id: number \| string`; `CreditsSummary.required: number \| null`                                                                                                                    |
| `features.routes.ts`                                    | `canMatch: [authGuard]` on `cpe-tracker`, as the CAIRA tracker already has                                                                                                                              |

## Contract traps

- **`allocated_on` is a bare `YYYY-MM-DD` in UTC.** `| date` renders it in local time, so a
  `2026-09-14` award shows as _Sep 13_ for every US learner. Pass `'UTC'` to the pipe.
- **`course_type` renamed:** `masterclass` → `course`, and `micro_learning` is new beside
  `nano_learning`. Sending the old token is a 400.
- **All ids are UUIDs**, including field-of-study ids.
- **`delivery_method` has a fourth value**, `Group Live`.
- `fields_of_study[].cpe_credit` is singular on the wire; `CategoryListItem` reads `cpe_credits`.
  Normalize in the parse, not in a component.
- `course.slug` is null for AI Labs and archived items, `course_type` is null for archived reels, and
  **`ai-labs` has no detail route** — those rows must not be links.
- Totals round to 2 decimals independently, so parts can be 0.01 off the total. Don't recompute.

## Security

Read-only GETs, bearer attached by `appInterceptor` — never hand-attach a header. Each route returns
only the caller's own data; there is no user id in any request. `canMatch: [authGuard]` keeps a
signed-out visitor off the page instead of showing a shell plus 401s.

## Acceptance criteria

- The table shows real rows for the signed-in learner, with dates matching `allocated_on` exactly.
- Every Course Type option returns 200. CAIRA ↔ Others re-fetches `credits/` only.
- A year with no credits renders the empty state, not an error.
- View Compliance shows the board's real requirement; `state_boards: []` hides the gauge.
- Signed out, the route does not activate.

## Checks

`pnpm lint` · `pnpm format:fix` · `pnpm build:prod` · `pnpm build-storybook`, then the running app on
port 4101.
