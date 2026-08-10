import {
  AllWebinarsResponse,
  isRegistrationAccepted,
  toRegistrationStatus,
  toWebinarCards,
  toWebinarDetail,
  toWebinarFeedbackBody,
  toWebinarFeedbackQuestions,
  toWebinarId,
} from './webinar.model';

describe('toWebinarId', () => {
  it('parses the string form #20 serialises', () => {
    expect(toWebinarId('1234')).toBe(1234);
    expect(toWebinarId(1234)).toBe(1234);
  });

  it('refuses a blank id instead of turning it into webinar 0', () => {
    // `Number('')` and `Number(null)` are both 0, which would look like a real
    // webinar and produce `webinars_web/0/`.
    expect(toWebinarId('')).toBeNull();
    expect(toWebinarId('   ')).toBeNull();
    expect(toWebinarId(null)).toBeNull();
    expect(toWebinarId(undefined)).toBeNull();
    expect(toWebinarId('abc')).toBeNull();
  });
});

describe('toWebinarCards', () => {
  const response: AllWebinarsResponse = {
    status: 'success',
    data: {
      upcoming: [{ id: '1', webinar_name: 'Up', start_time: '9:00 AM', end_time: '10:00 AM' }],
      expired: [{ id: 2, webinar_name: 'Old' }],
      completed: [{ id: '3', webinar_name: 'Done', is_feedback_completed: true }],
    },
  };

  it('tags each card with the group it came from — items carry no status', () => {
    expect(toWebinarCards(response).map((w) => [w.id, w.group])).toEqual([
      [1, 'upcoming'],
      [2, 'expired'],
      [3, 'completed'],
    ]);
  });

  it('drops items with no usable id rather than rendering a dead card', () => {
    expect(
      toWebinarCards({ status: 'success', data: { upcoming: [{ webinar_name: 'x' }] } }),
    ).toEqual([]);
  });

  it('prebuilds the time range and tolerates a missing half', () => {
    expect(toWebinarCards(response)[0].timeRange).toBe('9:00 AM - 10:00 AM');
    expect(toWebinarCards(response)[1].timeRange).toBe('');
    expect(
      toWebinarCards({
        status: 'success',
        data: { upcoming: [{ id: 1, start_time: '9:00 AM' }] },
      })[0].timeRange,
    ).toBe('9:00 AM');
  });

  it('survives a half-shaped response', () => {
    expect(toWebinarCards(undefined)).toEqual([]);
    expect(toWebinarCards({ status: 'success', data: {} })).toEqual([]);
    expect(toWebinarCards({ status: 'success', data: { upcoming: null } })).toEqual([]);
  });

  it('coerces empty certificate and badge URLs to null', () => {
    const [card] = toWebinarCards({
      status: 'success',
      data: { upcoming: [{ id: 1, webinar_certificate_url: '', webinar_credly_badge_url: '  ' }] },
    });
    expect(card.certificateUrl).toBeNull();
    expect(card.credlyBadgeUrl).toBeNull();
  });
});

describe('toWebinarDetail', () => {
  it('prefers the registration join URL over the bare webinar URL', () => {
    expect(
      toWebinarDetail({
        status: 'success',
        data: { id: 1, webinar_url: 'https://bare', registration: { join_url: 'https://join' } },
      })?.joinUrl,
    ).toBe('https://join');
  });

  it('falls back to the bare URL before the learner registers', () => {
    expect(
      toWebinarDetail({ status: 'success', data: { id: 1, webinar_url: 'https://bare' } })?.joinUrl,
    ).toBe('https://bare');
    expect(
      toWebinarDetail({
        status: 'success',
        data: { id: 1, webinar_url: 'https://bare', registration: { join_url: '' } },
      })?.joinUrl,
    ).toBe('https://bare');
  });

  it('maps speakers and the two list blocks', () => {
    const view = toWebinarDetail({
      status: 'success',
      data: {
        id: 1,
        why_attend: [{ title: 'A' }, { title: '' }],
        what_will_you_learn: ['X', ''],
        speakers: [{ name: 'S', designation: 'CPA', about: 'bio', image_url: '' }],
      },
    });
    expect(view?.whyAttend).toEqual(['A']);
    expect(view?.whatYouWillLearn).toEqual(['X']);
    expect(view?.speakers[0]).toEqual({
      name: 'S',
      imageUrl: null,
      credentials: 'CPA',
      bio: 'bio',
    });
  });

  it('returns null rather than a card with no id', () => {
    expect(toWebinarDetail(undefined)).toBeNull();
    expect(toWebinarDetail({ status: 'success', data: { webinar_name: 'x' } })).toBeNull();
  });
});

