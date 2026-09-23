import { Route } from '@angular/router';
import { canDeactivateExamGuard } from '@core/guards/can-deactivate-exam-guard';
import { FinalAssessmentFacade } from '../services/final-assessment-facade';
import { FeedbackFacade } from '../services/feedback-facade';
import { ChapterFacade } from '../services/chapter-facade';
import { Podcast } from './pages/podcast/podcast';

export const podcastRoutes: Route[] = [
  { path: '', component: Podcast },
  {
    path: ':courseId/:courseTitle',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/podcast-course/podcast-course').then((m) => m.PodcastCourse),
      },
      {
        path: 'chapter/:chapterId/:chapterTitle',
        providers: [ChapterFacade],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('./pages/podcast-chapter/podcast-chapter').then((m) => m.PodcastChapter),
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
