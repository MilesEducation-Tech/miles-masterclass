import { Route } from '@angular/router';

/**
 * No `providers` here: every page and card owns its own `resource()`, so there
 * is no feature-scoped service whose lifetime needs pinning to this subtree.
 */
export const CairaTrackerRoutes: Route[] = [
  {
    path: '',
    children: [
      {
        path: '',
        loadComponent: () => import('./caira-tracker').then((m) => m.CairaTracker),
      },
      {
        path: 'webinar-badges',
        loadComponent: () => import('./webinar-badges/webinar-badges').then((m) => m.WebinarBadges),
      },
      {
        path: 'course-badges',
        loadComponent: () => import('./course-badges/course-badges').then((m) => m.CourseBadges),
      },
    ],
  },
];
