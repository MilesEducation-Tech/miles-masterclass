---
name: cpe-tracker
description: The CPE tracker of Miles Masterclass v3 — credit tracking by year and study mode, the report table, NASBA and certificate downloads, Credly badge claiming, and state-board compliance. Read before touching features/cpe-tracker or anything about credits, certificates or badges.
---

# CPE tracker

Where a learner sees the credits they've earned, downloads certificates, and claims Credly badges. This is the **compliance-facing** surface — the numbers here are what a professional reports to their state board. Accuracy over cleverness.

## Files

```
features/cpe-tracker/
├── cpe-tracker.ts  cpe-tracker.routes.ts
└── shared/
    ├── services/
    │   ├── cpe-tracker-facade/            # 352 lines
    │   ├── certificate-access-policy/     # may this row download?
    │   ├── certificate-download/          # single + bulk (jszip)
    │   ├── course-action-resolver/        # row → next action
    │   ├── course-router/                 # row → course URL
    │   └── tracker-dialog-orchestrator/
    ├── mappers/{api-adapters,report-to-table}.ts
    ├── utils/{course.util,slug.util}.ts
    ├── constants/cpe-tracker.constants.ts
    └── components/{tracker-table,tracker-toolbar,badge-swiper}/   # each has a .stories.ts
```

Route: `/:country/:profession_type/cpe-tracker` — `[authGuard, activePlanGuard]`, provides `CpeTrackerFacade`, **`RenderMode.Client`** (per-user data, nothing to server-render).

## CpeTrackerFacade

**Filters**: `selectedYear`, `creditMode` (credits vs hours), `studyFilter: StudyModeFilter`.

**Raw data**: `statistics: RawStatistics | null`, `report: ReportRow[]`, `badges: BadgeItem[]`, plus `isLoadingStatistics` / `isLoadingReport` / `isLoadingBadges` — three independent loading flags so one slow call doesn't blank the whole page.

**Derived**: `credits` (`deriveCredits(statistics, creditMode)`), `studyModeDetails`, `deliveryModeDetails`, `stateBoard` (`resolveStateBoard`), `yearOptions`, `filteredReport`, `tableRows`, `totalRows`, `totalPages`, `pagedTableRows`, `pageWindow`.

**Actions**: `loadAll()`, `downloadNasba()`, `downloadAllCertificates()`, `downloadCertificateForRow(row)`, `openCompliance()`, `openBadgeInfo()`, `claimBadge(badge)`, `shareBadge(badge)`.

Filtering and pagination are **entirely computed**. Never store a filtered copy — that's how a table ends up disagreeing with its own row count.

## The service split

Five small services instead of one fat facade, each with a single question:

| Service                       | Answers                                                              |
| ----------------------------- | -------------------------------------------------------------------- |
| `certificate-access-policy`   | May this row's certificate be downloaded?                            |
| `certificate-download`        | Fetch and deliver it (bulk uses jszip)                               |
| `course-action-resolver`      | What's the next action for this row — resume, retake exam, download? |
| `course-router`               | Which URL does this row point at?                                    |
| `tracker-dialog-orchestrator` | Which dialog opens, and in what order?                               |

Respect the split. A permission check inside the download service, or URL building inside the table component, is how this becomes unmaintainable.

`course-router` handles all four content types — masterclass, podcast, micro-learning, webinar — each with its own URL shape and its own exam param spelling. Route through it; never build a course URL by hand here.

## Mappers

`api-adapters.ts` normalises the API response; `report-to-table.ts` turns `ReportRow[]` into table rows. Keep the raw shape and the display shape separate — a field the table needs is a mapper change, not a new API-shaped signal.

## Certificates

- Single: `downloadCertificateForRow(row)`, gated by `certificate-access-policy`.
- Bulk: `downloadAllCertificates()` — a zip via jszip.
- **NASBA report**: `downloadNasba()` — the formal credit report. It must reflect exactly what the server reports; never assemble it from filtered client-side rows.

Rendering uses `html-to-pdf` (jsPDF + html2canvas-pro). Dialogs: `certificate-download-dialog`, `cpe-compliance-dialog`.

## Badges

Credly badges. `badge-swiper` displays them; `claimBadge(badge)` claims and `shareBadge(badge)` shares. `badge-info-dialog` and `badge-claim-upsell-dialog` cover the explanatory and upsell paths. The public how-to page is `pages/how-to-claim-credly-badge/`. The badge **library** is a separate feature (`library` skill).

## Compliance

`stateBoard` is derived from `statistics` via `resolveStateBoard`. Requirements differ per state and per profession — **never hardcode a threshold**. If a rule isn't in `cpe-tracker.constants.ts` or the API response, ask rather than assume.

`openCompliance()` → `cpe-compliance-dialog`.

## Gotchas

- Credits vs hours (`creditMode`) changes the displayed number, not the underlying data. Both derive from the same statistics.
- `selectedYear` drives everything. Changing it must reset pagination, or page 5 of last year shows as empty.
- Three loading flags, three skeletons. Don't collapse them into one.
- Credits use `TotalCpeCreditsPipe` from `FieldOfStudy`. Never sum by hand.
- The components have Storybook stories — update them when props change, or the a11y check drifts.

## Verify

```bash
pnpm start
```

1. `/us/cpa/cpe-tracker` — statistics, report table and badges load independently.
2. Switch year → table, totals and pagination all update; pagination resets.
3. Toggle credits/hours and the study-mode filter — row counts stay consistent with the table.
4. Paginate to the last page, then change a filter — no empty page.
5. Download one certificate, then all of them (zip), then the NASBA report.
6. Claim and share a badge.
7. A row for each content type routes to the right course URL.
8. Log out → redirected to login, not the paywall.
