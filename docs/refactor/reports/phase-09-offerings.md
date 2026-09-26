# Phase 9 — Data layer · `features/offerings`

Date: 2026-09-26 · Branch: `refactor/structure-10` · Run before Phase 10 offerings, by your call (no waiver).

## 1. Summary

**Five facades** moved their rendered reads to `httpResource`. **Three pages** lost their
`effect()` → `subscribe()` → `signal.set()` loaders. **One new shared helper** was added. Source is
+426 / −396 (nearly even); specs are +464, with 17 new tests.

The rule is the `FeatureFacade` precedent from [phase-09-core-shared](phase-09-core-shared.md):

- A read that feeds rendered state becomes an `httpResource`.
- These stay on `HttpClient`/RxJS, and are listed in §3: one-shot reads from event handlers, polling,
  cursor pagination, POST-shaped reads, and downloads.

### 1.1 Facades converted

**`webinar-facade`** (S1): the feed and the detail read moved from `resource()` + `firstValueFrom` to
`httpResource`.

- The server-clock sync moved into `parse`. It runs once per response, including the browser's replay of the
  transfer-cached SSR response, exactly as the loader did.
- The error banner is a `linkedSignal` over the resource snapshot. It is held through a refetch and cleared
  only by a success, like the old flag.
- A detail 404 counts as "missing", not as a failure, and is not logged.
- Logging moved to `effect`s.

**`feedback-facade`** + `course-feedback` page (S2): three Observable getters became resources keyed on
`showCourse(id)`.

- The user-feedback read chains on `feedbackSubmitted`.
- The page's two-level subscribe chain is gone. `ratings` and `otherComments` are `linkedSignal`s over the
  submitted answers, so they stay editable.

**`final-assessment-facade`** + exam and report pages (S3): the `loadAssessmentData()` chain split into a
details resource, shared by both pages, and a questions resource.

- The questions read is gated on "not passed" and "no cached attempt". The localStorage cache write moved
  into `parse`, where the old `tap` was.
- `isAssessmentPassed` is now a `computed`.
- The `assessment_start` event moved to an `effect`: once per load, never for a passed course.
- `getCourseDetails()` was deleted; the report page reads `facade.courseDetails`.
- The exam page's `isLoading` is now the facade's loading OR its own submitting.

**`chapter-facade`** + **`masterclass-facade`** (S4, S5): both had the same
`forkJoin(details, chapters)`. They now share **`features/offerings/utils/course-load.ts`**
(`courseLoad()`):

- two resources, joined by a `loaded` computed so that **neither shows until both answer**, which is the
  forkJoin's all-or-nothing behaviour;
- `details` and `chapters` are `linkedSignal`s, so the in-place edits survive until the next load: the
  CPE-mode switch, the quiz report, activity tracking and the cart-removed flag;
- loading or a failure keep what is shown, as the subscription did, and only `clear()` empties it;
- `loading` = the reads OR the CPE-mode POST (a new `opLoading`), the same split `PaymentFacade` made in
  core/shared;
- `error` is derived, and logging is in an `effect`;
- `view_item` fires in an `effect` on `loadedDetails`: once per load, never on a local edit.

### 1.2 One trap worth recording

**A `linkedSignal` only "keeps the previous value" if something read that value.** It is lazy. The first
version of the S4 test switched courses without ever reading `courseDetails`, so "previous" was the stale
`null` from before the first load. In the app the templates read these signals continuously, so this is
not a bug there. It is the same lazy-computation property the core/shared report hit with the `pages` Map.
The test now reads the signal the way the page does, and says why.

## 2. Verification

`node scripts/refactor/verify.mjs`, full run, local macOS / Node 24.15: **8/8 green**.

| Gate            | Result                                                                |
| --------------- | --------------------------------------------------------------------- |
| lint            | pass                                                                  |
| unit tests      | pass: 169 files, **616 passed** + 1 skipped (was 599)                 |
| build (local)   | pass                                                                  |
| build (prod)    | pass                                                                  |
| storybook build | pass                                                                  |
| format check    | pass                                                                  |
| bundle report   | pass: initial 88.5 KB gz, −0.7 KB vs baseline (unchanged by this row) |
| ssr smoke       | pass: 4 of 4 routes, matching the baseline                            |

- **`reviewer`: PASS, zero violations.** It checked §4.2 compliance, parity against `HEAD` for each
  facade, every non-conversion in §3, the placement of `course-load.ts`, spec quality, and boundaries.
- ⚠️ **SSR cannot show that the course reads render on the server from this machine.** The masterclass
  route's title is `{{title}}` in both the baseline and this run. That is the documented pre-existing
  course-API condition (STATE.md, phase-09-core-shared §2). `httpResource` goes through `HttpClient`, so
  SSR still waits for it and the transfer cache still applies, but only a deploy or UAT run proves it.
- **Browser:** not run. Every converted page is signed-in (exam, report, feedback, chapter player) or needs
  UAT data (webinars). The QA list is in §4.

## 3. Decisions needed / skipped / suspicious

- **No decision needed** to close this row.
- **PR size: over the ~400-line guideline.** §5 splits it into three commits, one concern each, with
  their specs.

**Not converted, on purpose (reviewer agreed):**

