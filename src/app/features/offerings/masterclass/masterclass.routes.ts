import { Route } from '@angular/router';
import { ChapterFacade } from '../services/chapter-facade';
import { FinalAssessmentFacade } from '../services/final-assessment-facade';
import { canDeactivateExamGuard } from '@core/guards/can-deactivate-exam-guard';
import { FeedbackFacade } from '../services/feedback-facade';
import { Masterclass } from './pages/masterclass/masterclass';

export const masterclassRoutes: Route[] = [
  { path: '', component: Masterclass },
  {
    path: ':courseId/:courseTitle',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/masterclass-course/masterclass-course').then((m) => m.MasterclassCourse),
      },
      {
        path: 'chapter/:chapterId/:chapterTitle',
        providers: [ChapterFacade],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('./pages/masterclass-chapter/masterclass-chapter').then(
            (m) => m.MasterclassChapter,
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
