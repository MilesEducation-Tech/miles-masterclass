import { Route } from '@angular/router';
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
      // No final-assessment routes: the exam and report pages are on the web API,
      // keyed by course UUID, which podcasts don't have yet. They return with the
      // podcast rebind.
      {
        path: 'feedback',
        providers: [FeedbackFacade],
        loadComponent: () =>
          import('../pages/course-feedback/course-feedback').then((m) => m.CourseFeedback),
      },
    ],
  },
];
