# AI Labs — full-flow bug list (MIL-117)

Branch `feat/MIL-117-ai-labs-refactor`, on top of `a485733`. Five bugs found testing the flow end to end, plus
item 11 of the 2026-10-27 API guide (`lab_certificate_url`), which bug 4 needs.

## What I read

- Ours: `ai-labs-facade.ts` (`practicalProgress`), `ai-lab-feedback` page and facade, `ai-lab-course` page and
  facade (`STAGE_FOR_STEP`, `runCta`, `openFile`, `openTab`), `ai-labs.routes.ts`, `shared/components/backward`,
  `shared/dialogs/certificate-download-dialog`, `shared/utils/blob-download.ts`, `features/library/badge` (how it
  opens the certificate dialog).
- v3 `origin/feat/ai-labs-refactor`: `offerings/shared/pages/course-feedback` (Thank You view, `handleRedirect`),
  `pages/ai-lab/course/ai-lab-course.ts|html` (`openBriefPreview`, `renderFileViewer`, `keepPreviewLoading`,
  `viewerNote`, `previewKind`, `signedDisposition`), `MicroLearningCourseFacade.openCertificateDownloadDialog`.
- Guide `~/Downloads/AI_Labs_API_FE_Guide.md` (2026-10-27, backend `01c7a4d`): change 11, section 4 "Lab
  progress", section 9 "the certificate".

## Root causes

| #   | Bug                                   | Cause                                                                                                                                                                                       |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | "Where your labs stand" order         | `practicalProgress` keeps AI Labs' order; nothing sorts graded first.                                                                                                                       |
| 1   | Post-feedback message                 | Our thank-you view adds a CPE line, a "being generated" line, a white certificate link and "Back to the Lab". v3 is short: check, "Thank You!", one line, "Return to Home".                 |
| 2   | Build guide opens the raw file        | `openFile` points the tab straight at the link. v3 opens a viewer tab: the file shown (image inline, PDF framed) with a **Download** button the learner clicks.                             |
| 3   | "Back to AI Labs" returns to feedback | `app-backward` goes `location.back()` when the previous entry is in-app, and after feedback that entry is the feedback page.                                                                |
| 4   | No certificate after feedback         | Nothing reads a certificate link: `done` maps to `REWATCH` and `DOWNLOAD` routes to the CPE tracker. The link now exists — `course-progress/<id>/` → `lab_certificate_url` (guide item 11). |

## Locked decisions

1. **Bug 0:** stable sort in `AiLabsFacade.practicalProgress`: `status === 'graded'` rows first, every other row
   after them in the order AI Labs sent. Counts unchanged.
