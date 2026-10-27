import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { swiperConfigEven, swiperConfigOdd } from '@core/config/swiper.config';
import { filterIcon } from '@core/constants/icon';
import {
  MasterclassCourse,
  MasterclassCourseInfoDialogData,
} from '@core/models/masterclass-home.model';
import { MasterclassHomeFacade } from '@core/services/masterclass-home-facade/masterclass-home-facade';
import { NgIcon } from '@ng-icons/core';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { Carousel } from '@shared/components/carousel/carousel';
import { MasterclassCourseCard } from '@shared/components/cards/masterclass-course-card/masterclass-course-card';
import { Faq } from '@shared/components/faq/faq';
import { SectionNav, SectionNavItem } from '@shared/components/section-nav/section-nav';
import { SliderSkeleton } from '@shared/components/skeleton/slider-skeleton/slider-skeleton';
import { Slider } from '@shared/components/slider/slider';
import { CourseAiKit } from '@shared/services/course-ai-kit';
import { Utils } from '@shared/services/utils';
import { Button } from '@shared/ui/button/button';
import { RAIL_FILTER_EMPTY } from '@features/offerings/masterclass/constants/masterclass';
import {
  MASTERCLASS_SECTION_NAV,
  MASTERCLASS_TRACKS_SECTION_ID,
} from '@features/offerings/masterclass/constants/masterclass-nav';
import { trackRail } from '@features/offerings/masterclass/models/masterclass-library.model';
import { MasterclassHighlightFacade } from '@features/offerings/masterclass/services/masterclass-highlight-facade';
import { MasterclassLibraryFacade } from '@features/offerings/masterclass/services/masterclass-library-facade';
import { MasterclassRailFilterFacade } from '@features/offerings/masterclass/services/masterclass-rail-filter-facade';

/**
 * The masterclass landing page: the hero over the admin-pinned courses from
 * `highlight/`, then one carousel per track from `tracks-page/`. The tracks come
 * from the root `MasterclassHomeFacade`, which the home page shares, so
 * navigating between the two does not refetch. Signed in, the learner's own
 * rails sit around the tracks (`MasterclassLibraryFacade`). Every rail, tracks
 * included, has a filter (`MasterclassRailFilterFacade`).
 */
@Component({
  selector: 'app-masterclass',
  imports: [
    Carousel,
    Faq,
    NgTemplateOutlet,
    SectionNav,
    Slider,
    SliderSkeleton,
    Button,
    MasterclassCourseCard,
    NgIcon,
  ],
  templateUrl: './masterclass.html',
})
export class Masterclass {
  private readonly utils = inject(Utils);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly aiKit = inject(CourseAiKit);

  protected readonly highlight = inject(MasterclassHighlightFacade);
  protected readonly home = inject(MasterclassHomeFacade);
  protected readonly library = inject(MasterclassLibraryFacade);
  protected readonly railFilter = inject(MasterclassRailFilterFacade);

  constructor() {
    // MIL-23: this page renders the tracks on the server (a crawler gets the
    // track list; the browser reuses the response). The home page does not.
    this.home.fetchOnServer.set(true);
  }

  // Even tracks render vertical cards (more per view), odd ones horizontal.
  protected readonly swiperConfigEven = swiperConfigEven;
  protected readonly swiperConfigOdd = swiperConfigOdd;
  protected readonly filterIcon = filterIcon;
  protected readonly railFilterEmpty = RAIL_FILTER_EMPTY;

  // Every rail through its filter; `courses` stays whole for the dialog.
  protected readonly railsAboveTracks = computed(() =>
    this.railFilter.narrow(this.library.railsAboveTracks()),
  );
  protected readonly trackRails = computed(() =>
    this.railFilter.narrow(this.home.tracks().map(trackRail)),
  );
  protected readonly railsBelowTracks = computed(() =>
    this.railFilter.narrow(this.library.railsBelowTracks()),
  );

  protected readonly sectionNavItems = computed<SectionNavItem[]>(() => {
    const railIds = this.library.sectionIds();
    return MASTERCLASS_SECTION_NAV.map((item) =>
      item.id === MASTERCLASS_TRACKS_SECTION_ID
        ? { ...item, visible: this.home.tracks().length > 0 }
        : railIds.has(item.id)
          ? { ...item, visible: true }
          : item,
    );
  });

  /** The shared video dialog; it toasts "Trailer Not Found" for a course with none. */
  protected openTrailer(course: MasterclassCourse): void {
    void this.utils.openVideoDialog(course.horizontal_trailer_url, course.title);
  }

  /** The AI Kit button, on courses that have one: the "Additional Resources" dialog. */
  protected openAiKit(course: MasterclassCourse): void {
    this.aiKit.open(course);
  }

  /** The "i" dialog: the course's About, read when it opens. Loaded on first use. */
  protected async openCourseInfo(course: MasterclassCourse): Promise<void> {
    const { MasterclassCourseInfoDialog } =
      await import('@features/offerings/masterclass/dialogs/masterclass-course-info-dialog/masterclass-course-info-dialog');
    this.dialogs.open<MasterclassCourseInfoDialogData>(MasterclassCourseInfoDialog, {
      data: { course },
    });
  }
}
