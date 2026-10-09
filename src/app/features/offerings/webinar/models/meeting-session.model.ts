// Type-only: erased at build, so nothing static reaches into the SDK package and
// it stays in its own lazy chunk (see `ZoomMeetingClient`).
import type ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';
import {
  contractError,
  isNum,
  isObject,
  isStr,
  isStrOrNull,
} from '@features/offerings/utils/contract-guards';

/**
 * Types for the embedded-SDK surface: the signature mint, the single-session
 * lease, and the join lifecycle, against the Events v1 routes
 * `api/v1/events/attendance-session/{claim,heartbeat,release}/` and
 * `api/v1/events/meeting-sdk-signature/` (Postman "06. Events and Bookings").
 *
 * Postman documents successful bodies as `{"status": "success", ...result}`,
 * the result merged in at the top level. The same backend wraps its other
 * answers as `{success, message, data}` — the feed, and these routes' own 401
 * (seen on UAT 2026-10-09) — so the parsers accept either (`resultOf`).
 */

// ---- Signature -------------------------------------------------------------

export interface SignatureRequest {
  webinar_id: string;
  /** Client-generated, stable for the lifetime of this surface's session. */
  session_id: string;
  surface: 'web';
}

export interface SignatureResponse {
  /** The Meeting SDK JWT. Minted with the SDK Secret, server-side only. */
  signature: string;
  /** The SDK client id. Arrives with the signature, never from the bundle. */
  sdk_key: string;
  /** Zoom's webinar number, as a string: it can overflow a JS integer. */
  meeting_number: string;
  /** Empty string when the session only requires the waiting room. */
  password: string;
  /** The `tk` the SDK needs when the webinar requires registration. */
  registrant_token: string | null;
  /** `get_full_name()`, which can be empty; `toJoinParams` falls back. */
  user_name: string;
  /** REQUIRED by Zoom for webinars: the email the registrant was created with. */
  user_email: string;
  expires_at: string | null;
  session_id: string;
  /** In the spec, absent from Postman's example, and read by nothing. */
  lease_expires_at?: string;
  /** `null` when missing or not a number; `MeetingSession` falls back. */
  heartbeat_interval_seconds: number | null;
}

// ---- Lease -----------------------------------------------------------------

export interface ClaimRequest {
  webinar_id: string;
  session_id: string;
  /** `false` asks politely; `true` supersedes whatever holds the lease. */
  takeover: boolean;
  surface: 'web';
  /** "Chrome on macOS": what the OTHER device's conflict dialog names this one. */
  device_label: string;
}

export interface ClaimResponse {
  session_id: string;
  lease_expires_at: string | null;
  /** `null` when missing or not a number; `MeetingSession` falls back. */
  heartbeat_interval_seconds: number | null;
}

/** The heartbeat and the release both send the session id alone. */
export interface SessionIdRequest {
  session_id: string;
}

/**
 * Who currently holds the lease, for the conflict dialog's copy. A stale tab
 * and a genuinely live one are indistinguishable without this, which is exactly
 * why the policy is takeover-with-confirmation rather than a hard block.
 */
export interface LeaseHolder {
  surface: string;
  webinar_name: string | null;
  started_at: string;
  last_seen_at: string;
  device_label: string | null;
}

/** What sibling tabs tell each other over the `LIVE_SESSION_CHANNEL`. */
export type SessionChannelMessage =
  | { type: 'claimed'; sessionId: string; webinarId: string }
  | { type: 'takeover-requested'; sessionId: string; webinarId: string }
  | { type: 'released'; sessionId: string };

/** One row of the `device_label` tables: a user-agent pattern and the name it means. */
export type DeviceMatcher = readonly [pattern: RegExp, name: string];

// ---- Join lifecycle --------------------------------------------------------

/**
 * Where the surface is in the join sequence.
 *
 * `preflight` covers claiming the lease and minting the signature — both happen
 * before the SDK is even imported, so a refusal costs no bandwidth.
 */
export type JoinPhase =
  'idle' | 'preflight' | 'joining' | 'in-meeting' | 'left' | 'ejected' | 'failed';

/** The SDK's `connection-change` payload, read field by field: the SDK types it as `any`. */
export interface ConnectionChangePayload {
  state?: string;
  reason?: string;
}

/** The Component View client, typed by the SDK itself rather than restated here. */
export type ZoomEmbeddedClient = ReturnType<typeof ZoomMtgEmbedded.createClient>;

/** Why this surface lost the session. Drives which copy the exit screen shows. */
export type EjectionReason =
  'taken-over-locally' | 'superseded-remotely' | 'meeting-ended' | 'connection-lost';

/**
 * How Zoom itself ended the connection: the host ended the webinar (final), or
 * the connection failed (the learner can rejoin).
 */
export type ZoomCloseReason = Extract<EjectionReason, 'meeting-ended' | 'connection-lost'>;

