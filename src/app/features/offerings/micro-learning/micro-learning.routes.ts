import { Route } from '@angular/router';
import { authGuard } from '@core/guards/auth/auth-guard';
import { FeedbackFacade } from '@features/offerings/services/feedback-facade';
import { MicroLearningCourseFacade } from '@features/offerings/services/micro-learning-course-facade';
import { MicroLearning } from '@features/offerings/micro-learning/pages/micro-learning/micro-learning';

/**
 * The landing and course pages are public. The course page is also the reel
 * player, but it is that course's only page and guests could browse it in v3,
 * so it stays open. Feedback needs a session, so its route carries `authGuard`:
 * a visitor is sent to sign-in and back, and the page's chunk never loads.
 */
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
          import('@features/offerings/micro-learning/pages/micro-learning-course/micro-learning-course').then(
            (m) => m.MicroLearningCourse,
          ),
      },
      // No final-assessment routes: the exam and report pages are on the web API,
      // keyed by course UUID, which reels don't have yet. They return with the
      // micro-learning rebind.
      {
        path: 'feedback',
        canMatch: [authGuard],
        providers: [FeedbackFacade],
        loadComponent: () =>
          import('@features/offerings/pages/course-feedback/course-feedback').then(
            (m) => m.CourseFeedback,
          ),
      },
    ],
  },
];
