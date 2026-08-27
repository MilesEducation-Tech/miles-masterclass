import { Component, computed, signal } from '@angular/core';
import { Route } from '@angular/router';
import { Carousel } from '../../../shared/components/carousel/carousel';
import { environment } from '../../../../environments/environment';
import {
  swiperConfigComingSoon,
  swiperConfigPodcast,
} from '../../../shared/core/config/swiper.config';
import { Square } from '../../../shared/components/cards/square/square';
import { PodcastHero } from './shared/components/podcast-hero/podcast-hero';
import { ComingSoon } from '../../../shared/components/cards/coming-soon/coming-soon';
import { authGuard } from '../../../shared/core/guards/auth/auth-guard';
import { canDeactivateExamGuard } from '../../../shared/core/guards/can-deactivate-exam-guard';
import { Faq } from '../../../pages/faq/faq';
import { PartnerContentList } from '../../partners/shared/components/partner-content-list/partner-content-list';
import { CourseDetail } from '../shared/services/course-detail/course-detail';
import { Feedback } from '../shared/services/feedback/feedback';
import { ChapterProgress } from '../shared/services/chapter-progress/chapter-progress';

@Component({
  selector: 'app-podcast',
  imports: [Carousel, Square, ComingSoon, PodcastHero, Faq, PartnerContentList],
  templateUrl: './podcast.html',
  styleUrl: './podcast.css',
  host: {
    class: '',
  },
})
export class Podcast {
  S3_BUCKET_URL = environment.S3_BUCKET_URL;
  // ponytail: FeatureFacade was deleted with the Django strip. This placeholder
  // keeps the template bindings compiling and renders the empty state.
  // Swap in the new backend's service — the template needs no changes.
  readonly feature: any = {
    getResource: (..._args: any[]): any => ({
      items: signal<any[]>([]),
      isLoading: signal(false),
      hasMore: signal(false),
      error: signal(null),
      loadNextPage: () => undefined,
      loadNextTrackPage: () => undefined,
      setFilters: () => undefined,
      setTrackFilters: () => undefined,
      webp: signal(null),
    }),
  };

  // Swiper configurations for templates
  readonly swiperConfigPodcast = swiperConfigPodcast;
  readonly swiperConfigComingSoon = swiperConfigComingSoon;

  filterConfig = {
    filterEnabled: true,
  };

  readonly popular = this.feature.getResource('popular', 'podcast');
  readonly inprogress = this.feature.getResource('inprogress', 'podcast', {
    requiresAuth: true,
  });
  readonly recommended = this.feature.getResource('recommended', 'podcast', {
    requiresAuth: true,
  });
  readonly complimentary = this.feature.getResource('complimentary', 'podcast', {
    requiresAuth: true,
  });
  readonly becauseYouWatched = this.feature.getResource('becauseYouWatched', 'podcast', {
    requiresAuth: true,
  });
  readonly track = this.feature.getResource('track', 'podcast');
  readonly bookmark = this.feature.getResource('bookmark', 'podcast', { requiresAuth: true });
  readonly completed = this.feature.getResource('completed', 'podcast', { requiresAuth: true });
  readonly comingSoon = this.feature.getResource('comingSoon', 'podcast');

  readonly complimentaryHeading = computed(() => {
    const meta = this.complimentary.metadata();
    const details = meta?.['details'] as { company_name?: string } | undefined;
    const companyName = details?.company_name;
    return companyName
      ? `Complimentary Courses for ${companyName} Employees`
      : 'Complimentary Courses';
  });

  readonly becauseYouWatchedHeading = computed(() => {
    const meta = this.becauseYouWatched.metadata();
    const watchedCourse = meta?.['watched_course'] as { title?: string } | undefined;
    const courseTitle = watchedCourse?.title;
    return courseTitle ? `Because You Watched ${courseTitle}` : 'Because You Watched';
  });
}

export const podcastRoutes: Route[] = [
  { path: '', component: Podcast },
  {
    path: ':courseId/:courseTitle',
    // Same route-scoped `CourseDetail` the masterclass tree uses — CAIRA serves
    // podcasts from `Masterclass_Course_Detail` too.
    providers: [CourseDetail],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./shared/pages/podcast-course/podcast-course').then((m) => m.PodcastCourse),
      },
      {
        path: 'chapter/:chapterId/:chapterTitle',
        canActivate: [authGuard],
        // Route-scoped: the chapter player's #6 / #18 writes. `CourseDetail`
        // is provided one level up and supplies the chapter list, so this only
        // owns progress.
        providers: [ChapterProgress],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('./shared/pages/podcast-chapter/podcast-chapter').then((m) => m.PodcastChapter),
      },
      {
        path: 'final-assessment/exam',
        canActivate: [authGuard],
        // ponytail: route-scoped facade providers removed with the Django strip.
        // Re-add `providers: [YourService]` here when the new backend lands.
        canDeactivate: [canDeactivateExamGuard],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('../shared/pages/final-assessment-exam/final-assessment-exam').then(
            (m) => m.FinalAssessmentExam,
          ),
      },
      {
        path: 'final-assessment/report',
        canActivate: [authGuard],
        // ponytail: route-scoped facade providers removed with the Django strip.
        // Re-add `providers: [YourService]` here when the new backend lands.
        data: { layout: 'plain' },
        loadComponent: () =>
          import('../shared/pages/final-assessment-report/final-assessment-report').then(
            (m) => m.FinalAssessmentReport,
          ),
      },
      {
        path: 'feedback',
        canActivate: [authGuard],
        // #12 / #13, scoped to this route. `CourseDetail` is provided one level
        // up, so `Feedback` reaches the same instance and re-reads nothing.
        providers: [Feedback],
        loadComponent: () =>
          import('../shared/pages/course-feedback/course-feedback').then((m) => m.CourseFeedback),
      },
    ],
  },
];
