import { CairaUuid } from './envelope.model';

/**
 * Course feedback — #12 (questions) and #13 (submit).
 *
 * **G-02 caveat.** `CAIRAMasterclassFeedbackQuestionSerializer`'s field list was
 * never captured, so the payload below is derived rather than observed. The
 * derivation is sound: the *webinar* feedback questions (#31) are already bound
 * in `webinar.model.ts`, and their payload keys are literally
 * `CAIRA_Masterclass_Feedback_Question_Type` / `_Order` — the webinar endpoint
 * reuses the masterclass serializer. Only the question-text key differs per
 * surface, so both spellings are read here.
 *
 * `toFeedbackQuestions` therefore tolerates a bare array and three wrapper keys,
 * and drops any entry without an `id` rather than rendering a star row that
 * cannot be submitted. A shape the backend changes underneath us yields an empty
 * form, never a crash. Replace the guesswork the moment #12 is captured.
 */

// ---------------------------------------------------------------------------
// #12 · GET <courseId>/feedback/questions/
// ---------------------------------------------------------------------------

export interface FeedbackQuestionPayload {
  id?: CairaUuid | null;
  CAIRA_Masterclass_Feedback_Questions?: string | null;
  /** The webinar twin's spelling. Same serializer, different surface. */
  CAIRA_Webinar_Feedback_Questions?: string | null;
  CAIRA_Masterclass_Feedback_Question_Type?: string | null;
  CAIRA_Masterclass_Feedback_Question_Order?: number | null;
}

/** Bare array, or any of the three wrappers the LMS has been seen to receive. */
export type FeedbackQuestionsResponse =
  | FeedbackQuestionPayload[]
  | {
      questions?: FeedbackQuestionPayload[] | null;
      feedback_questions?: FeedbackQuestionPayload[] | null;
      data?: FeedbackQuestionPayload[] | null;
    };

/** What the feedback form renders: one rating row per question. */
export interface FeedbackQuestion {
  id: CairaUuid;
  question: string;
  type: string;
  order: number;
}

export function toFeedbackQuestions(
  response: FeedbackQuestionsResponse | undefined,
): FeedbackQuestion[] {
  if (!response) return [];
  const list = Array.isArray(response)
    ? response
    : (response.questions ?? response.feedback_questions ?? response.data ?? []);

  return (list ?? [])
    .flatMap((q, index) =>
      q?.id
        ? [
            {
              id: q.id,
              question:
                q.CAIRA_Masterclass_Feedback_Questions ?? q.CAIRA_Webinar_Feedback_Questions ?? '',
              type: q.CAIRA_Masterclass_Feedback_Question_Type ?? '',
              order: q.CAIRA_Masterclass_Feedback_Question_Order ?? index + 1,
            },
          ]
        : [],
    )
    .sort((a, b) => a.order - b.order);
}

// ---------------------------------------------------------------------------
// #13 · POST <courseId>/feedback/submit/
// ---------------------------------------------------------------------------

/**
 * **The key is `question_id`.** The webinar twin (#32) calls the same concept
 * `feedback_id`; sending the wrong one is a silent 400 carrying an
 * `invalid_feedback_ids` list whose order comes from a Python `set` and is
 * therefore not stable.
 */
export interface FeedbackAnswer {
  question_id: CairaUuid;
  rating: number;
}

export interface FeedbackSubmitBody {
  /** Required, and iterated unconditionally server-side. */
  responses: FeedbackAnswer[];
  /** Omitted entirely when blank — never sent as an empty string. */
  optional_feedback_text?: string;
}

/**
 * Feedback is the trigger for the whole credential pipeline, so the response is
 * four independent flags rather than a single success boolean. The certificate
 * is *triggered*, not returned — its URL arrives on #4's `certificate_url` once
 * generation finishes, which is why this response carries no link.
 */
export interface FeedbackSubmitResponse {
  feedback_submitted?: boolean | null;
  cpe_awarded?: boolean | null;
  badge_issued?: boolean | null;
  certificate_triggered?: boolean | null;
}

/** Drop unrated questions and omit blank comments — both are server contracts. */
export function toFeedbackSubmitBody(
  ratings: Record<CairaUuid, number>,
  comments: string,
): FeedbackSubmitBody {
  const responses = Object.entries(ratings)
    .filter(([, rating]) => rating > 0)
    .map(([question_id, rating]) => ({ question_id, rating }));

  const text = comments.trim();
  return text ? { responses, optional_feedback_text: text } : { responses };
}
