import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  linkedSignal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { Button } from '@shared/ui/button/button';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { BadgeFilterChips } from '@features/tracker/components/badge-filter-chips/badge-filter-chips';
import { CourseBadgeCard } from '@features/tracker/caira/components/course-badge-card/course-badge-card';
import {
  BadgeFilter,
  COURSE_BADGE_FILTERS,
  EMPTY_BADGES_PAGE,
  isEarned,
  MasterclassBadge,
  matchesBadgeFilter,
  nextSectionPage,
} from '@features/tracker/caira/models/caira-badge-page.model';
import { BadgeActions } from '@features/tracker/caira/services/badge-actions';
import { CairaBadgesApi } from '@features/tracker/caira/services/caira-badges-api';
import { redirectOnSessionLoss } from '@features/tracker/caira/utils/session-redirect';
import { trackerLinks } from '@features/tracker/utils/tracker-links';

/**
 * Course Badges listing, filterable by state.
 *
 * The course-type chips (Masterclass / Podcast / Nano-Learning) and the `?course_type=`
 * parameter that seeded them are gone: `badges/page/` ships a `masterclass_badges` section and
 * nothing for the other two, so a chip row with one chip in it filtered nothing. Bring both
 * back together if those sections appear.
 */
@Component({
  selector: 'app-course-badges',
  imports: [BadgeFilterChips, Button, CourseBadgeCard, ErrorState, NgIcon, RouterLink],
  providers: [provideIcons({ lucideArrowLeft })],
  templateUrl: './course-badges.html',
  host: { class: 'block' },
})
export class CourseBadges {
  private readonly api = inject(CairaBadgesApi);
  private readonly actions = inject(BadgeActions);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly trackerHome = trackerLinks().home;

  protected readonly filters = COURSE_BADGE_FILTERS;
  protected readonly filter = linkedSignal<BadgeFilter>(() => 'all');

  /** Page 1 replaces; every later page appends. */
  protected readonly items = linkedSignal({
    source: this.api.page.snapshot,
    computation: (snap, previous): MasterclassBadge[] => {
      if (snap.status !== 'resolved') return previous?.value ?? [];
      const block = (snap.value ?? EMPTY_BADGES_PAGE).masterclass_badges;
      return block.page === 1 ? block.results : [...(previous?.value ?? []), ...block.results];
    },
  });

  /** Client-side: the endpoint exposes no status filter, so the chips narrow what loaded. */
  protected readonly visible = computed(() =>
    this.items().filter((badge) => matchesBadgeFilter(badge, this.filter())),
  );

  /** Counts what has loaded — the endpoint exposes no total for earned badges. */
  protected readonly earnedCount = computed(() => this.items().filter(isEarned).length);

  protected readonly totalCount = computed(() => this.api.data().masterclass_badges.count);
  protected readonly isLoading = computed(() => this.api.page.isLoading());
  protected readonly hasError = computed(() => !!this.api.page.error());
  protected readonly isFirstPage = computed(() => this.isLoading() && !this.items().length);

  private readonly sentinel = viewChild.required<ElementRef<HTMLDivElement>>('sentinel');

  constructor() {
    redirectOnSessionLoss();

    // `afterNextRender` is browser-only by definition, and the sentinel is unconditionally in
    // the template, so one observer set up once is enough — no `effect`, no re-observing on
    // every data change.
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

    // Leave the shared page where the next visitor expects it: page 1.
    //
    // `CairaBadgesApi` is root-scoped, so a page this listing advanced outlives the listing.
    // Without this, coming back here after scrolling seeds the accumulator from page 2 and the
    // first rows are simply missing, with no way to fetch them.
    //
    // On destroy, NOT in the constructor. Writing this signal while the component is being
    // constructed re-keys the resource that `items` reads, and the navigation dies silently:
    // Angular boots, `<router-outlet>` stays empty and nothing is logged. Measured 2026-10-15 —
    // with the constructor write the page rendered a 5.4 kB shell, without it 68.8 kB.
    //
    // The refetch this triggers is not wasted on the common path: the tracker home renders
    // page 1 of this very section in its rail.
    this.destroyRef.onDestroy(() => this.api.masterclassPage.set(1));
  }

  /** No-ops while a request is in flight, and once the section has no further page — the
   *  sentinel sits in the viewport for as long as the list is short, so it fires repeatedly. */
  private loadNext(): void {
    if (this.isLoading()) return;
    const next = nextSectionPage(this.api.data().masterclass_badges);
    if (next !== null && next !== untracked(this.api.masterclassPage)) {
      this.api.masterclassPage.set(next);
    }
  }

  protected onFilter(value: string | null): void {
    this.filter.set((value ?? 'all') as BadgeFilter);
  }

  protected retry(): void {
    this.api.reload();
  }

  protected onActivate(card: MasterclassBadge): void {
    void this.actions.run(card);
  }
}
