import { HttpErrorResponse } from '@angular/common/http';

import { ProfileStatus } from './auth.model';
import { RouteConfig } from './http.model';

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
 *    read with an 8-field routing summary and has NO write (a PATCH is 405).
 */

/** Which questionnaire is in scope. An unrecognised value is a 400 naming the
 *  accepted set, never a silent fallback that would serve the wrong screen. */
export type ProfileForm = 'onboarding' | 'profile';

// ── The user record ─────────────────────────────────────────────────────────

/** Legacy's shape: a capitalised STRING, not a boolean. */
export type YesNo = 'Yes' | 'No';

/**
 * `GET user-details/` — everything the app needs to route the caller, in one
 * call. No user id in the path: the row is always the caller's.
 *
 * Every key is always present. There is deliberately no email, last name,
 * phone or city here any more — those are questionnaire answers now.
 */
export interface UserDetails {
  /** Display name. Falls back server-side to the first token of `full_name`. */
  first_name: string;
  /** Stored full name, whitespace-stripped. May be `''`. */
  full_name: string;
  /** The stored milestone column — the onboarding gate reads THIS one. */
  is_onboarding_completed: boolean;
  is_profile_completed: boolean;
  /**
   * `'No'` means "could not confirm", not proof of absence: an enrolment lookup
   * failure answers 200 with the conservative `'No'` payload rather than 500.
   */
  Pathway: YesNo;
  Enrolled_status: YesNo;
  /** Programme names; `[]` when not enrolled. */
  Enrolled_course: string[];
  /** DERIVED — every always-asked onboarding field is filled. Not the stored
   *  `is_onboarding_completed`, and not the gate. */
  onboarding_fully_completed: boolean;
}

const isYesNo = (v: unknown): v is YesNo => v === 'Yes' || v === 'No';

/**
 * The trust boundary for the user record. Hand-written for the same reason as
 * `isSessionResponse`: a renamed key would otherwise render as `undefined`
 * everywhere with no signal. Extra keys are allowed — the contract adds keys
 * without notice; it is a rename or removal that must fail loudly.
 */
export function isUserDetails(body: unknown): body is UserDetails {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b['first_name'] === 'string' &&
    typeof b['full_name'] === 'string' &&
    typeof b['is_onboarding_completed'] === 'boolean' &&
    typeof b['is_profile_completed'] === 'boolean' &&
    isYesNo(b['Pathway']) &&
    isYesNo(b['Enrolled_status']) &&
    Array.isArray(b['Enrolled_course']) &&
    b['Enrolled_course'].every((c) => typeof c === 'string') &&
    typeof b['onboarding_fully_completed'] === 'boolean'
  );
}

/** `httpResource` `parse` for `user-details/`: a drifted body becomes the
 *  resource's `error()`, in one place, rather than a half-typed value. */
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
  /**
   * What gets stored. ALWAYS a list, even for a single-select — and the answer
   * written back to `profile/` is this list verbatim, which is why the option
   * is looked up rather than its key split apart.
   */
  value: string[];
}

/** One question from `GET questions/`. */
export interface Question {
  /** UUID. `parent_question` points at this, NOT at `code`. */
  id: string;
  /** The key the answer is stored under in `AnswerMap`. */
  code: string;
  question: string;
  help_text: string;
  placeholder: string;
  answer_format: AnswerFormat | (string & {});
  /** A label you may group by. It does NOT affect ordering, and `''` means
   *  ungrouped — there are no screen buckets. */
  section: string;
  /** `both` appears under EITHER `form` value — which is why membership is one
   *  column rather than two booleans. */
  visibility: ProfileForm | 'both';
  display_order: number;
  is_required: boolean;
  /** Extra rules (length, range, pattern). Null on every question captured so
   *  far, so the shape is unknown — carried, not interpreted. */
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
 * The error bodies this app's account routes answer with. There is no shared
 * envelope; these four are all live:
 *
 * - `{ [questionCode]: message }` — `PATCH profile/` 400, one line per answer.
 * - `{ [undeclaredKey]: message }` — the strict-input 400 on every strict route.
 * - `{ status: 'error', message, details? }` — the shared 500 from `utils/view_errors`.
 * - `{ message, status: 'Failed' }` — legacy 404 / 502.
 * - `{ detail }` — DRF's own 403 for a missing or expired token.
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

  const entries = Object.entries(body);
  const message = ['message', 'detail']
    .map((key) => entries.find(([k]) => k === key)?.[1])
    .find((v): v is string => typeof v === 'string' && v.length > 0);

  // An envelope says so with its keys; only a body made purely of other keys is
  // field-keyed. Checking the keys — not merely "has string values" — is what
  // stops `{status: 'error', message}` rendering as two "field" errors nobody sees.
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
    : { kind: 'message', message: null };
}

// ── Route registry ──────────────────────────────────────────────────────────

export const ACCOUNT_ROUTES = {
  /** GET only — the old underscore route and its PATCH were deleted. */
  userDetails: {
    path: 'api/v1/account/user-details/',
    method: 'GET',
  } as RouteConfig<void, UserDetails>,

  questions: {
    path: 'api/v1/account/questions/',
    method: 'GET',
  } as RouteConfig<void, QuestionsResponse, Record<string, never>, { form: ProfileForm }>,

  answers: {
    path: 'api/v1/account/profile/',
    method: 'GET',
  } as RouteConfig<void, AnswerMap>,

  saveAnswers: {
    path: 'api/v1/account/profile/',
    method: 'PATCH',
  } as RouteConfig<AnswerMap, SaveAnswersResponse, Record<string, never>, { form: ProfileForm }>,
} as const;
