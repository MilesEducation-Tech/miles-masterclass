import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApplicationRef, computed, signal } from '@angular/core';

import { ACCOUNT_ROUTES } from '../../models/account.model';
import { AuthSession } from '../auth-session/auth-session';
import { AccountApi } from './account-api';

/** The contract's own `GET user-details/` example (§3.1), verbatim. */
const ENROLLED = {
  first_name: 'Sohan',
  full_name: 'Sohan Biswas',
  is_onboarding_completed: true,
  is_profile_completed: true,
  Pathway: 'Yes',
  Enrolled_status: 'Yes',
  Enrolled_course: ['US CPA'],
  onboarding_fully_completed: true,
};

describe('AccountApi', () => {
  let backend: HttpTestingController;
  let accessToken: ReturnType<typeof signal<string>>;
  let setMilestones: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    accessToken = signal('');
    setMilestones = vi.fn();

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
            setMilestones,
          },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  const matchUser = () => backend.match((r) => r.url.includes(ACCOUNT_ROUTES.userDetails.path));

  /** Sign in and let the resource settle on `body`. */
  async function signInWith(body: object): Promise<AccountApi> {
    const api = TestBed.inject(AccountApi);
    void api.user.value();
    accessToken.set('token-1');
    TestBed.tick();
    matchUser()[0].flush(body);
    await TestBed.inject(ApplicationRef).whenStable();
    return api;
  }

  it('sends nothing at all while signed out', () => {
    const api = TestBed.inject(AccountApi);
    // Touch the resources so they would fetch if they were going to.
    void api.user.value();
    TestBed.tick();

    backend.expectNone(() => true);
    expect(api.user.isLoading()).toBe(false);
  });

  it('fetches the user record from user-details/ (hyphen) once signed in', () => {
    const api = TestBed.inject(AccountApi);
    void api.user.value();

    accessToken.set('token-1');
    TestBed.tick();

    const [req] = matchUser();
    expect(req.request.url).toContain('api/v1/account/user-details/');
    expect(req.request.method).toBe('GET');
    req.flush(ENROLLED);
  });

  it('pushes the stored milestones into the session', async () => {
    const api = await signInWith(ENROLLED);

    expect(api.user.value()).toEqual(ENROLLED);
    expect(setMilestones).toHaveBeenCalledWith(true, true);
  });

  // The contract's degraded 200: an enrolment lookup failure answers "No",
  // never a 500. It is a valid body, not an error.
  it('accepts the conservative fallback payload', async () => {
    const api = await signInWith({
      ...ENROLLED,
      is_onboarding_completed: false,
      is_profile_completed: false,
      Pathway: 'No',
      Enrolled_status: 'No',
      Enrolled_course: [],
      onboarding_fully_completed: false,
    });

    expect(api.user.hasValue()).toBe(true);
    expect(setMilestones).toHaveBeenCalledWith(false, false);
  });

  // A renamed or retyped key must fail HERE, once — not render `undefined`.
  it.each([
    ['the deleted 28-field row', { id: 'uuid', email: 'a@b.c', first_name: 'A', last_name: 'B' }],
    ['a boolean Pathway', { ...ENROLLED, Pathway: true }],
    ['a missing full_name', { ...ENROLLED, full_name: undefined }],
  ])('puts %s into error() rather than a value', async (_, body) => {
    const api = await signInWith(body);

    expect(api.user.hasValue()).toBe(false);
    expect(api.user.error()).toBeTruthy();
    expect(setMilestones).not.toHaveBeenCalled();
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
    first[0].flush(ENROLLED);

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
    matchUser()[0].flush(ENROLLED);

    accessToken.set('');
    TestBed.tick();

    backend.expectNone(() => true);
    expect(api.user.hasValue()).toBe(false);
  });
});
