# Phase 5 — dissolve `src/app/pages/`

Session run 2026-09-23 on `refactor/structure-5`. Part A, structure only.

## 1. Summary

**`src/app/pages/` no longer exists.** The five folders that were left — `ai-labs`, `faculty`,
`how-to-claim-credly-badge`, `instructor-details`, `milesverse` — moved into `features/`, and the
top-level folder was deleted. `features/features.ts` was renamed `features.routes.ts`.

**46 files moved, 18 files edited, 1 file created.** Every one of the 46 moves is a `git mv`.
The 13 moved files that are not `R100` are all `.ts` files whose import specifiers had to change;
**no `.html` and no `.css` file has a single byte of content change**, which is the strongest available
evidence that no template, selector or style was touched.

| Unit                                                  | Moves | Destination                                              |
| ----------------------------------------------------- | ----- | -------------------------------------------------------- |
| `video-list-wrapper` (from `partners`)                | 4     | `shared/components/video-list-wrapper/`                  |
| `plan-scrolling-gallery` (from `payment`)             | 3     | `shared/components/plan-scrolling-gallery/`              |
| `pages/milesverse/` + `core/services/milesverse/`     | 17    | `features/milesverse/{pages,models,services}/`           |
| `pages/faculty/`                                      | 4     | `features/faculty/pages/faculty/`                        |
| `pages/how-to-claim-credly-badge/`                    | 4     | `features/how-to-claim-credly-badge/pages/…/`            |
| `pages/instructor-details/` (+ `instructor-hero`)     | 6     | `features/library/instructor/{pages,components}/`        |
| `pages/ai-labs/`                                      | 5     | `features/ai-labs/{pages,models}/` + `ai-labs.routes.ts` |
| `ai-lab-submission.ts`                                | 1     | `core/services/ai-lab-submission/`                       |
| `ai-lab-agent-about.model.ts` (from `shared/dialogs`) | 1     | `core/models/ai-lab-assessment.model.ts`                 |
| `features.ts`                                         | 1     | `features.routes.ts`                                     |

### The three things worth remembering

**1. Two magnet promotions, both clean.** `video-list-wrapper` (13 consumers: 12 partner pages plus
`how-to-claim-credly-badge`) and `plan-scrolling-gallery` (`payment/plan` plus `faculty`) each cross two
top-level features, so §3's placement rule sends them to `shared/`. They were done **first**, so
`faculty` and `how-to-claim-credly-badge` landed in `features/` with zero banned edges rather than
creating two and clearing them afterwards. Neither dragged a hidden sibling out of its feature the way
`partner-icons` did last time — `video-list-wrapper` imports only `@shared/components/video-poster` and
`plan-scrolling-gallery` only `@angular/core`. The auditor was run on both precisely to check that, and
also confirmed **zero** references in `angular.json`, `tsconfig*`, `.storybook/`, Tailwind `@source`
lines, `vercel.*` and every `*.stories.ts`.

**2. The ai-labs cycle was killed, not exempted.** `shared/dialogs/ai-lab-agent-dialog` reached _into_
`pages/ai-labs` by relative path for `CopilotWorkflow` and `AiLabSubmission`, while `ai-labs.ts`
imported that dialog back. Moving the folder would have relabelled the inbound half as
`shared → features`, which §3 bans. The fix promotes the shared surface to `core/`:

- `CopilotWorkflow` + `MOCK_WORKFLOWS` cut out of the 450-line `ai-labs.model.ts` into a new
  `core/models/ai-lab.model.ts`. The remaining 405 lines are page copy (FAQs, testimonials, sections)
  and stayed with the feature.
- `ai-lab-agent-about.model.ts` moved wholesale from `shared/dialogs/` to
  `core/models/ai-lab-assessment.model.ts`.
- The `providedIn: 'root'` singleton `AiLabSubmission` moved to `core/services/ai-lab-submission/`.

**The assessment model had to move in the same change or the fix would have been a regression.**
`AiLabSubmission` imports `AI_LAB_ASSESSMENT_REPORT`/`AiLabAssessmentReport` from it, so relocating only
the service would have traded a `shared → features` edge for a `core → shared` edge — banned just as
firmly, one layer deeper. The auditor flagged this explicitly before the move.

**Measured outcome:** repo-wide `shared → features` edges are down from **6 to 4**. The four survivors
are the PaymentFacade/cart cluster (`utils.ts` ×2 — one static, one dynamic — and `subscription-dialog`
×2), all already assigned to Phase 11. Both ai-lab edges are gone outright.

