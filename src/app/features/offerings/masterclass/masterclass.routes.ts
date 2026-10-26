import { Route } from '@angular/router';
import { authGuard } from '@core/guards/auth/auth-guard';
import { canDeactivateExamGuard } from '@core/guards/can-deactivate-exam-guard';
import { CourseCertificateFacade } from '@features/offerings/services/course-certificate-facade';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';
import { CourseEvaluationFacade } from '@features/offerings/services/course-evaluation-facade';
import { FinalAssessmentFacade } from '@features/offerings/services/final-assessment-facade';
import { Masterclass } from '@features/offerings/masterclass/pages/masterclass/masterclass';
import { MasterclassHighlightFacade } from '@features/offerings/masterclass/services/masterclass-highlight-facade';
import { MasterclassLibraryFacade } from '@features/offerings/masterclass/services/masterclass-library-facade';

/**
 * The landing and course pages are public. Everything a learner does inside a
 * course (chapters, the final assessment, feedback) needs a session, so those
 * routes carry `authGuard`: a visitor is sent to sign-in and back, and the
 * page's chunk never loads.
 */
export const masterclassRoutes: Route[] = [
  {
    path: '',
    component: Masterclass,
    providers: [MasterclassHighlightFacade, MasterclassLibraryFacade],
  },
  {
    path: ':courseId/:courseTitle',
    // One instance for the course page and its chapters, so Watch Now and moving
    // between chapters reuse the course read instead of fetching it again. The
    // final assessment sits beside it (the hero and the last chapter's quiz start
    // a sitting, and the exam page shows it), and so does the course evaluation
    // (the hero and the report open it, and the feedback page submits it), and
    // so does the certificate it triggers (the hero, the report and the
    // feedback page's thank-you view download it).
    providers: [
      CourseDetailFacade,
      FinalAssessmentFacade,
      CourseEvaluationFacade,
      CourseCertificateFacade,
    ],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('@features/offerings/masterclass/pages/masterclass-course/masterclass-course').then(
            (m) => m.MasterclassCourse,
          ),
      },
      {
        path: 'chapter/:chapterId/:chapterTitle',
        canMatch: [authGuard],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('@features/offerings/masterclass/pages/masterclass-chapter/masterclass-chapter').then(
            (m) => m.MasterclassChapter,
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
        // The course evaluation on the web API; podcast, micro-learning and
        // webinar keep the legacy `course-feedback` page until their own rebinds.
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
