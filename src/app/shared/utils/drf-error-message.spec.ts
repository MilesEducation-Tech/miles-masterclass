import { describe, expect, it } from 'vitest';
import { drfErrorMessage } from './drf-error-message';

/**
 * The public enquiry form and the admin leads page both show this string to a
 * human, so the field-keyed DRF shape must not collapse to the fallback.
 */
describe('drfErrorMessage', () => {
  it('labels a field-keyed validation error', () => {
    expect(drfErrorMessage({ error: { email: ['This field is required.'] } }, 'fallback')).toBe(
      'email: This field is required.',
    );
  });

  it('returns bare keys (detail / message / non_field_errors) unlabelled', () => {
    expect(drfErrorMessage({ error: { detail: 'Not a super-admin.' } }, 'fallback')).toBe(
      'Not a super-admin.',
    );
    expect(
      drfErrorMessage(
        { error: { non_field_errors: ['Provide at least one of: status, notes.'] } },
        'fallback',
      ),
    ).toBe('Provide at least one of: status, notes.');
  });

  it('reads the Miles gateway envelope, not its `field` metadata', () => {
    // Verified against UAT: an unauthenticated call returns exactly this shape.
    expect(
      drfErrorMessage(
        {
          error: {
            field: 'detail',
            message: 'Authentication credentials were not provided.',
            error_code: 'not_authenticated',
          },
        },
        'fallback',
      ),
    ).toBe('Authentication credentials were not provided.');
  });

  it('falls back on a body with no readable message', () => {
    expect(drfErrorMessage({ error: { status: false } }, 'fallback')).toBe('fallback');
    expect(drfErrorMessage({ error: { error_code: 'x', field: 'y' } }, 'fallback')).toBe(
      'fallback',
    );
    expect(drfErrorMessage(new Error('network'), 'fallback')).toBe('fallback');
    expect(drfErrorMessage(undefined, 'fallback')).toBe('fallback');
  });
});
