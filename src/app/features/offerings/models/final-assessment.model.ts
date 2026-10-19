/**
 * A course's final assessment on the offerings' web API: `assessment-start/`
 * (draws or resumes a sitting), `assessment-questions/` (the sitting's paper
 * again) and `assessment-submit/` (scores it), from the Postman export of
 * 2026-10-15 and its descriptions.
 *
 * The server grades, and the paper carries no correct answers: they would be a
 * NASBA breach on the client, not a UI choice. A sitting's paper is fixed when
 * it is drawn, so a reload reads the same questions in the same order.
 */

import { HttpErrorResponse } from '@angular/common/http';
import {
  contractError,
  isBool,
  isNum,
  isObject,
  isStr,
  listOf,
} from '@features/offerings/utils/contract-guards';

/** One option, in the server's `order`. */
export interface AssessmentOption {
  id: string;
  text: string;
  order: number;
}

/** One question. `single` takes one option; any other type takes several. */
export interface AssessmentQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options: AssessmentOption[];
}

/** `assessment-questions/`'s `data`: one sitting's paper. */
export interface AssessmentPaper {
  course_id: string;
  questions_to_show: number;
  pass_threshold_percent: number;
  previous_attempts: number;
  questions: AssessmentQuestion[];
}

/** `assessment-start/`'s `data`, as far as the start reads it: the paper is read again on the exam page. */
export interface AssessmentStart {
  session_id: string;
  /** `true` when the open sitting came back rather than a new one. */
  resumed: boolean;
}

/** One answer of the submit. */
export interface AssessmentAnswer {
  question_id: string;
  selected_option_ids: string[];
}

/** `assessment-submit/`'s body. Strict: it must answer exactly the sitting's questions. */
export interface AssessmentSubmitBody {
  session_id: string;
  answers: AssessmentAnswer[];
}

/**
 * `assessment-submit/`'s outcome: the score, or an expired 365-day window, which
 * reset the learner's progress instead. A pass also grades every answer; the
 * report shows those, so they are not read here.
 */
export type AssessmentOutcome =
  { reset_required: true } | { reset_required: false; passed: boolean; score_percent: number };

/** A course's `exam_rules`, as the rules dialog lists them. */
export interface ExamRules {
  /** The text's own title line, when it opens with one; `null` otherwise. */
  heading: string | null;
  /** One whole rule per item. */
  rules: string[];
}

/**
 * Split `exam_rules` into its title and its rules. Most courses' text is
 * hard-wrapped mid-sentence ("…within one\r\nyear of enrollment…"), so a line
 * that starts in lower case continues the one before it rather than starting a
 * rule. A first line with no closing punctuation is the title
 * ("QAS Self-Study Course Examination Guidelines" on every UAT course).
 */
export function toExamRules(text: string): ExamRules {
  const items: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (items.length && /^[a-z(]/.test(trimmed)) items[items.length - 1] += ` ${trimmed}`;
    else items.push(trimmed);
  }
  const heading = items.length > 1 && !/[.!?:]$/.test(items[0]) ? items[0] : null;
  return { heading, rules: heading ? items.slice(1) : items };
}

const isOption = (v: unknown): v is AssessmentOption =>
  isObject(v) && isStr(v['id']) && isStr(v['text']) && isNum(v['order']);

const isQuestion = (v: unknown): v is AssessmentQuestion =>
  isObject(v) &&
  isStr(v['id']) &&
  isStr(v['question_text']) &&
  isStr(v['question_type']) &&
  listOf(isOption)(v['options']);

/** `parse` for `assessment-questions/`: the `{ success, message, data }` envelope, options in `order`. */
export function parseAssessmentPaper(raw: unknown): AssessmentPaper {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (
    isObject(data) &&
    isStr(data['course_id']) &&
    isNum(data['questions_to_show']) &&
    isNum(data['pass_threshold_percent']) &&
    isNum(data['previous_attempts']) &&
    listOf(isQuestion)(data['questions'])
  ) {
    return {
      course_id: data['course_id'],
      questions_to_show: data['questions_to_show'],
      pass_threshold_percent: data['pass_threshold_percent'],
      previous_attempts: data['previous_attempts'],
      questions: data['questions'].map((question) => ({
        ...question,
        options: [...question.options].sort((a, b) => a.order - b.order),
      })),
    };
  }
  throw contractError('assessment-questions');
}

/** `parse` for `assessment-start/`: the sitting's id. */
export function parseAssessmentStart(raw: unknown): AssessmentStart {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (isObject(data) && isStr(data['session_id']) && isBool(data['resumed'])) {
    return { session_id: data['session_id'], resumed: data['resumed'] };
  }
  throw contractError('assessment-start');
}

/**
 * `assessment-submit/`'s `{ success, message, data }` envelope. An expired
 * window answers `200` with `reset_required` and no score, so that case alone
 * is accepted without one.
 */
export function parseAssessmentSubmit(raw: unknown): AssessmentOutcome {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (isObject(data) && data['reset_required'] === true) return { reset_required: true };
  if (isObject(data) && isBool(data['passed']) && isNum(data['score_percent'])) {
    return { reset_required: false, passed: data['passed'], score_percent: data['score_percent'] };
  }
  throw contractError('assessment-submit');
}

/** When a `403 cool_off_active` lets the learner try again; `null` for any other answer. */
export function readCoolOffEndsAt(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body: unknown = error.error;
  const data = isObject(body) ? body['data'] : undefined;
  return isObject(data) && data['reason'] === 'cool_off_active' && isStr(data['cool_off_ends_at'])
    ? data['cool_off_ends_at']
    : null;
}
