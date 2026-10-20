import { environment } from '@env/environment';
import { CommonResponse, RouteConfig } from '@core/models/http.model';
import {
  AiLabAccountState,
  AiLabExamAnswer,
  AiLabQuizAnswerBody,
  AiLabSubmitBody,
  AiLabTokenRequestBody,
  AiLabVideoProgressBody,
} from '@features/ai-labs/models/ai-labs.model';

/**
 * Absolute URLs off `BASE_API_URL`, which is the ORIGIN ROOT (trailing slash, no `api/` segment).
 * Built whole, as `COURSE_DETAIL_API` does, so `apiUrl()` passes them through untouched and the
 * surface is spelled out where a reviewer can see it. Reads are `web-api/v1/`, writes the shared
 * `api/v1/`; `app-api/` belongs to the mobile app and is never used here.
 *
 * Contract: `docs/AI_LABS_API.md`. Routes join this table with the ticket that binds them.
 */
const ROOT = environment.BASE_API_URL;

export const AI_LABS_API = {
  /**
   * `AllowAny`: every masterclass course that has an AI Lab, as the `tracks-page/` card. A flat
   * course list, not labs. `pre_login` always — that branch ignores the token, and nothing here is
   * per-user, so signing in never refetches it (same choice as `SurroundCarousel`).
   */
  rail: `${ROOT}web-api/v1/masterclass/ai-labs/`,

  /** `IsAuthenticated`: the lab catalogue, paged (web default 6, max 100), with `lock_state`. */
  courses: `${ROOT}web-api/v1/ai-labs/courses/`,

  /** `IsAuthenticated`: `{eligible, reason, account_created}`. Never calls AI Labs — cheap to poll. */
  accountEnsure: `${ROOT}api/v1/ai-labs/account-ensure/`,

  /**
   * `IsAuthenticated`, no body (the payload is built from the learner). 202
   * `PROVISIONING_STARTED|IN_PROGRESS` returns at once; provisioning takes two to three minutes.
   * 200 `ACCOUNT_EXISTS` may carry `entitlement_refresh_required`, which means sign in again.
   */
  accountCreate: {
    path: `${ROOT}api/v1/ai-labs/account-create/`,
    method: 'POST',
  } as RouteConfig<void, CommonResponse<AiLabAccountState>>,

  /** `IsAuthenticated`, no body. Mails a reset link; the account must already exist. */
  accountResetPassword: {
    path: `${ROOT}api/v1/ai-labs/account-reset-password/`,
    method: 'POST',
  } as RouteConfig<void, CommonResponse<AiLabAccountState>>,

  /** `IsAuthenticated`: one lab's page. Append `<uuid>/`; an unknown or inactive lab is 404. */
  courseDetail: `${ROOT}web-api/v1/ai-labs/course/`,

  /** `IsAuthenticated`: Start vs Continue — `started`, `can_start`, `enrollment`, `lock_state`. */
  courseStarted: `${ROOT}web-api/v1/ai-labs/course-started/`,

  /**
   * `IsAuthenticated`: the gate flags and `next_step`. Append `<uuid>/`. 404
   * `no_ai_lab_enrollment` until the lab is started — read only once `course-started/` says so.
   */
  courseProgress: `${ROOT}web-api/v1/ai-labs/course-progress/`,

  /**
   * `IsAuthenticated`, no body, idempotent: creates (or revives) the enrolment. 409 when the
   * parent masterclass course holds the lock (`credit_already_earned_via_course`,
   * `started_via_masterclass_course`); 403 `caira_access_required`.
   */
  courseStart: {
    path: `${ROOT}api/v1/ai-labs/course-start/:id/`,
    method: 'POST',
  } as RouteConfig<void, CommonResponse<unknown>>,

  /**
   * `IsAuthenticated`, strict body: watched seconds on the lab's one video. Completion is derived
   * server-side at 95%, so the client never asserts it.
   */
  courseVideoProgress: {
    path: `${ROOT}api/v1/ai-labs/course-video-progress/`,
    method: 'POST',
  } as RouteConfig<AiLabVideoProgressBody, CommonResponse<unknown>>,

  // ---- The practical. These call AI Labs: `200 is_provisioned: false` means "no AI Labs account
  // yet" and is not an error; 403 AI_LABS_ACCESS_DENIED / AI_LABS_TOKEN_REJECTED means the login
  // token predates the account (sign in again). See `docs/AI_LABS_API.md` §2.

  /** `IsAuthenticated`: `{status, is_provisioned, brief}`. Append `<uuid>/`. 409 if no practical. */
  assignmentBrief: `${ROOT}web-api/v1/ai-labs/assignment-brief/`,

  /** `IsAuthenticated`: `{status, is_provisioned, agents}` — the picker's agents. */
  agents: `${ROOT}web-api/v1/ai-labs/agents/`,

  /** `IsAuthenticated`: `{status, is_provisioned, flows}` — the picker's flows. */
  flows: `${ROOT}web-api/v1/ai-labs/flows/`,

  /**
   * `IsAuthenticated`: the practical's state. Append `<uuid>/`. Polled while grading — it also
   * reconciles a missed webhook, so polling is what heals one. 404 `no_ai_lab_enrollment` before a
   * start.
   */
  assignmentStatus: `${ROOT}web-api/v1/ai-labs/assignment-status/`,

  /**
   * `IsAuthenticated`, strict body `{artefact_kind, agent_ref}`: 202 `in_progress`. Refusals carry
   * a learner-facing message (`final_assessment_not_passed`, `practical_already_completed`,
   * `AI_LABS_ALREADY_IN_PROGRESS`, …).
   */
  assignmentSubmit: {
    path: `${ROOT}api/v1/ai-labs/assignment-submit/:id/`,
    method: 'POST',
  } as RouteConfig<AiLabSubmitBody, CommonResponse<unknown>>,

  /** `IsAuthenticated`: `{status, is_provisioned, tokens}` — the Copilot Credits balance. */
  tokens: `${ROOT}web-api/v1/ai-labs/tokens/`,

  /**
   * `IsAuthenticated`, strict body `{tokens: 500 | 1000, reason?}`. 200 `{status, request}`; 409
   * `tokens_request_open` means one is already pending — its message is written for the learner.
   */
  tokensRequest: {
    path: `${ROOT}api/v1/ai-labs/tokens-request/`,
    method: 'POST',
  } as RouteConfig<AiLabTokenRequestBody, CommonResponse<unknown>>,

  /**
   * `IsAuthenticated`: `{status, is_provisioned, progress}` — every assignment the learner has
   * attempted on AI Labs. Supplementary; it gates nothing.
   */
  practicalProgress: `${ROOT}web-api/v1/ai-labs/practical-progress/`,

  /**
   * `IsAuthenticated`: the lab quiz, resumable. Append `<uuid>/`. 403 `video_not_complete`, 404
   * `no_quiz_config`, 409 `already_completed`.
   */
  quizQuestions: `${ROOT}web-api/v1/ai-labs/course-quiz-questions/`,

  /**
   * `IsAuthenticated`, strict body: ONE answer, graded server-side. The last one completes the
   * quiz (`is_quiz_completed`). 409 `already_answered` / `already_completed`.
   */
  quizSubmit: {
    path: `${ROOT}api/v1/ai-labs/course-quiz-submit/`,
    method: 'POST',
  } as RouteConfig<AiLabQuizAnswerBody, CommonResponse<unknown>>,

  /**
   * `IsAuthenticated`: the final assessment's paper. Append `<uuid>/`. 403 `cool_off_active`
   * (with `cool_off_ends_at`), `quiz_not_complete`, `video_not_complete`; 404
   * `no_assessment_config`; 409 `already_passed`.
   */
  assessmentQuestions: `${ROOT}web-api/v1/ai-labs/course-assessment-questions/`,

  /**
   * `IsAuthenticated`, strict body `{answers: [{question_id, selected_option_ids}]}` — every answer
   * with a selection. 200 carries the score and the per-answer review; a pass moves `next_step`
   * on to `ai_assessment`.
   */
  assessmentSubmit: {
    path: `${ROOT}api/v1/ai-labs/course-assessment-submit/:id/`,
    method: 'POST',
  } as RouteConfig<{ answers: AiLabExamAnswer[] }, CommonResponse<unknown>>,
} as const;
