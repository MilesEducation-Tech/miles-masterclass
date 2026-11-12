import { Route } from '@angular/router';
import { authGuard } from '@core/guards/auth/auth-guard';
import { canDeactivateExamGuard } from '@core/guards/can-deactivate-exam-guard';
import { MasterclassRailFilter } from '@shared/services/masterclass-rail-filter';
import { CourseCertificateFacade } from '@features/offerings/services/course-certificate-facade';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';
import { CourseEvaluationFacade } from '@features/offerings/services/course-evaluation-facade';
import { FinalAssessmentFacade } from '@features/offerings/services/final-assessment-facade';
import { MasterclassLibraryFacade } from '@features/offerings/services/masterclass-library-facade';
import { MicroLearningCourseFacade } from '@features/offerings/services/micro-learning-course-facade';
import { MicroLearning } from '@features/offerings/micro-learning/pages/micro-learning/micro-learning';
import { COURSE_OFFERING_DATA_KEY } from '@features/offerings/utils/route-offering';

/**
 * The landing page and the reel player are public: a visitor sees the trailer
 * and a sign-in button. The steps after a reel (the final assessment, its
 * report, feedback) need a session, so those routes carry `authGuard`: a
 * visitor is sent to sign-in and back, and the page's chunk never loads.
 *
 * A reel is a one-chapter course on the web API, so its course tree is
 * podcast's: the same shared facades and the same exam, report and evaluation
 * pages. The reel's quiz opens over the player, not on a page of its own.
 */
export const microLearningRoutes: Route[] = [
  {
    path: '',
    component: MicroLearning,
    // The landing page's rows (connected to `reels`) and the rails' filter.
    providers: [MasterclassLibraryFacade, MasterclassRailFilter],
  },
  {
    path: ':courseId/:courseTitle',
    // The children inherit it (this route has no component): the shared exam, report
    // and evaluation pages connect `CourseDetailFacade` to `reels` through it, so
    // their links stay under `/micro-learning/`.
    data: { [COURSE_OFFERING_DATA_KEY]: 'reels' },
    // One instance for the player and the pages after it: the player connects the
    // course read to a reel when a step needs it (the quiz, the rules), the exam
    // and the report share the sitting, and the certificate follows the evaluation.
    providers: [
      CourseDetailFacade,
      FinalAssessmentFacade,
      CourseEvaluationFacade,
      CourseCertificateFacade,
    ],
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
      {
        path: 'final-assessment/:sessionId/exam',
        canMatch: [authGuard],
        canDeactivate: [canDeactivateExamGuard],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('@features/offerings/pages/final-assessment-exam/final-assessment-exam').then(
            (m) => m.FinalAssessmentExam,
          ),
      },
      {
        // The latest attempt, read by course: no session id in the URL.
        path: 'final-assessment/report',
        canMatch: [authGuard],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('@features/offerings/pages/final-assessment-report/final-assessment-report').then(
            (m) => m.FinalAssessmentReport,
          ),
      },
      {
        path: 'feedback',
        canMatch: [authGuard],
        loadComponent: () =>
          import('@features/offerings/pages/course-evaluation/course-evaluation').then(
            (m) => m.CourseEvaluation,
          ),
      },
    ],
  },
];
