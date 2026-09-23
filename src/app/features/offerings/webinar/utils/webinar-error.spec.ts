import { HttpErrorResponse } from '@angular/common/http';
import { isSessionConflict, isSupersededError, toWebinarError } from './webinar-error';

function refusal(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('toWebinarError', () => {
  it('switches on code, not on HTTP status', () => {
    // The same code can arrive under a different status without the client
    // changing; the status is not the contract.
    const a = toWebinarError(refusal(409, { code: 'webinar_inactive', detail: 'Paused.' }));
    const b = toWebinarError(refusal(404, { code: 'webinar_inactive', detail: 'Paused.' }));
    expect(a.code).toBe('webinar_inactive');
    expect(b.code).toBe('webinar_inactive');
    expect(a.code).toBe(b.code);
  });

  it('reads detail, and falls back to message', () => {
    // `authentication_required` is the one refusal that carries `message`
    // where every other one carries `detail`.
    const withDetail = toWebinarError(
      refusal(409, { code: 'webinar_cancelled', detail: 'The session was cancelled.' }),
    );
    expect(withDetail.message).toBe('The session was cancelled.');

    const withMessage = toWebinarError(
      refusal(401, {
        code: 'authentication_required',
        message: 'login_type=post_login requires an authenticated request.',
      }),
    );
    expect(withMessage.message).toBe('login_type=post_login requires an authenticated request.');
  });

  it('flags the four profile refusals', () => {
    for (const code of [
      'missing_email',
      'invalid_email',
      'missing_first_name',
      'invalid_first_name',
    ]) {
      const error = toWebinarError(refusal(400, { code, detail: 'Fix your profile.' }));
      expect(error.isProfileProblem).toBe(true);
      // None is retryable without the user changing something first.
      expect(error.isRetryable).toBe(false);
    }
  });

  it('does not flag a non-profile refusal as a profile problem', () => {
    const error = toWebinarError(refusal(404, { code: 'webinar_not_found' }));
    expect(error.isProfileProblem).toBe(false);
  });

  it('carries retry_after_seconds on lock contention', () => {
    const error = toWebinarError(
      refusal(409, { code: 'registration_in_progress', retry_after_seconds: 15 }),
    );
    expect(error.retryAfterSeconds).toBe(15);
    expect(error.isRetryable).toBe(true);
  });

  it('carries the per-field errors from a validation failure', () => {
    const error = toWebinarError(
      refusal(400, {
        code: 'invalid_request',
        errors: [{ field: 'login_type', message: 'Field required' }],
      }),
    );
    expect(error.errors).toEqual([{ field: 'login_type', message: 'Field required' }]);
  });

  it('falls back to known copy when the body carries no text', () => {
    const error = toWebinarError(refusal(404, { code: 'webinar_not_found' }));
    expect(error.message).toBe('We could not find that webinar.');
  });

  it('names the bad-token 403 even though it carries no code', () => {
    // DRF's own envelope, not this app's: `403 {"detail": "Error decoding
    // signature."}`. Without the special case the user would be shown a JWT
    // library's internal wording under `unknown_error`.
    const error = toWebinarError(refusal(403, { detail: 'Error decoding signature.' }));
    expect(error.code).toBe('authentication_failed');
    expect(error.message).toBe('Your session has expired. Please sign in again.');
  });

  it('leaves a 403 that DOES carry a code alone', () => {
    const error = toWebinarError(refusal(403, { code: 'not_registered', detail: 'Nope.' }));
    expect(error.code).toBe('not_registered');
    expect(error.message).toBe('Nope.');
  });

  it('handles a body that is not an object', () => {
    const error = toWebinarError(refusal(502, 'Bad Gateway'));
    expect(error.code).toBe('unknown_error');
    expect(error.status).toBe(502);
  });

  it('handles a thrown Error that is not an HTTP response', () => {
    const error = toWebinarError(new Error('Network down'));
    expect(error.code).toBe('unknown_error');
    expect(error.message).toBe('Network down');
    expect(error.status).toBeNull();
  });
});

describe('session predicates', () => {
  it('identifies a lease conflict', () => {
    expect(isSessionConflict(toWebinarError(refusal(409, { code: 'session_active' })))).toBe(true);
    expect(isSessionConflict(toWebinarError(refusal(409, { code: 'webinar_inactive' })))).toBe(
      false,
    );
  });

  it('identifies an eviction', () => {
    expect(isSupersededError(toWebinarError(refusal(409, { code: 'session_superseded' })))).toBe(
      true,
    );
  });
});
