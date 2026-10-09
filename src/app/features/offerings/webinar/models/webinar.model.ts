import { environment } from '@env/environment';
import type { WebinarErrorCode } from '@features/offerings/webinar/utils/webinar-error';

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
 * it — branch on `registration_status`, which the server already collapses.
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
  error_code: WebinarErrorCode | null;
  error_message: string | null;
  zoom_attempts: number;
  completed_at: string | null;
  /** `true` → open the session in the web-LMS surface instead of `join_url`. */
  route_to_web_lms: boolean;
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
  /** Added 2026-09-17: a level's `level_name` repeats across subjects, so this
   *  is the only thing that can address one. Not rendered. */
  level_id: string;
}

/**
 * Added 2026-09-17. `null` together with `subject`.
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
 * One card — the keys every bucket carries. `registration` and `eligible` are
 * NOT here: each exists on specific buckets only, so they live on the bucket
 * types below and a reader has to prove which bucket it holds.
 */
export interface WebinarCard {
  /** This is what `register-via-zoom` takes. */
  id: string;
  slug: string | null;
  name: string;
  type: WebinarType;
  /** `null` on every live UAT card on 2026-10-09, although Postman types it `string`. */
  short_description: string | null;
  start_date_time: string | null;
  end_date_time: string | null;
  /**
   * SECONDS. One hour is `3600` — Postman `06 → webinar-main-page` §8:
   * "`duration_seconds` | integer or null | SECONDS from 2026-09-25. Was
   * `duration_minutes`." The live UAT feed sends it on every card.
   *
   * May be `null`, so nothing may depend on it being present —
   * `effectiveEndAt` falls back to `end_date_time`.
   */
  duration_seconds: number | null;
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
  /** `subject` as an addressable object. See `WebinarSubjectDetails`. */
  subject_details: WebinarSubjectDetails | null;
  level_details: WebinarLevelDetails | null;
  /** Full public URL, or `''`. Never null, never a bare storage key. */
  horizontal_thumbnail: string;
  /**
   * Postman says `''` when unset, but UAT sends `null` (10 of 14 cards on
   * 2026-10-09). Every reader already falls through on a falsy value.
   */
  vertical_thumbnail: string | null;
  square_image: string;
  fields_of_study: FieldOfStudy[];
  /**
   * The SUM of `fields_of_study[].cpe_credit`. `null` — not `0` — when nothing
   * is tagged, which is a different fact from zero credits.
   *
   * Renamed from `cpe_credits` on 2026-09-18 with NO alias kept (contract §8),
   * so reading the old name silently hides every CPE pill.
   */
  total_cpe_credits: number | null;
}

/** A `highlight_webinars` / `upcoming_webinars` row (and the details payload). */
export interface UpcomingWebinarCard extends WebinarCard {
  /**
   * `post_login` only — ABSENT on `pre_login`, which is why it stays optional:
   * registration is an affordance, and an anonymous caller has none.
   */
  registration?: WebinarRegistrationInfo;
}

/** A `completed_webinar` row — the only bucket that carries `eligible`. */
export interface CompletedWebinarCard extends WebinarCard {
  /**
   * `true` when the booking attended, or when leadership force-overrode.
   * Deliberately NOT recomputed client-side from durations — the thresholds
   * live in the attendance ingest.
   */
  eligible: boolean;
}

/** Any card a surface may render, whichever bucket it came from. */
export type FeedCard = WebinarCard | UpcomingWebinarCard | CompletedWebinarCard;

/** The `registration` block, when this card's bucket carries one. */
export function registrationOf(
  card: FeedCard | null | undefined,
): WebinarRegistrationInfo | undefined {
  return card && 'registration' in card ? card.registration : undefined;
}

/** `eligible`, when this is a completed row; `undefined` for every other bucket. */
export function eligibleOf(card: FeedCard | null | undefined): boolean | undefined {
  return card && 'eligible' in card ? card.eligible : undefined;
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
  highlight_webinars: UpcomingWebinarCard[];
  upcoming_webinars: UpcomingWebinarCard[];
  /** Per-user. Past webinars the user attended. Each carries `eligible`. */
  completed_webinar: CompletedWebinarCard[];
  /** Per-user. Booked and did not honour. */
  absent_webinar: WebinarCard[];
  /** Per-user. Never booked at all. */
  missed_webinar: WebinarCard[];
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
  /** `fe_registration_status(attempt_status)` — `PENDING` in practice, but the
   *  contract types it as the three-state value, so it is not narrowed here. */
  registration_status: RegistrationStatus;
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
  /** Ten known values; anything unknown is read as `PENDING` (`isInternalAttemptStatus`). */
  status: InternalAttemptStatus;
  registration_status: RegistrationStatus;
  zoom_attempts: number;
  last_status_code: number | null;
  error_message: string | null;
  error_code: WebinarErrorCode | null;
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
}

