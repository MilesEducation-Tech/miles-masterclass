import { CairaUuid } from './envelope.model';

/**
 * Final assessment — the **result** half only (#11).
 *
 * `#9` (questions) and `#10` (submit) are deliberately absent. Both carry the
 * question set built by `CAIRAMasterclassQuizQuestionSerializer`, whose field
 * list is uncaptured (G-01, which covers "P5 quiz (#7, #9)" — one serializer
 * backs the chapter quiz and the exam alike). Guessing an option id there means
 * submitting wrong answers to a CPE-bearing exam.
 *
 * `#11` is safe to bind on what is documented because it is **read-only** and
 * its keys are called out explicitly: it is the one response using
 * `question_text` and `options` (rather than `options_feedback`) and carrying
 * `was_selected`. A display that renders a field blank is recoverable; a wrong
 * submission is not.
 */

// ---------------------------------------------------------------------------
// Wire shape — tolerant on purpose
// ---------------------------------------------------------------------------

/** An id may arrive as a uuid or a legacy int; only equality is ever needed. */
type OptionId = CairaUuid | number;

export interface AssessmentResultOptionPayload {
  id?: OptionId | null;
  /** The reference names `option_text`; `text` is accepted as a fallback. */
  option_text?: string | null;
  text?: string | null;
  /** #11 is the only response carrying this. */
  was_selected?: boolean | null;
  /** Rationale copy, where the serializer includes it. */
  description?: string | null;
}

export interface AssessmentResultQuestionPayload {
  id?: OptionId | null;
  /** #11 keys the text this way — every other endpoint uses a longer name. */
  question_text?: string | null;
  options?: AssessmentResultOptionPayload[] | null;
  /**
   * Built from a Python `set`, so the order is **not stable**. Compare as a set;
   * never index into it and never assume position matches `options`.
   */
  correct_option_ids?: OptionId[] | null;
}

export interface AssessmentResultPayload {
  questions?: AssessmentResultQuestionPayload[] | null;
  question_answers?: AssessmentResultQuestionPayload[] | null;
  total_questions?: number | null;
  total_correct?: number | null;
  exam_passes_date?: string | null;
  result_details?: { my_percentage?: number | null } | null;
}

export interface AssessmentResultResponse {
  status?: boolean | string;
  data?: AssessmentResultPayload | null;
}

// ---------------------------------------------------------------------------
// View model
// ---------------------------------------------------------------------------

export interface AssessmentReportQuestion {
  id: string;
  question: string;
  isCorrect: boolean;
  /** What the learner picked, `null` when they skipped it. */
  selectedText: string | null;
  correctText: string | null;
  explanation: string | null;
}

export interface AssessmentReport {
  passedAt: string | null;
  scorePercent: number;
  correctCount: number;
  totalCount: number;
  questions: AssessmentReportQuestion[];
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

const text = (value: string | null | undefined): string => value?.trim() ?? '';
const optionText = (option: AssessmentResultOptionPayload): string =>
  text(option.option_text) || text(option.text);

/**
 * #11 → the report view model.
 *
 * Correctness is decided by **set membership**, not by position: an option is
 * correct when its id appears in `correct_option_ids`. A question with no
 * selected option is a skip, which counts as incorrect — the same verdict the
 * server reaches, since a skip cannot be in the correct set.
 */
export function toAssessmentReport(
  response: AssessmentResultResponse | undefined,
): AssessmentReport | null {
  const payload = response?.data;
  if (!payload) return null;

  // The reference names `questions`; older captures show `question_answers`.
  const rows = payload.questions ?? payload.question_answers ?? [];

  const questions = rows.map<AssessmentReportQuestion>((row, index) => {
    const options = row.options ?? [];
    const correctIds = new Set((row.correct_option_ids ?? []).map(String));
    const selected = options.find((o) => o.was_selected === true) ?? null;
    const correct = options.find((o) => o.id != null && correctIds.has(String(o.id))) ?? null;

    return {
      id: String(row.id ?? index),
      question: text(row.question_text),
      isCorrect: selected?.id != null && correctIds.has(String(selected.id)),
      selectedText: selected ? optionText(selected) || null : null,
      correctText: correct ? optionText(correct) || null : null,
      explanation: text(correct?.description) || null,
    };
  });

  const correctCount = payload.total_correct ?? questions.filter((q) => q.isCorrect).length;
  const totalCount = payload.total_questions ?? questions.length;

  return {
    passedAt: payload.exam_passes_date ?? null,
    // The server's percentage wins; the derived one only covers a response that
    // omits it. Pass/fail itself is never computed here — that is #10's call.
    scorePercent: Math.round(
      payload.result_details?.my_percentage ?? (totalCount ? (correctCount / totalCount) * 100 : 0),
    ),
    correctCount,
    totalCount,
    questions,
  };
}
