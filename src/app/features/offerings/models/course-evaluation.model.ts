/**
 * A course's post-course evaluation on the offerings' web API, from the Postman
 * export of 2026-10-15: `feedback-questions/` (the form), `feedback-submit/`
 * (records it once and closes the course: CPE, Credly badge, certificate) and
 * `feedback-responses/` (whether, and when, it was submitted).
 *
 * NASBA requires the evaluation, which is why it sits between the pass and the
 * certificate. It is submitted once and never edited.
 */

import {
  contractError,
  isBool,
  isNum,
  isNumOrNull,
  isObject,
  isStr,
  isStrOrNull,
  listOf,
} from '@features/offerings/utils/contract-guards';

/** One question of the form. Every question on UAT is a 1–5 `rating`. */
export interface EvaluationQuestion {
  id: string;
  text: string;
  type: string;
  order: number;
}

/**
 * `feedback-questions/`'s `data`: the questions in their `order`, or an expired
 * 365-day window, which reset the learner's progress instead.
 */
export type EvaluationForm =
  { reset_required: true } | { reset_required: false; questions: EvaluationQuestion[] };

/** One answer of the submit; `text_response` is empty for a rating question. */
export interface EvaluationResponse {
  question_id: string;
  rating: number;
  text_response: string;
}

/** `feedback-submit/`'s body. Strict: an undeclared key is a `400`. */
export interface EvaluationSubmitBody {
  responses: EvaluationResponse[];
  optional_feedback_text: string;
}

/**
 * `feedback-submit/`'s outcome: the evaluation is in and the course closed, or
 * an expired window reset the learner's progress instead.
 */
export type EvaluationOutcome =
  { reset_required: true } | { reset_required: false; cpe_awarded: number | null };

/** `feedback-responses/`'s `data`, as far as the page reads it. Its paged `responses` are not read. */
export interface EvaluationStatus {
  submitted: boolean;
  submitted_at: string | null;
}

const isQuestion = (v: unknown): v is EvaluationQuestion =>
  isObject(v) && isStr(v['id']) && isStr(v['text']) && isStr(v['type']) && isNum(v['order']);

/** `parse` for `feedback-questions/`: the `{ success, message, data }` envelope, questions in `order`. */
export function parseEvaluationForm(raw: unknown): EvaluationForm {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (isObject(data) && data['reset_required'] === true) return { reset_required: true };
  if (isObject(data) && listOf(isQuestion)(data['questions'])) {
    return {
      reset_required: false,
      questions: [...data['questions']].sort((a, b) => a.order - b.order),
    };
  }
  throw contractError('feedback-questions');
}

/** `parse` for `feedback-submit/`. An expired window answers `200` with `reset_required` alone. */
export function parseEvaluationSubmit(raw: unknown): EvaluationOutcome {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (isObject(data) && data['reset_required'] === true) return { reset_required: true };
  if (isObject(data) && data['feedback_submitted'] === true && isNumOrNull(data['cpe_awarded'])) {
    return { reset_required: false, cpe_awarded: data['cpe_awarded'] };
  }
  throw contractError('feedback-submit');
}

/** `parse` for `feedback-responses/`: always answers, `submitted: false` before an evaluation. */
export function parseEvaluationStatus(raw: unknown): EvaluationStatus {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (isObject(data) && isBool(data['submitted']) && isStrOrNull(data['submitted_at'])) {
    return { submitted: data['submitted'], submitted_at: data['submitted_at'] };
  }
  throw contractError('feedback-responses');
}