const INTERNAL_ATTEMPT_STATUSES: readonly string[] = [
  'SUCCESS',
  'MF_FAILED',
  'MF_PERMANENTLY_FAILED',
  'MF_SKIPPED',
  'ZOOM_FAILED',
  'BOOKING_FAILED',
  'INTERRUPTED',
  'PENDING',
  'ZOOM_RETRYING',
  'ZOOM_PENDING_APPROVAL',
];

export function isInternalAttemptStatus(v: unknown): v is InternalAttemptStatus {
  return typeof v === 'string' && INTERNAL_ATTEMPT_STATUSES.includes(v);
}

/**
 * Normalise a status-route body at the trust boundary.
 *
 * Two things the contract warns about: an internal `status` outside the ten
 * documented values collapses to `PENDING` (the server does the same for
 * `registration_status`), and `booking_id` is built with Python's `str()`, so
 * an unset booking can arrive as the literal string `"None"` rather than null.
 */
export function normaliseAttemptStatus(raw: AttemptStatusResponse): AttemptStatusResponse {
  return {
    ...raw,
    status: isInternalAttemptStatus(raw.status) ? raw.status : 'PENDING',
    booking_id: raw.booking_id === 'None' ? null : raw.booking_id,
  };
}

// ---- The detail page -------------------------------------------------------

