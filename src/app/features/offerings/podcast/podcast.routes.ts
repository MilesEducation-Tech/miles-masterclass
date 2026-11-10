import { Route } from '@angular/router';
import { authGuard } from '@core/guards/auth/auth-guard';
import { canDeactivateExamGuard } from '@core/guards/can-deactivate-exam-guard';
import { MasterclassRailFilter } from '@shared/services/masterclass-rail-filter';
import { CourseCertificateFacade } from '@features/offerings/services/course-certificate-facade';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';
import { CourseEvaluationFacade } from '@features/offerings/services/course-evaluation-facade';
import { FinalAssessmentFacade } from '@features/offerings/services/final-assessment-facade';
import { MasterclassLibraryFacade } from '@features/offerings/services/masterclass-library-facade';
import { Podcast } from '@features/offerings/podcast/pages/podcast/podcast';
import { COURSE_OFFERING_DATA_KEY } from '@features/offerings/utils/route-offering';

/**
 * The landing and course pages are public. Everything a learner does inside a
 * course (chapters, the final assessment, feedback) needs a session, so those
 * routes carry `authGuard`: a visitor is sent to sign-in and back, and the
 * page's chunk never loads.
 *
 * A podcast is a course on the web API, so its course tree is masterclass's:
 * the same shared facades and the same exam, report and evaluation pages.
 */
export const podcastRoutes: Route[] = [
  {
    path: '',
    component: Podcast,
    // The landing page's rows (connected to `podcast`) and the rails' filter.
    providers: [MasterclassLibraryFacade, MasterclassRailFilter],
  },
  {
    path: ':courseId/:courseTitle',
    // The children inherit it (this route has no component): the shared exam, report
    // and evaluation pages connect `CourseDetailFacade` to `podcast` through it.
    data: { [COURSE_OFFERING_DATA_KEY]: 'podcast' },
    // One instance for the course page and its chapters, so Watch Now and moving
    // between chapters reuse the course read. The final assessment, the course
    // evaluation and the certificate sit beside it, as on masterclass: the hero
    // and the last chapter's quiz start a sitting, the report and the feedback
    // page share it, and the certificate follows the evaluation.
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
          import('@features/offerings/podcast/pages/podcast-course/podcast-course').then(
            (m) => m.PodcastCourse,
          ),
      },
      {
        path: 'chapter/:chapterId/:chapterTitle',
        canMatch: [authGuard],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('@features/offerings/podcast/pages/podcast-chapter/podcast-chapter').then(
            (m) => m.PodcastChapter,
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
