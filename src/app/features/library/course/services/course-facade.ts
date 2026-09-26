import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import {
  computed,
  effect,
  inject,
  Service,
  linkedSignal,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
import { Content } from '@core/models/course.model';
import { FeatureApiResponse } from '@core/models/feature.model';
import {
  ApiCourseType,
  CourseFilterSelection,
  EMPTY_COURSE_FILTERS,
  LibraryFiltersData,
} from '@core/models/library-filters.model';
import { apiUrl } from '@core/services/api-client/api-client';
import { parseNextPage } from '@core/utils/parse-next-page';
import { withPreviousValue } from '@shared/utils/with-previous-value';

/**
 * Owns course-listing state for `/library/course-library`. Lazy by
 * `providedIn: 'root'` — `v2/library-filters` and `v2/library/` only fire when
 * the Course page injects this facade. Visiting Instructor/Badge libraries
 * does not trigger course requests.
 */
@Service()
export class CourseFacade {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // ---- Library filters (single fetch, drives the sidebar) ------------------

  private readonly libraryFiltersResource = httpResource<FeatureApiResponse<LibraryFiltersData>>(
    () => (this.isBrowser ? apiUrl('v2/library-filters/') : undefined),
  );

  /**
   * Guarded: `value()` throws on an errored resource, so a failed `v2/library-filters/`
   * (a 404 in local/UAT) used to throw on every change detection and take the page down.
   * Now the sidebar just has no filters.
   */
  readonly libraryFilters = computed(() =>
    this.libraryFiltersResource.hasValue() ? this.libraryFiltersResource.value()?.data : undefined,
  );
  readonly isLibraryFiltersLoading = computed(() => this.libraryFiltersResource.isLoading());

  // ---- Course listing -------------------------------------------------------

  readonly courseType = signal<ApiCourseType>('masterclass');
  readonly courseFilters = signal<CourseFilterSelection>(EMPTY_COURSE_FILTERS);
  private readonly coursePage = signal(1);

  private readonly rawCourseResource = httpResource<FeatureApiResponse<Content[]>>(() => {
    if (!this.isBrowser) return undefined;
    // Multi-select filters are serialized as comma-separated values per
    // the backend contract (e.g. `instructor_ids=1361,1522`), not as
    // repeated query params. Single-value entries are emitted plainly.
    const params: Record<string, string | number> = {
      course_type: this.courseType(),
      page: this.coursePage(),
    };
    for (const [key, values] of Object.entries(this.courseFilters())) {
      if (values.length > 0) params[key] = values.join(',');
    }
    return { url: apiUrl('v2/library/'), params };
  });

  private readonly courseResource = withPreviousValue(this.rawCourseResource);

  readonly courseItems = linkedSignal({
    source: this.courseResource.snapshot,
    computation: (snap, previous): Content[] => {
      if (snap.status !== 'resolved') return previous?.value ?? [];
      const data = snap.value?.data ?? [];
      const page = untracked(() => this.coursePage());
      return page === 1 ? data : [...(previous?.value ?? []), ...data];
    },
  });

  /** Guarded like `libraryFilters`: `value()` throws on an errored resource. */
  readonly coursePagination = computed(() =>
    this.courseResource.hasValue() ? this.courseResource.value()?.pagination_data : undefined,
  );
  readonly isCourseLoading = computed(() => this.courseResource.isLoading());
  readonly courseError = computed(() => this.courseResource.error());

  constructor() {
    // Reset pagination + accumulator on type or filter change.
    effect(() => {
      this.courseType();
      this.courseFilters();
      untracked(() => {
        this.coursePage.set(1);
        this.courseItems.set([]);
      });
    });
  }

  selectCourseType(type: ApiCourseType): void {
    this.courseType.set(type);
  }

  setCourseFilters(sel: CourseFilterSelection): void {
    this.courseFilters.set(sel);
  }

  clearCourseFilters(): void {
    this.courseFilters.set(EMPTY_COURSE_FILTERS);
  }

  loadNextCoursePage(): void {
    if (this.isCourseLoading()) return;
    const next = parseNextPage(this.coursePagination()?.next_page);
    if (next !== null) this.coursePage.set(next);
  }
}
