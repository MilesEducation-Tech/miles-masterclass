import { httpResource } from '@angular/common/http';
import { Injector, Service, computed, inject } from '@angular/core';
import { ApiClient } from '../../../../shared/core/services/api-client/api-client';
import { Auth } from '../../../../shared/core/services/auth/auth';
import { CAIRA } from '../../../../shared/core/http/caira.endpoints';
import { cairaError } from '../../../../shared/core/http/caira-error';
import {
  CompletedCourseSectionResponse,
  CourseCard,
  CourseLevelRail,
  CourseSectionResponse,
  CourseStatus,
  TopSectionResponse,
  courseSectionToCard,
  groupByLevel,
  topSectionToCard,
} from '../../../../shared/core/models/caira/masterclass.model';
import { CourseFeed, courseFeed, emptyCourseFeed } from '../course-feed/course-feed';

/** The rails `masterclass.ts` asks for by name. */
export type FeedKey =
  | 'popular'
  | 'inprogress'
  | 'recommended'
  | 'complimentary'
  | 'becauseYouWatched'
  | 'track'
  | 'bookmark'
  | 'completed'
  | 'comingSoon';

export interface FeedOptions {
  requiresAuth?: boolean;
}

/**
 * The masterclass home rails.
 *
 * **Must stay auto-provided.** `Utils.applyBookmarkChange` and
 * `refreshPersonalized` broadcast into this instance; providing it route-scoped
 * forks it and the broadcast lands where nobody is listening. This is the
 * documented exception to the route-scoped-facade rule.
 *
 * Nine rails are requested; CAIRA can serve four, and two of those are views
 * over one request rather than requests of their own:
 *
 * | Rail          | Source                                              |
 * |---------------|-----------------------------------------------------|
 * | `popular`     | #1 `Top_Section/` — auth-optional, so it server-renders |
 * | `track`       | #2 grouped by level                                  |
 * | `inprogress`  | #2 filtered to `course_status === 2`                 |
 * | `completed`   | #3 `Completed_Masterclass_Course_Section/`           |
 * | the other 5   | no endpoint — `emptyCourseFeed()`, see G-22          |
 *
 * Every section in `masterclass.html` is `@if`-guarded on `items().length`, so
 * an unsourced rail renders nothing rather than an empty carousel.
 */
@Service()
export class FeatureFacade {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(Auth);
  private readonly injector = inject(Injector);

  private readonly cache = new Map<string, CourseFeed<never>>();

  /**
   * The catalog, fetched once. Two rails read it, so it is a resource here
   * rather than a `courseFeed` — `levelRails` needs the raw rows to group by
   * level *before* they become cards, and `inprogress` needs the mapped cards.
   *
   * `pageSize` is the server's own clamp: one request gets everything.
   */
  private readonly catalog = httpResource<CourseSectionResponse | undefined>(
    () => `${this.api.absoluteUrl(CAIRA.courseSection)}?limit=100&page=1`,
    { defaultValue: undefined, injector: this.injector },
  );

  private readonly catalogRows = computed(() => this.catalog.value()?.all_courses ?? []);

  /** Per-level rails for the "tracks" section — level is CAIRA's organising dimension. */
  readonly levelRails = computed<CourseLevelRail[]>(() => groupByLevel(this.catalogRows()));

  private readonly catalogCards = computed<CourseCard[]>(() =>
    this.catalogRows().map((c) => courseSectionToCard(c)),
  );

  private readonly catalogError = computed(() => {
    const err = this.catalog.error();
    return err ? cairaError(err) : null;
  });

  /** Catalog cards keyed by course id, for enriching the pinned rail. */
  private readonly catalogById = computed(() => {
    const index = new Map<string, CourseCard>();
    for (const card of this.catalogCards()) index.set(card.id, card);
    return index;
  });

