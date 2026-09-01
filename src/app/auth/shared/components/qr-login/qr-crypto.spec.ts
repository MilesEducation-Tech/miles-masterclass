import {
  QrCryptoError,
  decryptQrPayload,
  generateQrKeyPair,
  isQrCryptoAvailable,
} from './qr-crypto';
import { QrEncryptedPayload } from '../../../../shared/core/models/caira/qr-login.model';

/**
 * These tests prove the **browser half** is correct: that
 * `generateQrKeyPair` → `decryptQrPayload` round-trips against a sender that
 * follows the documented assumption in `qr-crypto.ts`.
 *
 * They deliberately do **not** prove the backend agrees — that is G-04 and no
 * test here can settle it. What they do buy is isolation: if a real scan fails,
 * these passing means the bug is the contract, not this implementation.
 *
 * `encryptForBrowser` below is a transcription of what
 * `account/qr_login/crypto.py` does. Its HKDF salt and info are the backend's
 * **confirmed** values; the curve, key encoding and cipher are still the
 * assumed ones. If the backend publishes more of its source and something
 * differs, change it here first — the test will go red and point at exactly
 * which constant `qr-crypto.ts` has to follow.
 */
async function encryptForBrowser(
  plaintext: string,
  recipientRawB64: string,
  kdf: { salt: Uint8Array<ArrayBuffer>; info: Uint8Array<ArrayBuffer> } = {
    salt: new TextEncoder().encode('miles-qr-login-salt-v1'),
    info: new TextEncoder().encode('miles-qr-login-aesgcm-v1'),
  },
): Promise<QrEncryptedPayload> {
  const recipient = await crypto.subtle.importKey(
    'raw',
    b64ToBytes(recipientRawB64),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);

  const shared = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: recipient },
    ephemeral.privateKey,
    256,
  );

  const hkdfKey = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      // Byte-for-byte the backend's confirmed values, defaulted in the
      // signature above. Written out as literals rather than imported from
      // `qr-crypto.ts` on purpose: importing them would make the test agree
      // with itself no matter what those constants said, and the whole point
      // is to pin them.
      salt: kdf.salt,
      info: kdf.info,
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    new TextEncoder().encode(plaintext),
  );

  return {
    epk: bytesToB64(new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey))),
    iv: bytesToB64(iv),
    ct: bytesToB64(new Uint8Array(ct)),
  };
}

function bytesToB64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function b64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

const SESSION = {
  access_token: 'access-abc',
  refresh_token: 'refresh-xyz',
  user_id: '9f1c-user',
};

describe('qr-crypto', () => {
  it('reports availability where WebCrypto exists', () => {
    expect(isQrCryptoAvailable()).toBe(true);
  });

  it('round-trips a session under the assumed contract', async () => {
    const pair = await generateQrKeyPair();
    const payload = await encryptForBrowser(JSON.stringify(SESSION), pair.publicKey);

    await expect(decryptQrPayload(payload, pair.privateKey)).resolves.toEqual(SESSION);
  });

  it('exports a raw EC point, not SPKI', async () => {
    // The regression that costs the most to find: #36 accepts *any* string as
    // `public_key` and still returns 201, so an SPKI key only fails later on
    // the phone. 65 raw bytes → 88 base64 chars; SPKI would be 124.
    const pair = await generateQrKeyPair();
    expect(pair.publicKey).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(pair.publicKey.length).toBe(88);
    expect(b64ToBytes(pair.publicKey).length).toBe(65);
    // Uncompressed-point marker. A compressed point would start 0x02/0x03.
    expect(b64ToBytes(pair.publicKey)[0]).toBe(0x04);
  });

  it('pins the HKDF salt and info', async () => {
    // The regression this guards: someone "tidies" the constants back to empty
    // buffers. Nothing else in the suite would notice — the round-trip above
    // would still pass if both sides changed together — but QR sign-in would
    // silently stop working against the real backend.
    const pair = await generateQrKeyPair();
    const wrongSalt = await encryptForBrowser(JSON.stringify(SESSION), pair.publicKey, {
      salt: new TextEncoder().encode('some-other-salt'),
      info: new TextEncoder().encode('miles-qr-login-aesgcm-v1'),
    });
    const wrongInfo = await encryptForBrowser(JSON.stringify(SESSION), pair.publicKey, {
      salt: new TextEncoder().encode('miles-qr-login-salt-v1'),
      info: new TextEncoder().encode('some-other-info'),
    });

    await expect(decryptQrPayload(wrongSalt, pair.privateKey)).rejects.toBeInstanceOf(
      QrCryptoError,
    );
    await expect(decryptQrPayload(wrongInfo, pair.privateKey)).rejects.toBeInstanceOf(
      QrCryptoError,
    );
  });

  it('fails as QrCryptoError when the key does not match', async () => {
    // The wrong private key is exactly what a curve/KDF mismatch looks like
    // from here — the point is that it throws rather than returning garbage.
    const pair = await generateQrKeyPair();
    const stranger = await generateQrKeyPair();
    const payload = await encryptForBrowser(JSON.stringify(SESSION), pair.publicKey);

    await expect(decryptQrPayload(payload, stranger.privateKey)).rejects.toBeInstanceOf(
      QrCryptoError,
    );
  });

  it('rejects a tampered ciphertext', async () => {
    const pair = await generateQrKeyPair();
    const payload = await encryptForBrowser(JSON.stringify(SESSION), pair.publicKey);
    const bytes = b64ToBytes(payload.ct);
    bytes[0] ^= 0xff;

    await expect(
      decryptQrPayload({ ...payload, ct: bytesToB64(bytes) }, pair.privateKey),
    ).rejects.toBeInstanceOf(QrCryptoError);
  });

  it('refuses a payload that decrypts but carries no access token', async () => {
    // Never store a session built from a blob without a token — that logs the
    // user into nothing and hides the real failure.
    const pair = await generateQrKeyPair();
    const payload = await encryptForBrowser(JSON.stringify({ refresh_token: 'r' }), pair.publicKey);

    await expect(decryptQrPayload(payload, pair.privateKey)).rejects.toBeInstanceOf(QrCryptoError);
  });

  it('names the keys it got, and no values, when the shape is wrong', async () => {
    // The `{user_id, session_id, token_id}` shape a sibling client documents.
    // If that is what the backend really sends, this message is the whole
    // diagnosis — and it must never echo the values, which are credentials.
    const pair = await generateQrKeyPair();
    const payload = await encryptForBrowser(
      JSON.stringify({ user_id: 'u-1', session_id: 's-1', token_id: 'SECRET-VALUE' }),
      pair.publicKey,
    );

    const failure = await decryptQrPayload(payload, pair.privateKey).catch((e: unknown) => e);
    const cause = (failure as QrCryptoError).cause as Error;
    expect(cause.message).toContain('user_id, session_id, token_id');
    expect(cause.message).not.toContain('SECRET-VALUE');
  });

  it('tolerates a missing refresh_token', async () => {
    // #35's twin problem: an absent refresh token just means the session ends
    // when the access token expires — not a reason to fail the sign-in.
    const pair = await generateQrKeyPair();
    const payload = await encryptForBrowser(
      JSON.stringify({ access_token: 'only-access' }),
      pair.publicKey,
    );

    await expect(decryptQrPayload(payload, pair.privateKey)).resolves.toEqual({
      access_token: 'only-access',
      refresh_token: '',
      user_id: null,
    });
  });
});
