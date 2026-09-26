import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  linkedSignal,
  PLATFORM_ID,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import {
  badgeNextPage,
  badgeTotalCount,
  BadgeFilter,
  BadgeV2Response,
  isEarnedState,
  matchesBadgeFilter,
  WEBINAR_BADGE_FILTERS,
  WebinarBadgeItem,
} from '@core/models/caira-badge.model';
import { apiUrl } from '@core/services/api-client/api-client';
import { Button } from '@shared/ui/button/button';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { withPreviousValue } from '@shared/utils/with-previous-value';
import { BadgeFilterChips } from '../../../components/badge-filter-chips/badge-filter-chips';
import { WebinarBadgeCard } from '../../components/webinar-badge-card/webinar-badge-card';
import { BadgeActions } from '../../services/badge-actions';
import { trackerLinks } from '../../../utils/tracker-links';

const EMPTY: BadgeV2Response<WebinarBadgeItem[]> = { data: [] };

/**
 * Webinar Badges listing — one card per webinar badge, collapsed across every
 * session in its series.
 *
 * Figma draws a numbered pager; per product this loads on scroll instead, so
 * `page` is a `linkedSignal` the sentinel advances and the resource re-keys on.
 */
@Component({
  selector: 'app-webinar-badges',
  imports: [BadgeFilterChips, Button, ErrorState, NgIcon, RouterLink, WebinarBadgeCard],
  providers: [provideIcons({ lucideArrowLeft })],
  templateUrl: './webinar-badges.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class WebinarBadges {
  private readonly actions = inject(BadgeActions);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly trackerHome = trackerLinks().home;

  protected readonly filters = WEBINAR_BADGE_FILTERS;
  protected readonly filter = linkedSignal<BadgeFilter>(() => 'all');

  private readonly page = linkedSignal<number>(() => 1);

  private readonly listResource = httpResource<BadgeV2Response<WebinarBadgeItem[]>>(
    () =>
      this.isBrowser
        ? { url: apiUrl('v2/webinar-badges/'), params: { page: this.page() } }
        : undefined,
    { defaultValue: EMPTY },
  );

  /** Stale-while-revalidate, so loading page 2 never blanks page 1. */
  private readonly list = withPreviousValue(this.listResource);

  /** Page 1 replaces; every later page appends. */
  protected readonly items = linkedSignal({
    source: this.list.snapshot,
    computation: (snap, previous): WebinarBadgeItem[] => {
      if (snap.status !== 'resolved') return previous?.value ?? [];
      const data = snap.value?.data ?? [];
      return untracked(() => this.page()) === 1 ? data : [...(previous?.value ?? []), ...data];
    },
  });

  protected readonly visible = computed(() =>
    this.items().filter((b) => matchesBadgeFilter(b.action_state, this.filter())),
  );

  /** Counts what has loaded — the API exposes no total for earned badges yet. */
  protected readonly earnedCount = computed(
    () => this.items().filter((b) => isEarnedState(b.action_state)).length,
  );

  /**
   * Guarded: `value()` throws on an errored resource, which would take the page down
   * before its own `hasError` state could render.
   */
  private readonly pagination = computed(() =>
    this.list.hasValue() ? this.list.value()?.pagination_data : undefined,
  );

  protected readonly totalCount = computed(() => badgeTotalCount(this.pagination()));
  protected readonly isLoading = computed(() => this.list.isLoading());
  protected readonly hasError = computed(() => !!this.list.error());
  protected readonly isFirstPage = computed(() => this.isLoading() && !this.items().length);

  private readonly sentinel = viewChild.required<ElementRef<HTMLDivElement>>('sentinel');

  constructor() {
    // `afterNextRender` is browser-only by definition, and the sentinel is
    // unconditionally in the template, so one observer set up once is enough —
    // no `effect`, no re-observing on every data change.
    afterNextRender(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) this.loadNext();
        },
        { rootMargin: '300px' },
      );
      observer.observe(this.sentinel().nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private loadNext(): void {
    if (this.list.isLoading()) return;
    const next = badgeNextPage(this.pagination());
    if (next !== null && next !== this.page()) this.page.set(next);
  }

  protected onFilter(value: string | null): void {
    this.filter.set((value ?? 'all') as BadgeFilter);
  }

  protected retry(): void {
    this.listResource.reload();
  }

  protected async onActivate(card: WebinarBadgeItem): Promise<void> {
    if (await this.actions.run(BadgeActions.fromWebinar(card))) this.listResource.reload();
  }
}
