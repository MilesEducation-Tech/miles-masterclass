// Importing ApiClient pulls in @angular/common/http, whose BrowserXhr is only
// partially compiled and needs the JIT compiler loaded in the test env.
import '@angular/compiler';

import { DOCUMENT } from '@angular/common';
import { Injector, PLATFORM_ID, runInInjectionContext } from '@angular/core';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { environment } from '../../../../../environments/environment';
import { User } from '../../models/auth.model';
import { ApiClient } from '../api-client/api-client';
import { Auth } from '../auth/auth';
import { Logger } from '../logger/logger';
import { MilesActivity } from './miles-activity';

/**
 * Built on a plain `Injector` rather than `TestBed`, for the same reason as
 * `salesforce-lead.spec.ts`: this repo's vitest setup never calls
 * `TestBed.initTestEnvironment()`.
 *
 * Every branch here fails SILENTLY if it regresses — `send()` swallows its own
 * errors by design and no caller inspects the result — so the guards are the
 * only thing worth pinning:
 *   1. a signed-in user produces the exact wire shape + `x-api-key`;
 *   2. anonymous traffic and an empty `miles_user_id` send nothing (a non-UUID
 *      would be junk to Miles360);
 *   3. `/admin/**` is never mirrored;
 *   4. a failing endpoint never propagates out of `send()`.
 *
 * The `environment.production` guard isn't covered here: the spec resolves the
 * production environment file, so the false branch is unreachable without
 * mocking the module — more machinery than the one-line guard is worth.
 */
function makeService(
  opts: {
    user?: Partial<User> | null;
    path?: string;
    post?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const post = opts.post ?? vi.fn().mockReturnValue(of({ statusCode: 200 }));
  const injector = Injector.create({
    providers: [
      { provide: ApiClient, useValue: { post } },
      { provide: Auth, useValue: { currentUser: () => opts.user ?? null } },
      { provide: Logger, useValue: { log: vi.fn(), error: vi.fn() } },
      {
        provide: DOCUMENT,
        useValue: {
          location: { pathname: opts.path ?? '/us/cpa/home' },
        },
      },
      { provide: PLATFORM_ID, useValue: 'browser' },
    ],
  });
  const service = runInInjectionContext(injector, () => new MilesActivity());
  return { service, post };
}

const USER: Partial<User> = {
  id: 42,
  miles_user_id: 'fc4f8be5-2d9f-4a26-902f-695e3dcfd52d',
  email: 'test@example.com',
};

describe('MilesActivity.send', () => {
  it('posts the Miles360 payload with the api key for a signed-in user', () => {
    const { service, post } = makeService({ user: USER });

    service.send('video_progress', { percent: 50 });

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, options] = post.mock.calls[0];
    expect(url).toBe(environment.MILES_ACTIVITY.url);
    expect(options.headers['x-api-key']).toBe(environment.MILES_ACTIVITY.apiKey);
    expect(body).toMatchObject({
      miles_uuid: USER.miles_user_id,
      event_name: 'video_progress',
      event_data: {
        email: 'test@example.com',
        app_source: environment.appType,
        percent: 50,
      },
    });
    // Second precision, no millis — the API sample's format.
    expect(body.event_time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it('sends nothing for an anonymous visitor', () => {
    const { service, post } = makeService({ user: null });
    service.send('view_item');
    expect(post).not.toHaveBeenCalled();
  });

  it('sends nothing when miles_user_id is missing — the numeric id is not a UUID', () => {
    const { service, post } = makeService({ user: { ...USER, miles_user_id: '' } });
    service.send('account_create');
    expect(post).not.toHaveBeenCalled();
  });

  it('never mirrors the admin panel', () => {
    const { service, post } = makeService({ user: USER, path: '/admin/user-onboarding' });
    service.send('element_click');
    expect(post).not.toHaveBeenCalled();
  });

  it("never throws when the endpoint fails — the user's own interaction must survive", () => {
    const failing = vi.fn().mockReturnValue(throwError(() => new Error('boom')));
    const { service } = makeService({ user: USER, post: failing });
    expect(() => service.send('login')).not.toThrow();
  });
});
