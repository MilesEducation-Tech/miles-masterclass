import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { Component, computed, ElementRef, inject, PLATFORM_ID, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { swiperConfigComingSoon, swiperConfigOdd } from '@core/config/swiper.config';
import { filterIcon } from '@core/constants/icon';
import { RAIL_FILTER_EMPTY } from '@core/constants/masterclass';
import { MasterclassCourse, trackRail } from '@core/models/masterclass-home.model';
import { MasterclassBookmarks } from '@core/services/masterclass-bookmarks/masterclass-bookmarks';
import { NgIcon } from '@ng-icons/core';
import { Carousel } from '@shared/components/carousel/carousel';
import { MasterclassCourseCard } from '@shared/components/cards/masterclass-course-card/masterclass-course-card';
import { Faq } from '@shared/components/faq/faq';
import { PartnerContentList } from '@shared/components/partner-content-list/partner-content-list';
import { CourseAiKit } from '@shared/services/course-ai-kit';
import { MasterclassRailFilter } from '@shared/services/masterclass-rail-filter';
import { Utils } from '@shared/services/utils';
import { Button } from '@shared/ui/button/button';
import { ComingSoonCard } from '@features/offerings/components/coming-soon-card/coming-soon-card';
import { MicroLearningHero } from '@features/offerings/micro-learning/components/micro-learning-hero/micro-learning-hero';
import {
  REELS_COMING_SOON_HEADING,
  REELS_COMING_SOON_SECTION_ID,
  REELS_FILTER_CONTENT_TYPE,
  REELS_PATH_SEGMENT,
} from '@features/offerings/micro-learning/constants/reels-landing';
import { MasterclassLibraryFacade } from '@features/offerings/services/masterclass-library-facade';

/**
 * The reels landing page, on the web API: the hero, then the reel tracks from
 * `tracks-page/?course_type=nano_learning,micro_learning` (both sides of
 * sign-in), and signed in Continue Watching above them, My List and the
 * mastered reels below them (`reels-activity/`) and Coming Soon last. Every row
 * comes from `MasterclassLibraryFacade`, connected to `reels`, the same service
 * as the masterclass and podcast pages'. Every rail has a filter over the reels
 * (`MasterclassRailFilter`), and every card a bookmark.
 *
 * No paywall here: every card and the hero open the reel, and the player
 * decides what plays.
 */
@Component({
  selector: 'app-micro-learning',
  imports: [
    Button,
    Carousel,
    ComingSoonCard,
    Faq,
    MasterclassCourseCard,
    MicroLearningHero,
    NgIcon,
    NgTemplateOutlet,
    PartnerContentList,
  ],
  templateUrl: './micro-learning.html',
})
export class MicroLearning {
  private readonly utils = inject(Utils);
  private readonly router = inject(Router);
  private readonly aiKit = inject(CourseAiKit);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly library = inject(MasterclassLibraryFacade);
  protected readonly railFilter = inject(MasterclassRailFilter);
  protected readonly bookmarks = inject(MasterclassBookmarks);

  private readonly carouselsRef = viewChild<ElementRef<HTMLElement>>('carousels');

  constructor() {
    this.library.connect('reels');
    this.railFilter.contentType.set(REELS_FILTER_CONTENT_TYPE);
  }

  protected readonly swiperConfigOdd = swiperConfigOdd;
  protected readonly swiperConfigComingSoon = swiperConfigComingSoon;
  protected readonly comingSoonHeading = REELS_COMING_SOON_HEADING;
  protected readonly comingSoonSectionId = REELS_COMING_SOON_SECTION_ID;
  protected readonly pathSegment = REELS_PATH_SEGMENT;
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

  /** A reel's trailer: the 9:16 one, else the 16:9 one. */
  protected openTrailer(course: MasterclassCourse): void {
    const url = course.vertical_trailer_url || course.horizontal_trailer_url;
    void this.utils.openVideoDialog(url, course.title);
  }

  protected openAiKit(course: MasterclassCourse): void {
    this.aiKit.open(course);
  }

  /**
   * The hero's "Start Watching": the first reel of the first track, which the
   * page already has (and the server HTML carries), so it needs no read of its
   * own. With no tracks, the rows instead.
   */
  protected onStartWatching(): void {
    const first = this.library.tracks()[0]?.courses[0];
    if (!first) {
      this.onBrowseLibrary();
      return;
    }
    void this.router.navigate([
      '/',
      this.utils.country(),
      this.utils.profession(),
      REELS_PATH_SEGMENT,
      first.id,
      first.slug,
    ]);
  }

  protected onBrowseLibrary(): void {
    if (!this.isBrowser) return;
    this.carouselsRef()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
