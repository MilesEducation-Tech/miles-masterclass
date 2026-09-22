import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '@env/environment';
import { AUTH_ROUTES } from '../../models/auth.model';
import { Storage } from '../storage/storage';
import { AuthSession } from './auth-session';

/** A JWT whose `exp` is `secondsFromNow` away. Only the payload is read. */
function jwt(secondsFromNow: number): string {
  const exp = Math.floor(Date.now() / 1000) + secondsFromNow;
  const payload = btoa(JSON.stringify({ exp })).replace(/=+$/, '');
  return `header.${payload}.signature`;
}

function session(accessToken: string, refreshToken = 'refresh-2') {
  return { accessToken, refreshToken, profile_status: 'profile_completed', is_test_user: false };
}

describe('AuthSession', () => {
  let auth: AuthSession;
  let http: HttpTestingController;
  let cookies: Record<string, string>;

  beforeEach(() => {
    cookies = {};
    const storage: Partial<Storage> = {
      getCookie: (key: string) => cookies[key] ?? '',
      setCookie: (key: string, value: string) => void (cookies[key] = value),
      deleteCookie: (key: string) => void delete cookies[key],
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Storage, useValue: storage },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Seeds a live session, then builds the service so it hydrates from cookies. */
  function signedInWith(accessToken: string) {
    cookies[environment.AUTH.accessToken] = accessToken;
    cookies[environment.AUTH.refreshToken] = 'refresh-1';
    auth = TestBed.inject(AuthSession);
  }

  it('hydrates from cookies so SSR and a hard refresh agree', () => {
    signedInWith(jwt(3600));
    expect(auth.isAuthenticated()).toBe(true);
  });

  describe('ensureFreshToken', () => {
    it('does nothing while the token has plenty of life left', async () => {
      signedInWith(jwt(3600));
      await auth.ensureFreshToken();
      http.expectNone(() => true);
    });

    it('refreshes once the token is inside the 120s skew', async () => {
      signedInWith(jwt(30));
      const pending = auth.ensureFreshToken();

      const req = http.expectOne((r) => r.url.includes(AUTH_ROUTES.refresh.path));
      expect(req.request.method).toBe('POST');
      // The app-client shape. `{}` (cookie-forwarding) is the alternative the
      // endpoint also accepts, but it is not what this client sends.
      expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
      req.flush(session(jwt(3600)));

      await pending;
      expect(auth.isAuthenticated()).toBe(true);
    });

    // RULE 3. Refresh tokens rotate and the previous one dies about ten seconds
    // after use, so two concurrent refreshes invalidate the caller's own
    // session. This is the assertion that protects the serialisation.
    it('issues exactly ONE request for concurrent callers', async () => {
      signedInWith(jwt(10));

      const all = Promise.all([
        auth.ensureFreshToken(),
        auth.ensureFreshToken(),
        auth.ensureFreshToken(),
      ]);

      const requests = http.match((r) => r.url.includes(AUTH_ROUTES.refresh.path));
      expect(requests).toHaveLength(1);
      requests[0].flush(session(jwt(3600)));

      await all;
    });

    // RULE 3 again: keeping the OLD refresh token works exactly once and then
    // fails against a value that still looks like a valid token.
    it('stores the ROTATED refresh token', async () => {
      signedInWith(jwt(10));
      const pending = auth.ensureFreshToken();
      http
        .expectOne((r) => r.url.includes(AUTH_ROUTES.refresh.path))
        .flush(session(jwt(3600), 'rotated'));
      await pending;

      expect(cookies[environment.AUTH.refreshToken]).toBe('rotated');
    });

    it('clears the session once and does not loop when the refresh is refused', async () => {
      signedInWith(jwt(10));
      const pending = auth.ensureFreshToken();
      http
        .expectOne((r) => r.url.includes(AUTH_ROUTES.refresh.path))
        .flush({ message: 'Session could not be refreshed.' }, { status: 401, statusText: 'x' });
      await pending;

      expect(auth.isAuthenticated()).toBe(false);
      // A second call must not chase a session that can no longer exist.
      await auth.ensureFreshToken();
      http.expectNone(() => true);
    });

    it('refuses a malformed session rather than storing garbage', async () => {
      signedInWith(jwt(10));
      const pending = auth.ensureFreshToken();
      http
        .expectOne((r) => r.url.includes(AUTH_ROUTES.refresh.path))
        .flush({ accessToken: 'only-half-a-session' });
      await pending;

      // Storing it would look signed in while every later request failed with
      // no signal, so the session is cleared instead.
      expect(auth.isAuthenticated()).toBe(false);
      expect(cookies[environment.AUTH.accessToken]).toBeUndefined();
    });
  });

  describe('logout', () => {
    it('clears the session when the SSO confirms it', async () => {
      signedInWith(jwt(3600));
      const pending = auth.logout();
      http.expectOne((r) => r.url.includes(AUTH_ROUTES.logout.path)).flush({});
      await pending;

      expect(auth.isAuthenticated()).toBe(false);
    });

    // A logout that failed leaves a session still live at the SSO. Blanking the
    // tokens would hide that behind a UI that merely looks signed out.
    it('KEEPS the session when logout fails', async () => {
      signedInWith(jwt(3600));
      const pending = auth.logout();
      http
        .expectOne((r) => r.url.includes(AUTH_ROUTES.logout.path))
        .flush({}, { status: 500, statusText: 'err' });
      await pending;

      expect(auth.isAuthenticated()).toBe(true);
    });
  });

  it('exposes the milestone, not a token claim, for the onboarding gate', async () => {
    signedInWith(jwt(10));
    const pending = auth.ensureFreshToken();
    http
      .expectOne((r) => r.url.includes(AUTH_ROUTES.refresh.path))
      .flush({ ...session(jwt(3600)), profile_status: 'new_user' });
    await pending;

    expect(auth.needsOnboarding()).toBe(true);
  });
});
