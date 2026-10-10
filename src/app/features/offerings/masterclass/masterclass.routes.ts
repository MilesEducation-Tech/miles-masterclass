import { Route } from '@angular/router';
import { ChapterFacade } from '@features/offerings/services/chapter-facade';
import { FinalAssessmentFacade } from '@features/offerings/services/final-assessment-facade';
import { canDeactivateExamGuard } from '@core/guards/can-deactivate-exam-guard';
import { FeedbackFacade } from '@features/offerings/services/feedback-facade';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';
import { Masterclass } from '@features/offerings/masterclass/pages/masterclass/masterclass';

export const masterclassRoutes: Route[] = [
  { path: '', component: Masterclass },
  {
    path: ':courseId/:courseTitle',
    children: [
      {
        path: '',
        providers: [CourseDetailFacade],
        loadComponent: () =>
          import('@features/offerings/masterclass/pages/masterclass-course/masterclass-course').then(
            (m) => m.MasterclassCourse,
          ),
      },
      {
        path: 'chapter/:chapterId/:chapterTitle',
        providers: [ChapterFacade],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('@features/offerings/masterclass/pages/masterclass-chapter/masterclass-chapter').then(
            (m) => m.MasterclassChapter,
          ),
      },
      {
        path: 'final-assessment/:sessionId/exam',
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
        providers: [FinalAssessmentFacade],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('@features/offerings/pages/final-assessment-report/final-assessment-report').then(
            (m) => m.FinalAssessmentReport,
          ),
      },
      {
        path: 'feedback',
        providers: [FeedbackFacade],
        loadComponent: () =>
          import('@features/offerings/pages/course-feedback/course-feedback').then(
            (m) => m.CourseFeedback,
          ),
      },
    ],
  },
];