/** The Miles product a webinar is sold under. `null` as a whole when untagged. */
export interface WebinarProduct {
  id: string;
  name: string;
  mini_description: string | null;
  description: string | null;
  /**
   * The contract says `""` when unset, but UAT sends `null` (all three, on the
   * CAIRA product, 2026-10-09). Nothing renders them yet.
   */
  horizontal_image: string | null;
  vertical_image: string | null;
  square_image: string | null;
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
export interface WebinarDetail extends UpcomingWebinarCard {
  /** Long-form page body. `short_description` remains the one-liner. Only this
   *  endpoint sends it — the feed card never does. */
  description: string | null;
  trailer_url: string | null;
  trailer_thumbnail_url: string | null;
  product: WebinarProduct | null;
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

// ---- Trust boundary --------------------------------------------------------
//
// Hand-written for the same reason as `isSessionResponse` / `isUserDetails`: a
// renamed key would otherwise render as `undefined` with no signal — which is
// exactly how `cpe_credits` → `total_cpe_credits` hid every CPE pill. Every
// contract key is checked; EXTRA keys pass, because the contract adds keys
// without notice. A missing or retyped key fails the whole response, once, in
// the resource's `parse`, so it lands in `error()` rather than on screen.

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStrOrNull = (v: unknown): v is string | null => v === null || isStr(v);
const isNumOrNull = (v: unknown): v is number | null => v === null || isNum(v);
const isStrList = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

const WEBINAR_TYPES: readonly unknown[] = ['webinar', 'offline', 'orientation', 'premier'];
const LOGIN_TYPES: readonly unknown[] = ['pre_login', 'post_login'];
const REGISTRATION_STATUSES: readonly unknown[] = ['PENDING', 'REGISTERED', 'REGISTER'];

function isFieldOfStudy(v: unknown): v is FieldOfStudy {
  return isObject(v) && isStr(v['id']) && isStr(v['name']) && isNum(v['cpe_credit']);
}

function isLevelDetails(v: unknown): v is WebinarLevelDetails {
  return (
    isObject(v) &&
    isStr(v['level_id']) &&
    isNum(v['level_number']) &&
    isStr(v['level_name']) &&
    isStrOrNull(v['level_actual_name'])
  );
}

function isSubjectDetails(v: unknown): v is WebinarSubjectDetails {
  return isObject(v) && isStr(v['id']) && isStr(v['subject']);
}

/** Every key the contract (§8) puts on a card, in every bucket. */
export function isWebinarCard(v: unknown): v is WebinarCard {
  return (
    isObject(v) &&
    isStr(v['id']) &&
    isStrOrNull(v['slug']) &&
    isStr(v['name']) &&
    WEBINAR_TYPES.includes(v['type']) &&
    isStrOrNull(v['short_description']) &&
    isStrOrNull(v['start_date_time']) &&
    isStrOrNull(v['end_date_time']) &&
    isNumOrNull(v['duration_seconds']) &&
    isStrOrNull(v['webinar_zoom_id']) &&
    typeof v['is_test_webinar'] === 'boolean' &&
    (v['webinar_why_attend_points'] === null || isStrList(v['webinar_why_attend_points'])) &&
    (v['webinar_what_will_you_learn_points'] === null ||
      isStrList(v['webinar_what_will_you_learn_points'])) &&
    isStrOrNull(v['subject']) &&
    (v['subject_details'] === null || isSubjectDetails(v['subject_details'])) &&
    (v['level_details'] === null || isLevelDetails(v['level_details'])) &&
    isStr(v['horizontal_thumbnail']) &&
    isStrOrNull(v['vertical_thumbnail']) &&
    isStr(v['square_image']) &&
    Array.isArray(v['fields_of_study']) &&
    v['fields_of_study'].every(isFieldOfStudy) &&
    isNumOrNull(v['total_cpe_credits'])
  );
}

/** The block is optional (absent on `pre_login`), but when present it is whole. */
function isRegistrationInfo(v: unknown): v is WebinarRegistrationInfo {
  return (
    isObject(v) &&
    REGISTRATION_STATUSES.includes(v['registration_status']) &&
    isStrOrNull(v['status']) &&
    isStrOrNull(v['attempt_id']) &&
    isStrOrNull(v['join_url']) &&
    isStrOrNull(v['error_code']) &&
    isStrOrNull(v['error_message']) &&
    isNum(v['zoom_attempts']) &&
    isStrOrNull(v['completed_at']) &&
    typeof v['route_to_web_lms'] === 'boolean'
  );
}

function isUpcomingCard(v: unknown): v is UpcomingWebinarCard {
  return isWebinarCard(v) && (!('registration' in v) || isRegistrationInfo(v.registration));
}

function isCompletedCard(v: unknown): v is CompletedWebinarCard {
  return isWebinarCard(v) && 'eligible' in v && typeof v.eligible === 'boolean';
}

const listOf =
  <T>(guard: (v: unknown) => v is T) =>
  (v: unknown): v is T[] =>
    Array.isArray(v) && v.every(guard);

/** Thrown from `parse`; the message names the resource so the log says where. */
function contractError(resource: string): Error {
  return new Error(`[webinar] ${resource} response does not match the Events contract.`);
}

const isLoginType = (v: unknown): v is LoginType => LOGIN_TYPES.includes(v);

/**
 * A bucket's cards. On UAT by 2026-10-09 every bucket is a paginated envelope,
 * `{slug, count, page, page_size, total_pages, has_next, has_previous, next,
 * previous, results}`, where Postman still documents a bare array; both shapes
 * are accepted so the feed parses either way. Only the first page is read: the
 * rails have no "more" control, and the paging parameters are undocumented.
 */
const bucketCards = (v: unknown): unknown => (isObject(v) ? v['results'] : v);

/** `parse` for `webinar-main-page/`: the `{message, data}` envelope, unwrapped. */
export function parseMainPage(raw: unknown): WebinarMainPageData {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (!isObject(data)) throw contractError('webinar-main-page');

  // Pulled into locals so each guard narrows its own value — no cast needed.
  const login_type = data['login_type'];
  const highlight_webinars = bucketCards(data['highlight_webinars']);
  const upcoming_webinars = bucketCards(data['upcoming_webinars']);
  const completed_webinar = bucketCards(data['completed_webinar']);
  const absent_webinar = bucketCards(data['absent_webinar']);
  const missed_webinar = bucketCards(data['missed_webinar']);

  if (
    isLoginType(login_type) &&
    listOf(isUpcomingCard)(highlight_webinars) &&
    listOf(isUpcomingCard)(upcoming_webinars) &&
    listOf(isCompletedCard)(completed_webinar) &&
    listOf(isWebinarCard)(absent_webinar) &&
    listOf(isWebinarCard)(missed_webinar)
  ) {
    return {
      login_type,
      highlight_webinars,
      upcoming_webinars,
      completed_webinar,
      absent_webinar,
      missed_webinar,
    };
  }
  throw contractError('webinar-main-page');
}

function isWebinarDetail(v: unknown): v is WebinarDetail {
  return (
    isObject(v) &&
    isStrOrNull(v['description']) &&
    isStrOrNull(v['trailer_url']) &&
    isStrOrNull(v['trailer_thumbnail_url']) &&
    (v['product'] === null || isProduct(v['product'])) &&
    isUpcomingCard(v)
  );
}

/** `parse` for `webinar-details-page/`: the card plus its four detail keys. */
export function parseDetail(raw: unknown): WebinarDetail {
  const data = isObject(raw) ? raw['data'] : undefined;
  const webinar = isObject(data) ? data['webinar'] : undefined;
  if (isWebinarDetail(webinar)) return webinar;
  throw contractError('webinar-details-page');
}

function isProduct(v: unknown): v is WebinarProduct {
  return (
    isObject(v) &&
    isStr(v['id']) &&
    isStr(v['name']) &&
    isStrOrNull(v['mini_description']) &&
    isStrOrNull(v['description']) &&
    isStrOrNull(v['horizontal_image']) &&
    isStrOrNull(v['vertical_image']) &&
    isStrOrNull(v['square_image'])
  );
}
