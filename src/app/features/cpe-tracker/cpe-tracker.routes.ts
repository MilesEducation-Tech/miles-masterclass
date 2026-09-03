import { Route } from '@angular/router';
import { activePlanGuard } from '../../shared/core/guards/active-plan/active-plan-guard';
import { authGuard } from '../../shared/core/guards/auth/auth-guard';
import { CpeTrackerFacade } from './shared/services/cpe-tracker-facade/cpe-tracker-facade';

export const CpeTrackerRoutes: Route[] = [
  {
    path: '',
    // `authGuard` first so anonymous users hit the login redirect; only then
    // does `activePlanGuard` decide whether to gate on subscription status.
    canActivate: [authGuard, activePlanGuard],
    providers: [CpeTrackerFacade],
    loadComponent: () => import('./cpe-tracker').then((m) => m.CpeTracker),
  },
];