**3. `instructor-details` overrode PLAN.md, on the user's call.** PLAN.md §3 sent it to a standalone
`features/instructors/`. It went to `features/library/instructor/` instead: that folder already owns the
instructor _list_ page and `instructor-facade`, and both sides read `InstructorListItem` from
`@core/models/library.model` against the same `instructor/` endpoint. This is the seventh PLAN.md row
corrected by an audit. The route registration deliberately stayed in `features.routes.ts` —
`instructor/:instructorId/:instructorName` is a sibling of `library`, not a child, and moving the
registration would have changed the URL.

### Two things only the auditor could have caught

Neither would have failed typecheck; both would have surfaced much later, attributed to the wrong step.

- **`subject.ts:50` is `styleUrls: ['../milesverse.css', './subject.css']`** — the only component in the
  milesverse set reaching out of its own folder for a stylesheet. After the move it had to become
  `'../milesverse/milesverse.css'`. Nothing type-checks a `styleUrls` string; this would have failed at
  `build:prod` with no hint that a move three steps earlier caused it.
- **`instructor-details.ts:27` imported `'./components/instructor-hero/instructor-hero'`** — nested
  today, but the target structure splits the two into _sibling_ `pages/` and `components/` trees, so it
  had to become `'../../components/…'`.

### One loss caught by self-check, not by any gate

The first cut of `core/models/ai-lab.model.ts` dropped `CopilotWorkflow`'s original doc comment —
including a **BACKEND CONTRACT** note recording that the real list comes from the learner's
authenticated Copilot/Graph session. Every gate was green with it missing; a line-accounting check
(450 → 405 + 44) exposed the 9 missing lines. Restored, and the extracted block is now verified
byte-identical to the removed one. AGENTS.md §8 calls this codebase's comments load-bearing; this one was.

## 2. Verification

`verifier` subagent, full run — **8/8 GREEN**.

| Gate            | Result | Time |
| --------------- | ------ | ---- |
| lint            | pass   | 6s   |
| unit tests      | pass   | 21s  |
| build (local)   | pass   | 31s  |
| build (prod)    | pass   | 35s  |
| storybook build | pass   | 24s  |
| format check    | pass   | 14s  |
| bundle report   | pass   | 0s   |
| ssr smoke       | pass   | 3s   |

The first full run was 7/8 — `format check` failed on `features.routes.ts`, because rewriting four lazy
import specifiers to longer alias paths pushed them past the print width. Fixed with Prettier; no code
change.

**Bundle.** Initial **12 files / 501.5 KB raw / 101.5 KB gzip — identical to baseline, +0.0%**.
Lazy chunks **271, unchanged**; lazy total +1.8 KB raw / +0.7 KB gzip (+0.02%, noise). No chunk created
or removed. Content-hash filenames churned, as expected from moved paths. **The step's real risk did not
materialise:** promoting two components out of lazy feature chunks into `shared/` could have pulled them
into the eager bundle, and did not.

**SSR smoke** — all four routes match the recorded baseline exactly:

| Route                                                 | Status                      | Title                                             | JSON-LD |
| ----------------------------------------------------- | --------------------------- | ------------------------------------------------- | ------- |
| `/`                                                   | 302 → `/us/accounting/home` | —                                                 | 0       |
| `/us/accounting/partners/cpacanada`                   | 200                         | real title                                        | 1       |
| `/us/accounting/masterclass/154/adulting-in-business` | 200                         | `Miles Masterclass` (known degraded baseline, Q8) | 0       |
| `/admin/login`                                        | 200                         | real title                                        | 0       |

The partner route is the meaningful one here: it renders the just-promoted `video-list-wrapper`, so a
200 with a populated title proves the 13 rewritten specifiers resolve at **runtime**, not merely at
typecheck.

`reviewer` subagent — **PASS, zero violations.** It independently confirmed the byte-identity of both the
assessment-model move and the `ai-labs.model.ts` split, that all 18 modified files contain only import
changes plus the one `styleUrls` fix, and that no `eslint-disable`, `ts-ignore` or skipped test entered
the diff.

## 3. Decisions needed / skipped / suspicious

### Settled this session by the user (no further action)

1. **`instructor-details` → `features/library/instructor/`**, overriding PLAN.md's `features/instructors/`.
2. **ai-labs cycle broken by promoting to `core/`**, not by a Phase 7 temporary-warning exemption.
3. **Session scoped to `pages/` only** — `app/auth/` deliberately deferred.

### Needs your call

