import { Route } from '@angular/router';
import { FinalAssessmentFacade } from '../services/final-assessment-facade';
import { canDeactivateExamGuard } from '@core/guards/can-deactivate-exam-guard';
import { FeedbackFacade } from '../services/feedback-facade';
import { MicroLearningCourseFacade } from '../services/micro-learning-course-facade';
import { ChapterFacade } from '../services/chapter-facade';
import { MicroLearning } from './pages/micro-learning/micro-learning';

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
          import('./pages/micro-learning-course/micro-learning-course').then(
            (m) => m.MicroLearningCourse,
          ),
      },
      {
        path: 'final-assessment/:sessionId/exam',
        providers: [FinalAssessmentFacade],
        canDeactivate: [canDeactivateExamGuard],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('../pages/final-assessment-exam/final-assessment-exam').then(
            (m) => m.FinalAssessmentExam,
          ),
      },
      {
        path: 'final-assessment/:sessionId/report',
        providers: [FinalAssessmentFacade],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('../pages/final-assessment-report/final-assessment-report').then(
            (m) => m.FinalAssessmentReport,
          ),
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
