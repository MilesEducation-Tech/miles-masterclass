import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';

import { ACCOUNT_ROUTES } from '../../models/account.model';
import { AuthSession } from '../auth-session/auth-session';
import { AccountApi } from './account-api';

describe('AccountApi', () => {
  let backend: HttpTestingController;
  let accessToken: ReturnType<typeof signal<string>>;

  beforeEach(() => {
    accessToken = signal('');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthSession,
          useValue: {
            accessToken,
            // The real service derives this the same way — a BOOLEAN, so that
            // a token rotation is invisible to anything gating on it.
            isAuthenticated: computed(() => accessToken().length > 0),
          },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  const matchUser = () => backend.match((r) => r.url.includes(ACCOUNT_ROUTES.userDetails.path));
  const matchStatus = () => backend.match((r) => r.url.includes(ACCOUNT_ROUTES.appStatus.path));

  /** Both resources fetch together; flush the probe so `verify()` stays honest. */
  const flushStatus = () => matchStatus().forEach((r) => r.flush({ is_maintenance: false }));

  it('sends nothing at all while signed out', () => {
    const api = TestBed.inject(AccountApi);
    // Touch the resources so they would fetch if they were going to.
    void api.user.value();
    void api.appStatus.value();
    TestBed.tick();

    backend.expectNone(() => true);
    expect(api.user.isLoading()).toBe(false);
  });

  it('fetches the user row and the app-status probe once signed in', () => {
    const api = TestBed.inject(AccountApi);
    void api.user.value();
    void api.appStatus.value();

    accessToken.set('token-1');
    TestBed.tick();

    expect(matchUser()).toHaveLength(1);
    expect(matchStatus()).toHaveLength(1);
  });

  /**
   * RULE 1, and the reason `isAuthenticated` is a boolean rather than the token
   * itself. A request function tracks every signal it reads; if these gated on
   * the token string, every rotation would silently re-fire every read in the
   * application. This is the assertion that catches that regression.
   */
  it('does NOT re-fetch when only the token rotates', () => {
    const api = TestBed.inject(AccountApi);
    void api.user.value();

    accessToken.set('token-1');
    TestBed.tick();
    const first = matchUser();
    expect(first).toHaveLength(1);
    first[0].flush({ id: 1, email: 'a@b.c' });
    flushStatus();

    // A rotation: still signed in, different token.
    accessToken.set('token-2-rotated');
    TestBed.tick();

    expect(matchUser()).toHaveLength(0);
  });

  it('goes idle again on sign-out', () => {
    const api = TestBed.inject(AccountApi);
    void api.user.value();

    accessToken.set('token-1');
    TestBed.tick();
    matchUser()[0].flush({ id: 1, email: 'a@b.c' });
    flushStatus();

    accessToken.set('');
    TestBed.tick();

    backend.expectNone(() => true);
    expect(api.user.hasValue()).toBe(false);
  });
});
