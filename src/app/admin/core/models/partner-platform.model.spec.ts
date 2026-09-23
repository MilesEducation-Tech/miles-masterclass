// `@angular/common/http` pulls in partially-compiled injectables (BrowserXhr)
// that need the JIT compiler present when this runs under plain vitest.
import '@angular/compiler';

import { describe, expect, it } from 'vitest';

import { HttpErrorResponse } from '@angular/common/http';
import {
  partnerBlobErrorMessage,
  partnerErrorMessage,
  partnerLoadError,
} from './partner-platform.model';

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
      url: 'https://uat-api.milesmasterclass.com/api/partners/superadmin/report/summary/',
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

/**
 * The CSV exports request `responseType: 'blob'`, so a 4xx arrives with the
 * JSON body wrapped in a Blob — invisible to the sync helper. The async one
 * must read it, or every export failure degrades to "Please try again.".
 */
describe('partnerBlobErrorMessage', () => {
  it('reads the backend message out of a Blob body', async () => {
    const err = new HttpErrorResponse({
      status: 403,
      error: new Blob([JSON.stringify({ status: false, message: 'Nope.' })], {
        type: 'application/json',
      }),
    });
    await expect(partnerBlobErrorMessage(err)).resolves.toBe('Nope.');
  });

  it('falls back on a non-JSON blob and defers to the sync helper otherwise', async () => {
    const junk = new HttpErrorResponse({ status: 500, error: new Blob(['<html>']) });
    await expect(partnerBlobErrorMessage(junk)).resolves.toBe('Please try again.');
    const plain = new HttpErrorResponse({ status: 400, error: { status: false, message: 'Bad.' } });
    await expect(partnerBlobErrorMessage(plain)).resolves.toBe('Bad.');
  });
});
