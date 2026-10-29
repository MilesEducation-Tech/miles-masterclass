/**
 * A course's final assessment on the offerings' web API: `assessment-start/`
 * (draws or resumes a sitting), `assessment-questions/` (the sitting's paper
 * again) and `assessment-submit/` (scores it), from the Postman export of
 * 2026-10-15 and its descriptions. Afterwards, `assessment-report/` (the state
 * and the latest score) and `assessment-result/` (the latest attempt, question
 * by question).
 *
 * The server grades, and the paper carries no correct answers: they would be a
 * NASBA breach on the client, not a UI choice. A sitting's paper is fixed when
 * it is drawn, so a reload reads the same questions in the same order.
 */

import { HttpErrorResponse } from '@angular/common/http';
import {
  contractError,
  isBool,
  isBoolOrNull,
  isNum,
  isNumOrNull,
  isObject,
  isStr,
  isStrOrNull,
  listOf,
} from '@core/utils/contract-guards';

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

/** The learner's final assessment, as `assessment-report/` states it. */
export type AssessmentReportStatus = 'passed' | 'failed' | 'not_attempted';

/** `assessment-report/`'s `data`, as far as the report page reads it. Its `answers[]` is not read. */
export interface AssessmentReport {
  /** `false` when the course has no final assessment configured. */
  has_final_assessment: boolean;
  status: AssessmentReportStatus;
  attempt_count: number;
  pass_threshold_percent: number;
  /** `null` before the first attempt, like the two dates. */
  score_percent: number | null;
  attempted_at: string | null;
  passed_at: string | null;
  total_questions: number;
  correct_count: number;
  skipped_count: number;
  /**
   * Correct answers are withheld for this attempt: a fail against a bank-less
   * assessment (NASBA 6.01.2(1)(ii)). The review must not show them.
   */
  feedback_withheld: boolean;
}

/** One option of a reviewed question; `is_correct` and `explanation` may be withheld. */
export interface AssessmentAttemptOption {
  id: string;
  text: string;
  is_correct: boolean | null;
  explanation: string | null;
  was_selected: boolean;
}

/** One question of the latest attempt, with the learner's answer. */
export interface AssessmentAttemptAnswer {
  question_id: string;
  question_text: string;
  is_skipped: boolean;
  is_correct: boolean;
  explanation: string | null;
  selected_option_ids: string[];
  /** Empty where withheld. */
  correct_option_ids: string[];
  options: AssessmentAttemptOption[];
}

/** `assessment-result/`'s `data`, as far as the review reads it. */
export interface AssessmentAttempt {
  answers: AssessmentAttemptAnswer[];
}

/** How one question of the attempt went. */
export type AssessmentReviewStatus = 'correct' | 'incorrect' | 'skipped';

/** One question as the report lists it, with anything withheld already removed. */
export interface AssessmentReviewItem {
  id: string;
  /** Its position in the paper, from 1. */
  number: number;
  question: string;
  status: AssessmentReviewStatus;
  /** The texts of the options the learner chose; empty when skipped. */
  yourAnswer: string[];
  /** The correct options' texts, only for a missed question that isn't withheld. */
  correctAnswer: string[];
  /** The question's explanation, else the correct option's; `null` when withheld. */
  explanation: string | null;
}

/**
 * The attempt as the report lists it. A withheld attempt (`feedback_withheld`)
 * keeps the learner's own answers and how each went, and drops every correct
 * answer and explanation, whatever the response carried.
 */
export function toReviewItems(
  attempt: AssessmentAttempt,
  withheld: boolean,
): AssessmentReviewItem[] {
  return attempt.answers.map((answer, index) => {
    const textsOf = (ids: string[]) =>
      answer.options.filter((option) => ids.includes(option.id)).map((option) => option.text);
    const status: AssessmentReviewStatus = answer.is_skipped
      ? 'skipped'
      : answer.is_correct
        ? 'correct'
        : 'incorrect';
    const correctOption = answer.options.find((option) =>
      answer.correct_option_ids.includes(option.id),
    );
    return {
      id: answer.question_id,
      number: index + 1,
      question: answer.question_text,
      status,
      yourAnswer: textsOf(answer.selected_option_ids),
      correctAnswer: withheld || status === 'correct' ? [] : textsOf(answer.correct_option_ids),
      explanation: withheld ? null : (answer.explanation ?? correctOption?.explanation ?? null),
    };
  });
}

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

const REPORT_STATUSES: readonly string[] = ['passed', 'failed', 'not_attempted'];

const isReportStatus = (v: unknown): v is AssessmentReportStatus =>
  isStr(v) && REPORT_STATUSES.includes(v);

/** `parse` for `assessment-report/`: the `{ success, message, data }` envelope, in all three states. */
export function parseAssessmentReport(raw: unknown): AssessmentReport {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (
    isObject(data) &&
    isBool(data['has_final_assessment']) &&
    isReportStatus(data['status']) &&
    isNum(data['attempt_count']) &&
    isNum(data['pass_threshold_percent']) &&
    isNumOrNull(data['score_percent']) &&
    isStrOrNull(data['attempted_at']) &&
    isStrOrNull(data['passed_at']) &&
    isNum(data['total_questions']) &&
    isNum(data['correct_count']) &&
    isNum(data['skipped_count']) &&
    isBool(data['feedback_withheld'])
  ) {
    return {
      has_final_assessment: data['has_final_assessment'],
      status: data['status'],
      attempt_count: data['attempt_count'],
      pass_threshold_percent: data['pass_threshold_percent'],
      score_percent: data['score_percent'],
      attempted_at: data['attempted_at'],
      passed_at: data['passed_at'],
      total_questions: data['total_questions'],
      correct_count: data['correct_count'],
      skipped_count: data['skipped_count'],
      feedback_withheld: data['feedback_withheld'],
    };
  }
  throw contractError('assessment-report');
}

const isAttemptOption = (v: unknown): v is AssessmentAttemptOption =>
  isObject(v) &&
  isStr(v['id']) &&
  isStr(v['text']) &&
  isBoolOrNull(v['is_correct']) &&
  isStrOrNull(v['explanation']) &&
  isBool(v['was_selected']);

const isIds = listOf(isStr);

/** A withheld attempt may send `null` for the correct options rather than an empty list. */
type ApiAttemptAnswer = Omit<AssessmentAttemptAnswer, 'correct_option_ids'> & {
  correct_option_ids: string[] | null;
};

const isAttemptAnswer = (v: unknown): v is ApiAttemptAnswer =>
  isObject(v) &&
  isStr(v['question_id']) &&
  isStr(v['question_text']) &&
  isBool(v['is_skipped']) &&
  isBool(v['is_correct']) &&
  isStrOrNull(v['explanation']) &&
  isIds(v['selected_option_ids']) &&
  (v['correct_option_ids'] === null || isIds(v['correct_option_ids'])) &&
  listOf(isAttemptOption)(v['options']);

/** `parse` for `assessment-result/`: the latest attempt's answers, in the order they were served. */
export function parseAssessmentAttempt(raw: unknown): AssessmentAttempt {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (isObject(data) && listOf(isAttemptAnswer)(data['answers'])) {
    return {
      answers: data['answers'].map((answer) => ({
        ...answer,
        correct_option_ids: answer.correct_option_ids ?? [],
      })),
    };
  }
  throw contractError('assessment-result');
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
