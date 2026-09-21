import { FeatureFacade } from './../../shared/services/feature-facade/feature-facade';
import { Component, computed, inject } from '@angular/core';
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
import { canDeactivateExamGuard } from '../../../shared/core/guards/can-deactivate-exam-guard';
import { FinalAssessmentFacade } from '../shared/services/final-assessment-facade/final-assessment-facade';
import { FeedbackFacade } from '../shared/services/feedback-facade/feedback-facade';
import { ChapterFacade } from '../shared/services/chapter-facade/chapter-facade';
import { Faq } from '../../../pages/faq/faq';
import { PartnerContentList } from '../../partners/shared/components/partner-content-list/partner-content-list';

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
  readonly feature: FeatureFacade = inject(FeatureFacade);

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
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./shared/pages/podcast-course/podcast-course').then((m) => m.PodcastCourse),
      },
      {
        path: 'chapter/:chapterId/:chapterTitle',
        providers: [ChapterFacade],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('./shared/pages/podcast-chapter/podcast-chapter').then((m) => m.PodcastChapter),
      },
      {
        path: 'final-assessment/:sessionId/exam',
        providers: [FinalAssessmentFacade],
        canDeactivate: [canDeactivateExamGuard],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('../shared/pages/final-assessment-exam/final-assessment-exam').then(
            (m) => m.FinalAssessmentExam,
          ),
      },
      {
        path: 'final-assessment/:sessionId/report',
        providers: [FinalAssessmentFacade],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('../shared/pages/final-assessment-report/final-assessment-report').then(
            (m) => m.FinalAssessmentReport,
          ),
      },
      {
        path: 'feedback',
        providers: [FeedbackFacade],
        loadComponent: () =>
          import('../shared/pages/course-feedback/course-feedback').then((m) => m.CourseFeedback),
      },
    ],
  },
];
