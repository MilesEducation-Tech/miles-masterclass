import { Route } from '@angular/router';
import { FeedbackFacade } from '../services/feedback-facade';
import { Webinar } from './pages/webinar/webinar';

export const webinarRoutes: Route[] = [
  {
    path: '',
    component: Webinar,
  },
  {
    path: ':courseId/:courseTitle',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/webinar-course/webinar-course').then((m) => m.WebinarCourse),
      },
      {
        path: 'feedback',
        providers: [FeedbackFacade],
        loadComponent: () =>
          import('../pages/course-feedback/course-feedback').then((m) => m.CourseFeedback),
      },
    ],
  },
];
