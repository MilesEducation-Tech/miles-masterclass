/**
 * A chapter's quiz on the offerings' web API: `quiz-questions/<chapter_id>/`
 * (the read) and `quiz-submit/<chapter_id>/` (one answer per call), from the
 * Postman export of 2026-10-14 and its descriptions.
 *
 * The server grades. An unanswered question arrives with its options only, and
 * the verdict comes back from the submit; on a resumed attempt the questions
 * already answered come back graded. So `is_correct` and the explanations are
 * `null` until then, never inferred here.
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
} from '@core/utils/contract-guards';

/** One option. `is_correct` and `explanation` stay `null` until its question is graded. */
export interface ChapterQuizOption {
  id: string;
  text: string;
  order: number;
  is_correct: boolean | null;
  explanation: string | null;
}

/**
 * One question. `single` takes one option; any other type (the body is a list,
 * so `multiple` is the likely one) takes several.
 */
export interface ChapterQuizQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options: ChapterQuizOption[];
  is_answered: boolean;
  /** The verdict on a resumed attempt's answered question; `null` otherwise. */
  is_correct: boolean | null;
  explanation: string | null;
  /** What the learner chose, when a resumed attempt says so; `[]` otherwise. */
  selected_option_ids: string[];
}

/** `quiz-questions/`'s `data`. `questions_to_show` can be fewer than the bank: the server picks them. */
export interface ChapterQuiz {
  chapter_id: string;
  questions_to_show: number;
  previously_completed: boolean;
  resumed: boolean;
  answered_count: number;
  questions: ChapterQuizQuestion[];
}

/** `quiz-submit/`'s body. Strict: any other key is a 400. */
export interface QuizAnswer {
  question_id: string;
  selected_option_ids: string[];
}

/** One option's feedback after grading. */
export interface QuizOptionFeedback {
  id: string;
  is_correct: boolean;
  explanation: string | null;
}

/** `quiz-submit/`'s graded answer. */
export interface QuizAnswerResult {
  question_id: string;
  is_correct: boolean;
  correct_option_ids: string[];
  explanation: string | null;
  options_feedback: QuizOptionFeedback[];
  answers_submitted: number;
  total_questions: number;
  /** The last answer is in: the chapter's quiz is done. */
  is_mcq_completed: boolean;
  is_chapter_completed: boolean;
  score_percent: number | null;
}

/** A submit's outcome: graded, or the enrolment window had expired and was reset. */
export type QuizSubmitOutcome =
  ({ reset_required: false } & QuizAnswerResult) | { reset_required: true };

/** What the page shows for an answered question: the learner's pick and the verdict per option. */
export interface QuizGrade {
  selected: string[];
  is_correct: boolean;
  explanation: string | null;
  /** Per option: whether it is a correct answer, and its explanation. */
  options: Record<string, { is_correct: boolean; explanation: string | null }>;
}

// ---- Trust boundary --------------------------------------------------------

const isOptionalBoolOrNull = (v: unknown): boolean => v === undefined || v === null || isBool(v);
const isOptionalStrOrNull = (v: unknown): boolean => v === undefined || isStrOrNull(v);
const isStrList = listOf(isStr);
const isPresent = <T>(v: T | null): v is T => v !== null;

function toOption(v: unknown): ChapterQuizOption | null {
  if (
    !isObject(v) ||
    !isStr(v['id']) ||
    !isStr(v['text']) ||
    !isNum(v['order']) ||
    !isOptionalBoolOrNull(v['is_correct']) ||
    !isOptionalStrOrNull(v['explanation'])
  ) {
    return null;
  }
  return {
    id: v['id'],
    text: v['text'],
    order: v['order'],
    is_correct: isBool(v['is_correct']) ? v['is_correct'] : null,
    explanation: isStr(v['explanation']) ? v['explanation'] : null,
  };
}