| Read                                           | Why it stays                                                                                                                                                                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `micro-learning-course-facade` feed            | The anchored first page of a **cursor** feed, and one of three mutually exclusive sources for `detailsList`: router handoff state, seeded course details, or this fetch. Cursor pages append to the list and the player mutates it. |
| `micro-learning-course-facade.openChapterQuiz` | Fetched on a CTA click, then opens a dialog.                                                                                                                                                                                        |
| `masterclass-facade.fetchCourseContent`        | On demand, returns an Observable to 5 callers with per-reel caches (transcript, glossary, about, resources).                                                                                                                        |
| `masterclass-facade` exercise files            | Blob download.                                                                                                                                                                                                                      |
| `chapter-facade.fetchQuizReport`               | Merges into the locally edited chapters. A resource source would reset those edits.                                                                                                                                                 |
| `final-assessment-facade.getAssessmentReport`  | A **POST**, which §4.2 never puts on `httpResource`.                                                                                                                                                                                |
| `micro-learning` "Start watching" first page   | Click-triggered, with `exhaustMap` against double clicks.                                                                                                                                                                           |
| `webinar-registration` attempt status          | **Polling.**                                                                                                                                                                                                                        |
| `meeting-session`                              | POSTs only.                                                                                                                                                                                                                         |

**Bugs found, logged, not fixed:**

1. 🚨 **Course feedback can never be submitted.** `course-feedback.ts`'s `currentUser` is an inert
   `signal(null)` (a "ponytail" stub left from the removed `Auth` service). `submit()` treats anything but
   `is_profile_completed === true` as incomplete, so **Submit always opens "Complete your profile"**. This
   is pre-existing, and the same family as the `footer-overlay` stubs fixed in Phase 9 `layout`. The fix
   needs a user source (`AccountApi.user`), which is a behaviour change for you to approve.
2. **AI Lab feedback probably 404s its course-details read.** `feedback-facade` builds
   `v2/:course_type/details/` from `getCourseType()`, which returns `ai_lab`. `Utils.getCourseDetailsSegment()`
   documents that `v2/ai_lab/details/` is a 404 and maps it to `micro-learning`, but this path was never
   switched to it. It is pre-existing and carried over unchanged.

No `@Injectable`, CSS file, or heavy-library service is involved.

## 4. Visual QA list (signed in, UAT data)

1. **Masterclass and podcast course pages:**
   - details and chapters render;
   - "Switch to CPE/Preview" updates the page in place;
   - removing the course from the cart clears "in cart";
   - one `view_item` per course in the analytics debugger.
2. **Chapter player (masterclass and podcast):**
   - next/previous chapters work;
   - a completed chapter's quiz report shows;
   - switching mode resets progress;
   - the subscription gate still exits a deep link.
3. **Final assessment:**
   - a fresh attempt loads its questions;
   - reload mid-attempt: the answers are kept (cache);
   - a passed course shows "Assessment Completed";
   - submitting shows a spinner, then the result dialog;
   - "Retake" starts a new session.
4. **Assessment report:** the course title and header render, and so does the report.
5. **Course feedback:**
   - categories and course render;
   - a course with feedback already submitted shows it read-only, pre-filled.
   - Submitting is blocked by bug 1.
6. **Webinars:**
   - the landing rails render;
   - an API failure shows the banner, and it stays up through a retry;
   - a non-existent id shows not-found;
   - `?preview=design` still works in dev.

## 5. Commit messages (three commits, one concern each)

**1.** `webinar-facade.ts` + `.spec.ts`

```
refactor(offerings): move the webinar feed and detail reads to httpResource

- feed and detail resource() + firstValueFrom -> httpResource
- server-clock sync in parse (still runs on the transfer-cache replay)
- error banner held through a refetch; a 404 detail counts as missing
- +4 spec tests for the reads

Phase 9 (data layer), features/offerings.
```

**2.** `feedback-facade.ts` + new `.spec.ts`, `course-feedback.ts`, `final-assessment-facade.ts` + `.spec.ts`,
`final-assessment-exam.ts` + `.spec.ts`, `final-assessment-report.ts`

```
refactor(offerings): move the feedback and final-assessment reads to httpResource

- FeedbackFacade: categories, course details and submitted feedback are
  resources keyed on showCourse(); the page's subscribe chain is gone
- FinalAssessmentFacade: loadAssessmentData() -> details + questions
  resources (cached attempt and passed course skip the fetch);
  isAssessmentPassed computed; assessment_start in an effect
- the report read is a POST and stays on HttpClient
- +9 spec tests; exam spec mocks the facade's signals

Phase 9 (data layer), features/offerings.
```

**3.** new `utils/course-load.ts`, `chapter-facade.ts` + `.spec.ts`, `masterclass-facade.ts` + `.spec.ts`
(+ STATE.md and this report)

```
refactor(offerings): share the course details + chapters load as httpResource

- courseLoad(): two httpResources joined so neither shows until both
  answer (the old forkJoin), exposed as linkedSignals so in-place edits
  survive until the next load
- ChapterFacade and MasterclassFacade use it; loading = reads OR the
  CPE-mode POST; view_item fires once per load
- +4 spec tests

Phase 9 (data layer), features/offerings.
```
