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
import { firstValueFrom, fromEvent, takeUntil, tap } from 'rxjs';
import {
  BADGE_STATUS_OPTIONS,
  BadgeApiResponse,
  BadgeItem,
  BadgeStatusFilter,
} from '@core/models/badge.model';
import { ApiClient } from '@core/services/api-client/api-client';
import { Analytics } from '@core/services/analytics/analytics';
import { Utils } from '@shared/services/utils';
import { parseNextPage } from '@core/utils/parse-next-page';
import { withPreviousValue } from '@shared/utils/with-previous-value';

/**
 * Owns badge-library state for `/library/badge-library`. Lazy by
 * `providedIn: 'root'` — neither `badge-categories/` nor `course-badges/`
 * fires until the Badge page (or `BadgeCard`'s `claimBadge` action) injects
 * this facade.
 */
@Injectable({ providedIn: 'root' })
export class BadgeFacade {
  private readonly api = inject(ApiClient);
  private readonly analytics = inject(Analytics);
  private readonly utils = inject(Utils);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // ---- Badge categories (single fetch, seeds the tab strip) ---------------

  private readonly badgeCategoriesResource = resource({
    params: () => (this.isBrowser ? {} : undefined),
    loader: () => firstValueFrom(this.api.get<BadgeApiResponse<string[]>>('badge-categories/')),
  });

  readonly badgeCategories = computed(() => this.badgeCategoriesResource.value()?.data ?? []);
  readonly isBadgeCategoriesLoading = computed(() => this.badgeCategoriesResource.isLoading());

  // ---- Badge listing -------------------------------------------------------

  readonly badgeStatusOptions = BADGE_STATUS_OPTIONS;
  readonly badgeCategory = signal<string | null>(null);
  readonly badgeStatus = signal<BadgeStatusFilter>('');
  private readonly badgePage = signal(1);

  private readonly rawBadgeResource = resource({
    params: () => {
      const cat = this.badgeCategory();
      if (!this.isBrowser || !cat) return undefined;
      return { course_type: cat, status: this.badgeStatus(), page: this.badgePage() };
    },
    loader: ({ params, abortSignal }) =>
      firstValueFrom(
        this.api
          .get<BadgeApiResponse<BadgeItem[]>>('course-badges/', {
            params: {
              course_type: params.course_type,
              status: params.status,
              page: params.page,
            },
          })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        {
          defaultValue: {
            status_code: 0,
            data: [],
            message: 'aborted',
          } as BadgeApiResponse<BadgeItem[]>,
        },
      ),
  });

  private readonly badgeResource = withPreviousValue(this.rawBadgeResource);

  readonly badgeItems = linkedSignal({
    source: this.badgeResource.snapshot,
    computation: (snap, previous): BadgeItem[] => {
      if (snap.status !== 'resolved') return previous?.value ?? [];
      const data = snap.value?.data ?? [];
      const page = untracked(() => this.badgePage());
      return page === 1 ? data : [...(previous?.value ?? []), ...data];
    },
  });

  readonly badgePagination = computed(() => this.badgeResource.value()?.pagination_data);
  readonly isBadgeLoading = computed(() => this.badgeResource.isLoading());
  readonly badgeError = computed(() => this.badgeResource.error());

  constructor() {
    // Default-select the first category once categories load.
    effect(() => {
      const cats = this.badgeCategories();
      if (cats.length && !untracked(() => this.badgeCategory())) {
        this.badgeCategory.set(cats[0]);
      }
    });

    // On category/status change: reset page + clear the accumulated list.
    effect(() => {
      this.badgeCategory();
      this.badgeStatus();
      untracked(() => {
        this.badgePage.set(1);
        this.badgeItems.set([]);
      });
    });
  }

  selectBadgeCategory(cat: string): void {
    this.badgeCategory.set(cat);
  }

  setBadgeStatus(s: BadgeStatusFilter): void {
    this.badgeStatus.set(s);
  }

  loadNextBadgePage(): void {
    if (this.isBadgeLoading()) return;
    const next = parseNextPage(this.badgePagination()?.next_page);
    if (next !== null) this.badgePage.set(next);
  }

  /**
   * Claim a badge by id. Returns the Credly share URL when the server has one
   * ready; consumers typically `window.open(url, '_blank')` on success.
   * Mirrors the cpe-tracker route at `user-badges/:id/claim/`.
   */
  claimBadge(
    badgeId: number,
    course: { course_id: number | null; course_name: string | null; course_type: string | null },
  ) {
    return this.utils.claimBadge(badgeId).pipe(
      tap((res) => {
        if (res) this.analytics.trackEvent('badge_claim', { badge_id: badgeId, ...course });
      }),
    );
  }
}
