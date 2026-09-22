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
import { Vertical } from '@shared/components/cards/vertical/vertical';
import { TabStrip } from '@shared/ui/tab-strip/tab-strip';
import {
  COURSE_TYPE_TABS,
  CourseFilterGroup,
  CourseFilterSelection,
} from '@core/models/library-filters.model';
import { Dialog } from '@core/services/dialog/dialog';
import { CourseFilters } from './shared/components/course-filters/course-filters';
import { CourseFiltersDrawer } from './shared/components/course-filters-drawer/course-filters-drawer';
import { CourseFacade } from './shared/services/course-facade/course-facade';

@Component({
  selector: 'app-course',
  imports: [TabStrip, Vertical, CourseFilters, NgIcon],
  providers: [provideIcons({ heroFunnel })],
  templateUrl: './course.html',
  styleUrl: './course.css',
  host: {
    class: 'p-4',
  },
})
export class Course {
  readonly facade = inject(CourseFacade);
  private readonly dialog = inject(Dialog);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly tabs = COURSE_TYPE_TABS;
  readonly tabLabels = computed(() => this.tabs.map((t) => t.label));
  readonly currentLabel = computed(
    () => this.tabs.find((t) => t.apiType === this.facade.courseType())?.label ?? '',
  );

  /** Route slug ('micro-learning', etc.) passed to `app-vertical`. */
  readonly routeType = computed(
    () => this.tabs.find((t) => t.apiType === this.facade.courseType())?.routeType ?? 'masterclass',
  );

  readonly groups = computed<readonly CourseFilterGroup[]>(() => {
    const f = this.facade.libraryFilters();
    if (!f) return [];
    return [
      {
        key: 'instructor_ids',
        label: 'Instructor',
        options: f.instructors.map(({ id, name }) => ({ value: id, label: name })),
      },
      {
        key: 'category_ids',
        label: 'Category',
        options: f.categories.map(({ id, name }) => ({ value: id, label: name })),
      },
      {
        key: 'field_of_study_ids',
        label: 'Field of Study',
        options: f.fields_of_study.map(({ id, name }) => ({ value: id, label: name })),
      },
      {
        key: 'additional_category_ids',
        label: 'Additional Category',
        options: f.additional_categories.map(({ id, name }) => ({ value: id, label: name })),
      },
      {
        key: 'caira_levels',
        label: 'CAIRA Level',
        options: f.caira_levels.map(({ id, name }) => ({ value: id, label: name })),
      },
      {
        key: 'cpe_range',
        label: 'CPE Credits',
        options: f.cpe_credits.map(({ key, label }) => ({ value: key, label })),
      },
      {
        key: 'track_ids',
        label: 'Track',
        options: (f.tracks ?? []).map(({ id, name }) => ({ value: id, label: name })),
      },
      {
        key: 'ai_library',
        label: 'AI Kit',
        options: [{ value: 'true', label: 'AI Kit Course' }].map(({ value, label }) => ({
          value,
          label,
        })),
      },
    ];
  });

  readonly activeFilterCount = computed(() =>
    Object.values(this.facade.courseFilters()).reduce((n, arr) => n + arr.length, 0),
  );

  readonly sentinel = viewChild<ElementRef<HTMLDivElement>>('sentinel');
  readonly listSection = viewChild<ElementRef<HTMLDivElement>>('listSection');

  constructor() {
    // IntersectionObserver pagination — same pattern as instructor + badge.
    effect((onCleanup) => {
      const el = this.sentinel()?.nativeElement;
      if (!el || !this.isBrowser) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            this.facade.loadNextCoursePage();
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
      this.facade.courseFilters();
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
    if (tab) this.facade.selectCourseType(tab.apiType);
  }

  /** Mobile button → opens the same `CourseFilters` body inside a right drawer. */
  openMobileFilters() {
    this.dialog.open(CourseFiltersDrawer, {
      position: 'right',
      ariaLabel: 'Course filters',
      data: {
        groups: () => this.groups(),
        selection: () => this.facade.courseFilters(),
        onChange: (next: CourseFilterSelection) => this.facade.setCourseFilters(next),
        onClear: () => this.facade.clearCourseFilters(),
      },
    });
  }
}
