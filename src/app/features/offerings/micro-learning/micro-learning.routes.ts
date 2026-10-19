import { Route } from '@angular/router';
import { FeedbackFacade } from '../services/feedback-facade';
import { MicroLearningCourseFacade } from '../services/micro-learning-course-facade';
import { MicroLearning } from './pages/micro-learning/micro-learning';

export const microLearningRoutes: Route[] = [
  { path: '', component: MicroLearning },
  {
    path: ':courseId/:courseTitle',
    children: [
      {
        path: '',
        data: { layout: 'plain' },
        providers: [MicroLearningCourseFacade],
        loadComponent: () =>
          import('./pages/micro-learning-course/micro-learning-course').then(
            (m) => m.MicroLearningCourse,
          ),
      },
      // No final-assessment routes: the exam and report pages are on the web API,
      // keyed by course UUID, which reels don't have yet. They return with the
      // micro-learning rebind.
      {
        path: 'feedback',
        providers: [FeedbackFacade],
        loadComponent: () =>
          import('../pages/course-feedback/course-feedback').then((m) => m.CourseFeedback),
      },
    ],
  },
];
