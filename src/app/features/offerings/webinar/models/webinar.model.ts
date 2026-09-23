import { environment } from '@env/environment';

/**
 * Types for the Events API v1 (`EVENTS_API_CONTRACT_V1`).
 *
 * These are the projections the views actually return, not the Django models.
 * The legacy `/api/v2/webinar/` shapes in `@core/models/feature.model.ts`
 * (`UpcomingPremiere`, `WebinarDate`, integer ids, `webinar_date_id`) describe a
 * different contract and must not be mixed in here — v1 addresses webinars by
 * UUID and the compound `(webinar_id, webinar_type)` lookup is gone.
 */

// ---- Endpoints -------------------------------------------------------------

/**
 * Absolute URLs off `BASE_API_URL`, which is the ORIGIN ROOT — trailing slash,
 * no `api/` segment.
 *
 * The contract splits writes (`api/v1/events/`, shared with the mobile app)
 * from web-only reads (`web-api/v1/events/`), and those are siblings. A base
 * that already committed to `api/` could not compose the second one, which is
 * why these are built absolute and handed to `ApiClient` whole — it passes an
 * absolute URL through untouched.
 */
const ROOT = environment.BASE_API_URL;

export const WEBINAR_ENDPOINTS = {
  /** Web-only read: the five-bucket landing feed. */
  mainPage: `${ROOT}web-api/v1/events/webinar-main-page/`,
  /**
   * Web-only read: ONE webinar in full, by UUID.
   *
   * `AllowAny` — an anonymous caller is served the `pre_login` surface rather
   * than refused, which is what makes the detail page server-renderable for a
   * crawler. There is deliberately NO `login_type` parameter (the token already
   * answers it, and sending one is a 400); a 404 means "not visible on this
   * surface" and is deliberately ambiguous, so it cannot be used to discover
   * which ids exist.
   */
  detailsPage: `${ROOT}web-api/v1/events/webinar-details-page/`,
  /** Shared write: the 202 registration handshake. */
  register: `${ROOT}api/v1/events/register-via-zoom/`,
  /**
   * Shared read: the polling half of the handshake. Prefer the `status_url` the
   * 202 returns — it is built server-side off the URLconf and cannot drift.
   * This builder is the fallback for when only an `attempt_id` is in hand.
   */
  registerStatus: (attemptId: string) =>
    `${ROOT}api/v1/events/register-via-zoom-status/${attemptId}/`,
} as const;

/**
 * Resolve a server-issued `status_url` to an absolute URL, PINNED to the API
 * origin. Following the server's own value is preferred over assembling the
 * path — it is built off the URLconf and cannot drift.
 *
 * The pin is not paranoia. `ApiClient` passes an absolute URL through untouched
 * and `appInterceptor` attaches the learner's bearer to anything not marked
 * `IS_EXTERNAL_REQUEST`, so an absolute `status_url` naming another host would
 * send the token off-platform — the exact leak AGENTS.md §7 and the
 * interceptor's own comment forbid. A foreign origin is therefore discarded in
 * favour of the path we can build ourselves, rather than trusted.
 */
export function resolveStatusUrl(statusUrl: string, attemptId?: string): string {
  const fallback = attemptId ? WEBINAR_ENDPOINTS.registerStatus(attemptId) : null;

  if (statusUrl.startsWith('http://') || statusUrl.startsWith('https://')) {
    try {
      if (new URL(statusUrl).origin === new URL(ROOT).origin) return statusUrl;
    } catch {
      // Unparseable — treat it exactly like a foreign origin.
    }
    if (fallback) return fallback;
    throw new Error('[webinar] status_url named a foreign origin and no attempt id was available');
  }

  return `${ROOT}${statusUrl.replace(/^\//, '')}`;
}

// ---- Login state -----------------------------------------------------------

/**
 * The literal values the backend stores and filters on. There is one vocabulary
 * end to end, so this is never translated to a friendlier casing.
 *
 * `login_type` is required with no default: defaulting would hand a signed-in
 * client the anonymous page as a valid 200, with the three per-user buckets
 * empty rather than absent.
 */
export type LoginType = 'pre_login' | 'post_login';

