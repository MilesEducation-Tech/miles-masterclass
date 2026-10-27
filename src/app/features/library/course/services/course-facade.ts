import { isPlatformBrowser } from '@angular/common';
import { HttpContext, httpResource } from '@angular/common/http';
import {
  computed,
  inject,
  linkedSignal,
  PLATFORM_ID,
  ResourceSnapshot,
  Service,
  signal,
  untracked,
} from '@angular/core';
import { SKIP_LOADING } from '@core/models/http.model';
import { MasterclassCourse } from '@core/models/masterclass-home.model';
import { withPreviousValue } from '@core/utils/with-previous-value';
import { CourseAiKit } from '@shared/services/course-ai-kit';
import {
  AI_KIT_CONTENT_TYPE,
  AI_KIT_COURSE_TYPE,
  COURSE_LIBRARY_FILTERS_URL,
  COURSE_LIBRARY_LIST_URL,
  COURSE_LIBRARY_PAGE_SIZE,
  EMPTY_LIBRARY_SELECTION,
  LIBRARY_FILTER_GROUPS,
} from '@features/library/course/constants/course-library';
import {
  CourseListPage,
  LibraryCourseType,
  LibraryFilterGroup,
  LibraryFilterOptions,
  LibraryFilterSelection,
  parseCourseList,
  parseLibraryFilters,
} from '@features/library/course/models/course-library.model';

/**
 * Owns course-listing state for `/library/course-library`. Lazy by
 * `providedIn: 'root'`: it is created only when the Course page injects it,
 * so the Instructor and Badge libraries never touch it.
 *
 * Two reads, split as the backend intends: `filter/` once for the sidebar's
 * options, and `filter-based-masterclass-list/` for the cards, by tab and
 * selection. Browser-only, as the page has always been.
 */
@Service()
export class CourseFacade {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly aiKit = inject(CourseAiKit);

  readonly courseType = signal<LibraryCourseType>('course');
  readonly selection = signal<LibraryFilterSelection>(EMPTY_LIBRARY_SELECTION);
  private readonly page = signal(1);

  /**
   * The sidebar's options, read once: the API narrows them by neither the tab
   * nor the selection. Only `filters` is read, so one card rather than the
   * default six comes with it.
   */
  private readonly filtersResource = httpResource<LibraryFilterOptions>(
    () =>
      this.isBrowser ? { url: COURSE_LIBRARY_FILTERS_URL, params: { page_size: 1 } } : undefined,
    // The trust boundary: an answer that drifted from the contract lands in `error()`.
    { parse: parseLibraryFilters },
  );

  private readonly rawResource = httpResource<CourseListPage>(
    () => {
      if (!this.isBrowser) return undefined;
      const page = this.page();
      const { content_type, ...groups } = this.selection();
      const params: Record<string, string | number> = {
        page,
        page_size: COURSE_LIBRARY_PAGE_SIZE,
      };
      for (const [key, values] of Object.entries(groups)) {
        if (values.length > 0) params[key] = values.join(',');
      }
      // The list route rejects `content_type`, so an AI Kit selection reads
      // `filter/`, which still filters by it. AI Kit is offered on the
      // Masterclasses tab only, and `filter/` lists masterclasses alone, so it
      // needs no `course_type` (which it would also reject).
      const aiKit = content_type.length > 0;
      if (aiKit) {
        params['content_type'] = content_type.join(',');
      } else {
        params['course_type'] = this.courseType();
        // The cards show no bookmark, the one thing a signed-in list adds.
        params['login_type'] = 'pre_login';
      }
      return {
        url: aiKit ? COURSE_LIBRARY_FILTERS_URL : COURSE_LIBRARY_LIST_URL,
        params,
        // Later pages show their own "Loading…" under the grid.
        context: page > 1 ? new HttpContext().set(SKIP_LOADING, true) : undefined,
      };
    },
    { parse: parseCourseList },
  );

  /** Holds the last answer while the next page or selection loads. */
  private readonly libraryResource = withPreviousValue(this.rawResource);

  private readonly latest = computed(() =>
    this.libraryResource.hasValue() ? this.libraryResource.value() : undefined,
  );

  /**
   * The sidebar groups, in production's order. A group with no options is
   * dropped, and only AI Kit is offered from the content types, on the
   * Masterclasses tab alone: the tabs already cover the rest, and AI Kits are
   * masterclasses.
   */
  readonly groups = computed<readonly LibraryFilterGroup[]>(() => {
    const filters = this.filtersResource.hasValue() ? this.filtersResource.value() : undefined;
    if (!filters) return [];
    const offersAiKit = this.courseType() === AI_KIT_COURSE_TYPE;
    return LIBRARY_FILTER_GROUPS.map(({ key, label }) => ({
      key,
      label,
      options:
        key !== 'content_type'
          ? filters[key]
          : offersAiKit
            ? filters.content_type.filter((option) => option.value === AI_KIT_CONTENT_TYPE)
            : [],
    })).filter((group) => group.options.length > 0);
  });

  readonly filtersLoading = computed(() => this.filtersResource.isLoading());
  readonly filtersError = computed(() => this.filtersResource.error());

  /** Every page loaded so far; page 1 starts the list over. */
  readonly courses = linkedSignal<
    ResourceSnapshot<CourseListPage | undefined>,
    MasterclassCourse[]
  >({
    source: this.libraryResource.snapshot,
    computation: (snap, previous) => {
      if (snap.status === 'resolved' && snap.value) {
        const { page, courses } = snap.value;
        return page === 1 ? courses : [...(previous?.value ?? []), ...courses];
      }
      // A new tab or selection empties the grid while page 1 loads.
      return untracked(this.page) === 1 ? [] : (previous?.value ?? []);
    },
  });

  readonly hasNext = computed(() => this.latest()?.hasNext ?? false);
  readonly isLoading = computed(() => this.libraryResource.isLoading());
  readonly error = computed(() => this.libraryResource.error());

  readonly selectedCount = computed(() =>
    Object.values(this.selection()).reduce((n, values) => n + values.length, 0),
  );

  selectCourseType(type: LibraryCourseType): void {
    if (type === this.courseType()) return;
    this.page.set(1);
    // AI Kit belongs to the Masterclasses tab. Carried to another tab it would
    // count in the Filter badge with no group left to clear it from.
    if (type !== AI_KIT_COURSE_TYPE && this.selection().content_type.length > 0) {
      this.selection.update((selection) => ({ ...selection, content_type: [] }));
    }
    this.courseType.set(type);
  }

  setSelection(selection: LibraryFilterSelection): void {
    this.page.set(1);
    this.selection.set(selection);
  }

  clearSelection(): void {
    this.setSelection(EMPTY_LIBRARY_SELECTION);
  }

  loadNextPage(): void {
    if (this.isLoading() || !this.hasNext()) return;
    this.page.update((page) => page + 1);
  }

  /** Try Again: re-reads whichever of the two reads failed. */
  reload(): void {
    if (this.rawResource.error()) this.rawResource.reload();
    if (this.filtersResource.error()) this.filtersResource.reload();
  }

  /** The card's AI Kit button: the shared "Additional Resources" dialog. */
  openAiKit(course: MasterclassCourse): void {
    this.aiKit.open(course);
  }
}