2. **Bug 1:** the `done` view becomes v3's markup: green check circle, "Thank You!", "Your feedback has been
   submitted successfully.", then a `variant="link"` **"Return to Home"** that goes back to the lab page (v3's
   `redirect` is the course page too). Kept from ours: the 409 `nasba_conditions_unmet` notice (it says the lab
   didn't close, which the learner must see). Kept as in v3: a certificate button only when the submit answer
   carries a URL, styled as v3's outline button. Dropped: the CPE-awarded line and the "being generated" line —
   the course page now owns the certificate state (bug 4).
3. **Bug 2:** port v3's viewer tab. The tab opens inside the click (popup blocker), the link is refreshed when the
   brief is older than 10 minutes (today's `openFile` logic, extracted into `freshFileUrl(file)`), then the tab is
   built with DOM calls only (never an HTML string, so nothing from the API is parsed as markup): a title bar plus
   a **Download** link, then an `<img>`, a framed PDF, or "can't be previewed here — use Download". A PDF is read
   into a typed blob when the bucket allows CORS. When it doesn't, the frame falls back to Google's viewer and
   retries a blank first load up to 5 times at 4 s, as v3 does.
   - Applies to the **build guide rows** and the **flow chart's "View" action**, which v3 also previews. The
     exercise zip, the flow chart's download action and the sample grade card keep opening the file directly, as
     in v3.
   - The DOM builder is a plain module, `features/ai-labs/utils/file-viewer.ts`. The facade keeps the HTTP.
4. **Bug 3:** `<app-backward … [routePath]="labsHome">`, where `labsHome` is `/:country/:profession_type/ai-labs`
   built from the route params (the existing `localeLink`). `Backward` already gives `routePath` priority over
   history, so no shared change.
5. **Bug 4, data:** `AiLabCourseProgress.lab_certificate_url: string | null` (before
   `final_assessment_status`). Facade `certificateUrl` computed.
   - `next_step: 'done'` + URL → `DOWNLOAD`, label "Download Certificate".
   - `done` + `null` → new stage `CERTIFICATE_PENDING`, label "Certificate is being generated", disabled. While in
     that stage the facade re-reads `course-progress/` every 5 s, for at most 60 s.
   - **Assumption (flag):** the guide also returns `null` forever when generation failed or the lab has no
     certificate template, so after the 60 s budget the stage falls back to today's `REWATCH` rather than claim
     "being generated" indefinitely. A reload starts a fresh budget.
6. **Bug 4, the pop-up:** DOWNLOAD opens the shared `CertificateDownloadDialog` (the dialog v3 opens), loaded by
   dynamic `import()`. The download in it is an `<a href target="_blank" rel="noopener">` the learner clicks, so it
   is a manual download that no popup blocker can eat, and it works whatever CORS the certificate bucket sends
   (a blob fetch would not).
   - **Shared change, additive.** `CertificateDialogData` becomes a union. The existing shape is unchanged
     (`courseId` + `courseType`, fetched on click from `download_certificate/`). The new
     shape is `{ certificateUrl, courseTitle? }`, a link the caller already holds. The fetch path narrows on it.
     `Utils` and the badge page need no changes.
   - Not going through `Utils.openCertificateDownloadDialog`: its subscription gate reads `ContentDetails.active_plan`.
     A lab is gated by CAIRA access, which the progress read already enforced.
7. Docs: `docs/AI_LABS_API.md` replaced by the `01c7a4d` edition, run through Prettier.

## Files touched

| File                                                                                               | Change                                                                                                                 |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `features/ai-labs/services/ai-labs-facade.ts`                                                      | graded-first sort                                                                                                      |
| `features/ai-labs/pages/ai-lab-feedback/ai-lab-feedback.html`, `.ts`                               | v3 thank-you markup, "Return to Home"                                                                                  |
| `features/ai-labs/services/ai-lab-feedback-facade.ts`                                              | copy: `returnHome`, drop the unused `cpeAwarded`/`certificatePending`                                                  |
| `features/ai-labs/utils/file-viewer.ts` (new)                                                      | `previewKind`, `signedDisposition`, `renderFileViewer`, `keepPreviewLoading`, `viewerNote`                             |
| `features/ai-labs/services/ai-lab-course-facade.ts`                                                | `freshFileUrl`, `previewFile`, `certificateUrl`, `CERTIFICATE_PENDING` + bounded re-read, `openCertificate()`          |
| `features/ai-labs/models/ai-labs.model.ts`                                                         | `lab_certificate_url`, `'CERTIFICATE_PENDING'` stage                                                                   |
| `features/ai-labs/pages/ai-lab-course/ai-lab-course.ts`, `.html`                                   | `labsHome` + `routePath`, guide/flow-chart rows → `previewFile`, CTA label/disabled/run for the two certificate stages |
| `shared/dialogs/certificate-download-dialog/certificate-download-dialog.ts`, `.html` (+ one story) | union data, link-mode download anchor                                                                                  |
| `testing/mocks/ai-labs.mock.ts`, course + feedback stories                                         | `lab_certificate_url`, a "certificate ready" and a "certificate pending" story                                         |
| `docs/AI_LABS_API.md`                                                                              | 2026-10-27 edition                                                                                                     |

About 300–350 changed lines, excluding the guide. That is one PR; if it runs over, the guide swap goes in its own `docs(ai-labs)` commit.

## Security

- Signed brief links and the certificate link open in `noopener` tabs and are never sent with our auth header:
  the blob read is a plain `fetch(..., { credentials: 'omit' })`, never `ApiClient`.
- **Google viewer fallback:** a PDF whose bucket refuses CORS is shown through `docs.google.com/viewer`, which
  hands Google the signed link, valid for about 15 minutes. This is v3's agreed interim. Build guides are public
  anyway; for the flow chart this is the same trade-off v3 shipped. It goes away once AI Labs signs links `inline`
  or opens CORS.
- The viewer tab is built with `textContent` and attributes only: no `innerHTML`, no API string parsed as markup.

## Acceptance

0. Landing, signed in with practical rows: every `graded` row is above every non-graded row; the order within
   each group is unchanged; the counts are as before.
1. Submit feedback: you see only a check circle, "Thank You!", "Your feedback has been submitted successfully.",
   and "Return to Home", which lands on the lab page. A 409 still shows its notice.
2. Build guide row: a new tab opens showing the guide, with a **Download** button. Nothing downloads on its own. A
   non-previewable type shows the "use Download" note.
3. Course page → feedback → back to the course page → "Back to AI Labs": you land on `/us/accounting/ai-labs`,
   never on feedback.
4. `next_step: done` with a URL: the CTA reads "Download Certificate", and clicking it opens the certificate
   pop-up. Its download button opens the PDF in a new tab. With `null`: the CTA reads "Certificate is being
   generated" and is disabled, `course-progress/` is re-read every 5 s, and the CTA flips once the URL arrives.
   If the URL never arrives, the CTA becomes Rewatch after 60 s.

## Checks

`pnpm lint` · `pnpm check:structure` · `pnpm format:fix` · `pnpm build:prod` · `pnpm build-storybook`.

## How I'll verify

A CDP headless-Chrome script against the dev server (port 4101), with every `ai-labs/` call answered from the
guide's shapes:

- **Bug 0:** shuffled practical rows; read the panel's row order.
- **Bug 3:** go course → feedback → course → click back; read `location.pathname`.
- **Bug 4:** progress `done` + URL: read the CTA label, click it, assert the dialog and its anchor `href`. Then
  progress `done` + `null`, flipping to a URL on the third read: assert the pending label, then the flip.
- **Bug 1:** stub the submit's answer; read the thank-you DOM.
- **Bug 2:** click a build guide; read the new tab's DOM (title bar, Download link, frame).

Then you re-run the real flow on UAT.

## Risks

- **The 60 s certificate budget is a guess.** If generation routinely takes longer, the CTA shows Rewatch until
  the next visit. The fix is to raise one constant.
- **The shared dialog change** touches a file the masterclass, podcast, micro-learning and badge flows use. The
  union keeps their shape, and `build:prod` type-checks every caller.
- **Google's viewer may not render the PDF at all.** The **Download** button in the same tab still works.
