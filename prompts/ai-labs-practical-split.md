# AI Labs: bind the practical split, and fix submit and lab set-up

MIL-117 · branch `feat/MIL-117-ai-labs-refactor` · two PRs, each under ~400 lines.

## Goal

1. **Follow the backend guide's 2026-10-27 split** (`docs/AI_LABS_API.md`, "What changed" items 12–13).
   - The practical (build an agent → submit → graded) no longer sits in the CPE flow. The flow is now video → quiz → final assessment → feedback → certificate.
   - The practical opens on a passed final assessment, gates nothing, and allows up to `max_attempts` graded attempts.
2. **Fix the bugs that stop a learner submitting an agent**, found in the 2026-10-27 parity audit against v3. They are the likely cause of "usaid can't submit".
3. **Fix the bugs that end the lab set-up wait early.**

Nothing here adds a route, an endpoint or a dependency.

## What I read

- `docs/AI_LABS_API.md` (replaced today with the new edition; only items 12–13 differ in content).
- The parity audit: `/private/tmp/claude-501/-Users-apple-Documents-GitHub-miles-masterclass/3793d7bc-4c8e-4234-85f8-a2f8f01f23f6/scratchpad/ai-labs-parity-audit.md`.
- v3 `origin/feat/ai-labs-refactor`: `pages/ai-lab/course/course-journey.ts`, and in `ai-lab-course.ts` `resubmit()` and the submit error switch (lines 1673–1722).
- Ours:
  - `services/`: `ai-lab-course-facade.ts`, `ai-lab-feedback-facade.ts`, `ai-labs-facade.ts`, `ai-lab-account.ts`
  - `pages/`: `ai-lab-course/ai-lab-course.ts|html`, `ai-labs/ai-labs.html`
  - `utils/course-journey.ts`, `models/ai-labs.model.ts`, `constants/ai-labs-api.ts`
  - `src/app/testing/mocks/ai-labs.mock.ts`, `shared/ui/select/select.ts`, `core/services/storage/storage.ts`

## Locked decisions

1. **Feedback follows the final assessment**, as in v3 and the new guide.
   - The `AI_LAB` CTA stage and `next_step: ai_assessment` go away.
   - A passed final assessment now leads the hero CTA to "Submit Feedback", then to the certificate.
