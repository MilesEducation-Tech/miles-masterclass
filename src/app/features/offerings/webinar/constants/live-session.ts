import { HttpContext } from '@angular/common/http';
import { environment } from '@env/environment';
import { RouteConfig, SKIP_LOADING } from '@core/models/http.model';
import {
  ClaimRequest,
  DeviceMatcher,
  JoinRefusal,
  JoinRefusalKind,
  SessionIdRequest,
  SignatureRequest,
  ZoomJoinOutcome,
} from '@features/offerings/webinar/models/meeting-session.model';
import type { KnownWebinarErrorCode } from '@features/offerings/webinar/utils/webinar-error';

/**
 * Configuration for the `/live` room: the single-session lease and the tab
 * coordination around it. See `MeetingSession` for how the layers fit together.
 */

/**
 * Absolute URLs off `environment.API.baseUrl` (the origin root), built whole like
 * `WEBINAR_ENDPOINTS` so `apiUrl()` passes them through untouched. These are the
 * `api/v1/` surface: the same routes serve the app and the web.
 */
const ROOT = environment.API.baseUrl;

/**
 * The four live-session routes. Responses are typed `unknown` because each one
 * is parsed (`parseClaim`, `parseSignature`) or not read at all.
 *
 * Every request body is checked by the backend's `StrictInputSerializer`, which
 * REJECTS an undeclared key with a 400 rather than dropping it — send exactly
 * the declared fields.
 */
export const LIVE_SESSION_ROUTES = {
  /** `IsAuthenticated`. Takes, or with `takeover: true` takes over, the learner's one lease. */
  claim: {
    path: `${ROOT}api/v1/events/attendance-session/claim/`,
    method: 'POST',
  } as RouteConfig<ClaimRequest, unknown>,
  /**
   * `IsAuthenticated`. The ENFORCEMENT POINT: the Zoom JWT is minted only for
   * the lease holder, which makes "one session at a time" a server fact rather
   * than a client courtesy. Re-runs every joinability check claim ran.
   */
  signature: {
    path: `${ROOT}api/v1/events/meeting-sdk-signature/`,
    method: 'POST',
  } as RouteConfig<SignatureRequest, unknown>,
  /**
   * `IsAuthenticated`. Its only refusal is `409 session_superseded`; a lapsed
   * lease nobody else claimed is re-granted with a 200. The body is not read.
   */
  heartbeat: {
    path: `${ROOT}api/v1/events/attendance-session/heartbeat/`,
    method: 'POST',
  } as RouteConfig<SessionIdRequest, unknown>,
  /**
   * `AllowAny`, CSRF-exempt, always `204`. Accepts a `text/plain` JSON body with
   * no `Authorization`, which is what `sendBeacon` sends on tab close.
   */
  release: {
    path: `${ROOT}api/v1/events/attendance-session/release/`,
    method: 'POST',
  } as RouteConfig<SessionIdRequest, unknown>,
} as const;

/**
 * Which room a join refusal lands in, by the contract's `code`. A code missing
 * here (or one the backend adds later) is `failed`: generic copy and a retry.
 * `satisfies` checks every key is a known code; the annotation lets a widened
 * code index it and read `undefined`.
 */
export const JOIN_REFUSAL_KINDS: Readonly<Record<string, JoinRefusalKind | undefined>> = {
  not_registered: 'not-registered',
  join_window_not_open: 'not-open',
  webinar_ended: 'ended',
  webinar_not_found: 'not-found',
  authentication_required: 'signed-out',
  authentication_failed: 'signed-out',
} satisfies Partial<Record<KnownWebinarErrorCode, JoinRefusalKind>>;

/**
 * What a Zoom join rejection means, by the SDK's numeric `errorCode`
 * (developers.zoom.us/docs/meeting-sdk/web/error-codes). A code missing here is
 * `failed`: generic copy, a retry, and an `error` log so it gets a row.
 */
