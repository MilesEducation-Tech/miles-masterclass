import { Route } from '@angular/router';

/**
 * No `providers`: `CpeTrackerFacade` is gone — the page owns its two v2
 * resources directly, so there is no feature-scoped state to pin here.
 */
export const CpeTrackerRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./pages/cpe-tracker/cpe-tracker').then((m) => m.CpeTracker),
  },
];
