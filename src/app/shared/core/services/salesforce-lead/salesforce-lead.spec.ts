// Importing ApiClient pulls in @angular/common/http, whose BrowserXhr is only
// partially compiled and needs the JIT compiler loaded in the test env.
import '@angular/compiler';

import { Injector, runInInjectionContext } from '@angular/core';
import { of, throwError } from 'rxjs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { environment } from '../../../../../environments/environment';
import { ApiClient } from '../api-client/api-client';
import { Logger } from '../logger/logger';
import { SalesforceLead } from './salesforce-lead';

/**
 * Built on a plain `Injector` rather than `TestBed`: this repo's vitest setup
 * never calls `TestBed.initTestEnvironment()`, so anything TestBed-based fails
 * before it runs. A hand-made injector needs none of that.
 *
 * What's worth pinning — all of it fails silently if it regresses, because
 * `create()` swallows its own errors by design and nothing else would tell us:
 *   1. the fixed constants reach the wire and the body carries EXACTLY the
 *      fields the `/mmc` route documents — no api key, no extras;
 *   2. a form with no phone doesn't post empty strings;
 *   3. a failing endpoint never propagates out of `create()`.
 *
 * `create()` no-ops unless `environment.production` is true, and the unit-test
 * builder resolves `environment.development.ts` (production `false`, the UAT
 * API URL — confirmed by probe), so every assertion below used to pass
 * vacuously against a method that had already returned. `vi.mock` is rejected
 * for relative imports by the Angular unit-test system, so the flag is flipped
 * on the shared object and restored afterwards.
 */

let wasProduction: boolean;
beforeAll(() => {
  wasProduction = environment.production;
  environment.production = true;
});
afterAll(() => {
  environment.production = wasProduction;
});

function makeService(post = vi.fn().mockReturnValue(of({ statusCode: 201 }))) {
  const injector = Injector.create({
    providers: [
      { provide: ApiClient, useValue: { post } },
      { provide: Logger, useValue: { log: vi.fn(), error: vi.fn() } },
    ],
  });
  const service = runInInjectionContext(injector, () => new SalesforceLead());
  return { service, post };
}

describe('SalesforceLead.create', () => {
  it('posts exactly the documented fields, with no auth header', () => {
    const { service, post } = makeService();

    service.create({
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      phone: '9876543210',
      country_code: '+91',
    });

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, options] = post.mock.calls[0];
    expect(url).toBe(environment.SALESFORCE_LEAD.url);
    // The /mmc route is unauthenticated — no credential may ship with it.
    expect(options.headers).toBeUndefined();
    expect(body).toEqual({
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      phone: '9876543210',
      country_code: '+91',
      course_id: environment.SALESFORCE_LEAD.courseId,
      vertical: environment.SALESFORCE_LEAD.vertical,
    });
  });

  it('omits the phone pair when the form did not collect one', () => {
    const { service, post } = makeService();

    service.create({ first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' });

    const body = post.mock.calls[0][1];
    expect(body.phone).toBeUndefined();
    expect(body.country_code).toBeUndefined();
  });

  it("never throws when the endpoint fails — the user's own submit must survive", () => {
    const failing = vi.fn().mockReturnValue(throwError(() => new Error('boom')));
    const { service } = makeService(failing);

    expect(() =>
      service.create({ first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' }),
    ).not.toThrow();
  });
});

describe('SalesforceLead.splitName', () => {
  it('splits a full name into first and the rest', () => {
    expect(SalesforceLead.splitName('Jane Q Doe')).toEqual({
      first_name: 'Jane',
      last_name: 'Q Doe',
    });
  });

  it('leaves last_name empty for a single token', () => {
    expect(SalesforceLead.splitName('Jane')).toEqual({ first_name: 'Jane', last_name: '' });
  });

  it('tolerates extra whitespace and an empty string', () => {
    expect(SalesforceLead.splitName('  Jane   Doe  ')).toEqual({
      first_name: 'Jane',
      last_name: 'Doe',
    });
    expect(SalesforceLead.splitName('')).toEqual({ first_name: '', last_name: '' });
  });
});
