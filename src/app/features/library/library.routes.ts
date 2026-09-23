import { Route } from '@angular/router';
import { Library } from './library';

export const LibraryRoutes: Route[] = [
  {
    path: '',
    component: Library,
    children: [
      {
        path: 'instructor-library',
        loadComponent: () =>
          import('./instructor/pages/instructor/instructor').then((m) => m.Instructor),
      },
      {
        path: 'badge-library',
        loadComponent: () => import('./badge/pages/badge/badge').then((m) => m.Badge),
      },
      {
        path: 'course-library',
        loadComponent: () => import('./course/pages/course/course').then((m) => m.Course),
      },
    ],
  },
];
