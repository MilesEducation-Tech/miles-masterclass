import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { Button } from '@shared/ui/button/button';
import { ErrorState } from '@shared/ui/error-state/error-state';
import {
  BadgeFilter,
  isEarned,
  matchesBadgeFilter,
  WEBINAR_BADGE_FILTERS,
} from '../../models/caira-badge-page.model';
import { CairaBadgesFacade } from '../../services/caira-badges-facade';
import { BadgeFilterChips } from '../../../components/badge-filter-chips/badge-filter-chips';
import { WebinarBadgeCard } from '../../components/webinar-badge-card/webinar-badge-card';
import { trackerLinks } from '../../../utils/tracker-links';

/**
 * Webinar Badges listing — one card per webinar badge, collapsed across every session in
 * its series.
 *
 * Figma draws a numbered pager; per product this loads on scroll instead, so the sentinel
 * asks the facade for the next page and the facade re-keys its one request on it.
 */
@Component({
  selector: 'app-webinar-badges',
  imports: [BadgeFilterChips, Button, ErrorState, NgIcon, RouterLink, WebinarBadgeCard],
  providers: [provideIcons({ lucideArrowLeft })],
  templateUrl: './webinar-badges.html',
  host: { class: 'block' },
})
export class WebinarBadges {
  private readonly facade = inject(CairaBadgesFacade);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly trackerHome = trackerLinks().home;

  protected readonly filters = WEBINAR_BADGE_FILTERS;
  protected readonly filter = linkedSignal<BadgeFilter>(() => 'all');

  protected readonly items = this.facade.webinarBadges;

  /** Client-side: the endpoint exposes no status filter, so the chips narrow what loaded. */
  protected readonly visible = computed(() =>
    this.items().filter((badge) => matchesBadgeFilter(badge, this.filter())),
  );

  /** Counts what has loaded — the endpoint exposes no total for earned badges. */
  protected readonly earnedCount = computed(() => this.items().filter(isEarned).length);

  protected readonly totalCount = this.facade.webinarCount;
  protected readonly isLoading = this.facade.isLoading;
  protected readonly hasError = computed(() => !!this.facade.loadError());
  protected readonly isFirstPage = computed(() => this.isLoading() && !this.items().length);

  private readonly sentinel = viewChild.required<ElementRef<HTMLDivElement>>('sentinel');

  constructor() {
    // `afterNextRender` is browser-only by definition, and the sentinel is unconditionally
    // in the template, so one observer set up once is enough — no `effect`, no re-observing
    // on every data change. The facade no-ops a request it cannot serve.
    afterNextRender(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) this.facade.loadMoreWebinars();
        },
        { rootMargin: '300px' },
      );
      observer.observe(this.sentinel().nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected onFilter(value: string | null): void {
    this.filter.set((value ?? 'all') as BadgeFilter);
  }

  protected retry(): void {
    this.facade.reload();
  }
}
