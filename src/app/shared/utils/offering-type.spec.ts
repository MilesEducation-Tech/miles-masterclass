import { OFFERING_TYPE_TOKENS, offeringTypeFromUrl } from './offering-type';

describe('offeringTypeFromUrl', () => {
  it('returns masterclass for listing + detail URLs', () => {
    expect(offeringTypeFromUrl('/in/accounting/masterclass')).toBe(
      OFFERING_TYPE_TOKENS.masterclass,
    );
    expect(offeringTypeFromUrl('/in/accounting/masterclass/42/some-title')).toBe(
      OFFERING_TYPE_TOKENS.masterclass,
    );
  });

  it('returns podcast for podcast URLs', () => {
    expect(offeringTypeFromUrl('/in/accounting/podcast/7/title')).toBe(
      OFFERING_TYPE_TOKENS.podcast,
    );
  });

  it('returns the API snake_case token for the kebab-case micro-learning segment', () => {
    expect(offeringTypeFromUrl('/in/accounting/micro-learning')).toBe(
      OFFERING_TYPE_TOKENS.microLearning,
    );
    expect(offeringTypeFromUrl('/in/accounting/micro-learning/9/reel')).toBe('nano_learning');
  });

  it('returns an empty string when no offering matches', () => {
    expect(offeringTypeFromUrl('/auth/login')).toBe('');
    expect(offeringTypeFromUrl('/in/accounting/library')).toBe('');
    expect(offeringTypeFromUrl('')).toBe('');
  });
});