/** How the single-session rule is currently blocking this surface. */
export type SessionConflict =
  /** Another tab in THIS browser holds the Web Lock. Detected with no network. */
  | { source: 'local-tab' }
  /** The server refused the claim. Carries the holder block for the dialog. */
  | { source: 'remote'; holder: LeaseHolder | null; detail: string };

/**
 * Why the server would not let this learner in, grouped by what the room
 * offers next. `failed` is everything else: network, 5xx, an unknown code, or
 * a response that broke the contract.
 */
export type JoinRefusalKind =
  'not-registered' | 'not-open' | 'ended' | 'not-found' | 'signed-out' | 'failed';

export interface JoinRefusal {
  kind: JoinRefusalKind;
  /** The server's own copy for the known codes; `null` for `failed`. */
  message: string | null;
  /** When the join window opens, if a `join_window_not_open` refusal said so. */
  opensAt: string | null;
}

/**
 * The join parameters handed to the Zoom SDK. Assembled in one place so the
 * webinar-specific requirements (`userEmail` is mandatory, `tk` is mandatory
 * when registration is on) cannot be forgotten at a call site.
 */
export interface ZoomJoinParams {
  signature: string;
  sdkKey: string;
  meetingNumber: string;
  password: string;
  userName: string;
  userEmail: string;
  tk: string;
}

// ---- Parsers -----------------------------------------------------------------

/**
 * The trust boundary. Keys the client reads are checked; keys it does not read
 * are not, so a contract addition never breaks a join. A missing or retyped
 * key the join needs throws `contractError`, which the room renders as a
 * refusal instead of handing Zoom `undefined`.
 */

const nonEmpty = (v: unknown): v is string => isStr(v) && v.trim() !== '';

/** The result object, whether it is merged into the body or wrapped in `data`. */
const resultOf = (raw: unknown): unknown =>
  isObject(raw) && isObject(raw['data']) ? raw['data'] : raw;

/** Lenient on purpose: the interval tunes a timer, it never blocks a join. */
const intervalOf = (v: unknown): number | null => (isNum(v) ? v : null);

/** `parse` for `attendance-session/claim/`. */
export function parseClaim(body: unknown): ClaimResponse {
  const raw = resultOf(body);
  if (!isObject(raw) || !nonEmpty(raw['session_id'])) {
    throw contractError('attendance-session/claim');
  }
  return {
    session_id: raw['session_id'],
    lease_expires_at: isStr(raw['lease_expires_at']) ? raw['lease_expires_at'] : null,
    heartbeat_interval_seconds: intervalOf(raw['heartbeat_interval_seconds']),
  };
}

/** `parse` for `meeting-sdk-signature/`. Everything Zoom's join needs is required. */
export function parseSignature(body: unknown): SignatureResponse {
  const raw = resultOf(body);
  if (!isObject(raw)) throw contractError('meeting-sdk-signature');

  const meetingNumber = raw['meeting_number'];
  const token = raw['registrant_token'];
  if (
    !nonEmpty(raw['signature']) ||
    !nonEmpty(raw['sdk_key']) ||
    !(nonEmpty(meetingNumber) || isNum(meetingNumber)) ||
    !nonEmpty(raw['user_email']) ||
    !nonEmpty(raw['session_id']) ||
    !(isStrOrNull(token) || token === undefined)
  ) {
    throw contractError('meeting-sdk-signature');
  }

  return {
    signature: raw['signature'],
    sdk_key: raw['sdk_key'],
    meeting_number: String(meetingNumber),
    password: isStr(raw['password']) ? raw['password'] : '',
    registrant_token: nonEmpty(token) ? token : null,
    user_name: isStr(raw['user_name']) ? raw['user_name'].trim() : '',
    user_email: raw['user_email'],
    expires_at: isStr(raw['expires_at']) ? raw['expires_at'] : null,
    session_id: raw['session_id'],
    ...(isStr(raw['lease_expires_at']) ? { lease_expires_at: raw['lease_expires_at'] } : {}),
    heartbeat_interval_seconds: intervalOf(raw['heartbeat_interval_seconds']),
  };
}

/**
 * The `holder` block of a `409 session_active`, or `null` when it is missing or
 * malformed: the conflict screen still renders, just without naming the device.
 */
export function parseLeaseHolder(raw: unknown): LeaseHolder | null {
  if (
    !isObject(raw) ||
    !isStr(raw['surface']) ||
    !isStr(raw['started_at']) ||
    !isStr(raw['last_seen_at'])
  ) {
    return null;
  }
  return {
    surface: raw['surface'],
    webinar_name: nonEmpty(raw['webinar_name']) ? raw['webinar_name'] : null,
    started_at: raw['started_at'],
    last_seen_at: raw['last_seen_at'],
    device_label: nonEmpty(raw['device_label']) ? raw['device_label'] : null,
  };
}
