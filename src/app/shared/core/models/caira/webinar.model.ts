import { CairaDataEnvelope, WebinarId } from './envelope.model';

/**
 * Webinars — #20 (list), #21 (detail), and the two parity endpoints L3/L4 that
 * register a learner.
 *
 * **Webinar ids are the one integer in CAIRA.** `Webinar.webinar_id` is a real
 * integer; #20 serialises it as a *string* (`str(webinar_id)`) while #21 takes
 * it back as an integer path param. The wire types below accept both and the
 * mappers normalise to `WebinarId` (number), so a call site can never build
 * `webinars_web/undefined/`. `webinar_uuid` is a separate field and is not the
 * id.
 *
 * #20 returns **every** active webinar in one shot, grouped
 * `{ upcoming, expired, completed }` — no pagination, no filters. The cards
 * carry no `status` field: the grouping *is* the status. #21 does have one.
 */

// ---------------------------------------------------------------------------
// Wire shapes — #20 list
// ---------------------------------------------------------------------------

export interface WebinarListItem {
  /** Integer, serialised as a string by #20. Normalise before use. */
  id?: number | string | null;
  webinar_uuid?: string | null;
  webinar_name?: string | null;
  date?: string | null;
  day?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  timezone?: string | null;
  credits_label?: string | null;
  cpe_credit_allocated?: number | null;
  badge_name?: string | null;
  badge_included?: boolean | null;
  credly_assertion_id?: string | null;
  credly_badge_claimed?: boolean | null;
  is_registered?: boolean | null;
  is_feedback_completed?: boolean | null;
  webinar_certificate_url?: string | null;
  webinar_credly_badge_url?: string | null;
}

/** The grouping is the status — the items themselves carry no status field. */
export type AllWebinarsResponse = CairaDataEnvelope<{
  upcoming?: WebinarListItem[] | null;
  expired?: WebinarListItem[] | null;
  completed?: WebinarListItem[] | null;
}>;

// ---------------------------------------------------------------------------
// Wire shapes — #21 detail
// ---------------------------------------------------------------------------

export interface WebinarSpeakerPayload {
  name?: string | null;
  image_url?: string | null;
  designation?: string | null;
  about?: string | null;
}

export interface WebinarWhyAttendPayload {
  title?: string | null;
}

/** Present once the learner is registered. `join_url` is the live link. */
export interface WebinarRegistrationPayload {
  registration_status?: string | null;
  join_url?: string | null;
}

export interface WebinarDetailPayload extends WebinarListItem {
  description?: string | null;
  image_url?: string | null;
  status?: string | null;
  webinar_url?: string | null;
  registration?: WebinarRegistrationPayload | null;
  /** Free-form blocks the LMS parses rather than reads — see the mapper. */
  important_details?: unknown;
  how_to_earn_cpe?: unknown;
  additional_information?: unknown;
  why_attend_heading?: string | null;
  why_attend?: WebinarWhyAttendPayload[] | null;
  what_will_you_learn?: string[] | null;
  speakers?: WebinarSpeakerPayload[] | null;
}

export type WebinarDetailResponse = CairaDataEnvelope<WebinarDetailPayload>;

// ---------------------------------------------------------------------------
// Wire shapes — L3 / L4 async registration
// ---------------------------------------------------------------------------

/**
 * Server-side registration states. `PENDING` means the work is queued, not
 * failed — the LMS treats it as an accepted registration and polls.
 */
export type WebinarRegistrationStatus = 'PENDING' | 'REGISTERED' | 'FAILED';

/** L3 — the accept. The registration itself completes in the background. */
export interface WebinarRegisterResponse {
  status?: string | null;
  registration_status?: string | null;
  attempt_id?: string | null;
  status_url?: string | null;
  message?: string | null;
}

/** L4 — one poll of an attempt. */
export interface WebinarRegisterStatusResponse {
  status?: string | null;
  registration_status?: string | null;
  error_message?: string | null;
  error_code?: string | null;
}

// ---------------------------------------------------------------------------
// View models
// ---------------------------------------------------------------------------

export type WebinarGroup = 'upcoming' | 'expired' | 'completed';

