/**
 * Wire shapes for cross-device QR login — endpoints #36 and #38.
 *
 * The flow has three actors and only two of the calls are ours:
 *
 * 1. **#36 `POST qr/initiate`** (browser, unauthenticated) — we send a freshly
 *    generated public key and get back a session id.
 * 2. The learner scans the code with the Miles One app, which calls
 *    **#37 `POST qr/claim`** with its own bearer token. That endpoint is the
 *    *phone's* and is deliberately not implemented here. It returns a PIN,
 *    which the phone displays.
 * 3. **#38 `POST qr/confirm`** (browser, unauthenticated) — we send the session
 *    id plus the PIN the learner read off their phone, and get the token pair
 *    back encrypted to the key from step 1.
 *
 * Security rests entirely on the unguessable session id, the PIN, and a
 * 3-attempt lockout — neither of our two calls carries a token.
 */

/** #36 request. `public_key` is base64; see `qr-crypto.ts` for the encoding. */
export interface QrInitiateRequest {
  public_key: string;
}

/**
 * #36 response — `201 Created`.
 *
 * ⚠️ The reference calls `session_id` a "UUID4", but UAT returns a **32-char
 * hex string with no dashes** (`984c0d7dbbe44a5488f12e662feba034`). Verified
 * live. Treat it as an opaque string — never parse or reformat it.
 *
 * `expires_in` is `store.SESSION_TTL`, documented as 120 s.
 */
export interface QrInitiateResponse {
  session_id: string;
  expires_in: number;
}

/** #38 request. The PIN is sent exactly as the phone displayed it. */
export interface QrConfirmRequest {
  session_id: string;
  verification_pin: string;
}

/**
 * The hybrid-encrypted blob #38 returns. Only the browser's in-memory private
 * key can open it — Redis never holds the plaintext.
 *
 * - `epk` — the sender's ephemeral public key
 * - `iv`  — the symmetric cipher's nonce
 * - `ct`  — the ciphertext
 *
 * All three are base64. Their *inner* structure is the documented gap (G-04);
 * `qr-crypto.ts` names the assumption it decrypts them under.
 */
export interface QrEncryptedPayload {
  epk: string;
  iv: string;
  ct: string;
}

/** #38 response — `200 OK`. Single-use: the session is purged before replying. */
export interface QrConfirmResponse {
  status: 'authorized';
  payload: QrEncryptedPayload;
}

/**
 * What the blob decrypts to — assembled by #37 from the phone's own session.
 *
 * `access_token` is literally the phone's `request.auth` bearer, and
 * `refresh_token` is whatever the phone put in its request body (the backend
 * does **not** validate it as a JWT), so both are opaque strings here.
 */
export interface QrAuthorizedSession {
  access_token: string;
  refresh_token: string;
  user_id: string | null;
}

/**
 * Reasons `cairaError` produces for the QR routes, from `reasonFromStatus`.
 * They are `kind: 'domain'` — ordinary UI states, never toasts.
 */
export const QrFailureReason = {
  /** 401 — wrong PIN. `extra.attempts_remaining` carries the count left. */
  INVALID_PIN: 'invalid_pin',
  /** 409 — the PIN was submitted before the phone claimed the session. */
  NOT_CLAIMED: 'not_claimed',
  /** 429 — three wrong PINs; the session is deleted and must be re-scanned. */
  LOCKED_OUT: 'locked_out',
} as const;
