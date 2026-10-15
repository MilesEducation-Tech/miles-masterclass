import { Route } from '@angular/router';
import { authGuard } from '@core/guards/auth/auth-guard';

/**
 * The CAIRA tracker's routes.
 *
 * No `providers`: `CairaBadgesApi` is a root `@Service()`, so the home page and both listings
 * already share one `badges/page/` response — navigating between them costs no request, and
 * there is no route-scoped state whose lifetime needs pinning here.
 */
export const CairaTrackerRoutes: Route[] = [
  {
    path: '',
    // Every surface here is the signed-in learner's own progress, and `badges/page/` is
    // `IsAuthenticated` — a signed-out visitor used to get a page shell and a 401. `canMatch`
    // rather than `canActivate` so the chunks are never downloaded by someone who cannot use
    // them, the same choice the webinar live route makes.
    canMatch: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('@features/tracker/caira/pages/caira-tracker/caira-tracker').then(
            (m) => m.CairaTracker,
          ),
      },
      {
        path: 'webinar-badges',
        loadComponent: () =>
          import('@features/tracker/caira/pages/webinar-badges/webinar-badges').then(
            (m) => m.WebinarBadges,
          ),
      },
      {
        path: 'course-badges',
        loadComponent: () =>
          import('@features/tracker/caira/pages/course-badges/course-badges').then(
            (m) => m.CourseBadges,
          ),
      },
    ],
  },
];
