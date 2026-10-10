import { HttpErrorResponse } from '@angular/common/http';

import { ProfileStatus } from './auth.model';
import { CommonResponse, RouteConfig } from './http.model';

/**
 * MilesCAIRA Accounts v1 — the user record and the questionnaire.
 *
 * READ THIS FIRST — two renames, both load-bearing:
 *
 *  - `api/v1/account/profile/` changed meaning on 2026-09-09. It used to serve
 *    the user row; it now serves QUESTIONNAIRE ANSWERS AND NOTHING ELSE, and
 *    `PATCH profile/` is the only way to write profile fields.
 *  - `api/v1/account/user_details/` (underscore) — the 28-field row and its
 *    PATCH — was DELETED on 2026-09-24. `user-details/` (hyphen) replaces the
 *    read with a routing summary and has NO write (a PATCH is 405).
 *
 * Every body arrives inside `{success, message, data}` (2026-10-10). The types
 * below describe `data`; `AccountApi` / `OnboardingApi` unwrap it.
 */

/** Which questionnaire is in scope. An unrecognised value is a 400 naming the
 *  accepted set, never a silent fallback that would serve the wrong screen. */
export type ProfileForm = 'onboarding' | 'profile';

// ── The user record ─────────────────────────────────────────────────────────

/**
 * `GET user-details/` — everything the app needs to route the caller, in one
 * call. No user id in the path: the row is always the caller's.
 *
 * Only the keys this app READS are typed. The payload also carries `pathway`,
 * `enrolled_status`, `enrolled_course` (programme rows), `user_data_fully_filled`
 * and `career_counselling_booked` — renamed or reshaped three times in a month
 * (2026-09-24, 10-05, 10-07), and nothing here branches on them. Bind one only
 * when a screen needs it, and add it to `isUserDetails` then.
 *
 * There is deliberately no email, last name, phone or city here — those are
 * questionnaire answers now.
 */
export interface UserDetails {
  /** Display name. Falls back server-side to the whole `full_name`. `null` on a
   *  new account until the questionnaire's `full_name` is answered (live UAT,
   *  2026-10-10). */
  first_name: string | null;
  /** Stored full name, whitespace-stripped. `null` on a new account. */
  full_name: string | null;
  /** The stored milestone column — the onboarding gate reads THIS one. */
  is_onboarding_completed: boolean;
  is_profile_completed: boolean;
}

/**
 * The name the shell shows for the signed-in user. `user-details/` carries
 * `full_name` and `first_name` and nothing else about identity (no email, no
 * separate last name), so this is the whole rule. Shared by the header drawer
 * and `user-avatar-menu`, so the two can't disagree.
 */
export function displayNameOf(user: UserDetails | null): string {
  return user?.full_name || user?.first_name || '';
}

/** First and last initials of a display name; `'U'` when there is no name. */
export function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1][0] ?? '') : '';
  return `${first}${last}`.toUpperCase() || 'U';
}

/**
 * The trust boundary for the user record. Hand-written for the same reason as
 * `isSessionResponse`: a renamed key would otherwise render as `undefined`
 * everywhere with no signal. It checks exactly the keys `UserDetails` types —
 * a rename of one we read must fail loudly, and a rename of one we don't must
 * not blank the header (which is what the 2026-10-05 `Pathway` → `pathway`
 * lowercasing did).
 */
const isNullableString = (v: unknown): v is string | null => v === null || typeof v === 'string';

export function isUserDetails(body: unknown): body is UserDetails {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false;
  const b = body as Record<string, unknown>;
  return (
    isNullableString(b['first_name']) &&
    isNullableString(b['full_name']) &&
    typeof b['is_onboarding_completed'] === 'boolean' &&
    typeof b['is_profile_completed'] === 'boolean'
  );
}

/** `httpResource` `parse` for `user-details/`'s `data`: a drifted body becomes
 *  the resource's `error()`, in one place, rather than a half-typed value. */
export function parseUserDetails(body: unknown): UserDetails {
  if (!isUserDetails(body)) {
    throw new Error('user-details/ response does not match the contract.');
  }
  return body;
}

// ── The questionnaire ───────────────────────────────────────────────────────

export type AnswerValue = string | number | boolean | string[];

/**
 * `GET profile/` returns a BARE FLAT MAP keyed by question code — the value is
 * the answer itself, not an object describing it. Text gives a string, select
 * formats give a list, booleans give `true`/`false`, numbers give a number.
 *
 * An empty answer set is `{}`, not a 404: having answered nothing is normal.
 * Key order is display order; there is no separate ordering field.
 *
 * Flattened on 2026-09-10 — `type` is no longer reported here. Join
 * `questions/` on `code` if you need it.
 */
export type AnswerMap = Record<string, AnswerValue>;

/**
 * How a question is answered — drives which control renders.
 *
 * Confirmed from a live `questions/` payload: `text` and `single_select`. The
 * rest are the backend's declared vocabulary; an unrecognised value is not an
 * error, it falls back to a free-text control (or a choice when the question
 * ships options).
 */
export type AnswerFormat =
  'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'single_select' | 'multi_select';

