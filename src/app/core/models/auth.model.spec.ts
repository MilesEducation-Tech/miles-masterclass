import { HttpErrorResponse } from '@angular/common/http';

import { AUTH_ROUTES, AUTH_ROUTE_PATHS, isSessionResponse, toAuthFailure } from './auth.model';

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

    it('maps a spent code to retry_new_code and a config fault to misconfigured', () => {
      expect(at(502, { message: 'Please request a new code.' }).kind).toBe('retry_new_code');
      expect(at(503, { message: 'Sign-in is not configured on this environment.' })).toEqual({
        kind: 'misconfigured',
        message: 'Sign-in is not configured on this environment.',
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
    expect(AUTH_ROUTE_PATHS).toHaveLength(5);
    expect(AUTH_ROUTE_PATHS).toContain(AUTH_ROUTES.refresh.path);
    expect(AUTH_ROUTE_PATHS).toContain(AUTH_ROUTES.logout.path);
  });
});
