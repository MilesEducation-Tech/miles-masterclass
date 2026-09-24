import { ProfileStatus } from './auth.model';
import { RouteConfig } from './http.model';

/**
 * MilesCAIRA Accounts v1 — the user record and the questionnaire.
 *
 * READ THIS FIRST: `api/v1/account/profile/` changed meaning on 2026-09-09.
 * It used to serve the user row; it now serves QUESTIONNAIRE ANSWERS AND
 * NOTHING ELSE. The user row is `user_details/`. Code written against the old
 * `profile/` is pointing at a different resource with a different shape.
 */

/** Which questionnaire is in scope. An unrecognised value is a 400 naming the
 *  accepted set, never a silent fallback that would serve the wrong screen. */
export type ProfileForm = 'onboarding' | 'profile';

// ── The user record ─────────────────────────────────────────────────────────

/**
 * `GET user_details/` — 28 fields. There is NO user id in the path: the row is
 * always the caller's, so one client can never address another's profile.
 *
 * Six columns are absent from the serializer entirely, not merely read-only:
 * `password`, `is_superuser`, `is_staff`, `is_blocked`, `active`,
 * `is_internal_test_user`. The last reaches the client as `is_test_user` on the
 * auth responses instead.
 */
export interface UserDetails {
  /** A UUID, not a number — never arithmetic, never a sort key. */
  id: string;
  sso_user_id: string;
  email: string;
  username: string;
  phone_number: string | null;
  country_code: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  full_name: string;
  profile_picture: string | null;
  city: string | null;
  location: string | null;
  pathway: string | null;
  professional_qualification: string | null;
  work_experience: string | null;
  education: string | null;
  career_path: string | null;
  ai_readiness: string | null;
  learning_pathway: string | null;
  voluntary_enrollment_disclosure: boolean;
  /** `profile_status`, `is_onboarding_completed` and `is_profile_completed`
   *  all encode the same two milestones and all three are returned. They are
   *  consistent; the booleans exist because they are cheaper to branch on.
   *  None is writable. */
  profile_status: ProfileStatus;
  is_onboarding_completed: boolean;
  is_profile_completed: boolean;
  /** `null` on a fresh account, not `[]`. */
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

/** Every field is optional — this is a PATCH. An empty body is a 400
 *  ("Send at least one field to update."). */
export type UserDetailsPatch = Partial<
  Pick<
    UserDetails,
    | 'first_name'
    | 'middle_name'
    | 'last_name'
    | 'full_name'
    | 'country_code'
    | 'profile_picture'
    | 'city'
    | 'location'
    | 'pathway'
    | 'professional_qualification'
    | 'work_experience'
    | 'education'
    | 'career_path'
    | 'ai_readiness'
    | 'learning_pathway'
    | 'voluntary_enrollment_disclosure'
  >
>;

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

// ── Startup probe ───────────────────────────────────────────────────────────

export interface AppStatus {
  /** Global mobile maintenance flag. Honours the runtime override. */
  is_maintenance: boolean;
  /** Web maintenance flag, env-only — nothing writes a web override. */
  is_web_maintenance: boolean;
  is_pathway: boolean;
  is_onboarding_completed: boolean;
}

// ── Route registry ──────────────────────────────────────────────────────────

export const ACCOUNT_ROUTES = {
  userDetails: {
    path: 'api/v1/account/user_details/',
    method: 'GET',
  } as RouteConfig<void, UserDetails>,

  updateUserDetails: {
    path: 'api/v1/account/user_details/',
    method: 'PATCH',
  } as RouteConfig<UserDetailsPatch, UserDetails>,

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

  appStatus: {
    path: 'api/v1/account/web/app-status/',
    method: 'GET',
  } as RouteConfig<void, AppStatus>,
} as const;
