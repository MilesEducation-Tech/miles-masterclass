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
  COURSE_BADGE_FILTERS,
  isEarned,
  MasterclassBadge,
  matchesBadgeFilter,
} from '../../models/caira-badge-page.model';
import { BadgeActions } from '../../services/badge-actions';
import { CairaBadgesFacade } from '../../services/caira-badges-facade';
import { BadgeFilterChips } from '../../../components/badge-filter-chips/badge-filter-chips';
import { CourseBadgeCard } from '../../components/course-badge-card/course-badge-card';
import { trackerLinks } from '../../../utils/tracker-links';

/**
 * Course Badges listing, filterable by state.
 *
 * The course-type chips (Masterclass / Podcast / Nano-Learning) and the `?course_type=`
 * parameter that seeded them are gone: `badges/page/` ships a `masterclass_badges` section
 * and nothing for the other two, so a chip row with one chip in it filtered nothing. Bring
 * both back together if those sections appear.
 */
@Component({
  selector: 'app-course-badges',
  imports: [BadgeFilterChips, Button, CourseBadgeCard, ErrorState, NgIcon, RouterLink],
  providers: [provideIcons({ lucideArrowLeft })],
  templateUrl: './course-badges.html',
  host: { class: 'block' },
})
export class CourseBadges {
  private readonly facade = inject(CairaBadgesFacade);
  private readonly actions = inject(BadgeActions);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly trackerHome = trackerLinks().home;

  protected readonly filters = COURSE_BADGE_FILTERS;
  protected readonly filter = linkedSignal<BadgeFilter>(() => 'all');

  protected readonly items = this.facade.masterclassBadges;

  /** Client-side: the endpoint exposes no status filter, so the chips narrow what loaded. */
  protected readonly visible = computed(() =>
    this.items().filter((badge) => matchesBadgeFilter(badge, this.filter())),
  );

  /** Counts what has loaded — the endpoint exposes no total for earned badges. */
  protected readonly earnedCount = computed(() => this.items().filter(isEarned).length);

  protected readonly totalCount = this.facade.masterclassCount;
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
          if (entries.some((e) => e.isIntersecting)) this.facade.loadMoreMasterclass();
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

  protected onActivate(card: MasterclassBadge): void {
    void this.actions.run(card);
  }
}
