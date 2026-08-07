import { cairaError, isRefreshable, userMessage } from './caira-error';

/**
 * Every body here is copied from the CAIRA Web API reference, not invented.
 * The classifier is the only thing standing between a documented UI state and
 * a "Something went wrong" toast, so each vocabulary gets a case.
 *
 * `res` builds the same shape `HttpErrorResponse` exposes rather than
 * constructing one: instantiating it imports `@angular/common/http`, which
 * pulls in `BrowserXhr` and needs the JIT compiler. `cairaError` reads these
 * three fields structurally, so a real response and this object take the same
 * path — and the suite stays runnable without booting Angular.
 */
function res(status: number, error: unknown): { status: number; error: unknown; message: string } {
  return { status, error, message: `Http failure response: ${status}` };
}

describe('cairaError', () => {
  describe('domain states — must never toast', () => {
    it('classifies a locked chapter by its reason key', () => {
      const f = cairaError(res(403, { status: 'error', reason: 'chapter_locked' }));
      expect(f.kind).toBe('domain');
      expect(f).toMatchObject({ reason: 'chapter_locked', status: 403 });
    });

    it('keeps cool-off siblings so the countdown is renderable', () => {
      const f = cairaError(
        res(403, {
          status: 'error',
          reason: 'cool_off_active',
          cool_off_minutes_remaining: 7,
          cool_off_ends_at: '2026-08-07T10:00:00+05:30',
        }),
      );
      expect(f.kind).toBe('domain');
      if (f.kind !== 'domain') return;
      expect(f.extra['cool_off_minutes_remaining']).toBe(7);
      expect(f.extra['cool_off_ends_at']).toBe('2026-08-07T10:00:00+05:30');
      // `status`/`reason`/`message` are lifted out, not duplicated into extra.
      expect(f.extra).not.toHaveProperty('reason');
    });

    it('classifies the 7DC conflict, which is a 409 not a 4xx error', () => {
      const f = cairaError(
        res(409, {
          status: 'error',
          reason: 'already_started_via_7dc',
          message: 'This course was started via the 7DC partner flow.',
        }),
      );
      expect(f).toMatchObject({ kind: 'domain', reason: 'already_started_via_7dc' });
    });

    it.each([
      'already_completed',
      'chapters_not_complete',
      'already_passed',
      'assessment_not_passed',
      'feedback_already_submitted',
    ])('classifies %s as domain', (reason) => {
      expect(cairaError(res(403, { status: 'error', reason })).kind).toBe('domain');
    });
  });

  describe('auth — 403 is the common case, not 401', () => {
    it('treats a 403 with a detail key as auth, per the missing authenticate_header override', () => {
      const f = cairaError(res(403, { detail: 'Signature has expired.' }));
      expect(f).toMatchObject({ kind: 'auth', expired: true });
      expect(isRefreshable(f)).toBe(true);
    });

    it('treats a 401 with a detail key as auth', () => {
      expect(cairaError(res(401, { detail: 'Authorization header is missing' })).kind).toBe('auth');
    });

    it('flags the admin issuer expiry as refreshable too', () => {
      expect(isRefreshable(cairaError(res(403, { detail: 'Admin signature has expired.' })))).toBe(
        true,
      );
    });

    it.each([
      'Invalid token header. No credentials provided.',
      'Authentication credentials were not provided.',
      'User not found.',
      'Invalid token.',
      'Error decoding signature.',
      'Admin user not found.',
      'Invalid admin token.',
    ])('does not retry a non-expiry auth failure: %s', (detail) => {
      const f = cairaError(res(403, { detail }));
      expect(f.kind).toBe('auth');
      // A new token will not fix a malformed header or an unknown user.
      expect(isRefreshable(f)).toBe(false);
    });
  });

  describe('web login — {code, message}', () => {
    it('classifies a wrong password as domain, NOT auth, so it never triggers a refresh', () => {
      const f = cairaError(
        res(401, { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' }),
      );
      expect(f).toMatchObject({ kind: 'domain', reason: 'INVALID_CREDENTIALS' });
      expect(isRefreshable(f)).toBe(false);
    });

    it('classifies the profile gate as domain so it can open a dialog', () => {
      expect(
        cairaError(
          res(403, {
            code: 'PROFILE_INCOMPLETE',
            message: 'Please complete your profile on the Miles One app to continue.',
          }),
        ),
      ).toMatchObject({ kind: 'domain', reason: 'PROFILE_INCOMPLETE' });
    });

    it('classifies duplicate accounts as domain', () => {
      expect(cairaError(res(409, { code: 'MULTIPLE_ACCOUNTS', message: 'x' }))).toMatchObject({
        kind: 'domain',
        reason: 'MULTIPLE_ACCOUNTS',
      });
    });

    it('classifies missing credentials as validation', () => {
      const f = cairaError(
        res(400, {
          code: 'MISSING_CREDENTIALS',
          message: 'Both user_name and password are required.',
        }),
      );
      expect(f.kind).toBe('validation');
      if (f.kind !== 'validation') return;
      expect(f.fields[0].message).toBe('Both user_name and password are required.');
    });

    it.each([500, 502, 504])('classifies an SSO %d as unexpected', (status) => {
      expect(cairaError(res(status, { code: 'SSO_UNAVAILABLE', message: 'x' })).kind).toBe(
        'unexpected',
      );
    });
  });

  describe('QR routes — {error}', () => {
    it('classifies a wrong PIN as domain and keeps attempts_remaining', () => {
      const f = cairaError(res(401, { error: 'Incorrect PIN', attempts_remaining: 2 }));
      expect(f.kind).toBe('domain');
      if (f.kind !== 'domain') return;
      expect(f.extra['attempts_remaining']).toBe(2);
      // Critical: a wrong PIN is not an expired token.
      expect(isRefreshable(f)).toBe(false);
    });

    it('classifies "scan the QR code first" as domain', () => {
      expect(cairaError(res(409, { error: 'Scan the QR code with your phone first' })).kind).toBe(
        'domain',
      );
    });

    it('classifies the PIN lockout as domain', () => {
      expect(
        cairaError(res(429, { error: 'Too many incorrect attempts. Rescan the QR code.' })).kind,
      ).toBe('domain');
    });

    it('classifies an expired session as notFound', () => {
      expect(cairaError(res(404, { error: 'Session not found or expired' })).kind).toBe('notFound');
    });

    it('classifies a missing public key as validation', () => {
      expect(cairaError(res(400, { error: 'Missing public_key' })).kind).toBe('validation');
    });
  });

  describe('validation', () => {
    it('unpacks the pydantic envelope', () => {
      const f = cairaError(
        res(400, {
          status: 'error',
          errors: [{ field: 'answers.0.question_id', message: 'Input should be a valid UUID' }],
        }),
      );
      expect(f.kind).toBe('validation');
      if (f.kind !== 'validation') return;
      expect(f.fields).toEqual([
        { field: 'answers.0.question_id', message: 'Input should be a valid UUID' },
      ]);
    });

    it("unpacks DRF's field-keyed dict into the same shape", () => {
      const f = cairaError(
        res(400, { responses: ['This field is required.'], rating: ['Too high.'] }),
      );
      expect(f.kind).toBe('validation');
      if (f.kind !== 'validation') return;
      expect(f.fields).toEqual([
        { field: 'responses', message: 'This field is required.' },
        { field: 'rating', message: 'Too high.' },
      ]);
    });

    it('treats a single web-LMS message 400 as a non-field error', () => {
      const f = cairaError(res(400, { status: 'error', message: 'Expected 20 answers, got 19.' }));
      expect(f.kind).toBe('validation');
      if (f.kind !== 'validation') return;
      expect(f.fields).toEqual([{ field: '__all__', message: 'Expected 20 answers, got 19.' }]);
    });

    it('treats a DRF detail 400 as validation, not auth', () => {
      expect(cairaError(res(400, { detail: 'webinar_id query parameter is required.' })).kind).toBe(
        'validation',
      );
    });
  });

  describe('notFound', () => {
    it('reads the web-LMS message shape', () => {
      expect(cairaError(res(404, { status: 'error', message: 'Course not found.' }))).toMatchObject(
        {
          kind: 'notFound',
          message: 'Course not found.',
        },
      );
    });

    it('reads the DRF detail shape', () => {
      expect(cairaError(res(404, { detail: 'No Webinar matches the given query.' })).kind).toBe(
        'notFound',
      );
    });

    it("reads badge-clicked's {status:false, data:{}, message} shape", () => {
      expect(
        cairaError(
          res(404, {
            status: false,
            data: {},
            message: 'Badge not found or does not belong to you.',
          }),
        ).kind,
      ).toBe('notFound');
    });

    it("handles Django's plain-text 404 from a non-canonical UUID", () => {
      expect(cairaError(res(404, '<!DOCTYPE html><h1>Not Found</h1>')).kind).toBe('notFound');
    });
  });

  describe('unexpected — the only bucket that toasts', () => {
    it('classifies a raw-exception 500', () => {
      expect(cairaError(res(500, { status: 'error', message: "KeyError: 'foo'" })).kind).toBe(
        'unexpected',
      );
    });

    it('classifies the boolean-status 500 the list endpoints use', () => {
      expect(
        cairaError(res(500, { status: false, message: 'Failed to load top section.' })).kind,
      ).toBe('unexpected');
    });

    it("classifies all_webinars_web's 400 catch-all as unexpected — it has no 500 path", () => {
      // The {message, error} pair is a flattened server fault. Reading it as a
      // validation error would tell the user they typed something wrong.
      const f = cairaError(
        res(400, { status: 'error', message: 'Failed to fetch webinars', error: "KeyError: 'x'" }),
      );
      expect(f).toMatchObject({ kind: 'unexpected', message: 'Failed to fetch webinars' });
    });

    it("classifies badges_catalog's 400 catch-all as unexpected", () => {
      expect(
        cairaError(
          res(400, { status: 'error', message: 'Failed to fetch badges catalog', error: 'boom' }),
        ).kind,
      ).toBe('unexpected');
    });

    it('classifies a collapsed refresh failure as unexpected, not validation', () => {
      expect(
        cairaError(
          res(400, { message: 'Token refresh failed', error: 'refresh_token_service error' }),
        ).kind,
      ).toBe('unexpected');
    });

    it('classifies a network failure (status 0)', () => {
      expect(cairaError(res(0, null))).toMatchObject({ kind: 'unexpected', status: 0 });
    });

    it('classifies a non-HttpErrorResponse throw', () => {
      expect(cairaError(new Error('boom'))).toMatchObject({ kind: 'unexpected', status: 0 });
    });

    it('classifies an empty body', () => {
      expect(cairaError(res(502, null)).kind).toBe('unexpected');
    });
  });

  describe('throttling', () => {
    it('classifies the login throttle as domain so it renders inline', () => {
      const f = cairaError(
        res(429, { detail: 'Request was throttled. Expected available in 42 seconds.' }),
      );
      expect(f).toMatchObject({ kind: 'domain', reason: 'throttled' });
    });
  });
});

describe('userMessage', () => {
  it('never leaks a raw exception string from a 500', () => {
    const raw = "KeyError: 'Masterclass_Course_Name'";
    const msg = userMessage(cairaError(res(500, { status: 'error', message: raw })));
    expect(msg).not.toContain('KeyError');
    expect(msg).toBe('Something went wrong. Please try again.');
  });

  it('passes a domain message through verbatim', () => {
    const msg = userMessage(
      cairaError(res(403, { status: 'error', reason: 'x', message: 'Come back in 7 minutes.' })),
    );
    expect(msg).toBe('Come back in 7 minutes.');
  });
});
