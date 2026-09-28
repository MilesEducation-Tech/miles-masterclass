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

    // The collection documents 502/503 as transient and keeps the tokens on
    // any non-200 but 401. Clearing here signed learners out on a blip.
    it.each([
      [502, { message: 'Sign-in is temporarily unavailable. Please try again.' }],
      [503, { message: 'Sign-in is not configured on this environment.' }],
    ])('keeps the session when the refresh answers a transient %s', async (status, body) => {
      signedInWith(jwt(10));
      const pending = auth.ensureFreshToken();
      http
        .expectOne((r) => r.url.includes(AUTH_ROUTES.refresh.path))
        .flush(body, { status, statusText: 'x' });
      await pending;

      expect(auth.isAuthenticated()).toBe(true);
      expect(cookies[environment.AUTH.refreshToken]).toBe('refresh-1');
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

  // The status cookie was renamed from USER_DATA, which read as if the user
  // record lived there. An older build's copy must not outlive the rename.
  describe('profile status cookie', () => {
    it('writes PROFILE_STATUS and removes a legacy USER_DATA on store', async () => {
      cookies['USER_DATA'] = 'new_user';
      signedInWith(jwt(10));
      const pending = auth.ensureFreshToken();
      http.expectOne((r) => r.url.includes(AUTH_ROUTES.refresh.path)).flush(session(jwt(3600)));
      await pending;

      expect(cookies['PROFILE_STATUS']).toBe('profile_completed');
      expect(cookies['USER_DATA']).toBeUndefined();
    });

    it('ignores a legacy USER_DATA and deletes it on load', () => {
      cookies['USER_DATA'] = 'profile_completed';
      signedInWith(jwt(3600));
      expect(auth.profileStatus()).toBeNull();
      expect(cookies['USER_DATA']).toBeUndefined();
    });

    it('removes both names on logout', async () => {
      cookies['PROFILE_STATUS'] = 'new_user';
      cookies['USER_DATA'] = 'new_user';
      signedInWith(jwt(3600));
      expect(auth.profileStatus()).toBe('new_user');

      const pending = auth.logout();
      http.expectOne((r) => r.url.includes(AUTH_ROUTES.logout.path)).flush({});
      await pending;

      expect(cookies['PROFILE_STATUS']).toBeUndefined();
      expect(cookies['USER_DATA']).toBeUndefined();
    });
  });

  describe('logout', () => {
    it('clears the session and resolves true when the SSO confirms it', async () => {
      signedInWith(jwt(3600));
      const pending = auth.logout();
      http.expectOne((r) => r.url.includes(AUTH_ROUTES.logout.path)).flush({});

      expect(await pending).toBe(true);
      expect(auth.isAuthenticated()).toBe(false);
    });

    // With the bearer attached, a 401 means our token no longer resolves
    // upstream: there is no live session left to protect, and keeping the
    // tokens would strand the learner signed in.
    it('clears the session on a 401', async () => {
      signedInWith(jwt(3600));
      const pending = auth.logout();
      http
        .expectOne((r) => r.url.includes(AUTH_ROUTES.logout.path))
        .flush(
          { message: 'Authorization header with a Bearer token is required.' },
          { status: 401, statusText: 'Unauthorized' },
        );

      expect(await pending).toBe(true);
      expect(auth.isAuthenticated()).toBe(false);
    });

    // A logout that failed leaves a session still live at the SSO. Blanking the
    // tokens would hide that behind a UI that merely looks signed out.
    it.each([502, 503, 500])('KEEPS the session and resolves false on a %s', async (status) => {
      signedInWith(jwt(3600));
      const pending = auth.logout();
      http
        .expectOne((r) => r.url.includes(AUTH_ROUTES.logout.path))
        .flush(
          { message: 'Sign-in is temporarily unavailable. Please try again.' },
          {
            status,
            statusText: 'err',
          },
        );

      expect(await pending).toBe(false);
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

  /**
   * `is_onboarding_completed` from `user-details/` is the ONLY access
   * restriction taken off that row, and the gate must distinguish "not
   * completed" from "nobody has said yet" — an unknown that redirected would
   * bounce every learner whose `PROFILE_STATUS` cookie went missing back into an
   * onboarding they finished long ago.
   */
  describe('the onboarding gate', () => {
    it('does not redirect while the milestone is unknown', () => {
      signedInWith(jwt(3600)); // no PROFILE_STATUS cookie: status is null
      expect(auth.isOnboardingCompleted()).toBeNull();
      expect(auth.needsOnboarding()).toBe(false);
    });

    it('redirects on a known-false and lets a known-true through', () => {
      signedInWith(jwt(3600));

      auth.setMilestones(false, false);
      expect(auth.needsOnboarding()).toBe(true);

      auth.setMilestones(true, false);
      expect(auth.needsOnboarding()).toBe(false);
      // Carried for later use; nothing gates on it today.
      expect(auth.isProfileCompleted()).toBe(false);
    });

    it('never redirects a signed-out visitor', () => {
      auth = TestBed.inject(AuthSession);
      auth.setMilestones(false, false);
      expect(auth.needsOnboarding()).toBe(false);
    });
  });
});