  /**
   * Fill in the facts `Top_Section` does not carry.
   *
   * #1 returns exactly 8 keys — no credits, no level, no fields of study, no
   * badge flag — so a pinned card rendered straight from it shows **"0 CPE"**
   * and no level chip. The same courses appear in #2 *with* all of that, and
   * the catalog is already loaded for the level rails, so this is a join over
   * data we have rather than an extra request.
   *
   * The instructor stays from #1: it is the only endpoint of the two that
   * returns one, and the hero rail reads it unguarded.
   */
  private enrich(cards: CourseCard[]): CourseCard[] {
    const index = this.catalogById();
    if (index.size === 0) return cards;
    return cards.map((card) => {
      const full = index.get(card.id);
      if (!full) return card;
      return {
        ...card,
        class_credits: full.class_credits,
        fields_of_study: full.fields_of_study,
        caira_level: full.caira_level,
        has_individual_badge: full.has_individual_badge,
        course_status: full.course_status,
      };
    });
  }

  getResource(key: 'track', type?: string, options?: FeedOptions): CourseFeed<CourseLevelRail>;
  getResource(key: FeedKey, type?: string, options?: FeedOptions): CourseFeed<CourseCard>;
  getResource(key: FeedKey, type = 'masterclass', options: FeedOptions = {}): CourseFeed<never> {
    const cacheKey = `${key}:${type}`;
    const hit = this.cache.get(cacheKey);
    if (hit) return hit;
    const feed = this.build(key, options) as CourseFeed<never>;
    this.cache.set(cacheKey, feed);
    return feed;
  }

  private build(key: FeedKey, options: FeedOptions): CourseFeed<CourseCard | CourseLevelRail> {
    switch (key) {
      // #1 — pinned courses. Auth-optional, so this is what an anonymous
      // crawler sees on /masterclass, and why the route stays server-rendered.
      case 'popular': {
        const pinned = courseFeed<TopSectionResponse>({
          url: () => this.api.absoluteUrl(CAIRA.topSection),
          select: (body) => ({
            items: (body?.data ?? []).map(topSectionToCard),
            total: body?.total_count ?? 0,
          }),
          injector: this.injector,
        });
        // Credits/level/fields come from the catalog — see `enrich`.
        return { ...pinned, items: computed(() => this.enrich(pinned.items())) };
      }

      // #3 — auth required. Reuses #2's item shape but omits `course_status`,
      // so CLOSED is passed explicitly: defaulting would render "Watch Now" on
      // a course the learner has finished.
      case 'completed':
        return courseFeed<CompletedCourseSectionResponse>({
          url: () => this.gated(options, CAIRA.completedCourseSection),
          select: (body) => ({
            items: (body?.all_courses ?? []).map((c) =>
              courseSectionToCard(c, CourseStatus.CLOSED),
            ),
            total: body?.total_count ?? 0,
          }),
          injector: this.injector,
        });

      // Derived, not fetched. CAIRA has no "continue watching" endpoint, but #2
      // reports `course_status` per course and `2` is enrolled-and-in-progress.
      // Anonymous callers always get `1`, so this is naturally empty logged out.
      case 'inprogress':
        return this.view(() =>
          this.catalogCards().filter((c) => c.course_status === CourseStatus.IN_PROGRESS),
        );

      // The template iterates `track.items()` for the grouping and reads
      // `item.content` / `item.title` / `item.ids[0]` off each entry, so this
      // rail's items are rails, not cards. Hence the generic.
      case 'track':
        return this.view(() => this.levelRails());

      // No endpoint: no recommendation engine, no bookmarks list, no
      // coming-soon flag, no company relation. G-18, G-22.
      case 'recommended':
      case 'complimentary':
      case 'becauseYouWatched':
      case 'bookmark':
      case 'comingSoon':
        return emptyCourseFeed<CourseCard>();
    }
  }

  /** Auth-gated feeds return `undefined` when signed out, which skips the request. */
  private gated(options: FeedOptions, path: string): string | undefined {
    if (options.requiresAuth && !this.auth.isAuthenticated()) return undefined;
    return this.api.absoluteUrl(path);
  }

  /** A rail that is a projection of `catalog` rather than its own request. */
  private view<TItem>(project: () => TItem[]): CourseFeed<TItem> {
    return {
      ...emptyCourseFeed<TItem>(),
      items: computed(project),
      isLoading: this.catalog.isLoading,
      error: this.catalogError,
      reload: () => void this.catalog.reload(),
    };
  }
}
