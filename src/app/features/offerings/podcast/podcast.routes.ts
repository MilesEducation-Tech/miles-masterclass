import { Route } from '@angular/router';
import { authGuard } from '@core/guards/auth/auth-guard';
import { FeedbackFacade } from '@features/offerings/services/feedback-facade';
import { ChapterFacade } from '@features/offerings/services/chapter-facade';
import { MasterclassFacade } from '@features/offerings/services/masterclass-facade';
import { Podcast } from '@features/offerings/podcast/pages/podcast/podcast';

/**
 * The landing and course pages are public. Everything a learner does inside a
 * course (chapters, feedback) needs a session, so those routes carry
 * `authGuard`: a visitor is sent to sign-in and back, and the page's chunk
 * never loads.
 */
export const podcastRoutes: Route[] = [
  { path: '', component: Podcast },
  {
    path: ':courseId/:courseTitle',
    // Podcast is the last user of the legacy `MasterclassFacade` (masterclass moved to
    // `CourseDetailFacade`). One instance for the course page and its chapters.
    providers: [MasterclassFacade],
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
      // No final-assessment routes: the exam and report pages are on the web API,
      // keyed by course UUID, which podcasts don't have yet. They return with the
      // podcast rebind.
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
