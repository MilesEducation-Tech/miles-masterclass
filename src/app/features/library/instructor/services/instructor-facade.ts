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
import { FeatureApiResponse } from '@core/models/feature.model';
import { InstructorListItem } from '@core/models/library.model';
import { apiUrl } from '@core/services/api-client/api-client';
import { parseNextPage } from '@core/utils/parse-next-page';
import { withPreviousValue } from '@shared/utils/with-previous-value';

/**
 * Owns instructor-listing state for `/library/instructor-library`. Lazy by
 * `providedIn: 'root'` — the resource only fires on first injection from the
 * Instructor page, so visiting Course/Badge libraries never triggers
 * `instructor/` requests.
 */
@Service()
export class InstructorFacade {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Debounced search term. Pages bind a debounced signal here via `setSearchKey`. */
  readonly searchKey = signal('');

  private readonly instructorPage = signal(1);

  /**
   * A paginated list filtered by an ALREADY-debounced term (the page debounces before
   * `setSearchKey`), so this never sees keystrokes, which is why it is an `httpResource`
   * and not the §4.2 search pipeline. The same call was made for leads and user-report.
   */
  private readonly rawInstructorResource = httpResource<FeatureApiResponse<InstructorListItem[]>>(
    () => {
      if (!this.isBrowser) return undefined;
      const params: Record<string, string | number> = { page: this.instructorPage() };
      const search = this.searchKey();
      if (search) params['search_key'] = search;
      return { url: apiUrl('instructor/'), params };
    },
  );

  private readonly instructorResource = withPreviousValue(this.rawInstructorResource);

  readonly instructorItems = linkedSignal({
    source: this.instructorResource.snapshot,
    computation: (snap, previous): InstructorListItem[] => {
      if (snap.status !== 'resolved') return previous?.value ?? [];
      const data = snap.value?.data ?? [];
      const page = untracked(() => this.instructorPage());
      return page === 1 ? data : [...(previous?.value ?? []), ...data];
    },
  });

  /** Guarded: `value()` throws on an errored resource. */
  readonly instructorPagination = computed(() =>
    this.instructorResource.hasValue()
      ? this.instructorResource.value()?.pagination_data
      : undefined,
  );
  readonly isInstructorLoading = computed(() => this.instructorResource.isLoading());
  readonly instructorError = computed(() => this.instructorResource.error());

  constructor() {
    // Reset pagination + accumulator on search change so a fresh query starts
    // at page 1 and doesn't append to stale results.
    effect(() => {
      this.searchKey();
      untracked(() => {
        this.instructorPage.set(1);
        this.instructorItems.set([]);
      });
    });
  }

  setSearchKey(value: string): void {
    this.searchKey.set(value.trim());
  }

  loadNextInstructorPage(): void {
    if (this.isInstructorLoading()) return;
    const next = parseNextPage(this.instructorPagination()?.next_page);
    if (next !== null) this.instructorPage.set(next);
  }

  resetInstructors(): void {
    this.instructorItems.set([]);
    this.instructorPage.set(1);
  }
}
