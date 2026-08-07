import { Component } from '@angular/core';
import { Route, RouterOutlet } from '@angular/router';
import { Backward } from '../../shared/components/backward/backward';

@Component({
  selector: 'app-library',
  imports: [Backward, RouterOutlet],
  template: `
    <div class="container mx-auto pt-28 space-y-10">
      <app-backward />
      <router-outlet />
    </div>
  `,
  styles: ``,
})
export class Library {}

export const LibraryRoutes: Route[] = [
  {
    path: '',
    component: Library,
    children: [
      {
        path: 'instructor-library',
        loadComponent: () => import('./instructor/instructor').then((m) => m.Instructor),
      },
      { path: 'badge-library', loadComponent: () => import('./badge/badge').then((m) => m.Badge) },
      {
        path: 'course-library',
        loadComponent: () => import('./course/course').then((m) => m.Course),
      },
    ],
  },
];
