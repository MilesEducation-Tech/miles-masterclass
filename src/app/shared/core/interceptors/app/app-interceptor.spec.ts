import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AUTH_ROUTES } from '../../models/auth.model';
import { IS_ADMIN_REQUEST, IS_EXTERNAL_REQUEST, SKIP_AUTH_TOKEN } from '../../models/http.model';
import { AuthSession } from '../../services/auth-session/auth-session';
import { appInterceptor } from './app-interceptor';

describe('appInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let ensureFreshToken: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ensureFreshToken = vi.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([appInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthSession,
          useValue: { accessToken: () => 'token-123', ensureFreshToken },
        },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  async function send(url: string, context?: HttpContext) {
    const done = new Promise<void>((resolve) =>
      http.get(url, { context }).subscribe(() => resolve()),
    );
    // The bearer path awaits `ensureFreshToken`, so the request is issued on a
    // microtask rather than synchronously.
    await Promise.resolve();
    await Promise.resolve();
    const req = backend.expectOne(url);
    req.flush({});
    await done;
    return req;
  }

  it('attaches the bearer and rotates first', async () => {
    const req = await send('/api/v1/account/user_details/');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-123');
    // Rule 2: rotate BEFORE the request, never as a retry after a 401/403.
    expect(ensureFreshToken).toHaveBeenCalledTimes(1);
  });

  // Verified live: MilesCAIRA's Access-Control-Allow-Headers lists none of
  // these three, so sending any of them fails every preflighted request.
  it('sends none of the retired x-* app headers', async () => {
    const req = await send('/api/v1/account/user_details/');
    expect(req.request.headers.get('x-app-type')).toBeNull();
    expect(req.request.headers.get('x-platform')).toBeNull();
    expect(req.request.headers.get('x-country-code')).toBeNull();
  });

  describe('skips', () => {
    it('every auth route — refreshing before the call that mints the session is nonsense', async () => {
      for (const route of Object.values(AUTH_ROUTES)) {
        const sent = await send(`https://api.example.com/${route.path}`);
        expect(sent.request.headers.has('Authorization')).toBe(false);
      }
      expect(ensureFreshToken).not.toHaveBeenCalled();
    });

    it('a request that opted out with SKIP_AUTH_TOKEN', async () => {
      const req = await send('/open/', new HttpContext().set(SKIP_AUTH_TOKEN, true));
      expect(req.request.headers.has('Authorization')).toBe(false);
      expect(ensureFreshToken).not.toHaveBeenCalled();
    });

    it('an admin request, which carries a different identity provider’s token', async () => {
      const req = await send('/reports/', new HttpContext().set(IS_ADMIN_REQUEST, true));
      expect(req.request.headers.has('Authorization')).toBe(false);
    });

    // A foreign origin must never receive this platform's bearer.
    it('a third-party origin entirely', async () => {
      const done = new Promise<void>((resolve) =>
        http
          .get('https://third-party.example.com/x', {
            context: new HttpContext().set(IS_EXTERNAL_REQUEST, true),
          })
          .subscribe(() => resolve()),
      );
      const req = backend.expectOne('https://third-party.example.com/x');
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({});
      await done;
      expect(ensureFreshToken).not.toHaveBeenCalled();
    });
  });
});
