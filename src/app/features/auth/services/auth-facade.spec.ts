import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { effect } from '@angular/core';
import { provideRouter } from '@angular/router';

import { AUTH_ROUTES } from '@core/models/auth.model';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { AuthFacade } from './auth-facade';

/**
 * The identify prefetch. `auth-identify/` fires as soon as the identifier
 * validates, debounced — so these assertions are about WHEN a request is made,
 * not about what comes back.
 */
describe('AuthFacade — identify on valid input', () => {
  let facade: AuthFacade;
  let http: HttpTestingController;

  const identifyRequests = () => http.match((r) => r.url.includes(AUTH_ROUTES.identify.path));

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthSession, useValue: { identify: vi.fn(), verifyOtp: vi.fn() } },
        AuthFacade,
      ],
    });
    facade = TestBed.inject(AuthFacade);
    http = TestBed.inject(HttpTestingController);

    // The async validator is lazy until something observes form validity. In
    // the app that is the submit button's `[disabled]` binding; here it is this.
    TestBed.runInInjectionContext(() => effect(() => facade.loginForm().valid()));
    TestBed.tick();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Type a value and let Angular settle, without letting the debounce elapse. */
  function type(identifier: string): void {
    facade.selectLoginMethod('Email');
    facade.authModel.update((m) => ({ ...m, identifier }));
    TestBed.tick();
  }

  /** Async so the resource's own promise chain flushes, not just the timer. */
  async function letDebounceElapse(): Promise<void> {
    await vi.advanceTimersByTimeAsync(600);
    TestBed.tick();
  }

  it('sends nothing while the identifier is still invalid', async () => {
    type('sohan@');
    await letDebounceElapse();
    expect(identifyRequests()).toHaveLength(0);
  });

  it('sends nothing before the debounce elapses', async () => {
    type('sohan.biswas@mileseducation.com');
    expect(identifyRequests()).toHaveLength(0);
  });

  it('sends exactly one request once the identifier settles', async () => {
    type('sohan.biswas@mileseducation.com');
    await letDebounceElapse();

    const requests = identifyRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0].request.method).toBe('POST');
    // §1.4 rejects undeclared keys, so the body carries `identifier` and nothing else.
    expect(requests[0].request.body).toEqual({
      identifier: 'sohan.biswas@mileseducation.com',
    });
  });

  /**
   * Each of these is a legal address on its own. Without the debounce every one
   * of them would be its own request.
   */
  it('coalesces a burst of valid values into one request', async () => {
    for (const value of ['a@b.co', 'a@b.com', 'a@bc.com', 'sohan.biswas@mileseducation.com']) {
      type(value);
      await vi.advanceTimersByTimeAsync(120);
      TestBed.tick();
    }
    expect(identifyRequests()).toHaveLength(0);

    await letDebounceElapse();
    const requests = identifyRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0].request.body).toEqual({
      identifier: 'sohan.biswas@mileseducation.com',
    });
  });

  it('does not re-fire while the identifier sits unchanged', async () => {
    type('sohan.biswas@mileseducation.com');
    await letDebounceElapse();
    identifyRequests().forEach((r) =>
      r.flush({ methods: ['email_otp'], defaultMethod: 'email_otp' }),
    );

    await letDebounceElapse();
    expect(identifyRequests()).toHaveLength(0);
  });

  it('asks nothing once the field is cleared', async () => {
    type('sohan.biswas@mileseducation.com');
    await letDebounceElapse();
    identifyRequests().forEach((r) =>
      r.flush({ methods: ['email_otp'], defaultMethod: 'email_otp' }),
    );

    type('');
    await letDebounceElapse();
    expect(identifyRequests()).toHaveLength(0);
  });

  /**
   * The SSO-only case is a validation error on the field now, not a bespoke
   * banner — so the form itself refuses the submit.
   */
  it('marks the field invalid when the account has no OTP method', async () => {
    type('someone@enterprise.example');
    await letDebounceElapse();
    identifyRequests().forEach((r) => r.flush({ methods: ['saml'], defaultMethod: 'saml' }));
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();

    expect(facade.loginForm.identifier().invalid()).toBe(true);
    expect(facade.loginForm().invalid()).toBe(true);
  });

  it('leaves the field usable for an account that does have one', async () => {
    type('sohan.biswas@mileseducation.com');
    await letDebounceElapse();
    identifyRequests().forEach((r) =>
      r.flush({ methods: ['email_otp', 'password'], defaultMethod: 'email_otp' }),
    );
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();

    expect(facade.loginForm.identifier().invalid()).toBe(false);
  });

  /**
   * A background call must never put an error under a field the user is still
   * typing in — `submitLogin` owns error reporting.
   */
  it('renders no error when the prefetch fails', async () => {
    type('sohan.biswas@mileseducation.com');
    await letDebounceElapse();
    identifyRequests().forEach((r) =>
      r.flush({ message: 'Sign-in is not configured.' }, { status: 503, statusText: 'x' }),
    );
    TestBed.tick();

    expect(facade.error()).toBeNull();
    // ...and it must not block the send either.
    expect(facade.loginForm.identifier().invalid()).toBe(false);
  });
});
