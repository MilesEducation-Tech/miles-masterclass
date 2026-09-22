import { isPlatformBrowser } from '@angular/common';
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
  resource,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import {
  badgeNextPage,
  badgeTotalCount,
  BadgeCourseType,
  BadgeFilter,
  BadgeV2Response,
  COURSE_BADGE_FILTERS,
  COURSE_BADGE_TYPES,
  CourseBadgeItem,
  isEarnedState,
  matchesBadgeFilter,
} from '@core/models/caira-badge.model';
import { ApiClient } from '@core/services/api-client/api-client';
import { Button } from '@shared/components/ui/button/button';
import { ErrorState } from '@shared/components/ui/error-state/error-state';
import { withPreviousValue } from '@shared/utils/with-previous-value';
import { BadgeFilterChips } from '../shared/components/badge-filter-chips/badge-filter-chips';
import { CourseBadgeCard } from '../shared/components/course-badge-card/course-badge-card';
import { BadgeActions } from '../shared/services/badge-actions/badge-actions';
import { trackerLinks } from '../shared/utils/tracker-links';

const EMPTY: BadgeV2Response<CourseBadgeItem[]> = { data: [] };

const VALID_TYPES = COURSE_BADGE_TYPES.map((t) => t.value).filter(
  (v): v is BadgeCourseType => v !== null,
);

/**
 * Course Badges listing — masterclass / podcast / nano-learning, filterable by
 * course type as well as state. Seeded from `?course_type=` so the tracker's
 * per-row "View All" lands on the right slice.
 */
@Component({
  selector: 'app-course-badges',
  imports: [BadgeFilterChips, Button, CourseBadgeCard, ErrorState, NgIcon, RouterLink],
  providers: [provideIcons({ lucideArrowLeft })],
  templateUrl: './course-badges.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class CourseBadges {
  private readonly api = inject(ApiClient);
  private readonly actions = inject(BadgeActions);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly trackerHome = trackerLinks().home;

  protected readonly filters = COURSE_BADGE_FILTERS;
  protected readonly types = COURSE_BADGE_TYPES;

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** Unknown values fall through to "All" rather than querying a bogus type. */
  private readonly typeParam = computed<BadgeCourseType | null>(() => {
    const raw = this.queryParams().get('course_type') as BadgeCourseType | null;
    return raw && VALID_TYPES.includes(raw) ? raw : null;
  });

  protected readonly courseType = linkedSignal<BadgeCourseType | null, BadgeCourseType | null>({
    source: this.typeParam,
    computation: (param) => param,
  });

  // Both reset when the course type changes — the `linkedSignal` equivalent of
  // the reset `effect` the library facades use.
  protected readonly filter = linkedSignal<BadgeCourseType | null, BadgeFilter>({
    source: this.courseType,
    computation: () => 'all',
  });
  private readonly page = linkedSignal<BadgeCourseType | null, number>({
    source: this.courseType,
    computation: () => 1,
  });

  private readonly listResource = resource({
    params: () =>
      this.isBrowser ? { courseType: this.courseType(), page: this.page() } : undefined,
    loader: ({ params, abortSignal }) => {
      const httpParams: Record<string, string | number> = { page: params.page };
      if (params.courseType) httpParams['course_type'] = params.courseType;
      return firstValueFrom(
        this.api
          .get<BadgeV2Response<CourseBadgeItem[]>>('v2/course-badges/', { params: httpParams })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: EMPTY },
      );
    },
  });

  /** Stale-while-revalidate, so loading page 2 never blanks page 1. */
  private readonly list = withPreviousValue(this.listResource);

  /** Page 1 replaces; every later page appends. */
  protected readonly items = linkedSignal({
    source: this.list.snapshot,
    computation: (snap, previous): CourseBadgeItem[] => {
      if (snap.status !== 'resolved') return previous?.value ?? [];
      const data = snap.value?.data ?? [];
      return untracked(() => this.page()) === 1 ? data : [...(previous?.value ?? []), ...data];
    },
  });

  protected readonly visible = computed(() =>
    this.items()
      .filter((b) => matchesBadgeFilter(b.action_state, this.filter()))
      // The API has no `webinar` exclusion, and webinar badges have their own
      // page — keep them out of the course grid.
      .filter((b) => b.course.course_type !== 'webinar'),
  );

  /** Counts what has loaded — the API exposes no total for earned badges yet. */
  protected readonly earnedCount = computed(
    () => this.items().filter((b) => isEarnedState(b.action_state)).length,
  );

  protected readonly totalCount = computed(() =>
    badgeTotalCount(this.list.value()?.pagination_data),
  );
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
    const next = badgeNextPage(this.list.value()?.pagination_data);
    if (next !== null && next !== this.page()) this.page.set(next);
  }

  protected onFilter(value: string | null): void {
    this.filter.set((value ?? 'all') as BadgeFilter);
  }

  protected onType(value: string | null): void {
    this.courseType.set(value as BadgeCourseType | null);
  }

  protected retry(): void {
    this.listResource.reload();
  }

  protected async onActivate(card: CourseBadgeItem): Promise<void> {
    if (await this.actions.run(BadgeActions.fromCourse(card))) this.listResource.reload();
  }
}
