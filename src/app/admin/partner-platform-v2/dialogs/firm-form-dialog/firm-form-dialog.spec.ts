// The dialog import pulls the whole Angular component chain in; under plain
// vitest that needs the JIT compiler present (see partner-platform.model.spec).
import '@angular/compiler';

import { describe, expect, it } from 'vitest';

import { parseDomains } from './firm-form-dialog';

/**
 * The operator types one comma-separated string; the API takes `email_domains`
 * as a list. If this regresses, a firm silently gets a domain with a stray
 * space or a duplicate — and nothing matches on redemption.
 */
describe('parseDomains', () => {
  it('splits, trims, lowercases and dedupes', () => {
    expect(parseDomains(' Acme.com , acme.com,foo.co.uk ')).toEqual(['acme.com', 'foo.co.uk']);
  });

  it('is empty for blank or comma-only input', () => {
    expect(parseDomains('')).toEqual([]);
    expect(parseDomains(' , , ')).toEqual([]);
  });
});
