import { Route } from '@angular/router';
import { authGuard } from '@core/guards/auth/auth-guard';
import { FinalAssessmentFacade } from '@features/offerings/services/final-assessment-facade';
import { canDeactivateExamGuard } from '@core/guards/can-deactivate-exam-guard';
import { FeedbackFacade } from '@features/offerings/services/feedback-facade';
import { MicroLearningCourseFacade } from '@features/offerings/services/micro-learning-course-facade';
import { ChapterFacade } from '@features/offerings/services/chapter-facade';
import { MicroLearning } from '@features/offerings/micro-learning/pages/micro-learning/micro-learning';

/**
 * The landing and course pages are public. The course page is also the reel
 * player, but it is that course's only page and guests could browse it in v3,
 * so it stays open. The final assessment and feedback need a session, so those
 * routes carry `authGuard`: a visitor is sent to sign-in and back, and the
 * page's chunk never loads.
 */
export const microLearningRoutes: Route[] = [
  { path: '', component: MicroLearning },
  {
    path: ':courseId/:courseTitle',
    children: [
      {
        path: '',
        data: { layout: 'plain' },
        // ChapterFacade is route-scoped so the `ChapterQuiz` component
        // (opened via `MicroLearningQuizDialog`) can resolve it via `inject()`.
        providers: [MicroLearningCourseFacade, ChapterFacade],
        loadComponent: () =>
          import('@features/offerings/micro-learning/pages/micro-learning-course/micro-learning-course').then(
            (m) => m.MicroLearningCourse,
          ),
      },
      {
        path: 'final-assessment/:sessionId/exam',
        canMatch: [authGuard],
        providers: [FinalAssessmentFacade],
        canDeactivate: [canDeactivateExamGuard],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('@features/offerings/pages/final-assessment-exam/final-assessment-exam').then(
            (m) => m.FinalAssessmentExam,
          ),
      },
      {
        path: 'final-assessment/:sessionId/report',
        canMatch: [authGuard],
        providers: [FinalAssessmentFacade],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('@features/offerings/pages/final-assessment-report/final-assessment-report').then(
            (m) => m.FinalAssessmentReport,
          ),
      },
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
