import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { swiperConfigComingSoon, swiperConfigPodcast } from '@core/config/swiper.config';
import { filterIcon } from '@core/constants/icon';
import { RAIL_FILTER_EMPTY } from '@core/constants/masterclass';
import { trackRail } from '@core/models/masterclass-home.model';
import { NgIcon } from '@ng-icons/core';
import { Carousel } from '@shared/components/carousel/carousel';
import { Faq } from '@shared/components/faq/faq';
import { PartnerContentList } from '@shared/components/partner-content-list/partner-content-list';
import { MasterclassRailFilter } from '@shared/services/masterclass-rail-filter';
import { Button } from '@shared/ui/button/button';
import { ComingSoonCard } from '@features/offerings/components/coming-soon-card/coming-soon-card';
import { PodcastCourseCard } from '@features/offerings/podcast/components/podcast-course-card/podcast-course-card';
import { PodcastHero } from '@features/offerings/podcast/components/podcast-hero/podcast-hero';
import {
  PODCAST_COMING_SOON_HEADING,
  PODCAST_COMING_SOON_SECTION_ID,
  PODCAST_FILTER_CONTENT_TYPE,
} from '@features/offerings/podcast/constants/podcast';
import { MasterclassLibraryFacade } from '@features/offerings/services/masterclass-library-facade';

/**
 * The podcast landing page, on the web API: the hero, then the podcast tracks
 * from `tracks-page/?course_type=podcast` (both sides of sign-in), and signed
 * in the learner's own rails around them and Coming Soon last. Every row comes
 * from `MasterclassLibraryFacade`, connected to `podcast`, the same service as
 * the masterclass page's. Every rail has a filter over the podcasts
 * (`MasterclassRailFilter`), and every card a bookmark.
 */
@Component({
  selector: 'app-podcast',
  imports: [
    Carousel,
    ComingSoonCard,
    Faq,
    NgIcon,
    NgTemplateOutlet,
    PartnerContentList,
    PodcastCourseCard,
    PodcastHero,
    Button,
  ],
  templateUrl: './podcast.html',
})
export class Podcast {
  protected readonly library = inject(MasterclassLibraryFacade);
  protected readonly railFilter = inject(MasterclassRailFilter);

  constructor() {
    this.library.connect('podcast');
    this.railFilter.contentType.set(PODCAST_FILTER_CONTENT_TYPE);
  }

  protected readonly swiperConfigPodcast = swiperConfigPodcast;
  protected readonly swiperConfigComingSoon = swiperConfigComingSoon;
  protected readonly comingSoonHeading = PODCAST_COMING_SOON_HEADING;
  protected readonly comingSoonSectionId = PODCAST_COMING_SOON_SECTION_ID;
  protected readonly filterIcon = filterIcon;
  protected readonly railFilterEmpty = RAIL_FILTER_EMPTY;

  // Every rail through its filter.
  protected readonly railsAboveTracks = computed(() =>
    this.railFilter.narrow(this.library.railsAboveTracks()),
  );
  protected readonly trackRails = computed(() =>
    this.railFilter.narrow(this.library.tracks().map(trackRail)),
  );
  protected readonly railsBelowTracks = computed(() =>
    this.railFilter.narrow(this.library.railsBelowTracks()),
  );
}
