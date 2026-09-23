import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  effect,
  inject,
  Injectable,
  linkedSignal,
  PLATFORM_ID,
  resource,
  signal,
  untracked,
} from '@angular/core';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import { Content } from '@core/models/course.model';
import { FeatureApiResponse } from '@core/models/feature.model';
import {
  ApiCourseType,
  CourseFilterSelection,
  EMPTY_COURSE_FILTERS,
  LibraryFiltersData,
} from '@core/models/library-filters.model';
import { ApiClient } from '@core/services/api-client/api-client';
import { parseNextPage } from '@core/utils/parse-next-page';
import { withPreviousValue } from '@shared/utils/with-previous-value';

/**
 * Owns course-listing state for `/library/course-library`. Lazy by
 * `providedIn: 'root'` — `v2/library-filters` and `v2/library/` only fire when
 * the Course page injects this facade. Visiting Instructor/Badge libraries
 * does not trigger course requests.
 */
@Injectable({ providedIn: 'root' })
export class CourseFacade {
  private readonly api = inject(ApiClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // ---- Library filters (single fetch, drives the sidebar) ------------------

  private readonly libraryFiltersResource = resource({
    params: () => (this.isBrowser ? {} : undefined),
    loader: () =>
      firstValueFrom(this.api.get<FeatureApiResponse<LibraryFiltersData>>('v2/library-filters/')),
  });

  readonly libraryFilters = computed(() => this.libraryFiltersResource.value()?.data);
  readonly isLibraryFiltersLoading = computed(() => this.libraryFiltersResource.isLoading());

  // ---- Course listing -------------------------------------------------------

  readonly courseType = signal<ApiCourseType>('masterclass');
  readonly courseFilters = signal<CourseFilterSelection>(EMPTY_COURSE_FILTERS);
  private readonly coursePage = signal(1);

  private readonly rawCourseResource = resource({
    params: () => {
      if (!this.isBrowser) return undefined;
      return {
        course_type: this.courseType(),
        filters: this.courseFilters(),
        page: this.coursePage(),
      };
    },
    loader: ({ params, abortSignal }) => {
      // Multi-select filters are serialized as comma-separated values per
      // the backend contract (e.g. `instructor_ids=1361,1522`), not as
      // repeated query params. Single-value entries are emitted plainly.
      const httpParams: Record<string, string | number> = {
        course_type: params.course_type,
        page: params.page,
      };
      for (const [key, values] of Object.entries(params.filters)) {
        if (values.length > 0) httpParams[key] = values.join(',');
      }
      return firstValueFrom(
        this.api
          .get<FeatureApiResponse<Content[]>>('v2/library/', { params: httpParams })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        {
          defaultValue: { data: [] as Content[] } as FeatureApiResponse<Content[]>,
        },
      );
    },
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

  readonly coursePagination = computed(() => this.courseResource.value()?.pagination_data);
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
