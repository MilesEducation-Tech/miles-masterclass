import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  PLATFORM_ID,
  untracked,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroFunnel } from '@ng-icons/heroicons/outline';
import { NgpDialogManager } from 'ng-primitives/dialog';

import {
  MasterclassCourse,
  MasterclassCourseInfoDialogData,
} from '@core/models/masterclass-home.model';
import { MASTERCLASS_COURSE_INFO_DIALOG } from '@core/services/dialog/feature-dialog-tokens';
import { MasterclassCourseCard } from '@shared/components/cards/masterclass-course-card/masterclass-course-card';
import { Utils } from '@shared/services/utils';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { Tabs } from '@shared/ui/tabs/tabs';
import { Tab } from '@shared/ui/tabs/tab';
import { CourseFilters } from '@features/library/course/components/course-filters/course-filters';
import { COURSE_LIBRARY_TABS } from '@features/library/course/constants/course-library';
import { LibraryFilterSelection } from '@features/library/course/models/course-library.model';
import { CourseFacade } from '@features/library/course/services/course-facade';

@Component({
  selector: 'app-course',
  imports: [MasterclassCourseCard, CourseFilters, ErrorState, NgIcon, Tabs, Tab],
  providers: [provideIcons({ heroFunnel })],
  templateUrl: './course.html',
  // Production's spacing: 24px above and below, none at the sides, so the
  // sidebar and grid use the container's full width.
  host: {
    class: 'block py-6',
  },
})
export class Course {
  readonly facade = inject(CourseFacade);
  private readonly utils = inject(Utils);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly courseInfoDialog = inject(MASTERCLASS_COURSE_INFO_DIALOG);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly tabs = COURSE_LIBRARY_TABS;
  readonly tabLabels = computed(() => this.tabs.map((t) => t.label));
  readonly currentLabel = computed(
    () => this.tabs.find((t) => t.courseType === this.facade.courseType())?.label ?? '',
  );

  readonly sentinel = viewChild<ElementRef<HTMLDivElement>>('sentinel');
  readonly listSection = viewChild<ElementRef<HTMLDivElement>>('listSection');

  constructor() {
    // IntersectionObserver pagination — same pattern as instructor + badge. The
    // sentinel is re-rendered after every page, and observing a fresh element
    // reports its state at once, so a short page that leaves it in view still
    // loads the next one.
    effect((onCleanup) => {
      const el = this.sentinel()?.nativeElement;
      if (!el || !this.isBrowser) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            this.facade.loadNextPage();
          }
        },
        { rootMargin: '300px' },
      );
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });

    // Scroll the controls + grid into view on type/filter change. Skip first run.
    let firstRun = true;
    effect(() => {
      this.facade.courseType();
      this.facade.selection();
      untracked(() => {
        if (firstRun) {
          firstRun = false;
          return;
        }
        if (!this.isBrowser) return;
        this.listSection()?.nativeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    });
  }

  onTabChange(label: string) {
    const tab = this.tabs.find((t) => t.label === label);
    if (tab) this.facade.selectCourseType(tab.courseType);
  }

  openTrailer(course: MasterclassCourse): void {
    void this.utils.openVideoDialog(course.horizontal_trailer_url, course.title);
  }

  /**
   * The "i" dialog, as on the home page: it belongs to the offerings feature,
   * so it comes through the token `app.config.ts` binds, and loads on first use.
   */
  async openCourseInfo(course: MasterclassCourse): Promise<void> {
    this.dialogs.open<MasterclassCourseInfoDialogData>(await this.courseInfoDialog(), {
      data: { course },
    });
  }

  /** Mobile button → opens the same `CourseFilters` body inside a right drawer. */
  async openMobileFilters() {
    // Loaded on open: the drawer is mobile-only and user-initiated (§4.4).
    const { CourseFiltersDrawer } =
      await import('@features/library/course/components/course-filters-drawer/course-filters-drawer');
    this.dialogs.open(CourseFiltersDrawer, {
      data: {
        groups: () => this.facade.groups(),
        selection: () => this.facade.selection(),
        onChange: (next: LibraryFilterSelection) => this.facade.setSelection(next),
        onClear: () => this.facade.clearSelection(),
      },
    });
  }
}
