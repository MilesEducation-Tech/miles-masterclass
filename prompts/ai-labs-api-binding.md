# AI Labs: catch up to upstream's UI and bind it to `web-api/v1`

**Two sources, one for each half:**

- **Design:** `miles-masterclass-v3`, branch **`feat/ai-labs-refactor` @ `ce0194a4`** (2026-10-16). It is 9 commits
  and +2,354 / −831 lines ahead of the `master` the UI-parity work was ported from. **Our AI Labs UI is that far
  behind.**
- **Data:** **`docs/AI_LABS_API.md`**, the backend's FE guide (43 routes, generated 2026-10-20). Upstream's own data
  layer is **not** ported: it calls `v2/ai-lab/...` on `api.milesmasterclass.com/api/`, and every one of those
  routes answers **404** on our `uat-api.milescaira.com` (probed 2026-10-20).

The UI-parity work on `feat/ai-labs-ui-parity` (landing, course page, progress panel, token meter, and the header
spotlight from upstream `1056a2b3`) is committed first. Everything below stacks on it.

## What was read

- Upstream `master..feat/ai-labs-refactor`: all 9 commit messages, the `ai-lab.html` diff, and the V2 wire types in
  `ai-lab.model.ts`.
- `docs/AI_LABS_API.md` in full.
- Our `features/ai-labs/` (routes, landing, course page inputs/outputs, model) and `COURSE_DETAIL_API` as the
  reference binding shape.
- UAT probes:
  - `web-api/v1/masterclass/ai-labs/` → 200 (2 courses).
  - `web-api/v1/ai-labs/{courses,tracks,tokens}/` and `api/v1/ai-labs/account-ensure/` → 401.
  - `v2/ai-lab/*` → 404.

## What upstream's branch adds, and where each piece lands

| Upstream change (commit)                                                                     | Here                                                                                                                             |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Account: polled status, "Setting up your lab…" / "taking longer" copy (`e5908fc8`)           | Ported. The poll reads `account-ensure/`.                                                                                        |
| Resend Credential button, confirm first (`f7b6df4e`)                                         | Ported, on `account-reset-password/`. Its reasons `RESET_EMAIL_RATE_LIMITED` / `ACCOUNT_NOT_CREATED` each get their own message. |
| Credits: `cap` + decimal-string `used`/`remaining`, `locked`, `pending_request` (`4cbf3668`) | Ported as-is. **The guide's `tokens/` shape is identical.** The token meter moves to it.                                         |
| Top-up dialog: 500/1000, a 500-char reason, 409 handling (`4cbf3668`)                        | **New:** `features/ai-labs/dialogs/ai-lab-token-request-dialog/`. 409 `tokens_request_open` re-reads the balance.                |
| Full brief: details, logic flow, guardrails, scenarios, input-file downloads (`e5908fc8`)    | Ported to the guide's brief. **`input_files` is `{name, url}`, and `scenarios` and `tools` are `string[]`.**                     |
| Picker on `{kind, id, name}` rows; submit sends `agent_ref` + `artefact_kind` (`e5908fc8`)   | Ported. Identical to the guide.                                                                                                  |
| Grading state polled, then stop; lab resubmission (`0302957b`, `8a858ff1`)                   | Ported. It polls `assignment-status/` every 12 s while `assessment_status` is `in_progress`; `can_resubmit` reopens the picker.  |
| Grade card fetched per click (`e5908fc8`)                                                    | **Simplified.** `assignment-status/` already carries `grade_card_pdf_url`; `grade_card_is_expired` triggers a re-read first.     |
| Progress bar and Theater mode under the player removed (`8a858ff1`)                          | Ported. Fullscreen stays in the video.js control bar.                                                                            |
| An attempted exam counts as the video watched (`ce0194a4`)                                   | Ported. On our API the derivation is unnecessary, because `course-progress/` reports `video_completed` itself.                   |

## Where the guide overrides upstream's design (read first)

1. **Feedback can't open right after the exam.** Upstream (`8a858ff1`) opens feedback and the certificate on an exam
   pass. Our backend refuses feedback until the AI practical is graded: `course-feedback-gate/` answers
   `allowed: false, reason: ai_assessment_not_completed` with a `remark`, and the submit route 403s. **The CTA follows
   the gate and shows the `remark`.** Copying upstream here would put a button on screen that always fails.
2. **Rubric areas, "working well" and "holding back" are not ported.** The guide's `assignment-status/` has the score,
   the two comments and the grade card, but no `areas`. They come back when the backend adds them.
3. **"Send email" (`tools.trigger_email`) is not ported, and our existing "Send test emails" button is removed.** The
   guide has no route for either. Q2 below.
4. **Account creation sends no body and does not swap the session.** Upstream sends `refresh_token` and stores a
   reissued session. Per the guide:
   - The POST has no body.
   - `202 PROVISIONING_STARTED|IN_PROGRESS` starts the status poll.
   - `200 ACCOUNT_EXISTS` with `entitlement_refresh_required: true` signs the learner out and back in. The guide says
     to force a re-login.
