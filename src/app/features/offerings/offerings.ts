import { Route } from '@angular/router';

export const offeringsRoutes: Route[] = [
  { path: '', redirectTo: 'masterclass', pathMatch: 'full' },
  {
    path: 'masterclass',
    loadChildren: () => import('./masterclass/masterclass').then((m) => m.masterclassRoutes),
  },
  { path: 'podcast', loadChildren: () => import('./podcast/podcast').then((m) => m.podcastRoutes) },
  { path: 'webinar', loadChildren: () => import('./webinar/webinar').then((m) => m.webinarRoutes) },
  {
    path: 'micro-learning',
    loadChildren: () =>
      import('./micro-learning/micro-learning').then((m) => m.microLearningRoutes),
  },
];