export interface QuestionOption {
  /** What the learner reads. */
  text: string;
  /** The option's second line; `''` when it has none, never absent. */
  description: string;
  /**
   * What gets stored — one string per option (changed 2026-10-09 from a
   * one-element list). A select's ANSWER is still a list of these, even for a
   * single-select.
   */
  value: string;
}

/** One question from `GET questions/`. */
export interface Question {
  /** UUID. `parent_question` points at this, NOT at `code`. */
  id: string;
  /** The key the answer is stored under in `AnswerMap`. */
  code: string;
  question: string;
  help_text: string;
  placeholder: string | null;
  answer_format: AnswerFormat | (string & {});
  /** A label you may group by. It does NOT affect ordering, and `''` means
   *  ungrouped — there are no screen buckets. */
  section: string;
  /** `both` appears under EITHER `form` value — which is why membership is one
   *  column rather than two booleans. */
  visibility: ProfileForm | 'both';
  display_order: number;
  is_required: boolean;
  /** Extra rules (`min`, `max`, `max_length`). Enforced server-side, which
   *  answers a 400 under the question — carried, not interpreted. */
  validation: unknown;
  /** `id` of the question that gates this one; `null` = always shown. */
  parent_question: string | null;
  /** The parent answer(s) that reveal this question. `null` with a parent set
   *  means any answer reveals it. */
  parent_answer_value: string | string[] | null;
  options: QuestionOption[];
}

/** A flat list, already sorted by `display_order`. */
export interface QuestionsResponse {
  Questions: Question[];
}

export interface SaveAnswersResponse {
  answers: AnswerMap;
  profile_status: ProfileStatus;
  is_onboarding_completed: boolean;
  is_profile_completed: boolean;
  /**
   * What is still outstanding. The write ALWAYS succeeds; the milestone
   * advances only when every required, shown question of that form has an
   * answer. A non-empty `missing` is NOT an error — do not render it as one.
   */
  missing: string[];
}

// ── Errors ──────────────────────────────────────────────────────────────────

/**
 * The error bodies this app's account routes answer with. All arrive inside
 * `{success: false, message, data}`, and `data` is one of:
 *
 * - `{ [questionCode]: message | [message] }` — `PATCH profile/` 400, one line
 *   per answer.
 * - `{ [undeclaredKey]: message }` — the strict-input 400 on every strict route.
 * - `{ status: 'error', code, … }` — a routed failure; the top `message` says it.
 * - `null` — 401 for a missing or expired token, 404, 502.
 *
 * Normalised into the two things a screen can do with one: put messages under
 * fields, or show one message.
 */
export type AccountError =
  { kind: 'fields'; fields: Record<string, string> } | { kind: 'message'; message: string | null };

/** Keys that mark an envelope rather than a field-keyed 400. */
const ENVELOPE_KEYS = new Set(['status', 'message', 'detail', 'details', 'code', 'error']);

export function readAccountError(err: unknown): AccountError {
  const body: unknown = err instanceof HttpErrorResponse ? err.error : null;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { kind: 'message', message: typeof body === 'string' && body ? body : null };
  }

  const top = body as Record<string, unknown>;
  const message = [top['message'], top['detail']].find(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );

  // A field-keyed 400 is the envelope's `data`. Anything else — no `data`, or a
  // `data` that is itself an envelope — is one message. Checking the keys, not
  // merely "has string values", is what stops `{status: 'error', code}` rendering
  // as two "field" errors under questions that do not exist.
  const data = top['data'];
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { kind: 'message', message: message ?? null };
  }
  const entries = Object.entries(data);
  if (entries.some(([key]) => ENVELOPE_KEYS.has(key))) {
    return { kind: 'message', message: message ?? null };
  }
  const fields: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (typeof value === 'string' && value) fields[key] = value;
    // DRF-native 400s send a list of messages per field.
    else if (Array.isArray(value) && typeof value[0] === 'string') fields[key] = value[0];
  }
  return Object.keys(fields).length
    ? { kind: 'fields', fields }
    : { kind: 'message', message: message ?? null };
}

// ── Route registry ──────────────────────────────────────────────────────────

export const ACCOUNT_ROUTES = {
  /** GET only — the old underscore route and its PATCH were deleted. */
  userDetails: {
    path: 'api/v1/account/user-details/',
    method: 'GET',
  } as RouteConfig<void, CommonResponse<UserDetails>>,

  questions: {
    path: 'api/v1/account/questions/',
    method: 'GET',
  } as RouteConfig<
    void,
    CommonResponse<QuestionsResponse>,
    Record<string, never>,
    { form: ProfileForm }
  >,

  answers: {
    path: 'api/v1/account/profile/',
    method: 'GET',
  } as RouteConfig<void, CommonResponse<AnswerMap>>,

  saveAnswers: {
    path: 'api/v1/account/profile/',
    method: 'PATCH',
  } as RouteConfig<
    AnswerMap,
    CommonResponse<SaveAnswersResponse>,
    Record<string, never>,
    { form: ProfileForm }
  >,
} as const;