describe('isRegistrationAccepted', () => {
  it('accepts all three shapes the LMS treats as success', () => {
    expect(isRegistrationAccepted({ status: 'accepted' })).toBe(true);
    expect(isRegistrationAccepted({ registration_status: 'PENDING' })).toBe(true);
    expect(isRegistrationAccepted({ registration_status: 'registered' })).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isRegistrationAccepted(undefined)).toBe(false);
    expect(isRegistrationAccepted({ status: 'rejected', message: 'full' })).toBe(false);
    expect(isRegistrationAccepted({ registration_status: 'FAILED' })).toBe(false);
  });
});

describe('toRegistrationStatus', () => {
  it('reads either status key', () => {
    expect(toRegistrationStatus({ registration_status: 'REGISTERED' })).toBe('REGISTERED');
    expect(toRegistrationStatus({ status: 'registered' })).toBe('REGISTERED');
  });

  it('treats an error field as failure even when the status says otherwise', () => {
    expect(toRegistrationStatus({ registration_status: 'PENDING', error_code: 'E1' })).toBe(
      'FAILED',
    );
    expect(toRegistrationStatus({ status: 'REGISTERED', error_message: 'nope' })).toBe('FAILED');
  });

  it('defaults to pending so the poll keeps running', () => {
    expect(toRegistrationStatus(undefined)).toBe('PENDING');
    expect(toRegistrationStatus({})).toBe('PENDING');
    expect(toRegistrationStatus({ status: 'QUEUED' })).toBe('PENDING');
  });
});

describe('toWebinarFeedbackQuestions', () => {
  const q = {
    id: 'q1',
    CAIRA_Webinar_Feedback_Questions: 'Was it useful?',
    CAIRA_Masterclass_Feedback_Question_Type: 'rating',
    CAIRA_Masterclass_Feedback_Question_Order: 2,
  };

  it('reads the bare array #31 actually returns', () => {
    expect(toWebinarFeedbackQuestions([q])).toEqual([
      { id: 'q1', question: 'Was it useful?', type: 'rating', order: 2 },
    ]);
  });

  it('also reads the three wrapper keys the LMS tolerates', () => {
    expect(toWebinarFeedbackQuestions({ questions: [q] })).toHaveLength(1);
    expect(toWebinarFeedbackQuestions({ feedback_questions: [q] })).toHaveLength(1);
    expect(toWebinarFeedbackQuestions({ data: [q] })).toHaveLength(1);
  });

  it('drops questions with no id and numbers the rest from position', () => {
    expect(toWebinarFeedbackQuestions([{ CAIRA_Webinar_Feedback_Questions: 'x' }])).toEqual([]);
    expect(toWebinarFeedbackQuestions([{ id: 'q2' }])[0].order).toBe(1);
  });

  it('returns an empty list for nothing', () => {
    expect(toWebinarFeedbackQuestions(undefined)).toEqual([]);
    expect(toWebinarFeedbackQuestions([])).toEqual([]);
    expect(toWebinarFeedbackQuestions({})).toEqual([]);
  });
});

describe('toWebinarFeedbackBody', () => {
  const answers = [{ feedback_id: 'q1', rating: 5 }];

  it('uses feedback_id, not question_id — #13 and #32 disagree', () => {
    expect(toWebinarFeedbackBody(answers).responses[0]).toEqual({ feedback_id: 'q1', rating: 5 });
  });

  it('omits the comment key entirely when blank', () => {
    expect(toWebinarFeedbackBody(answers)).not.toHaveProperty('optional_feedback_text');
    expect(toWebinarFeedbackBody(answers, '   ')).not.toHaveProperty('optional_feedback_text');
  });

  it('trims and includes a real comment', () => {
    expect(toWebinarFeedbackBody(answers, '  great  ').optional_feedback_text).toBe('great');
  });
});
