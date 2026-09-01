import {
  QrAuthorizedSession,
  QrEncryptedPayload,
} from '../../../../shared/core/models/caira/qr-login.model';

/**
 * The browser half of QR login's hybrid encryption — the ECIES construction
 * that opens what `encrypt_for_browser` sealed.
 *
 * The API reference places `account/qr_login/crypto.py` outside its scope
 * (gap **G-04**), so this began as pure assumption. It no longer is: every
 * parameter below now comes from an implementation that talked to this same
 * crypto module successfully — the salt and info strings match it byte for
 * byte, which is what identifies it as the same module rather than a lookalike.
 *
 * | Step        | Value                                                          |
 * | ----------- | -------------------------------------------------------------- |
 * | Key agree   | ECDH on **P-256**                                              |
 * | Key encode  | **raw uncompressed EC point, base64** — our key and their `epk` |
 * | Derive      | **HKDF-SHA256**, 32 bytes, salt + info below                   |
 * | Cipher      | **AES-256-GCM**, 96-bit `iv`, 128-bit tag **appended to `ct`**  |
 *
 * ⚠️ **`raw`, not SPKI.** This was the one parameter no live probe could catch:
 * #36 performs *no* format validation on `public_key` — the reference is
 * explicit that a malformed key is not detected until #37 calls
 * `encrypt_for_browser`. So an SPKI key sails through `qr/initiate` with a 201
 * and only fails later, on the phone, as `400 Invalid session encryption key`.
 * A P-256 raw point is 65 bytes → 88 base64 chars; SPKI is 91 → 124. If you
 * ever see a 124-char key here, this is the regression.
 *
 * The tag placement is the one line that never needed confirming: Python's
 * `AESGCM.encrypt` appends it and WebCrypto's `decrypt` expects it appended, so
 * the two agree by construction.
 *
 * Every choice is a named constant, so a backend change touches this file and
 * nothing else. A mismatch surfaces as {@link QrCryptoError} — never a silent
 * failure or a half-signed-in state — and the message prints the full parameter
 * set so the diff against the real contract is a five-second read.
 */

const CURVE = 'P-256';
const HKDF_HASH = 'SHA-256';
const AES_BITS = 256;

/**
 * HKDF salt and info, **confirmed against the backend** — these two are no
 * longer guesses.
 *
 * Byte-exact: HKDF mixes the salt into the extract step and the info into
 * expand, so a single character's difference derives a different key and the
 * only symptom is a failed decrypt. They are `TextEncoder` output rather than
 * strings because `HkdfParams` takes a `BufferSource`; passing the literal does
 * not compile, which is the failure mode you want for this.
 *
 * The `-v1` suffixes are the backend's own versioning. If a future rollout
 * bumps them, both sides must change together — the error message below prints
 * these values so a mismatched deploy is readable straight from the console.
 */
const HKDF_SALT = new TextEncoder().encode('miles-qr-login-salt-v1');
const HKDF_INFO = new TextEncoder().encode('miles-qr-login-aesgcm-v1');

/**
 * Decryption failed — the contract, not the user's PIN. A wrong PIN never gets
 * this far: #38 rejects it with a 401 before any payload is returned.
 */
export class QrCryptoError extends Error {
  constructor(cause?: unknown) {
    super(
      'Could not decrypt the QR sign-in payload. Contract used: ECDH ' +
        `${CURVE} (raw point, base64) → HKDF-${HKDF_HASH} ` +
        `(salt "${new TextDecoder().decode(HKDF_SALT)}", info "${new TextDecoder().decode(HKDF_INFO)}") ` +
        `→ AES-${AES_BITS}-GCM, tag appended to \`ct\`. Every parameter matches a ` +
        'known-working client, so suspect a backend rollout (the -v1 suffixes) before ' +
        'suspecting this file. See G-04.',
    );
    this.name = 'QrCryptoError';
    this.cause = cause;
  }
}

/**
 * A keypair for one sign-in attempt.
 *
 * The private key never leaves memory: it is not persisted, not sent anywhere,
 * and is dropped when the component holding it is destroyed. `extractable` is
 * `true` only because WebCrypto applies the flag to the whole pair and the
 * public half has to be exported for #36.
 */
