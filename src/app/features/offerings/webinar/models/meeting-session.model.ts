import { environment } from '@env/environment';

/**
 * Types for the embedded-SDK surface: the signature mint, the single-session
 * lease, and the join lifecycle.
 *
 * These endpoints do not exist in EVENTS_API_CONTRACT_V1 yet — they are the
 * backend work specified in the plan (Part A2 / A3). Everything here is written
 * against that contract so the client half is ready the moment it lands.
 */

const ROOT = environment.BASE_API_URL;

export const MEETING_ENDPOINTS = {
  /**
   * Mints the Zoom SDK JWT. This is the ENFORCEMENT POINT: a signature is only
   * issued to the holder of the live session lease, which is what makes "one
   * meeting at a time" a server fact rather than a client courtesy.
   */
  signature: `${ROOT}api/v1/events/meeting-sdk-signature/`,
  claim: `${ROOT}api/v1/events/attendance-session/claim/`,
  heartbeat: `${ROOT}api/v1/events/attendance-session/heartbeat/`,
  release: `${ROOT}api/v1/events/attendance-session/release/`,
} as const;

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
  /** Zoom's webinar number, as a string. */
  meeting_number: string;
  /** Empty string when the session only requires the waiting room. */
  password: string;
  /** The `tk` the SDK needs when the webinar requires registration. */
  registrant_token: string | null;
  user_name: string;
  /** REQUIRED by Zoom for webinars. */
  user_email: string;
  expires_at: string;
  session_id: string;
  lease_expires_at: string;
  heartbeat_interval_seconds: number;
}

// ---- Lease -----------------------------------------------------------------

export interface ClaimRequest {
  webinar_id: string;
  session_id: string;
  /** `false` asks politely; `true` supersedes whatever holds the lease. */
  takeover: boolean;
  surface: 'web';
}

export interface ClaimResponse {
  session_id: string;
  lease_expires_at: string;
  heartbeat_interval_seconds: number;
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

export interface HeartbeatResponse {
  lease_expires_at: string;
}

// ---- Join lifecycle --------------------------------------------------------

/**
 * Where the surface is in the join sequence.
 *
 * `preflight` covers claiming the lease and minting the signature — both happen
 * before the SDK is even imported, so a refusal costs no bandwidth.
 */
export type JoinPhase =
  'idle' | 'preflight' | 'joining' | 'in-meeting' | 'left' | 'ejected' | 'failed';

/** Why this surface lost the session. Drives which copy the ejection screen shows. */
export type EjectionReason =
  'taken-over-locally' | 'superseded-remotely' | 'meeting-ended' | 'connection-lost';

/** How the single-session rule is currently blocking this surface. */
export type SessionConflict =
  /** Another tab in THIS browser holds the Web Lock. Detected with no network. */
  | { source: 'local-tab' }
  /** The server refused the claim. Carries the holder block for the dialog. */
  | { source: 'remote'; holder: LeaseHolder | null; detail: string };

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