4. **`features/shared/services/tracks/` has no home in the target structure.** It sits at the
   `features/` root, which §3 does not contain. Its only importers are `features.routes.ts:5` (route
   `providers`) and `cpa-landing/shared/components/cpa-caira-section.ts:9` — i.e. **one feature plus a
   route config**, not two features. Options: push it down to `features/cpa-landing/services/tracks.ts`
   (§3's placement rule, but a route table at the `features/` root would then import out of a feature),
   or promote it to `core/services/`. Not touched this session.

### Logged, not fixed (PROMPT.md §2.7)

5. **A `core → shared` edge exists and predates this session:**
   `core/services/notification/notification.ts:3` imports `@shared/ui/toast/toast`. §3 bans it. It
   arrived in Phase 4 (`7b3c7cc`) and is untouched here. Earlier STATE.md entries stating "`core/` is
   clean" were scoped to the files of that step, not a repo-wide claim. **Phase 7 will hit this.**
6. **`instructor-details.css` is 0 bytes but still wired** at `instructor-details.ts:62` — Phase 12 item,
   joining `page-not-found.css` and `connect-us.css`.
7. **`milesverse.model.ts:104,113`** — `scenarioImage` and `subjectImage` are exported and imported
   nowhere.
8. **`AiLabReportQuestion` and `AiLabFlowCheck`** (now `core/models/ai-lab-assessment.model.ts`) are
   exported but imported by name nowhere; they are only used structurally inside that file.
9. **All three environment files set `redirectPath: '/auth/ai-labs-callback'`, but no `ai-labs-callback`
   route exists anywhere in `src/`.** Dead config or a broken OAuth callback. Recorded now specifically
   so it is not blamed on this move.
10. **`MOCK_WORKFLOWS` is mock data now living in `core/models/`, not `src/app/testing/`.** Phase 1's
    mock rule does not apply: it is imported by production code, because `AiLabSubmission` is itself a
    documented stand-in until the backend endpoint exists. Worth revisiting when that endpoint lands.
11. **`library/instructor/shared/` still exists** (`shared/services/instructor-facade/`), as do
    `library/{course,badge}/shared/`. Pre-existing, out of scope, and on the Phase 5 remainder list.

## 4. Visual QA list

Part A changes no markup, and no `.html`/`.css` file changed content. The risk is purely that a moved
component fails to resolve at runtime on a page the SSR smoke test does not cover.

**Highest priority — the promoted `video-list-wrapper` renders on 13 pages:**
all 12 partner landing pages (`allinial-global`, `ascpa`, `bkn`, `caira-landing`, `corporate`,
`cpa-canada`, `ctcpa`, `dscpa`, `hawaii`, `illinois`, `mgi-north-america`, `mgi-world`) plus
`/{c}/{p}/how-to-claim-credly-badge`. Only `cpacanada` is covered by the SSR gate.

**Then:**

- `/{c}/{p}/payment/plan` and `/{c}/{p}/faculty` — both render `plan-scrolling-gallery`.
- `/{c}/{p}/simulation`, `/simulation/subjects/:slug`, `/simulation/briefing/:id`, `/simulation/report` —
  the milesverse pages. **Check `/simulation/subjects/:slug` specifically:** it is the page whose
  `styleUrls` cross-folder path was rewritten, so a mistake there shows up as an unstyled page, not an
  error.
- `/{c}/{p}/ai-labs` — plus open the agent dialog, which is the component whose imports were rerouted
  through `core/`.
- `/{c}/{p}/instructor/:instructorId/:instructorName` — renders the relocated `instructor-hero`.

## 5. Commit message

```
refactor(structure): phase 5 dissolve app/pages/

Move the last five page folders into features/ and delete src/app/pages/.

- milesverse -> features/milesverse/ (internal shared/ dissolved into flat
  models/ + services/); core/services/milesverse pushed down into the feature,
  since its only 4 importers were those pages and it pulls in @milesverse/sdk
- faculty, how-to-claim-credly-badge -> their own features
- instructor-details + instructor-hero -> features/library/instructor/, which
  already owns the instructor list page and facade (overrides PLAN.md's
  features/instructors/)
- ai-labs -> features/ai-labs/
- features.ts -> features.routes.ts

Promote two cross-feature components to shared/components/ per the placement
rule: video-list-wrapper (12 partner pages + how-to-claim-credly-badge) and
plan-scrolling-gallery (payment/plan + faculty).

Break the shared <-> ai-labs import cycle by promoting its shared surface to
core/ rather than exempting it: CopilotWorkflow + MOCK_WORKFLOWS to
core/models/ai-lab.model.ts, ai-lab-agent-about.model.ts to
core/models/ai-lab-assessment.model.ts, and AiLabSubmission to
core/services/ai-lab-submission/. The assessment model had to move in the same
change, or relocating the service alone would have created a core -> shared
edge. Repo-wide shared -> features edges drop from 6 to 4.

Structure only: no logic, URL, selector or template change. Initial bundle and
lazy chunk count are identical to baseline.
```
