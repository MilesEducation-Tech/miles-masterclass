import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';

import { activePlanGuard } from './active-plan-guard';
import { Auth } from '../../services/auth/auth';
import { NotificationService } from '../../services/notification/notification';
import { CurrentPlanData } from '../../models/auth.model';

describe('activePlanGuard', () => {
  let currentPlan: CurrentPlanData | null;
  let cookieActive: boolean;
  let notificationInfo: ReturnType<typeof vi.fn>;
  let createUrlTree: ReturnType<typeof vi.fn>;
  const redirectTree = {} as UrlTree;

  const executeGuard: CanActivateFn = (...params) =>
    TestBed.runInInjectionContext(() => activePlanGuard(...params));

  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/cpe-tracker' } as RouterStateSnapshot;

  const planWithStatus = (status: string): CurrentPlanData =>
    ({ subscription_status: status }) as unknown as CurrentPlanData;

  beforeEach(() => {
    currentPlan = null;
    cookieActive = false;
    notificationInfo = vi.fn();
    createUrlTree = vi.fn(() => redirectTree);

    const authMock = {
      currentPlan: () => currentPlan,
      isPlanActive: (plan: CurrentPlanData | null) =>
        plan?.subscription_status?.toLowerCase() === 'active',
      hasActivePlanFromCookie: () => cookieActive,
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: authMock },
        { provide: Router, useValue: { createUrlTree } },
        { provide: NotificationService, useValue: { info: notificationInfo } },
      ],
    });
  });

  it('allows navigation when the live plan signal is active', () => {
    currentPlan = planWithStatus('ACTIVE');
    expect(executeGuard(route, state)).toBe(true);
    expect(notificationInfo).not.toHaveBeenCalled();
  });

  it('falls back to the cookie when the signal is not yet hydrated (hard refresh)', () => {
    currentPlan = null;
    cookieActive = true;
    expect(executeGuard(route, state)).toBe(true);
    expect(notificationInfo).not.toHaveBeenCalled();
  });

  it('redirects when neither the signal nor the cookie reports an active plan', () => {
    currentPlan = null;
    cookieActive = false;
    expect(executeGuard(route, state)).toBe(redirectTree);
    expect(notificationInfo).toHaveBeenCalled();
  });

  it('does not fall back to the cookie when the hydrated signal is inactive', () => {
    currentPlan = planWithStatus('EXPIRED');
    cookieActive = true;
    expect(executeGuard(route, state)).toBe(redirectTree);
  });
});
