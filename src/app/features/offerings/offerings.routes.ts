import { Route } from '@angular/router';

export const offeringsRoutes: Route[] = [
  { path: '', redirectTo: 'masterclass', pathMatch: 'full' },
  {
    path: 'masterclass',
    loadChildren: () => import('./masterclass/masterclass.routes').then((m) => m.masterclassRoutes),
  },
  {
    path: 'podcast',
    loadChildren: () => import('./podcast/podcast.routes').then((m) => m.podcastRoutes),
  },
  {
    path: 'webinar',
    loadChildren: () => import('./webinar/webinar.routes').then((m) => m.webinarRoutes),
  },
  {
    path: 'micro-learning',
    loadChildren: () =>
      import('./micro-learning/micro-learning.routes').then((m) => m.microLearningRoutes),
  },
];
