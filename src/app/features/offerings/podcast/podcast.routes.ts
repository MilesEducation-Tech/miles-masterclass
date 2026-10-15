import { Route } from '@angular/router';
import { authGuard } from '@core/guards/auth/auth-guard';
import { canDeactivateExamGuard } from '@core/guards/can-deactivate-exam-guard';
import { FinalAssessmentFacade } from '@features/offerings/services/final-assessment-facade';
import { FeedbackFacade } from '@features/offerings/services/feedback-facade';
import { ChapterFacade } from '@features/offerings/services/chapter-facade';
import { Podcast } from '@features/offerings/podcast/pages/podcast/podcast';

/**
 * The landing and course pages are public. Everything a learner does inside a
 * course (chapters, the final assessment, feedback) needs a session, so those
 * routes carry `authGuard`: a visitor is sent to sign-in and back, and the
 * page's chunk never loads.
 */
export const podcastRoutes: Route[] = [
  { path: '', component: Podcast },
  {
    path: ':courseId/:courseTitle',
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
        providers: [ChapterFacade],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('@features/offerings/podcast/pages/podcast-chapter/podcast-chapter').then(
            (m) => m.PodcastChapter,
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