// ---- Registration ----------------------------------------------------------

/**
 * The THREE-state client contract. Branch on this, never on the ten-state
 * internal `status`.
 */
export type RegistrationStatus = 'PENDING' | 'REGISTERED' | 'REGISTER';

/**
 * The ten-state internal status. Diagnostic — for Ops and support, and for the
 * one display-only case in `WebinarRegistration.pollTimedOut`. Never branch on
 * it; `collapseRegistrationStatus` in `webinar-status.ts` is the only mapper.
 */
export type InternalAttemptStatus =
  | 'SUCCESS'
  | 'MF_FAILED'
  | 'MF_PERMANENTLY_FAILED'
  | 'MF_SKIPPED'
  | 'ZOOM_FAILED'
  | 'BOOKING_FAILED'
  | 'INTERRUPTED'
  | 'PENDING'
  | 'ZOOM_RETRYING'
  | 'ZOOM_PENDING_APPROVAL';

/**
 * The `registration` block on `highlight_webinars` and `upcoming_webinars`.
 *
 * ABSENT on the `pre_login` branch and on the three past buckets — registration
 * is an affordance (register vs join), and a webinar that already happened
 * offers neither.
 */
export interface WebinarRegistrationInfo {
  /** Diagnostic. `null` for a pre-pipeline registrant — see `attempt_id`. */
  status: InternalAttemptStatus | null;
  registration_status: RegistrationStatus;
  /**
   * `null` for a user who registered before the attempt-row pipeline existed.
   * A null `attempt_id` does NOT mean "not registered" — they hold a booking,
   * and registering again spends another Zoom registrant slot on a seat they
   * already have.
   */
  attempt_id: string | null;
  join_url: string | null;
  error_code: string | null;
  error_message: string | null;
  zoom_attempts: number;
  completed_at: string | null;
  /** `true` → open the session in the web-LMS surface instead of `join_url`. */
  route_to_web_lms: boolean;

  // ---- Added for the embedded Meeting SDK (plan A1) ------------------------

  /**
   * The Zoom registrant token — the `tk` query parameter in `join_url`.
   *
   * Optional because it appears NOWHERE in `EVENTS_API_CONTRACT_V1` (see
   * `docs/WEBINAR_API_QUESTIONS.md`, Q6). A `join_url`-parsing fallback used to
   * live in `zoom-join-params.ts`; it was deleted because nothing ever called
   * it — `toJoinParams` reads this field straight off the signature response,
   * so until the backend sends it the SDK path has no token at all.
   */
  registrant_token?: string | null;
  /**
   * `start_date_time − 50 minutes`, computed server-side. Optional for the same
   * reason; `webinar-status.ts` falls back to the local computation.
   */
  join_opens_at?: string | null;
}

// ---- The webinar card ------------------------------------------------------

/** Only `webinar` and `offline` are registrable through `register-via-zoom`. */
export type WebinarType = 'webinar' | 'offline' | 'orientation' | 'premier';

export interface FieldOfStudy {
  id: string;
  name: string;
  cpe_credit: number;
}

/** `null` as a whole when the webinar carries no level, so you test one key. */
export interface WebinarLevelDetails {
  level_number: number;
  level_name: string;
  /**
   * NULLABLE, despite the contract typing it as a plain string. Verified
   * against UAT on 2026-09-18: `Applied AI in Audit` returns
   * `{"level_number": 2, "level_name": "Level 2", "level_actual_name": null}`.
   * Render `level_name` when this is absent.
   */
  level_actual_name: string | null;
  /**
   * Present in the response but not in the contract. Not used for anything —
   * `subject` plus `level_number` is what renders "CAIRA L2".
   */
  level_id?: string;
}

/**
 * Present in the response but NOT documented in the contract.
 *
 * It restates `subject` as `{id, subject}`. Prefer the flat `subject` field:
 * the contract names it as the CAIRA/CAIBA answer, and a client given two
 * spellings of one fact has to decide which wins — the exact problem the
 * contract cites for not emitting `caira_check` / `non_caira_check` here.
 */
export interface WebinarSubjectDetails {
  id: string;
  subject: string;
}

