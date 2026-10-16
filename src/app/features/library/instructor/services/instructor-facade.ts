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
import { withPreviousValue } from '@core/utils/with-previous-value';
import {
  INSTRUCTOR_LIBRARY_COURSE_TYPES,
  INSTRUCTOR_LIBRARY_PAGE_SIZE,
  INSTRUCTOR_LIBRARY_URL,
} from '@features/library/instructor/constants/instructor-library';
import {
  InstructorLibraryPage,
  InstructorRow,
  parseInstructorLibrary,
} from '@features/library/instructor/models/instructor-library.model';

/**
 * Owns instructor-listing state for `/library/instructor-library`: one read,
 * `all-instructors-page/`, a page of rows at a time, accumulated as the learner
 * scrolls. Browser-only, as the course library is.
 *
 * The search term reaching it is already debounced by the page, so this never
 * sees keystrokes, which is why it is an `httpResource` and not the §4.2
 * search pipeline.
 */
// why: root rather than route-scoped, so the search term and the pages already
// loaded survive a visit to an instructor and the Back button.
@Service()
export class InstructorFacade {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** The trimmed term the list is filtered by. */
  readonly search = signal('');
  private readonly page = signal(1);

  private readonly rawResource = httpResource<InstructorLibraryPage>(
    () => {
      if (!this.isBrowser) return undefined;
      const page = this.page();
      const params: Record<string, string | number> = {
        course_type: INSTRUCTOR_LIBRARY_COURSE_TYPES,
        page,
        page_size: INSTRUCTOR_LIBRARY_PAGE_SIZE,
      };
      const search = this.search();
      if (search) params['search'] = search;
      return {
        url: INSTRUCTOR_LIBRARY_URL,
        params,
        // Later pages show their own "Loading…" under the grid.
        context: page > 1 ? new HttpContext().set(SKIP_LOADING, true) : undefined,
      };
    },
    // The trust boundary: an answer that drifted from the contract lands in `error()`.
    { parse: parseInstructorLibrary },
  );

  /** Holds the last answer while the next page or search loads. */
  private readonly libraryResource = withPreviousValue(this.rawResource);

  private readonly latest = computed(() =>
    this.libraryResource.hasValue() ? this.libraryResource.value() : undefined,
  );

  /** Every page loaded so far; page 1 starts the list over. */
  readonly instructors = linkedSignal<
    ResourceSnapshot<InstructorLibraryPage | undefined>,
    InstructorRow[]
  >({
    source: this.libraryResource.snapshot,
    computation: (snap, previous) => {
      if (snap.status === 'resolved' && snap.value) {
        const { page, instructors } = snap.value;
        return page === 1 ? instructors : [...(previous?.value ?? []), ...instructors];
      }
      // A new search empties the grid while its page 1 loads.
      return untracked(this.page) === 1 ? [] : (previous?.value ?? []);
    },
  });

  /**
   * Whether any answer has arrived. Until one has, the page says "Loading…"
   * rather than "No instructors found.", on the server too, where nothing loads.
   */
  readonly hasLoaded = computed(() => this.latest() !== undefined);
  readonly hasNext = computed(() => this.latest()?.hasNext ?? false);
  readonly isLoading = computed(() => this.libraryResource.isLoading());
  readonly error = computed(() => this.libraryResource.error());

  setSearch(term: string): void {
    const search = term.trim();
    if (search === this.search()) return;
    this.page.set(1);
    this.search.set(search);
  }

  loadNextPage(): void {
    if (this.isLoading() || !this.hasNext()) return;
    this.page.update((page) => page + 1);
  }

  reload(): void {
    this.rawResource.reload();
  }
}
