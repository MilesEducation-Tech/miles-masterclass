import { TestBed } from '@angular/core/testing';
import { CanMatchFn, Route, Router, UrlSegment, UrlTree, convertToParamMap } from '@angular/router';
import { signal, computed } from '@angular/core';
import { provideRouter } from '@angular/router';

import { AuthSession } from '../../services/auth-session/auth-session';
import { ProfileStatus } from '../../models/auth.model';
import { onboardingGuard } from './onboarding-guard';

describe('onboardingGuard', () => {
  let profileStatus: ReturnType<typeof signal<ProfileStatus | null>>;

  const run = (): boolean | UrlTree =>
    TestBed.runInInjectionContext(
      () =>
        (onboardingGuard as CanMatchFn)(
          {} as Route,
          [] as UrlSegment[],
          {
            queryParamMap: convertToParamMap({}),
          } as never,
        ) as boolean | UrlTree,
    );

  beforeEach(() => {
    profileStatus = signal<ProfileStatus | null>(null);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthSession,
          useValue: {
            profileStatus,
            // RULE 4: derived from the MILESTONE. The real service does the
            // same, and the point of this spec is that it never becomes a
            // token-claim read instead.
            needsOnboarding: computed(() => profileStatus() === 'new_user'),
          },
        },
      ],
    });
  });

  it('lets a signed-out visitor through — public pages are unaffected', () => {
    expect(run()).toBe(true);
  });

  it('sends a first-time learner to the profile form', () => {
    profileStatus.set('new_user');
    const result = run();
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/auth/profile');
  });

  it('lets a learner past once onboarding is done', () => {
    profileStatus.set('onboard_completed');
    expect(run()).toBe(true);
  });

  it('lets a fully completed profile past', () => {
    profileStatus.set('profile_completed');
    expect(run()).toBe(true);
  });

  /**
   * The regression this file exists for. `profile_status` and the token claim
   * `miles.onboarding_required` describe different facts AND have opposite
   * polarity, so swapping one for the other inverts this gate silently: every
   * onboarded user would be sent back to the form and every new user waved
   * through. Only `new_user` may redirect.
   */
  it('redirects on exactly one status and no other', () => {
    const statuses: (ProfileStatus | null)[] = [
      null,
      'new_user',
      'onboard_completed',
      'profile_completed',
    ];
    const redirected = statuses.filter((s) => {
      profileStatus.set(s);
      return run() !== true;
    });
    expect(redirected).toEqual(['new_user']);
  });
});