export interface WebinarCard {
  id: WebinarId;
  uuid: string | null;
  title: string;
  /** `"09:00 AM - 10:00 AM"`, prebuilt so the template holds no logic. */
  timeRange: string;
  date: string;
  day: string;
  timezone: string;
  creditsLabel: string;
  cpeCredits: number;
  badgeName: string | null;
  badgeIncluded: boolean;
  credlyAssertionId: string | null;
  credlyBadgeClaimed: boolean;
  group: WebinarGroup;
  isRegistered: boolean;
  isFeedbackCompleted: boolean;
  certificateUrl: string | null;
  credlyBadgeUrl: string | null;
}

export interface WebinarSpeaker {
  name: string;
  imageUrl: string | null;
  credentials: string;
  bio: string;
}

export interface WebinarDetailView extends WebinarCard {
  description: string;
  bannerUrl: string | null;
  /** #21's own status string, which the list endpoint does not provide. */
  status: string | null;
  /** `registration.join_url` first, then the bare `webinar_url`. */
  joinUrl: string | null;
  whyAttend: string[];
  whatYouWillLearn: string[];
  speakers: WebinarSpeaker[];
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

/** Empty string is not a URL — `ngSrc=""` throws NG02952. */
function img(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * #20 serialises the integer id as a string. `Number('')` is `0` and
 * `Number(null)` is `0`, so a blank id would silently become a valid-looking
 * webinar 0 — hence the explicit guard rather than a bare `Number()`.
 */
export function toWebinarId(value: number | string | null | undefined): WebinarId | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toCard(item: WebinarListItem, group: WebinarGroup, id: WebinarId): WebinarCard {
  const start = item.start_time?.trim() ?? '';
  const end = item.end_time?.trim() ?? '';
  return {
    id,
    uuid: item.webinar_uuid?.trim() || null,
    title: item.webinar_name ?? '',
    // Both halves present → a range; one half → that half; neither → ''.
    timeRange: [start, end].filter(Boolean).join(' - '),
    date: item.date ?? '',
    day: item.day ?? '',
    timezone: item.timezone ?? '',
    creditsLabel: item.credits_label ?? '',
    cpeCredits: item.cpe_credit_allocated ?? 0,
    badgeName: item.badge_name?.trim() || null,
    badgeIncluded: !!item.badge_included,
    credlyAssertionId: item.credly_assertion_id?.trim() || null,
    credlyBadgeClaimed: !!item.credly_badge_claimed,
    group,
    isRegistered: !!item.is_registered,
    isFeedbackCompleted: !!item.is_feedback_completed,
    certificateUrl: img(item.webinar_certificate_url),
    credlyBadgeUrl: img(item.webinar_credly_badge_url),
  };
}

/**
 * Flatten #20's three groups into one list, tagging each card with the group it
 * came from. Items without a usable id are dropped rather than rendered — a
 * card with no id has no detail page and no registration target.
 */
export function toWebinarCards(response: AllWebinarsResponse | undefined): WebinarCard[] {
  const data = response?.data;
  if (!data) return [];
  const groups: [WebinarGroup, WebinarListItem[] | null | undefined][] = [
    ['upcoming', data.upcoming],
    ['expired', data.expired],
    ['completed', data.completed],
  ];
  return groups.flatMap(([group, items]) =>
    (items ?? []).flatMap((item) => {
      const id = toWebinarId(item.id);
      return id === null ? [] : [toCard(item, group, id)];
    }),
  );
}

export function toWebinarDetail(
  response: WebinarDetailResponse | undefined,
): WebinarDetailView | null {
  const payload = response?.data;
  if (!payload) return null;
  const id = toWebinarId(payload.id);
  if (id === null) return null;

  return {
    // #21 carries no group, so the detail view inherits `upcoming` and callers
    // that need the real grouping read it off the list card instead.
    ...toCard(payload, 'upcoming', id),
    description: payload.description ?? '',
    bannerUrl: img(payload.image_url),
    status: payload.status?.trim() || null,
    // The join link only exists once registered; the bare URL is the fallback.
    joinUrl: img(payload.registration?.join_url) ?? img(payload.webinar_url),
    whyAttend: (payload.why_attend ?? []).map((w) => w?.title ?? '').filter(Boolean),
    whatYouWillLearn: (payload.what_will_you_learn ?? []).filter(Boolean),
    speakers: (payload.speakers ?? []).map((s) => ({
      name: s?.name ?? '',
      imageUrl: img(s?.image_url),
      credentials: s?.designation ?? '',
      bio: s?.about ?? '',
    })),
  };
}

/**
 * Whether L3 accepted the registration.
 *
 * Three shapes count as accepted, matching the LMS: the literal
 * `status: "accepted"`, or a `registration_status` of `PENDING` (queued) or
 * `REGISTERED` (already done). Anything else is a refusal and carries `message`.
 */
export function isRegistrationAccepted(response: WebinarRegisterResponse | undefined): boolean {
  if (!response) return false;
  const status = response.registration_status?.toUpperCase();
  return response.status === 'accepted' || status === 'PENDING' || status === 'REGISTERED';
}

/**
 * Normalise a poll answer. `registration_status` first, then the generic
 * `status` — L4 has been seen using either. An `error_message` or `error_code`
 * means failure even when the status string does not say so.
 */
export function toRegistrationStatus(
  response: WebinarRegisterStatusResponse | undefined,
): WebinarRegistrationStatus {
  if (!response) return 'PENDING';
  if (response.error_message || response.error_code) return 'FAILED';
  const status = (response.registration_status ?? response.status ?? '').toUpperCase();
  if (status === 'REGISTERED') return 'REGISTERED';
  if (status === 'FAILED') return 'FAILED';
  return 'PENDING';
}

// ---------------------------------------------------------------------------
// Wire shapes — #31 / #32 webinar feedback
// ---------------------------------------------------------------------------

/**
 * #31 · `GET caira/webinar_feedback_questions/?webinar_id=`.
 *
 * Returns a **bare JSON array** and uses DRF `{detail}` for errors, unlike its
 * masterclass twin. The LMS additionally accepts `{questions}`, `{data}` and
 * `{feedback_questions}` wrappers because it has seen all four; that tolerance
 * is reproduced in `toWebinarFeedbackQuestions` rather than in the type.
 */
export interface WebinarFeedbackQuestionPayload {
  id?: string | null;
  CAIRA_Webinar_Feedback_Questions?: string | null;
  CAIRA_Masterclass_Feedback_Question_Type?: string | null;
  CAIRA_Masterclass_Feedback_Question_Order?: number | null;
}

export type WebinarFeedbackQuestionsResponse =
  | WebinarFeedbackQuestionPayload[]
  | {
      questions?: WebinarFeedbackQuestionPayload[] | null;
      feedback_questions?: WebinarFeedbackQuestionPayload[] | null;
      data?: WebinarFeedbackQuestionPayload[] | null;
    };

/**
 * #32 · `POST caira/webinar_feedback_submit/?webinar_id=` — note `webinar_id`
 * stays a **query param even on the POST**, and the endpoint returns **201**.
 *
 * **The response key is `feedback_id`, not `question_id`.** The masterclass
 * feedback submit (#13) uses `question_id` for the same concept. Sending the
 * wrong key is a silent 400 with an `invalid_feedback_ids` list whose order is
 * nondeterministic (it comes from a Python `set`).
 */
export interface WebinarFeedbackAnswer {
  feedback_id: string;
  rating: number;
}

export interface WebinarFeedbackSubmitBody {
  responses: WebinarFeedbackAnswer[];
  /** Omitted entirely when blank — the LMS never sends an empty string. */
  optional_feedback_text?: string;
}

export interface WebinarFeedbackQuestion {
  id: string;
  question: string;
  type: string;
  order: number;
}

/** Accepts the bare array and all three wrapper keys the LMS tolerates. */
export function toWebinarFeedbackQuestions(
  response: WebinarFeedbackQuestionsResponse | undefined,
): WebinarFeedbackQuestion[] {
  if (!response) return [];
  const list = Array.isArray(response)
    ? response
    : (response.questions ?? response.feedback_questions ?? response.data ?? []);

  return list.flatMap((q, index) =>
    q?.id
      ? [
          {
            id: q.id,
            question: q.CAIRA_Webinar_Feedback_Questions ?? '',
            type: q.CAIRA_Masterclass_Feedback_Question_Type ?? '',
            order: q.CAIRA_Masterclass_Feedback_Question_Order ?? index + 1,
          },
        ]
      : [],
  );
}

/**
 * Build the #32 body. `optional_feedback_text` is dropped when blank rather
 * than sent as `''`.
 */
export function toWebinarFeedbackBody(
  answers: WebinarFeedbackAnswer[],
  comment?: string,
): WebinarFeedbackSubmitBody {
  const text = comment?.trim();
  return text ? { responses: answers, optional_feedback_text: text } : { responses: answers };
}
