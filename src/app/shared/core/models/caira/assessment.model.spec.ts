import { AssessmentResultResponse, toAssessmentReport } from './assessment.model';

function response(
  overrides: Partial<NonNullable<AssessmentResultResponse['data']>> = {},
): AssessmentResultResponse {
  return {
    status: true,
    data: {
      total_questions: 2,
      total_correct: 1,
      exam_passes_date: '2026-05-01T00:00:00Z',
      result_details: { my_percentage: 50 },
      questions: [
        {
          id: 'q-1',
          question_text: 'What is CPE?',
          correct_option_ids: ['o-2'],
          options: [
            { id: 'o-1', option_text: 'Wrong', was_selected: true },
            { id: 'o-2', option_text: 'Right', description: 'Because it is.' },
          ],
        },
        {
          id: 'q-2',
          question_text: 'Second?',
          correct_option_ids: ['o-4'],
          options: [
            { id: 'o-3', option_text: 'No' },
            { id: 'o-4', option_text: 'Yes', was_selected: true },
          ],
        },
      ],
      ...overrides,
    },
  };
}

describe('toAssessmentReport', () => {
  it('decides correctness by set membership, never by option order', () => {
    // `correct_option_ids` comes from a Python set — the order does not track
    // `options`, so indexing positionally would mark the wrong answer right.
    const report = toAssessmentReport(response())!;
    expect(report.questions[0].isCorrect).toBe(false);
    expect(report.questions[0].selectedText).toBe('Wrong');
    expect(report.questions[0].correctText).toBe('Right');
    expect(report.questions[1].isCorrect).toBe(true);
  });

  it('carries the correct option rationale, not the selected one', () => {
    expect(toAssessmentReport(response())!.questions[0].explanation).toBe('Because it is.');
  });

  it('treats a skipped question as incorrect with no selected text', () => {
    const skipped = toAssessmentReport(
      response({
        questions: [
          {
            id: 'q-1',
            question_text: 'Skipped',
            correct_option_ids: ['o-2'],
            options: [
              { id: 'o-1', option_text: 'A' },
              { id: 'o-2', option_text: 'B' },
            ],
          },
        ],
      }),
    )!;
    expect(skipped.questions[0].isCorrect).toBe(false);
    expect(skipped.questions[0].selectedText).toBeNull();
  });

  it('prefers the server percentage over a derived one', () => {
    // Pass/fail and the score are the server's call (#10). The derived value
    // only covers a response that omits it.
    expect(toAssessmentReport(response())!.scorePercent).toBe(50);
    const derived = toAssessmentReport(response({ result_details: null }))!;
    expect(derived.scorePercent).toBe(50);
  });

  it('accepts the older `question_answers` key', () => {
    const legacy = toAssessmentReport(
      response({ questions: null, question_answers: [{ id: 'q-9', question_text: 'Legacy' }] }),
    )!;
    expect(legacy.questions[0].question).toBe('Legacy');
  });

  it('returns null when there is no attempt to report', () => {
    expect(toAssessmentReport(undefined)).toBeNull();
    expect(toAssessmentReport({ status: true, data: null })).toBeNull();
  });
});
