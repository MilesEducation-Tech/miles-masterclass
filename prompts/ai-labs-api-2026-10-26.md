# AI Labs: bind the 2026-10-26 API additions (rev 3)

## Goal

Bind what changed in the backend's AI Labs FE guide, edition 2026-10-26 (backend `21a0042`, pasted by the user), on the
course page we just redesigned — filling the empty slots it was built with where the backend now serves the data.

## What was read

- The new guide, all sections; its "What changed" table (7 items).
- Ours: `AiLabCourseFacade` (brief, status, `openInputFile`, `reasonOf`/`messageOf`, `ctaStage`/`STAGE_FOR_STEP`),
  `AiLabAssessmentFacade` (submit, `cool_off_active` read error), `pages/ai-lab-course`, `pages/ai-lab-exam`,
  `ai-labs.model.ts`, `constants/ai-labs-api.ts`, the story mocks, `docs/AI_LABS_API.md`.

## The guide's changes, against our code

| #   | Change                                                                                                                                                                                                                                  | Our state                                                                                    | Action                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------- |
| 1   | **NEW** `GET web-api/v1/ai-labs/assignment-attempts/<id>/`                                                                                                                                                                              | `facade.attempts` is an empty slot                                                           | **Bind**               |
| 2   | Brief re-cut: `requirements, exercise_files, build_guides, sharepoint_links, sample_grade_card, flow_chart, tools`; `input_files, logic_flow, difficulty, version, published_date, scenarios` **gone**; `problem_statement` is Markdown | Model + template read the gone fields; `openInputFile` re-signs by `input_files[].name`      | **Re-bind (breaking)** |
| 3   | Course detail: instructor objects, `chapter`, **`final_assessment_status`**                                                                                                                                                             | First two bound last week                                                                    | **Bind the status**    |
| 4   | `course-progress/` and `course-assessment-submit/` carry `final_assessment_status`                                                                                                                                                      | `RETAKE_EXAM` is never produced (`next_step: final_assessment` → always "Take"); no cool-off | **Bind**               |
| 5   | Vendor codes `AI_LABS_STORAGE_UNAVAILABLE` (503, retry), `AI_LABS_CONFIGURATION_REJECTED` (502, try later)                                                                                                                              | Only re-login codes are told apart; a failed brief renders nothing                           | **Add**                |
| 6   | `account-ensure/?include=labs_account`                                                                                                                                                                                                  | Guide: "AI Labs account screen only" — we have no such screen                                | **None** (noted)       |
| 7   | Quiz/assessment questions from AI Labs' serializer, same keys                                                                                                                                                                           | —                                                                                            | **None**               |

## Changes

### Brief (2)

- `AiLabAssignmentBrief` → the 12 new keys (`requirements: string[] | null`, files as `AiLabFile`, links as
  `AiLabLink {url, label, sort_order}`, `sample_grade_card`, `flow_chart`, `tools: {trigger_email}`). `AiLabInputFile`
  goes.
- The facade's `requirements`, `buildGuides`, `flowChart`, `sampleGradeCard` slots become `computed`s off the brief,
  arrays sorted by `sort_order`. New: `exerciseFiles`, `workspaceLinks`.
- **Signed links (~15 min).** `openFile(file)` replaces `openInputFile`: a public build guide opens as is; a signed
  file (exercise, flow chart, sample card) older than 10 min re-reads the brief first and opens the fresh link,
  matched by group + `sort_order` + `filename` (the tab opens inside the click, as today).
- **Fix: `is_provisioned: false` answers `brief: {}`.** Today that renders an empty assignment; it becomes "no brief"
  plus the existing create-account line.
- Page: materials list = SharePoint links (label, else the URL; the first keeps the copy button; the course's own
  `ai_lab_course_sharepoint_artefact_url` only when the brief has none), the AI kit, exercise files (filename + type +
  size). Logic flow, difficulty and scenarios leave the template. `tools.trigger_email` has no route behind it in the
  guide → still not rendered.

### Attempts (1)

- Route + `AiLabAttempts` per the guide (`total_attempts`, `grade_card_urls_expire_at`, rows without comments —
  `master_comment`/`minor_comment` become optional and show only when sent; `allowed_attempt` stays optional/absent,
  so the header shows "Attempt N of M").
- `httpResource`, read once the lab is started and mapped; `is_provisioned: false` = empty list. Re-read when a grade
  lands and after "check result".
