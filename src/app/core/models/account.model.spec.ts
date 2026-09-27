import { HttpErrorResponse } from '@angular/common/http';

import { ACCOUNT_ROUTES, isUserDetails, readAccountError } from './account.model';

describe('account.model', () => {
  it('reads the user record from the hyphenated route; the underscore one was deleted', () => {
    expect(ACCOUNT_ROUTES.userDetails.path).toBe('api/v1/account/user-details/');
    expect(ACCOUNT_ROUTES.userDetails.method).toBe('GET');
  });

  describe('isUserDetails', () => {
    const valid = {
      first_name: 'Sohan',
      full_name: 'Sohan Biswas',
      is_onboarding_completed: true,
      is_profile_completed: true,
      Pathway: 'Yes',
      Enrolled_status: 'Yes',
      Enrolled_course: ['US CPA'],
      onboarding_fully_completed: true,
    };

    it('accepts the contract example', () => {
      expect(isUserDetails(valid)).toBe(true);
    });

    // The contract adds keys without notice; only a rename or removal must fail.
    it('allows an extra key', () => {
      expect(isUserDetails({ ...valid, show_seven_day_challenge: false })).toBe(true);
    });

    it('rejects a Yes/No sent as a boolean or in another case', () => {
      expect(isUserDetails({ ...valid, Pathway: true })).toBe(false);
      expect(isUserDetails({ ...valid, Enrolled_status: 'yes' })).toBe(false);
    });

    it('rejects a non-string course', () => {
      expect(isUserDetails({ ...valid, Enrolled_course: [1] })).toBe(false);
    });

    it('rejects non-objects', () => {
      expect(isUserDetails(null)).toBe(false);
      expect(isUserDetails([valid])).toBe(false);
    });
  });

  /** Bodies verbatim from the Postman examples for folder 02. */
  describe('readAccountError', () => {
    const at = (status: number, error: unknown) =>
      readAccountError(new HttpErrorResponse({ status, error }));

    it('keeps a code-keyed 400 as per-field messages', () => {
      expect(at(400, { years_experience: 'Enter a number.' })).toEqual({
        kind: 'fields',
        fields: { years_experience: 'Enter a number.' },
      });
    });

    it('takes the first message of a DRF-native list', () => {
      expect(at(400, { city: ['This field may not be blank.'] })).toEqual({
        kind: 'fields',
        fields: { city: 'This field may not be blank.' },
      });
    });

    // These used to be read as field errors on questions called `status` and
    // `message` — which do not exist, so nothing was ever shown.
    it('reads the shared 500 envelope as one message', () => {
      expect(at(500, { status: 'error', message: 'Could not read your name.' })).toEqual({
        kind: 'message',
        message: 'Could not read your name.',
      });
    });

    it('reads the legacy Failed envelope as one message', () => {
      expect(at(404, { message: 'User not found.', status: 'Failed' })).toEqual({
        kind: 'message',
        message: 'User not found.',
      });
    });

    it("reads DRF's 403 detail as one message", () => {
      expect(at(403, { detail: 'Authentication credentials were not provided.' })).toEqual({
        kind: 'message',
        message: 'Authentication credentials were not provided.',
      });
    });

    it('returns no message for a body it cannot read', () => {
      expect(at(0, null)).toEqual({ kind: 'message', message: null });
      expect(at(500, {})).toEqual({ kind: 'message', message: null });
      expect(readAccountError(new Error('boom'))).toEqual({ kind: 'message', message: null });
    });
  });
});
