import { HttpErrorResponse } from '@angular/common/http';
import { partnerErrorMessage, partnerLoadError } from './partner-platform.model';

/**
 * The one thing worth pinning: every Partner Platform failure is
 * `{ status:false, message }` on a 400/401/403, so the message lives on
 * `err.error` — never on `HttpErrorResponse.message`, which is Angular's
 * generic "Http failure response for …". If this regresses, every error toast
 * in the panel silently goes back to being useless.
 */
describe('partnerErrorMessage', () => {
  it('pulls the backend message out of an HttpErrorResponse body', () => {
    const err = new HttpErrorResponse({
      status: 400,
      url: 'https://uat-api.milesmasterclass.com/api/reports/superadmin/coupons/',
      error: { status: false, message: 'network_id or firm_id is required.' },
    });

    expect(partnerErrorMessage(err)).toBe('network_id or firm_id is required.');
    // Guard against the regression itself: never the generic Angular text.
    expect(partnerErrorMessage(err)).not.toContain('Http failure response');
  });

  it('accepts a plain-string error body', () => {
    const err = new HttpErrorResponse({ status: 403, error: 'Forbidden' });
    expect(partnerErrorMessage(err)).toBe('Forbidden');
  });

  it('falls back when there is no usable message (network down, blob body, null)', () => {
    expect(partnerErrorMessage(new HttpErrorResponse({ status: 0 }))).toBe('Please try again.');
    expect(partnerErrorMessage({ error: { status: false, message: '  ' } })).toBe(
      'Please try again.',
    );
    expect(partnerErrorMessage(null, 'Custom fallback.')).toBe('Custom fallback.');
  });
});

describe('partnerLoadError', () => {
  it('is null with no error so an @if banner stays hidden', () => {
    expect(partnerLoadError(undefined, 'Failed to load coupons.')).toBeNull();
  });

  it('returns the backend message when the load failed', () => {
    const err = new HttpErrorResponse({ status: 403, error: { status: false, message: 'Nope.' } });
    expect(partnerLoadError(err, 'Failed to load coupons.')).toBe('Nope.');
  });
});