/**
 * One card. All five main-page buckets carry identical objects, so a single
 * view model reads `highlight_webinars[0]` and `missed_webinar[0]` alike.
 */
export interface WebinarCard {
  /** This is what `register-via-zoom` takes. */
  id: string;
  slug: string | null;
  name: string;
  type: WebinarType;
  short_description: string;
  start_date_time: string | null;
  end_date_time: string | null;
  /** Minutes. One hour is `60`. */
  duration_minutes: number | null;
  /** The id Zoom keys the session on — what the SDK needs as `meetingNumber`. */
  webinar_zoom_id: string | null;
  is_test_webinar: boolean;
  /** `null` — not `[]` — when the operator never authored any. */
  webinar_why_attend_points: string[] | null;
  webinar_what_will_you_learn_points: string[] | null;
  /**
   * The CAIRA / CAIBA answer. `subject` plus `level_details.level_number` is
   * what renders "CAIRA L1". Use this, not `caira_check` / `non_caira_check` —
   * those are two booleans describing what this describes properly, and this
   * endpoint deliberately does not emit them.
   */
  subject: string | null;
  /** Undocumented duplicate of `subject`. See `WebinarSubjectDetails`. */
  subject_details?: WebinarSubjectDetails | null;
  level_details: WebinarLevelDetails | null;
  /** Full public URL, or `''`. Never null, never a bare storage key. */
  horizontal_thumbnail: string;
  vertical_thumbnail: string;
  square_image: string;
  fields_of_study: FieldOfStudy[];
  /**
   * The round credential badge the design overlaps the row artwork with.
   *
   * NOT in the v1 contract — declared optional here the same way
   * `registrant_token` and `join_opens_at` are, because the design calls for it
   * and the field already exists on the v2 `UpcomingPremiere`. Until the
   * backend adds it the slot renders empty. URLs look like
   * `…/static-assests/credly-badges/<Badge+Name>.png`.
   */
  badge_icon_url?: string | null;
  /**
   * The SUM of `fields_of_study[].cpe_credit`. `null` — not `0` — when nothing
   * is tagged, which is a different fact from zero credits.
   */
  cpe_credits: number | null;

  // ---- NASBA disclosure block, for the detail page -------------------------
  //
  // None of these are in the v1 contract. They are what the "Certifying
  // Organisations" section of the design lists, and every one of them is a
  // COMPLIANCE statement — NASBA requires a sponsor to disclose delivery
  // method, program level, prerequisites and advance preparation for each
  // course. So they are declared optional and each line renders only when its
  // field arrives: a wrong value here is worse than a missing one, and none of
  // them can be guessed from what v1 does send.
  //
  // They already exist on the v2 course model (`int_delivery_method`,
  // `program_level`, …), so this is a matter of adding them to the events
  // serializer rather than new columns.

  /** Long-form copy for "About the Webinar"; falls back to `short_description`. */
  description?: string | null;
  /** NASBA delivery method. For a live webinar this is "Group Internet Based". */
  int_delivery_method?: string | null;
  /** `Basic` / `Intermediate` / `Advanced`. */
  program_level?: string | null;
  prerequisite_education?: string | null;
  advance_preparation?: string | null;
  course_created_date?: string | null;
  course_reviewed_date?: string | null;
  course_updated_date?: string | null;
  /** Poll questions a learner must answer to earn credit. */
  no_question_answered?: number | null;
  /** Percentage of `duration_minutes` that must be attended. */
  attendance_threshold?: number | null;

  /** Present on `highlight_webinars` / `upcoming_webinars`, `post_login` only. */
  registration?: WebinarRegistrationInfo;
  /**
   * Present on `completed_webinar` only. `true` when the booking attended, or
   * when leadership force-overrode. Deliberately NOT recomputed client-side
   * from durations — the thresholds live in the attendance ingest.
   */
  eligible?: boolean;
}

// ---- The main-page feed ----------------------------------------------------

/**
 * The five buckets. The two plural / three singular key names are inconsistent
 * and that is preserved deliberately: they match the agreed contract, and
 * renaming a client contract to tidy it is a breaking change for cosmetic gain.
 */
