import { Route } from '@angular/router';
import { authGuard } from '@core/guards/auth/auth-guard';
import { CairaBadgesFacade } from './services/caira-badges-facade';

/**
 * The CAIRA tracker's routes.
 *
 * One `CairaBadgesFacade` on the parent, so the home page and both listings read a single
 * `badges/page/` response — navigating home → "View all" → home costs no request. Before
 * the 2026-10-13 rebind there was no facade at all and five components each owned a
 * resource; the comment that used to sit here said so.
 */
export const CairaTrackerRoutes: Route[] = [
  {
    path: '',
    providers: [CairaBadgesFacade],
    // Every surface here is the signed-in learner's own progress, and `badges/page/` is
    // `IsAuthenticated` — a signed-out visitor used to get a page shell and a 401. `canMatch`
    // rather than `canActivate` so the chunks are never downloaded by someone who cannot use
    // them, the same choice the webinar live route makes.
    canMatch: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/caira-tracker/caira-tracker').then((m) => m.CairaTracker),
      },
      {
        path: 'webinar-badges',
        loadComponent: () =>
          import('./pages/webinar-badges/webinar-badges').then((m) => m.WebinarBadges),
      },
      {
        path: 'course-badges',
        loadComponent: () =>
          import('./pages/course-badges/course-badges').then((m) => m.CourseBadges),
      },
    ],
  },
];