- A grade card past `grade_card_urls_expire_at` re-reads attempts before opening (same in-click tab pattern).
- `STORAGE_UNAVAILABLE` / call-failed → one line "Couldn't load your attempts — Retry" (upstream's line), no toast.
- Our latest-grade card (`assignment-status/`) stays as the fallback while the list is empty.

### `final_assessment_status` (3, 4)

- Model `AiLabFinalAssessmentStatus` (`locked | start | cool_off | retake | passed | ended`, `cool_off_ends_at`). Read
  off `course-progress/` once started, else the detail.
- CTA at `next_step: final_assessment`: `start` → Take, `retake` → **Retake**, `cool_off` → new stage `COOL_OFF`:
  disabled, "Retake after 4:40 PM"; a timer re-reads progress when it ends. `locked` → disabled.
- Journey: `examRetake` = `retake | cool_off` (step 01 turns amber).
- Exam page: a failed submit whose status is `cool_off` shows "You can retake after …" in place of an immediate Retake.

### Vendor codes (5)

- `reasonOf` callers learn the two codes: brief → `STORAGE_UNAVAILABLE`/call failures show "We couldn't load the brief
  right now" + Retry (today: nothing); `CONFIGURATION_REJECTED` → "try later", never "sign in again".

### Docs, mocks, stories

- `docs/AI_LABS_API.md` replaced with the 2026-10-26 edition.
- Brief and attempts mocks to the new shapes; the `Redesign…` stories now fill through the brief, not the slots; a
  cool-off story.

### Revision 2 of the same guide (items 8 and 9, re-sent by the user)

- **Scores out of 10.** Attempts carry `score`/`max_score` as `"8.80"`/`"10.00"` (the ring already shows
  score out of max). **`sample_grade_card.sample_grade` is now out of 10 (`"7.85"`)** — our sample card divides a
  percentage by 10, so it would read 0.8. It changes to: ring = `sample_grade × 10`%, number = `sample_grade`, and the
  illustrative fallback becomes `"7.85"`.
- **Attempts: `allowed_attempt` is sent** (the list's cap and the allowance; not enforced at submit), and every row
  carries `master_comment`/`minor_comment` (either may be `null`). Read it — never hard-code 3. Header: "Attempts
  `total` of `allowed`" with what's left; "Your best 3 of 5 attempts" when more exist than listed.
- **Reset password** (landing hero's "Resend credential"):
  - new `PROVISIONING_IN_PROGRESS` (200) → info "Your lab is being set up — try again in a few minutes" (today it
    falls through to "Email not sent");
  - `RESET_EMAIL_FAILED` now also means "reset, but the email failed": the old password is dead → "Try again — each
    retry issues a new password (3 per 5 minutes)";
  - every success replaces the password, so the copy says "your new AI Lab credentials", not "a link to set a new
    password". The existing confirm dialog stays (never called automatically).

### Revision 3 of the guide (backend `6a5c42d`, item 10 — re-sent by the user)

The only change: **`ai_lab_course_hints`** on the lab detail — `string[]`, always present, `[]` when none, in display
order, plain text, the same for every learner and sent whether or not the lab is started. The guide's card spec ("Hint
N of M", one dot per hint, arrows, fixed "Hints" / "Optimize your agents and workflows") is what step 04 already
renders.

- **Model:** `ai_lab_course_hints: string[]` on `AiLabCourseDetail`; `AiLabHint` drops `title` (no source).
- **Facade:** the `hints` slot becomes a `computed` off the detail — each string as `{ id: index + 1, hint }`, blanks
  dropped. The "not served yet" section goes (nothing is left in it).
- **Empty → hide the card.** No hints → the Hints card is gone. With no flow chart either, step 04 has nothing, so the
  whole step leaves the page **and** the sidebar navigator, and the steps after it renumber (05 → 04). Locked stays as
  designed: when hints exist and the lab isn't open, the blurred, padlocked card.
- **Docs / mocks:** `docs/AI_LABS_API.md` → this edition; the mock detail gets hints; stories stop filling the slot.

## Not in this change

the trigger-email tool (flag only, no route), the
`labs_account` block (no account screen).

## Acceptance

- Brief renders Markdown, requirements, guardrails, build guides, exercise files, SharePoint links, flow chart and the
  sample card from the new payload; an un-provisioned learner sees no empty brief.
- Attempts render best-first with history; a stale grade card re-signs; a 503 shows Retry.
- Failed exam → "Retake" or a disabled "Retake after …" per `final_assessment_status`; it flips when the wait ends.
- No code path reads `input_files`, `logic_flow`, `difficulty`, `scenarios`.
- Lint, structure, Prettier, `build:prod`, `build-storybook`; CDP on dev 4101 with the new payloads mocked.

## Risks

- **Samples, not captures.** Brief and attempts bodies are "code-derived sample data" in the guide; first real UAT read
  may differ in detail (e.g. `requirements: null`). Guards treat every documented `null` as empty.
- **Size.** ~450 lines; one PR, but the template edits are small — most of the change is the facade and model.
