import { Route } from '@angular/router';
import { authGuard } from '@core/guards/auth/auth-guard';

/**
 * No `providers`: `CpeTrackerFacade` is gone — the page owns its two reads directly, so there is
 * no feature-scoped state to pin here.
 */
export const CpeTrackerRoutes: Route[] = [
  {
    path: '',
    // The portfolio is the signed-in learner's own credits, and every `cpe-tracker/` route is
    // `IsAuthenticated` — without this a signed-out visitor gets a page shell and two 401s.
    // `canMatch` rather than `canActivate`, so the chunk is never downloaded by someone who
    // cannot use it; the same choice the CAIRA tracker makes.
    canMatch: [authGuard],
    loadComponent: () => import('./pages/cpe-tracker/cpe-tracker').then((m) => m.CpeTracker),
  },
];
