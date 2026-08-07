import { Route } from '@angular/router';
import { activePlanGuard } from '../../shared/core/guards/active-plan/active-plan-guard';
import { authGuard } from '../../shared/core/guards/auth/auth-guard';

export const CpeTrackerRoutes: Route[] = [
  {
    path: '',
    // `authGuard` first so anonymous users hit the login redirect; only then
    // does `activePlanGuard` decide whether to gate on subscription status.
    canActivate: [authGuard, activePlanGuard],
    // ponytail: route-scoped facade providers removed with the Django strip.
    // Re-add `providers: [YourService]` here when the new backend lands.
    loadComponent: () => import('./cpe-tracker').then((m) => m.CpeTracker),
  },
];