export interface WebinarMainPageData {
  login_type: LoginType;
  /** Editorial rail, upcoming only. Overlaps `upcoming_webinars` by design. */
  highlight_webinars: WebinarCard[];
  upcoming_webinars: WebinarCard[];
  /** Per-user. Past webinars the user attended. Each carries `eligible`. */
  completed_webinar: WebinarCard[];
  /** Per-user. Booked and did not honour. */
  absent_webinar: WebinarCard[];
  /** Per-user. Never booked at all. */
  missed_webinar: WebinarCard[];

  /**
   * Server clock at response time (plan A1). The countdown and the join window
   * derive "now" from this rather than the device clock — see `server-clock.ts`.
   * Optional until the backend field lands; absent means a zero offset.
   */
  server_time?: string;
}

export interface WebinarMainPageResponse {
  message: string;
  data: WebinarMainPageData;
}

// ---- Registration handshake ------------------------------------------------

/** The whole body. Nothing else is accepted — undeclared keys are a 400. */
export interface RegisterRequest {
  webinar_id: string;
}

/** `202` — the pipeline started, or an in-flight attempt was joined. */
export interface RegisterAcceptedResponse {
  status: 'accepted';
  registration_status: 'PENDING';
  message: string;
  attempt_id: string;
  /** Built server-side off the URLconf. Prefer following it. */
  status_url: string;
}

/** `200` — not an error. A live booking exists and NO pipeline was spawned. */
export interface AlreadyRegisteredResponse {
  status: 'already_registered';
  code: 'already_registered';
  message: string;
  booking_id: string;
}

export type RegisterResponse = RegisterAcceptedResponse | AlreadyRegisteredResponse;

export function isAlreadyRegistered(res: RegisterResponse): res is AlreadyRegisteredResponse {
  return res.status === 'already_registered';
}

/** `GET register-via-zoom-status/<attempt_id>/`. Takes NO query parameters. */
export interface AttemptStatusResponse {
  attempt_id: string;
  status: InternalAttemptStatus;
  registration_status: RegistrationStatus;
  zoom_attempts: number;
  last_status_code: number | null;
  error_message: string | null;
  error_code: string | null;
  mf_retry_count: number;
  join_url: string | null;
  /**
   * The address this attempt actually sent to Zoom. On a FAILED attempt this is
   * the only record of it — the pipeline reads the profile live and the learner
   * may have edited it since. This is the attendance-matching key.
   */
  registered_email: string | null;
  booking_id: string | null;
  completed_at: string | null;
  /** Added for the SDK (plan A1); falls back to parsing `join_url`. */
  registrant_token?: string | null;
}

// ---- The detail page -------------------------------------------------------

/** The Miles product a webinar is sold under. `null` as a whole when untagged. */
export interface WebinarProduct {
  id: string;
  name: string;
  mini_description: string | null;
  description: string | null;
  /** `""` when unset, not null — the contract is explicit about that. */
  horizontal_image: string;
  vertical_image: string;
  square_image: string;
}

/**
 * One webinar in full: EXACTLY the card object plus four keys.
 *
 * The shared keys come from the same server-side function that shapes the feed,
 * so the two screens cannot disagree — which is why this extends the card type
 * rather than restating it.
 *
 * `eligible` is deliberately absent here: it is a property of a BOOKING, the
 * feed attaches it only to `completed_webinar`, and computing it on this
 * endpoint would be a second definition of eligibility.
 */
export interface WebinarDetail extends WebinarCard {
  /** Long-form page body. `short_description` remains the one-liner. */
  description?: string | null;
  trailer_url?: string | null;
  trailer_thumbnail_url?: string | null;
  product?: WebinarProduct | null;
}

/**
 * `login_type` is ECHOED here rather than chosen: the surface was derived from
 * the token, so the echo is how a client confirms which one it got — and
 * therefore whether `registration` is present — without inspecting its own
 * token.
 */
export interface WebinarDetailsData {
  login_type: LoginType;
  webinar: WebinarDetail;
}

export interface WebinarDetailsResponse {
  message: string;
  data: WebinarDetailsData;
}
