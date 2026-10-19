# MIL-111: download the masterclass certificate after feedback

**Status:** revision 1, 2026-10-19, approved and implemented.

**Branch:** `feat/MIL-111-certificate-download`, stacked on `feat/MIL-110-course-feedback` (`46bdfc7`), which is stacked
on MIL-109 (#177). It rebases onto `master` as those merge.

**Input:**

- `prompts/final-assessment-analysis.md` (§2.9, §6 Q1–Q2)
- the App 5 Postman export: `course-detail`, `course-progress`

## Jira

```
Story  MIL-107  feat(offerings): bind the masterclass final assessment, feedback and certificate to the web API
  Sub  MIL-108  start and submit the final assessment          ✅ #175
  Sub  MIL-109  the assessment report                          #177, in review
  Sub  MIL-110  course feedback                                 committed, PR after #177
  Sub  MIL-111  feat(offerings): download the masterclass certificate after feedback   ← this plan
```

## Assumptions (read first)

1. **The rule (your call):** the certificate button shows **disabled until the feedback is in, and enabled once it
   is**. That is `feedback_submitted` on the course read, the same rule the previous app used
   (`user_feedback_submitted`).
2. **There is no certificate API to call.**
   - The PDF's link arrives as `masterclass_certificate_url` on `course-detail` and on `course-progress`.
   - `feedback-submit` only _triggers_ the PDF (`certificate_triggered: true`); the backend generates it
     asynchronously.
   - So for a short while after the feedback, the button is enabled but has no link yet.
3. **Waiting for the PDF:** after a successful feedback submit, the page checks `course-progress` quietly every 5
   seconds, for up to 2 minutes, until `masterclass_certificate_url` arrives.
   - **Quietly:** `SKIP_LOADING`, so no loading bar.
   - **While waiting:** the button reads "Preparing Certificate…" (disabled).
   - **If the link still isn't there:** the button is enabled again, and a click says "Your certificate is being
     generated" and checks again.
   - `course-progress` is used rather than re-reading `course-detail`, because it is the lighter read and both carry
     the same two fields.
4. **One PDF:** the previous app's dialog offered one PDF per field of study, in NASBA and Miles versions, through
   `user-assessment/download_certificate/` (404 on UAT). The new API exposes one `masterclass_certificate_url`, so
   Download opens that one PDF in a new tab. Whether it is the NASBA one is backend question Q1, still open.
5. **Popup blockers:** the PDF opens synchronously inside the click, so blockers allow it. When the link isn't there
   yet, nothing opens; the learner gets the message and the check runs again.

## Where the certificate is downloaded

**In the previous app, for a masterclass:**

1. **Course hero:** the "Download" icon button, disabled until feedback was in. It opened the certificate dialog
   (per field of study, NASBA / Miles).
2. **Assessment report header:** "Download Certificate", disabled until feedback was in. Same dialog.
3. **Feedback thank-you view:** "Download NASBA Certificate", a link from the submit response. The Miles one was
   commented out.
4. **CPE tracker:** a per-row certificate, the NASBA template download, and "Download all certificates" for a year.
5. **Badge library:** "Download Certificate" on a card whose feedback is in and that has a NASBA certificate.

**Other offerings, out of scope:** the webinar hero, list item, card and details dialog; the podcast hero; the
micro-learning reel card (its `DOWNLOAD` action); the AI Lab course page.

**In this repo today:**

| Trigger                 | State                                                                             | After MIL-111                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Course hero "Download"  | Enabled only once `masterclass_certificate_url` exists (`CourseDetailFacade`)     | **Changed:** the rule above, through the new facade. The method moves out of `CourseDetailFacade`. |
| Report header           | None                                                                              | **Added:** "Download Certificate", beside "Feedback Submitted"                                     |
| Feedback thank-you      | None                                                                              | **Added:** "Download Certificate" ("Preparing Certificate…" while waiting)                         |
| CPE tracker             | No download action. Its model says it waits for `credits/<award_id>/certificate/` | Unchanged, out of scope (tracker ticket)                                                           |
| Badge library           | The old dialog (`user-assessment/download_certificate/`, 404 on UAT)              | Unchanged, out of scope                                                                            |
| Podcast, micro-learning | The old dialog                                                                    | Unchanged, out of scope                                                                            |

## Endpoint map (`web-api/v1/masterclass/`, read only)

| Read                     | Route                       | Fields read                                                        |
| ------------------------ | --------------------------- | ------------------------------------------------------------------ |
| `course-detail` (exists) | `course-detail/<course>/`   | `feedback_submitted`, `masterclass_certificate_url`                |
| `course-progress` (new)  | `course-progress/<course>/` | `masterclass_certificate_url` (string or null), only while waiting |

`course-progress` is `IsAuthenticated`. Its top level carries the same completion flags as `course-detail`
(`feedback_submitted`, `masterclass_certificate_generated`, `masterclass_certificate_url`, …).

## Target architecture

- **`COURSE_DETAIL_API.masterclass`** gains `courseProgress` (the GET twin of `course-progress-update`).
  `CourseDetailFacade` gains `courseProgressUrl()` and loses `downloadCertificate()`, which moves.
- **`course-detail.model.ts`** gains `parseCertificateLink`, which reads only `masterclass_certificate_url` from
  `course-progress`'s `data`.
- **New `CourseCertificateFacade`** (`@Service({ autoProvided: false })`, on the course route beside the other three):
  - `canDownload`: signed in and `feedback_submitted`.
  - `link`: the course's `masterclass_certificate_url`, or the one the wait found first.
  - `waiting`: a check is running and no link is in yet.
  - `watch()`: an RxJS check, the AGENTS.md §4.2 way for polling.
    - `timer(0, 5 s)`, `take(24)`, then a `course-progress` GET with `SKIP_LOADING`.
    - It stops at the first link, and one watch at a time.
    - **As built:** it also stops once the address bar leaves the course's pages, or on sign-out. The course route's
      services outlive its pages, so the URL is the signal.
  - `download()`:
    - With a link: opens it in a new tab (`noopener`).
    - Without one: "Your certificate is being generated", then `watch()`.
- **`CourseEvaluationFacade.submit()`** calls `certificate.watch()` after a successful submit.
- **Constants:** `CERTIFICATE_COPY`, `CERTIFICATE_POLL_SECONDS = 5`, `CERTIFICATE_POLL_ATTEMPTS = 24`.
- **UI:**
  - **Report header:**
    - "Download Certificate" (white, download icon) after a pass.
    - Disabled until `canDownload()`, and while `waiting()` ("Preparing Certificate…").
  - **Hero:** the Download icon button follows the same rule (the label stays "Download").
  - **Thank-you view:** "Download Certificate" first, then the existing Continue / View Report and Back to Course.

## Files touched

| File                                                                  | Change                                                         |
| --------------------------------------------------------------------- | -------------------------------------------------------------- |
| `features/offerings/constants/course-detail.ts`                       | `courseProgress` route; `CERTIFICATE_COPY`; the poll constants |
| `features/offerings/models/course-detail.model.ts`                    | `CourseDetailApi.courseProgress`; `parseCertificateLink`       |
| `features/offerings/services/course-detail-facade.ts`                 | `courseProgressUrl()`; `downloadCertificate()` moves out       |
| `features/offerings/services/course-certificate-facade.ts` (new)      | the rule, the wait, the download                               |
| `features/offerings/services/course-evaluation-facade.ts`             | `watch()` after a submit                                       |
| `features/offerings/masterclass/masterclass.routes.ts`                | the facade provider                                            |
| `features/offerings/pages/final-assessment-report/*`                  | "Download Certificate"                                         |
| `features/offerings/pages/course-evaluation/*`                        | "Download Certificate" on the thank-you view                   |
| `features/offerings/masterclass/components/masterclass-course-hero/*` | Download through the new facade                                |
| `docs/refactor/STATE.md`                                              | "Now", step log                                                |

**Estimate:** about 250 changed lines, inside the ~400 guide.

## Security

- **Reads only:** the poll is an authenticated GET, sent through the interceptors.
- **Opening the PDF:** the link is opened with `noopener`; it is the server's own URL and is never built on the client.
- **Trust boundary:** the poll's response is parsed. A drift stops the wait, is logged, and leaves the button enabled.

## Acceptance criteria

1. **Report and hero:** after a pass, before feedback, "Download Certificate" and the hero's Download show disabled.
   Signed out or before a pass, the report button isn't there.
2. **During the wait:**
   - A successful feedback submit starts the wait: one `course-progress` GET every 5 s, no loading bar.
   - The thank-you view shows "Preparing Certificate…" (disabled).
   - The wait stops at the first `masterclass_certificate_url`.
3. **Once the link is in:** "Download Certificate" is enabled on the thank-you view, the report header and the hero.
   It opens the link in a new tab.
4. **Feedback in, no link yet** (for example, coming back later):
   - The button is enabled.
   - A click shows "Your certificate is being generated" and starts a wait.
   - It opens on a later click, once the link is in.
5. **Timeout:** after 24 checks with no link, the wait stops quietly and the button is enabled again.
6. **Navigation:** leaving the course's pages stops the wait, with no further requests. Moving between the course's
   own pages (report → course page) keeps it going.
7. **Layout:** 375 px with no horizontal scroll; the console shows no errors besides the stubbed refusals.

## Checks

`pnpm lint` (0 errors), `pnpm check:structure`, `pnpm format:fix`, `pnpm build:prod` (only `ai-labs.css`).

## How to verify

- **Headless, on dev 4101:**
  - `course-progress` is stubbed to return no link for N checks, then a URL.
  - Covers the criteria above: request timing, no loading bar, the new-tab URL, the timeout, and leaving the route.
- **Hand test:** extend `.playwright-mcp/manual-mil110.js` so that the certificate arrives about 10 s after the
  feedback.
- **Live UAT (you):** submit feedback on a passed course, then see how long `masterclass_certificate_url` takes to
  appear. That answers backend Q2, and tells us whether 2 minutes is the right limit.

## Risks

- **Generation time is unknown (Q2).** If it often takes longer than 2 minutes, the learner sees "being generated" on
  the first click. The limit is one constant.
- **One PDF (Q1).** If the backend later serves NASBA and Miles versions, Download becomes a small choice dialog.
- **`course-progress`' shape** is read for one field only, so other drift there doesn't break this.