5. **Practical routes' vendor states.** `200` with `is_provisioned: false` is "create account", not an error.
   `403 AI_LABS_ACCESS_DENIED|AI_LABS_TOKEN_REJECTED` asks for a re-login. 429/502/503 show retry copy. Upstream's
   per-code messages map onto these codes.

## The split (each PR under ~400 lines, each with its own report)

1. **PR 1a: UI catch-up, landing and widgets.** The landing account states (Resend Credential, polled-status
   copy), the progress panel and token meter on the guide shapes, and the new top-up dialog. Presentational: inputs
   and outputs only, plus stories. The view-model types move to the guide's wire types, so binding is a drop-in.
2. **PR 1b: UI catch-up, course page.**
   - The full brief with input-file downloads.
   - The `{kind, id, name}` picker.
   - The grading and resubmit states, and the grade card from `assignment-status/`.
   - The under-player bar is dropped.
   - The feedback CTA follows the gate (Divergence 1).
   - The page model moves from masterclass `ContentDetails` to the guide's `course/<uuid>/` shape.
   - Presentational, with stories.
3. **PR 2: landing binding.**
   - **Guests:** `web-api/v1/masterclass/ai-labs/` (`AllowAny`, server-rendered).
   - **Signed in:** `web-api/v1/ai-labs/courses/`, grouped by `lock_state.masterclass_course_id`.
   - **Account:** `account-ensure/` (polled after a create, `SKIP_LOADING`), `account-create/` and
     `account-reset-password/`. This replaces the `auth`/`milesAuth` stubs with `AuthSession`.
4. **PR 3: lab page reads.** `course/`, `course-started/`, `course-start/`, `course-progress/` (which drives the
   CTA stage), and `course-video-progress/`. **Blocked on Q1.**
5. **PR 4: the practical.** `assignment-brief/`, `agents/`, `flows/`, `assignment-submit/`, `assignment-status/`
   polling, `tokens/` and `tokens-request/` (re-read on tab focus, as upstream does), and `practical-progress/`.
6. **PR 5: quiz, final assessment, feedback.**
   - **Screens:** new ones in `features/ai-labs/`, designed like the offerings exam / report / feedback screens
     (upstream reuses those pages; a feature can't import another feature here).
   - **Routes:** `course-quiz-questions/`, `course-quiz-submit/`, `course-assessment-questions/`,
     `course-assessment-submit/`, `course-feedback-gate/`, `course-feedback-questions/` and
     `course-feedback-submit/`.
   - **Size:** likely two PRs.

**Never bound:** `course-release/` (staff only), `assessment-result/` (webhook), `assessment-refresh/` (a thin alias
of the status read), `tracks/` (until there is a filter UI), and every `app-api/` route.

## Assumptions

- **The design is pinned to `ce0194a4`.** Anything upstream adds later is a new ticket.
- **RTL handling stays ours,** as in the parity port: `dir`, logical utilities and mirrored arrows.
- **Our substitutions carry over:** `app-select` for `app-aria-select`, `sm` for `size="xs"`, and dialogs on
  `NgpDialogManager`.
- **One ticket per PR.** MIL numbers are needed.

## Backend questions (still open after the guide)

- **Q1 Video.** `course/<uuid>/` has no playable source (`ai_lab_course_trailer_url` is null), yet
  `course-video-progress/` measures "the lab's single video". Which field is it?
- **Q2 Test emails.** Upstream has a "Send email" for assignments with `tools.trigger_email`. Is there a
  `web-api` / `api/v1` route for it?
- **Q3 Launch AI.** Upstream launches into `environment_url` from its account status. Neither `account-ensure/` nor
  the brief has one. What does "Launch AI" open: `ai_lab_course_sharepoint_artefact_url`, or something in
  `ACCOUNT_EXISTS`'s `labs_account`?
- **Q4 Rubric.** Will `assignment-status/` carry rubric `areas` and the working-well / holding-back lists?
- **Q5 Consent.** `account-create/` takes no body. Where is the Participant Agreement acceptance recorded?

## Checks (every PR)

`pnpm lint`, `pnpm format:fix`, `pnpm build:prod` (`ai-labs.css` must stay under 16 kB) and `pnpm build-storybook`.
The binding PRs also need the SSR build plus a curl of `/us/cpa/ai-labs`, and a signed-in browser pass on
`pnpm start` (4101) with the network panel open.

## How to verify (UI PRs)

1. Run `pnpm storybook` and step through _AI Labs/*_. Each state in the table above has a story.
2. Compare each story with upstream at `ce0194a4` (`pnpm storybook` there, or the running app) at
   375 / 768 / 1440. Every intentional difference is one of Divergences 1–5.

## Risks

- **`ai-labs.css` is 15.86 kB against a 16 kB error.** Landing styles must go in as Tailwind utilities, not CSS.
- **SSR auth.** The auth-gated reads stay `undefined` on a guest's server render. A learner sees the rail cards
  first and then the lab cards, below the fold inside `@defer`.
- **The guide marks many bodies "sample data", built from code.** A field can still be missing on UAT. The
  facades guard with `hasValue()` and optional chaining, not casts.