export interface QrKeyPair {
  /** Base64 of the raw uncompressed EC point (88 chars), as #36's `public_key`. */
  publicKey: string;
  privateKey: CryptoKey;
}

/** Whether this environment can do QR login at all. False during SSR. */
export function isQrCryptoAvailable(): boolean {
  return typeof globalThis.crypto?.subtle?.generateKey === 'function';
}

export async function generateQrKeyPair(): Promise<QrKeyPair> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: CURVE }, true, [
    'deriveBits',
    'deriveKey',
  ]);
  // `raw` — the uncompressed EC point the backend's `load_public_key` expects.
  const raw = await crypto.subtle.exportKey('raw', pair.publicKey);
  return { publicKey: toBase64(new Uint8Array(raw)), privateKey: pair.privateKey };
}

/**
 * Open #38's `{epk, iv, ct}` with the private key from {@link generateQrKeyPair}.
 *
 * Throws {@link QrCryptoError} on any failure — a wrong curve, a different KDF
 * and a corrupt payload are indistinguishable from here, and all three mean the
 * same thing to the caller: this sign-in cannot complete.
 */
export async function decryptQrPayload(
  payload: QrEncryptedPayload,
  privateKey: CryptoKey,
): Promise<QrAuthorizedSession> {
  try {
    const senderKey = await crypto.subtle.importKey(
      'raw',
      fromBase64(payload.epk),
      { name: 'ECDH', namedCurve: CURVE },
      false,
      [],
    );

    const sharedSecret = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: senderKey },
      privateKey,
      AES_BITS,
    );

    const hkdfKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, [
      'deriveKey',
    ]);

    const aesKey = await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: HKDF_HASH, salt: HKDF_SALT, info: HKDF_INFO },
      hkdfKey,
      { name: 'AES-GCM', length: AES_BITS },
      false,
      ['decrypt'],
    );

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(payload.iv) },
      aesKey,
      fromBase64(payload.ct),
    );

    return parseSession(new TextDecoder().decode(plaintext));
  } catch (cause) {
    throw new QrCryptoError(cause);
  }
}

/**
 * Narrow the decrypted JSON before it becomes a session.
 *
 * Decision 1 waives *response* validation, but this is a trust boundary in a
 * way an ordinary GET is not: whatever comes out of here is written straight
 * into the auth cookies. A blob that decrypts but carries no access token must
 * fail loudly rather than store `undefined` and log the user into nothing.
 *
 * ⚠️ **Two documented shapes disagree here.** #37 states the plaintext is
 * `{access_token, refresh_token, user_id}` — that is what this reads, and the
 * only shape `Auth.storeTokens` can use. A sibling client documents it as
 * `{user_id, session_id, token_id}`, which is a set of *references*, not
 * credentials; no endpoint in this API redeems them, so if that is what really
 * arrives, QR login needs a backend conversation, not a client change. The
 * error below lists the keys it actually got so that is a one-line diagnosis.
 */
function parseSession(json: string): QrAuthorizedSession {
  const body: unknown = JSON.parse(json);
  if (typeof body !== 'object' || body === null) throw new Error('Payload is not an object');

  const record = body as Record<string, unknown>;
  const accessToken = record['access_token'];
  if (typeof accessToken !== 'string' || !accessToken) {
    // Key names only — every value in here is a credential.
    throw new Error(
      `Payload carries no access_token; keys present: ${Object.keys(record).join(', ')}`,
    );
  }
  const refreshToken = record['refresh_token'];
  const userId = record['user_id'];

  return {
    access_token: accessToken,
    refresh_token: typeof refreshToken === 'string' ? refreshToken : '',
    user_id: typeof userId === 'string' ? userId : null,
  };
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Standard base64 — the alphabet the backend uses. The URL-safe fallback this
 * used to carry is gone: it guarded against a variant we now know is not in
 * play, and dead flexibility in a crypto path is just a second thing to doubt
 * when a decrypt fails.
 *
 * Padding is still tolerated, since a stripped `=` is cheap to survive and
 * `atob` will not do it for you.
 */
function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  // Allocated rather than `Uint8Array.from`, which infers the wider
  // `ArrayBufferLike` and no longer satisfies WebCrypto's `BufferSource`.
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
