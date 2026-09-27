import { HttpErrorResponse } from '@angular/common/http';

import {
  AUTH_ROUTES,
  SESSION_MINTING_PATHS,
  isOtpMethod,
  isSessionResponse,
  toAuthFailure,
} from './auth.model';

describe('auth.model', () => {
  describe('toAuthFailure', () => {
    const at = (status: number, error: unknown) =>
      toAuthFailure(new HttpErrorResponse({ status, error }));

    it('maps a wrong code to a retryable bad_code', () => {
      expect(at(401, { message: 'Invalid code.' })).toEqual({
        kind: 'bad_code',
        message: 'Invalid code.',
      });
    });

    it('maps a lockout to locked', () => {
      expect(at(429, { message: 'Too many attempts.' }).kind).toBe('locked');
    });

    // The two 403s are the reason this is a union and not a string: `active`
    // and `is_blocked` are separate columns set by different people, and
    // collapsing them sends a blocked learner to the wrong team.
    it('distinguishes the two 403 reasons', () => {
      expect(at(403, { code: 'account_blocked' }).kind).toBe('blocked');
      expect(at(403, { code: 'account_deactivated' }).kind).toBe('deactivated');
    });

    // A terminal screen tells the learner no retry can help and points them at
    // a support team — wrong for a 403 the contract does not document.
    it('never treats an undocumented 403 as terminal', () => {
      expect(at(403, { detail: 'Authentication credentials were not provided.' })).toEqual({
        kind: 'unknown',
        message: 'Authentication credentials were not provided.',
      });
      expect(at(403, { code: 'something_new', message: 'Nope.' }).kind).toBe('unknown');
    });

    // Both 502 bodies below are verbatim from the collection. Only the first
    // means the code was spent; the second is transient on every auth route.
    it('splits the two 502s by what they ask the learner to do', () => {
      expect(
        at(502, { message: 'Sign-in could not be completed. Please request a new code.' }),
      ).toEqual({
        kind: 'retry_new_code',
        message: 'Sign-in could not be completed. Please request a new code.',
      });
      expect(at(502, { message: 'Sign-in is temporarily unavailable. Please try again.' })).toEqual(
        {
          kind: 'unavailable',
          message: 'Sign-in is temporarily unavailable. Please try again.',
        },
      );
      // No copy to read → the transient reading, which never spends a code.
      expect(at(502, null).kind).toBe('unavailable');
    });

    it('maps a config fault to misconfigured', () => {
      expect(at(503, { message: 'Sign-in is not configured on this environment.' })).toEqual({
        kind: 'misconfigured',
        message: 'Sign-in is not configured on this environment.',
      });
    });

    // Verbatim strict-input refusal from the collection: the undeclared key is
    // the field, and its value is a string, not a list.
    it('surfaces the strict-input 400 for an undeclared key', () => {
      const refusal =
        'Unrecognised field for this endpoint. Each endpoint declares its own fields; a field accepted elsewhere is not accepted here.';
      expect(at(400, { appCode: refusal })).toEqual({
        kind: 'invalid_input',
        message: refusal,
        fields: { appCode: refusal },
      });
    });

    // Verified live against UAT: this API rejects an undeclared field with a
    // field-keyed 400 rather than a `{message}` body.
    it('carries the per-field messages out of a field-keyed 400', () => {
      const failure = at(400, { identifier: 'Enter a valid phone number.' });
      expect(failure).toEqual({
        kind: 'invalid_input',
        message: 'Enter a valid phone number.',
        fields: { identifier: 'Enter a valid phone number.' },
      });
    });

    it('falls back rather than throwing on an unexpected status or body', () => {
      expect(at(0, null).kind).toBe('unknown');
      expect(at(418, 'I am a teapot').message).toBe('I am a teapot');
    });
  });

  describe('isSessionResponse', () => {
    const valid = {
      accessToken: 'a.b.c',
      refreshToken: 'r',
      profile_status: 'new_user',
      is_test_user: false,
    };

    it('accepts a complete session', () => {
      expect(isSessionResponse(valid)).toBe(true);
    });

    it('rejects a body with no access token', () => {
      expect(isSessionResponse({ ...valid, accessToken: undefined })).toBe(false);
      expect(isSessionResponse({ ...valid, accessToken: '' })).toBe(false);
    });

    it('rejects a body whose refresh token is missing', () => {
      // Rule 3: without the rotated refresh token the session works exactly
      // once and then dies against a value that still looks valid.
      expect(isSessionResponse({ ...valid, refreshToken: '' })).toBe(false);
    });

    it('rejects a body without the is_test_user boolean', () => {
      expect(isSessionResponse({ ...valid, is_test_user: undefined })).toBe(false);
      expect(isSessionResponse({ ...valid, is_test_user: 'false' })).toBe(false);
    });

    it('rejects an unknown profile_status', () => {
      expect(isSessionResponse({ ...valid, profile_status: 'onboarding' })).toBe(false);
    });

    it('rejects non-objects', () => {
      expect(isSessionResponse(null)).toBe(false);
      expect(isSessionResponse('a.b.c')).toBe(false);
    });
  });

  it('derives the interceptor skip list from the registry', () => {
    // Derived, never retyped — a renamed path must not be able to drift out of
    // the interceptor's exclusion.
    expect(SESSION_MINTING_PATHS).toEqual([
      AUTH_ROUTES.identify.path,
      AUTH_ROUTES.sendOtp.path,
      AUTH_ROUTES.verifyOtp.path,
      AUTH_ROUTES.refresh.path,
    ]);
  });

  // Logout REQUIRES the bearer; skipping it answers 401 and the learner is
  // never signed out.
  it('leaves logout out of the skip list', () => {
    expect(SESSION_MINTING_PATHS).not.toContain(AUTH_ROUTES.logout.path);
  });

  /**
   * The matrix from the contract. This exists because the first implementation
   * matched on the bare string `'otp'`, which appears in NONE of these — so
   * every account looked like enterprise SSO and no one could sign in.
   */
  describe('isOtpMethod', () => {
    it('accepts every documented one-time-code method', () => {
      expect(isOtpMethod('email_otp')).toBe(true);
      expect(isOtpMethod('phone_otp')).toBe(true);
    });

    it('rejects the methods that are not a code', () => {
      expect(isOtpMethod('password')).toBe(false);
      expect(isOtpMethod('saml')).toBe(false);
    });

    it('rejects the bare string "otp", which the API never sends', () => {
      expect(isOtpMethod('otp')).toBe(false);
    });

    it.each([
      [['email_otp', 'password'], true],
      [['phone_otp', 'password'], true],
      [['password', 'email_otp'], true],
      [['saml'], false],
      [['password'], false],
    ])('methods %j -> can be sent a code: %s', (methods, expected) => {
      expect((methods as string[]).some(isOtpMethod)).toBe(expected);
    });
  });
});
