import { FeatureFacade } from '@core/services/feature-facade/feature-facade';
import { Component, computed, inject } from '@angular/core';
import { Carousel } from '@shared/components/carousel/carousel';
import { environment } from '@env/environment';
import { swiperConfigComingSoon, swiperConfigPodcast } from '@core/config/swiper.config';
import { Square } from '@shared/components/cards/square/square';
import { PodcastHero } from '../../components/podcast-hero/podcast-hero';
import { ComingSoon } from '@shared/components/cards/coming-soon/coming-soon';
import { Faq } from '@shared/components/faq/faq';
import { PartnerContentList } from '@shared/components/partner-content-list/partner-content-list';

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
