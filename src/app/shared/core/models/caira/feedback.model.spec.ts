import {
  FeedbackQuestionPayload,
  toFeedbackQuestions,
  toFeedbackSubmitBody,
} from './feedback.model';

function question(overrides: Partial<FeedbackQuestionPayload> = {}): FeedbackQuestionPayload {
  return {
    id: 'q-1',
    CAIRA_Masterclass_Feedback_Questions: 'Was the content relevant?',
    CAIRA_Masterclass_Feedback_Question_Type: 'rating',
    CAIRA_Masterclass_Feedback_Question_Order: 1,
    ...overrides,
  };
}

describe('toFeedbackQuestions', () => {
  it('accepts the bare array and all three wrappers', () => {
    // #12 is uncaptured (G-02). The webinar twin has been seen returning each of
    // these, so the masterclass mapper tolerates the same set rather than
    // betting on one.
    const one = [question()];
    expect(toFeedbackQuestions(one)).toHaveLength(1);
    expect(toFeedbackQuestions({ questions: one })).toHaveLength(1);
    expect(toFeedbackQuestions({ feedback_questions: one })).toHaveLength(1);
    expect(toFeedbackQuestions({ data: one })).toHaveLength(1);
  });

  it('reads either surface spelling of the question text', () => {
    // The webinar endpoint reuses the masterclass serializer but names the text
    // field after itself, so both keys are live.
    const [masterclass] = toFeedbackQuestions([question()]);
    expect(masterclass.question).toBe('Was the content relevant?');

    const [webinar] = toFeedbackQuestions([
      question({
        CAIRA_Masterclass_Feedback_Questions: null,
        CAIRA_Webinar_Feedback_Questions: 'Would you recommend it?',
      }),
    ]);
    expect(webinar.question).toBe('Would you recommend it?');
  });

  it('drops an entry with no id rather than rendering an unsubmittable row', () => {
    // A star row whose id is missing cannot be submitted — #13 keys answers by
    // `question_id`, so rendering it would guarantee a 400 on submit.
    expect(toFeedbackQuestions([question({ id: null }), question({ id: 'q-2' })])).toEqual([
      { id: 'q-2', question: 'Was the content relevant?', type: 'rating', order: 1 },
    ]);
  });

  it('orders by `order`, not array position', () => {
    const views = toFeedbackQuestions([
      question({ id: 'q-2', CAIRA_Masterclass_Feedback_Question_Order: 2 }),
      question({ id: 'q-1', CAIRA_Masterclass_Feedback_Question_Order: 1 }),
    ]);
    expect(views.map((q) => q.id)).toEqual(['q-1', 'q-2']);
  });

  it('returns an empty list for an unexpected shape instead of throwing', () => {
    expect(toFeedbackQuestions(undefined)).toEqual([]);
    expect(toFeedbackQuestions({})).toEqual([]);
    expect(toFeedbackQuestions({ questions: null })).toEqual([]);
  });
});

describe('toFeedbackSubmitBody', () => {
  it('keys answers as `question_id` — the webinar twin uses `feedback_id`', () => {
    // Sending the wrong key is a silent 400 whose `invalid_feedback_ids` list
    // comes from a Python set, so the error is not even stable.
    expect(toFeedbackSubmitBody({ 'q-1': 5 }, '').responses).toEqual([
      { question_id: 'q-1', rating: 5 },
    ]);
  });

  it('drops unrated questions', () => {
    const body = toFeedbackSubmitBody({ 'q-1': 4, 'q-2': 0 }, '');
    expect(body.responses).toEqual([{ question_id: 'q-1', rating: 4 }]);
  });

  it('omits blank comments entirely rather than sending an empty string', () => {
    expect(toFeedbackSubmitBody({ 'q-1': 3 }, '   ')).not.toHaveProperty('optional_feedback_text');
    expect(toFeedbackSubmitBody({ 'q-1': 3 }, ' good ').optional_feedback_text).toBe('good');
  });
});