2. **The lab still opens on a passed final assessment** (`labOpen = examPassed`). The guide confirms submit refuses before the pass (`final_assessment_not_passed`), so `prompts/ai-labs-course-redesign.md` decision 1 stands.
3. **Submit follows the server.** It is closed while an attempt is grading, or when `assignment-status` says `can_resubmit: false`. The guide now defines `can_resubmit` as "MCQ passed, nothing grading, `attempts_left > 0`". When `attempts_left` is 0 the button reads "No attempts left". `allowed_attempt` (AI Labs' own number) is no longer read for the allowance.
4. **The attempts card reads the new counts.**
   - "Attempts X of Y" = `attempts_used` of `max_attempts`; "N left" = `attempts_left`.
   - The card's attempt is the one numbered `best_attempt_number`, no longer the first row (the list is now oldest first).
   - Every graded attempt is listed, so the "more attempts than listed" line goes.
5. **The progress sidebar goes back to v3's text** wherever ours only differed because feedback waited on the lab grade:
   - Retake: "…retake it to earn your certificate."
   - Complete: "Every step done. Submit again any time to push your score higher."
   - Halfway: "Video done. Take the final assessment — the AI Lab opens once you pass." (v3's line, adjusted for our gate).
6. **A login older than the lab account** (`labs_account.entitled: false`) shows a "Sign in again" line under Launch on the course page and the landing. It uses the same sign-out → login path the landing already uses for `entitlement_refresh_required`.
7. **The set-up wait ends on `labs_account.provisioned`, not on `account_created`.**
   - While `labs_account` is absent (AI Labs not reachable), `account_created` decides, as today.

## Assumptions (please check)

- **A1. The new build is live on UAT** (checked 2026-10-27 with usaid's token). `assignment-status` and `assignment-attempts` carry `max_attempts`, `attempts_used` and `attempts_left`, so nothing handles the old build.
- **A2. "Graded" means a counted attempt, not the status word or the latch.** usaid's live data:
  - `assessment_status: "completed"` with `submission_id: null`, `score: null`, `completed_at` 2026-10-14;
  - `attempts_used: 0` and an empty attempts list;
  - `ai_assessment_completed: true` on status, progress and the feedback gate.

  That is a latch from before the split, with no graded attempt behind it. So:
  - `labDone` is `assessment_status === 'completed' && attempts_used > 0`.
  - `labEverGraded` is `attempts_used > 0 || best_attempt_number !== null`.
  - `ai_assessment_completed` is no longer read.

  Without this, usaid's page shows "Evaluated — your scores are above" over an empty grade card and ticks the lab "Graded". Backend question 20 asks them to confirm.

- **A3. Field labels.** The agent/workflow selects get a visible label above each one ("Agent", "Workflow"), a placeholder ("Choose an agent" / "Choose a workflow") and an `ariaLabel`. I'm not adding a floating label to the shared `Select`; `shared/ui` stays unchanged.

## Phases

### PR A: `feat(ai-labs): follow the practical split and the attempt allowance` (~250 lines)

**Models** (`models/ai-labs.model.ts`)

- Drop `'ai_assessment'` from `AiLabNextStep`.
- Drop `'AI_LAB'` from `AiLabCtaStage` and `AI_LAB_QUIZ_BEHIND`, and fix the stage doc comment.
- `AiLabAssignmentStatus` gains `max_attempts`, `attempts_used` and `attempts_left`. Docs: `score`/`percentage`/comments/grade card are the best attempt's; `can_resubmit` follows the allowance.
- `AiLabAttempts` gains `max_attempts`, `attempts_used`, `attempts_left` and `best_attempt_number`. Docs: oldest first; `allowed_attempt` is AI Labs' own number.
- The feedback gate doc reason becomes `final_assessment_not_passed`.

**Course facade**

- `STAGE_FOR_STEP` loses `ai_assessment`.
- The submit error map (PR B) gains `practical_attempts_exhausted`.

**Course page**

- Remove the `AI_LAB` cases: the label, `runCta` and the html `@if (ctaStage() !== 'AI_LAB')`. The "Go to the AI Lab" outline button then shows whenever the lab is open, as in v3.
- `examUnlocks`: Feedback, Certificate and AI Lab.
- Text:
  - `finalHint` passed: "Passed — leave feedback for your certificate. The AI Lab is open below."
  - `heroHint` after the pass: "Assessment passed — leave feedback to get your certificate. The AI Lab is open below whenever you're ready."
  - The graded line becomes v3's: the certificate no longer follows the grade.
- Attempts:
  - `bestAttempt` is found by `best_attempt_number`.
  - `totalAttempts` → `attempts_used`; `allowedAttempts` → `max_attempts`; `attemptsLeft` → the server's `attempts_left`.
  - Drop `attemptsHidden` and its template line.
- Submit lock:
  - `alreadySubmitted` → `submitClosed = evaluating() || assignment()?.can_resubmit === false`.
  - The button reads "No attempts left" when `attempts_left === 0`.
  - `labHint`: "Evaluated — your best score is above. Submit again to improve it." or "…You've used all N attempts."
  - The picker header line drops "Submit it again" when no attempts are left, and gets back v3's "— your best score is kept."
- `labDone` / `labEverGraded` read the attempt counts (A2). Drop the `ai_assessment_completed` reads in the page.

**Journey** (`utils/course-journey.ts`): the text from decision 5, and the header comment.

**Feedback facade**

- `notYet` title: "Feedback opens once you pass the final assessment".
- Fallback: "Pass the final assessment first — feedback opens once you do."
- Fix the class comment.

**Constants:** fix the comments in `ai-labs-api.ts` that mention `practical_already_completed` and `ai_assessment`.

**Mocks and stories**

- `mockAiLabProgress` uses the new step order.
- `LabUnlocked` becomes a FEEDBACK-stage story; `MOCK_AI_LAB_ATTEMPTS` is oldest first and carries the new counts.
- New `AttemptsExhausted` story (3 of 3, `can_resubmit: false`).

### PR B: `fix(ai-labs): make the agent picker usable and hold the lab set-up wait` (~220 lines)

**Picker**

1. **The selects have no name.** Replace the dead `label="…"` attributes with a visible label above each select, a `placeholder` and an `ariaLabel` (A3).
2. **The provisioning check can throw.** `labProvisioned` reads `value()` only behind `hasValue()`.
3. **Disabled flows still count.**
   - The facade exposes `enabledFlows`.
   - The header ("agent or workflow"), the workflow select's `@if`, `hasArtefacts` and the options all use it.
4. **The picker locks on every status check.** `pickerLocked` drops `statusLoading()`, as in v3, which locks only on submitting or evaluating. The 12 s grading poll stops flickering the select.
5. **"Submit again" after a failed evaluation goes to the wrong place.**
   - Set a `retrying` flag, which hides the error card and shows the picker, re-read agents and flows, and scroll to the picker (step 05).
   - The flag clears when a new submission is recorded.
6. **Submit errors share one toast.** They now map by reason, using v3's text where the case exists:
   - `AI_LABS_ALREADY_IN_PROGRESS` and any other 409 except the two named below → info "Already submitted / An evaluation is already running.", then re-read the status.
   - `practical_attempts_exhausted` → info "No attempts left / You've used all {max_attempts} graded attempts for this lab.", then re-read the status and attempts.
   - `ai_lab_assignment_not_configured` → error "This AI Lab's practical is not set up yet."
   - `final_assessment_not_passed` → info "Not yet / Pass the final assessment before submitting the lab."
   - `AI_LABS_VALIDATION_REJECTED` → error "Pick again" + the server's message, then clear the pick and re-read the lists.
   - `AI_LABS_NOT_PROVISIONED` → info "Lab not ready / Your AI Lab account is still being set up. Try again in a few minutes."
   - Session refused → the existing "sign out and back in" text.
   - Anything else → "Couldn't submit" + the message.

**Lab account** 7. **`entitled: false` is ignored.** `AiLabAccount` exposes `needsRelogin` (`provisioned && entitled === false`) and `relogin()`: sign out, then go to `/auth/login?redirect=<this page>`. The course page and the landing show "Your AI Lab account is ready — sign in to Miles again to use it." with a "Sign in again" button. The landing's existing `entitlement_refresh_required` dialog calls the same `relogin()`. 8. **The set-up wait ends on `account_created`.**

- `AiLabsFacade.hasLabAccount` → `labReady = account_created && labAccount.provisioned() !== false`.
- The poll re-reads both reads and stops on `labReady`. This also means the lab email (`login_hint`) and the environment link are known the moment set-up ends.

9. **A reload never resumes the wait.** Store and compare the flag as a boolean (`setSession(KEY, true)`, `getSession<boolean>(KEY) === true`). Today `getSession` JSON-parses `'true'` to `true`, which never equals the string `'true'`.
10. **"This is taking longer than expected" can never show.** `awaitingAccount` excludes `pollTimedOut()`, so that line can appear after five minutes.
11. **The credits meter stays hidden after set-up.** When `labReady` turns true, re-read credits (`AiLabCredits`).

## Files touched

- **PR A:**
  - `models/ai-labs.model.ts`, `constants/ai-labs-api.ts`
  - `services/ai-lab-course-facade.ts`, `services/ai-lab-feedback-facade.ts`, `utils/course-journey.ts`
  - `pages/ai-lab-course/ai-lab-course.ts|html|stories.ts`, `testing/mocks/ai-labs.mock.ts`
- **PR B:**
  - `pages/ai-lab-course/ai-lab-course.ts|html`, `services/ai-lab-course-facade.ts`, `services/ai-lab-account.ts`
  - `services/ai-labs-facade.ts`, `services/ai-lab-credits.ts`, `pages/ai-labs/ai-labs.ts|html`
  - `testing/mocks/ai-labs.mock.ts` (an `AiLabAccount` stand-in with `needsRelogin`)
- **Both:** `docs/refactor/STATE.md` (the Now bullet). `docs/AI_LABS_API.md` was already replaced today and goes in PR A.

## Security

No change to what the browser can see or do. The re-login goes through `AuthSession.logout()`, which already clears the lab session. No token or secret is touched.

## Acceptance criteria

- **After a pass** (`next_step: feedback`):
  - Hero CTA "Submit Feedback"; step 01 lists Feedback, Certificate and AI Lab.
  - The lab is open, and "Go to the AI Lab" is shown.
  - The feedback page opens.
- **Attempts 2 of 3** (best #2):
  - The card shows attempt 2's score and "Attempts 2 of 3 · 1 left".
  - The history is oldest first; Best is on #2, Latest on #2.
  - "Submit again" is enabled.
- **Attempts 3 of 3** (`can_resubmit: false`): the button reads "No attempts left" and is disabled, with no "Submit it again" text.
- **The selects** have a visible label, a placeholder and an accessible name. A disabled-only flow list renders no workflow select.
- **One failing list:** agents 403, flows `[]` → the page renders and shows the picker's message, with no `ResourceValueError` in the console.
- **Failed evaluation:** "Submit again" hides the error card, re-reads both lists and scrolls to the picker.
- **Each submit reason** shows its own toast, as listed in PR B item 6.
- **`entitled: false`** shows the "Sign in again" line, and the button signs out and returns to the page after login.
- **Landing:**
  - With `account_created: true` and `provisioned: false`, it keeps "Setting up your lab…".
  - A reload mid-wait resumes the poll.
  - After five minutes it shows "This is taking longer…".
  - Once provisioned, the lab email and credits appear without a reload.

## Checks

`pnpm lint` · `pnpm format:fix` · `pnpm check:structure` · `pnpm build:prod` · `pnpm build-storybook`.

## How to verify

1. **Headless Chrome on `pnpm start` (4101),** with `*milescaira.com/*ai-labs/*` intercepted and a fake `ACCESS_TOKEN` cookie, as in the identity check. Give each acceptance row its own canned response set, and log console errors.
2. **Storybook:** _AI Labs/Course page_ → `LabUnlocked` (feedback stage), `RedesignGradedWithHistory` (best by number), `AttemptsExhausted`.
3. **UAT (the new build is live):** usaid's account on Lease Audit Agent (`5e974de7…`) end to end:
   - pick "Recognition Agent testing", submit, grade, resubmit;
   - check attempts 1 → 2 of 3 and the best-attempt card.

## Risks

- **The pre-split latch** (A2): if backend says `completed` with no attempts is meaningful, the lab step loses its "Graded" tick for those learners until they submit once.
- **A done lab with no certificate:** usaid's progress is `next_step: done`, `feedback_submitted: true`, `cpe_awarded: true`, `lab_certificate_url: null`. The page shows "Certificate is being generated" for 60 s, then Rewatch. This is a backend question (21), not code.
- **The status score scale** is unconfirmed (backend question 5). The card keeps leading with `percentage`, and with the attempt's own out-of-10 score when an attempts list exists.
- **PR B item 4** drops the lock during status reads. A click that lands during a re-read can now submit. The server answers 409 if grading has started, and item 6 turns that into "Already submitted".
- **PR B item 8 adds a second read to the landing poll** (the `include` read calls AI Labs). It runs only while waiting for set-up, every 12 s, for at most five minutes.