function toQuestion(v: unknown): ChapterQuizQuestion | null {
  if (
    !isObject(v) ||
    !isStr(v['id']) ||
    !isStr(v['question_text']) ||
    !isStr(v['question_type']) ||
    !isBool(v['is_answered']) ||
    !Array.isArray(v['options']) ||
    !isOptionalBoolOrNull(v['is_correct']) ||
    !isOptionalStrOrNull(v['explanation']) ||
    (v['selected_option_ids'] !== undefined && !isStrList(v['selected_option_ids']))
  ) {
    return null;
  }
  const options = v['options'].map(toOption);
  if (!options.every(isPresent)) return null;
  return {
    id: v['id'],
    question_text: v['question_text'],
    question_type: v['question_type'],
    // Shown in the server's order, whatever order the array arrives in.
    options: options.sort((a, b) => a.order - b.order),
    is_answered: v['is_answered'],
    is_correct: isBool(v['is_correct']) ? v['is_correct'] : null,
    explanation: isStr(v['explanation']) ? v['explanation'] : null,
    selected_option_ids: isStrList(v['selected_option_ids']) ? v['selected_option_ids'] : [],
  };
}

/** `parse` for `quiz-questions/`: the `{ success, message, data }` envelope. */
export function parseChapterQuiz(raw: unknown): ChapterQuiz {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (
    isObject(data) &&
    isStr(data['chapter_id']) &&
    isNum(data['questions_to_show']) &&
    isBool(data['previously_completed']) &&
    isBool(data['resumed']) &&
    isNum(data['answered_count']) &&
    Array.isArray(data['questions'])
  ) {
    const questions = data['questions'].map(toQuestion);
    if (questions.every(isPresent)) {
      return {
        chapter_id: data['chapter_id'],
        questions_to_show: data['questions_to_show'],
        previously_completed: data['previously_completed'],
        resumed: data['resumed'],
        answered_count: data['answered_count'],
        questions,
      };
    }
  }
  throw contractError('quiz-questions');
}

function isOptionFeedback(v: unknown): v is QuizOptionFeedback {
  return isObject(v) && isStr(v['id']) && isBool(v['is_correct']) && isStrOrNull(v['explanation']);
}

/**
 * `quiz-submit/`'s `{ success, message, data }` envelope. An expired window
 * answers `200` with `reset_required` and no grade, so that case alone is
 * accepted without the graded keys.
 */
export function parseQuizSubmit(raw: unknown): QuizSubmitOutcome {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (isObject(data) && data['reset_required'] === true) return { reset_required: true };
  if (
    isObject(data) &&
    isStr(data['question_id']) &&
    isBool(data['is_correct']) &&
    isStrList(data['correct_option_ids']) &&
    isStrOrNull(data['explanation']) &&
    listOf(isOptionFeedback)(data['options_feedback']) &&
    isNum(data['answers_submitted']) &&
    isNum(data['total_questions']) &&
    isBool(data['is_mcq_completed']) &&
    isBool(data['is_chapter_completed']) &&
    isNumOrNull(data['score_percent'])
  ) {
    return {
      reset_required: false,
      question_id: data['question_id'],
      is_correct: data['is_correct'],
      correct_option_ids: data['correct_option_ids'],
      explanation: data['explanation'],
      options_feedback: data['options_feedback'],
      answers_submitted: data['answers_submitted'],
      total_questions: data['total_questions'],
      is_mcq_completed: data['is_mcq_completed'],
      is_chapter_completed: data['is_chapter_completed'],
      score_percent: data['score_percent'],
    };
  }
  throw contractError('quiz-submit');
}

/** A resumed attempt's answered question, as a grade; `null` while it is unanswered. */
export function gradeOfAnswered(question: ChapterQuizQuestion): QuizGrade | null {
  if (!question.is_answered || question.is_correct === null) return null;
  return {
    selected: question.selected_option_ids,
    is_correct: question.is_correct,
    explanation: question.explanation,
    options: Object.fromEntries(
      question.options.map((option) => [
        option.id,
        { is_correct: option.is_correct === true, explanation: option.explanation },
      ]),
    ),
  };
}

/** A submit's verdict, as a grade. */
export function gradeOfResult(selected: string[], result: QuizAnswerResult): QuizGrade {
  const correct = new Set(result.correct_option_ids);
  return {
    selected,
    is_correct: result.is_correct,
    explanation: result.explanation,
    options: Object.fromEntries(
      result.options_feedback.map((option) => [
        option.id,
        {
          is_correct: option.is_correct || correct.has(option.id),
          explanation: option.explanation,
        },
      ]),
    ),
  };
}