export const ZOOM_ERROR_OUTCOMES: Readonly<Record<number, ZoomJoinOutcome | undefined>> = {
  /** MEETING_NOT_START: the host has not started the webinar, or is still in its practice session. */
  3008: 'not-started',
  /** BE_REMOVED: the host removed this learner, and Zoom will not let them back. */
  3009: 'removed',
  /** REGISTRATION_REQUIRED: Zoom has no registrant behind this `tk`. */
  3099: 'not-registered',
  /** TOKEN_ERROR, SIGNATURE_EXPIRED, TOKEN_ERROR (alt), SIGNATURE_INVALID: mint a fresh one. */
  3265: 'bad-signature',
  3623: 'bad-signature',
  3705: 'bad-signature',
  3712: 'bad-signature',
  /** NOT_SUPPORT_WEBCLIENT, USE_DESKTOP_OR_MOBILE: the webinar refuses browser joins. */
  3603: 'web-unsupported',
  3611: 'web-unsupported',
  /** MEETING_ENDED. */
  4004: 'meeting-ended',
  /** MEETING_CAPACITY_REACHED. */
  4005: 'full',
};

/**
 * The room's copy for the refusals only Zoom can give. The server's refusals
 * carry their own `detail`; these never show Zoom's raw `reason` text.
 */
export const ZOOM_REFUSALS: Readonly<
  Record<Extract<ZoomJoinOutcome, 'full' | 'not-registered' | 'web-unsupported'>, JoinRefusal>
> = {
  full: {
    kind: 'full',
    message: 'This webinar has reached its attendee limit. Please try again in a moment.',
    opensAt: null,
  },
  'not-registered': {
    kind: 'not-registered',
    message: 'Zoom could not find your registration for this webinar.',
    opensAt: null,
  },
  'web-unsupported': {
    kind: 'web-unsupported',
    message:
      'This webinar can only be joined in the Zoom app. Your attendance is still recorded for CPE.',
    opensAt: null,
  },
};

/**
 * How often the room tries Zoom again while the host has not started the
 * webinar. Each try mints a fresh signature, so a long wait never outlives it.
 */
export const WAITING_FOR_HOST_RETRY_MS = 15_000;

/**
 * The Web Lock every tab of this origin contends for. One name for the whole
 * app, because the rule is one live session per learner, not per webinar.
 */
export const LIVE_SESSION_LOCK = 'miles:webinar-session';

/** The BroadcastChannel sibling tabs use to tell each other about the lease. */
export const LIVE_SESSION_CHANNEL = 'miles:webinar-session';

/**
 * Requests that run on a timer or during teardown (heartbeat, release), so they
 * never drive the global loading bar.
 */
export const LIVE_SESSION_BACKGROUND = new HttpContext().set(SKIP_LOADING, true);

/** How long a takeover waits for a sibling tab to drop the Web Lock before the server arbitrates. */
export const TAKEOVER_WAIT_MS = 3_000;

/** How often a takeover re-checks the Web Lock while it waits. */
export const TAKEOVER_POLL_MS = 150;

/**
 * The server sends the heartbeat cadence so it can be tuned without a release,
 * but the lease TTL is 45s: anything outside this range is a bad value, not a
 * tuning, and falls back to `LEASE_HEARTBEAT_SECONDS`.
 */
export const HEARTBEAT_MIN_SECONDS = 5;
export const HEARTBEAT_MAX_SECONDS = 30;

/** Lease heartbeat cadence when the server sends none. Server TTL is 45s — three misses before eviction. */
export const LEASE_HEARTBEAT_SECONDS = 15;

/**
 * How long before the start the Join button appears.
 *
 * Fallback only IN PRINCIPLE: `joinOpensAt()` would prefer a server-sent
 * `join_opens_at`, but that field appears NOWHERE in `EVENTS_API_CONTRACT_V1`,
 * so today this value is the whole rule and it is computed in the browser. A
 * skewed clock can therefore show Join early and have the server refuse it —
 * `ServerClock` syncs off the feed's `server_time` to bound that. Ask the
 * backend for `join_opens_at`.
 */
export const JOIN_WINDOW_MINUTES = 15;

/** `device_label` length cap, and what it says when nothing in the user agent matched. */
export const DEVICE_LABEL_MAX_LENGTH = 64;
export const DEVICE_LABEL_FALLBACK = 'Web browser';

/**
 * Browser names, first match wins. Order matters: Edge and Opera also say
 * "Chrome", and Chrome also says "Safari".
 */
export const DEVICE_BROWSERS: readonly DeviceMatcher[] = [
  [/Edg(e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

/** Operating systems, first match wins. iOS before macOS: iPhone UAs say "like Mac OS X". */
export const DEVICE_SYSTEMS: readonly DeviceMatcher[] = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/CrOS/, 'ChromeOS'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Windows/, 'Windows'],
  [/Linux/, 'Linux'],
];
