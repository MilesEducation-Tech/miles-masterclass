import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  effect,
  inject,
  Service,
  linkedSignal,
  PLATFORM_ID,
  resource,
  signal,
  untracked,
} from '@angular/core';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import { FeatureApiResponse } from '@core/models/feature.model';
import { InstructorListItem } from '@core/models/library.model';
import { ApiClient } from '@core/services/api-client/api-client';
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
  private readonly api = inject(ApiClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Debounced search term. Pages bind a debounced signal here via `setSearchKey`. */
  readonly searchKey = signal('');

  private readonly instructorPage = signal(1);

  private readonly rawInstructorResource = resource({
    params: () =>
      this.isBrowser ? { page: this.instructorPage(), search_key: this.searchKey() } : undefined,
    loader: ({ params, abortSignal }) => {
      const httpParams: Record<string, string | number> = { page: params.page };
      if (params.search_key) httpParams['search_key'] = params.search_key;
      return firstValueFrom(
        this.api
          .get<FeatureApiResponse<InstructorListItem[]>>('instructor/', { params: httpParams })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        {
          defaultValue: {
            data: [] as InstructorListItem[],
          } as FeatureApiResponse<InstructorListItem[]>,
        },
      );
    },
  });

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

  readonly instructorPagination = computed(() => this.instructorResource.value()?.pagination_data);
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
