import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { SwiperStrip } from '../swiper-strip/swiper-strip';
import { swiperConfigEven } from '@core/config/swiper.config';
import { WebinarCard as WebinarCardModel } from '../../models/webinar.model';
import { BRAND_MARKS } from '../../utils/brand-assets';
import { WebinarBucket } from '../../utils/webinar-status';
import { WebinarCard } from '../webinar-card/webinar-card';

/** One entry in the level filter. */
export interface LevelTab {
  number: number;
  /** The server's own wording — `Level 2` — not a client-built string. */
  name: string;
}

/**
 * A titled section of webinar cards.
 *
 * Renders nothing at all when empty unless `showWhenEmpty` is set. The five
 * buckets are always PRESENT in the response — empty rather than omitted — so
 * "no absences" and "not signed in" both arrive as `[]`, and a heading over an
 * empty grid reads as a fault rather than good news.
 *
 * Two presentations, picked with `layout`:
 * - `rows` — full-width rows, what the upcoming section uses.
 * - `strip` — a horizontally scrolling Swiper rail of cards, which is how the
 *   attended / absent / missed sections have always rendered. It carries the v2
 *   `swiperConfigEven` preset verbatim, so the 1.1 / 2 / 2.8 slides-per-view
 *   breakpoints are the same ones those rails shipped with.
 *
 * The CAIRA wordmark, the level filter and "Show more" paging are opt-in,
 * because only the upcoming section wants them. Paging is ignored by `strip`:
 * a strip scrolls, so there is nothing for a "Show more" to reveal.
 */
@Component({
  selector: 'app-webinar-rail',
  host: { class: 'block' },
  imports: [SwiperStrip, WebinarCard],
  templateUrl: './webinar-rail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebinarRail {
  readonly heading = input.required<string>();
  readonly description = input<string | null>(null);
  readonly webinars = input.required<readonly WebinarCardModel[]>();
  readonly bucket = input.required<WebinarBucket>();
  readonly registeringIds = input<ReadonlySet<string>>(new Set());
  /** `rows` for the upcoming section, `strip` for the three past ones. */
  readonly layout = input<'rows' | 'strip'>('rows');
  readonly showWhenEmpty = input(false);
  readonly emptyMessage = input('Nothing here yet.');

  /** Lead the heading with the CAIRA wordmark, as the upcoming section does. */
  readonly withCairaMark = input(false);
  /** Offer the Level 1/2/3 filter, built from whatever levels the feed carries. */
  readonly withLevelTabs = input(false);
  /** Rows to show before "Show more". `0` shows everything and hides the button. */
  readonly pageSize = input(0);

  readonly register = output<string>();
  readonly join = output<string>();

  protected readonly cairaMark = BRAND_MARKS.caira;
  /** The v2 preset these rails used, unchanged. */
  protected readonly stripConfig = swiperConfigEven;

  protected readonly isStrip = computed(() => this.layout() === 'strip');

  /**
   * The level filter, derived from the data rather than hardcoded to three.
   *
   * A fixed Level 1/2/3 bar would offer a tab that filters to nothing the first
   * time a month has no Level 3 session — which looks like a broken filter, not
   * an empty month.
   */
  protected readonly levels = computed<LevelTab[]>(() => {
    if (!this.withLevelTabs()) return [];

    const byNumber = new Map<number, string>();
    for (const webinar of this.webinars()) {
      const level = webinar.level_details;
      if (level && !byNumber.has(level.level_number)) {
        byNumber.set(level.level_number, level.level_name);
      }
    }

    // One level is not a choice, so do not render a filter for it.
    if (byNumber.size < 2) return [];

    return [...byNumber.entries()]
      .sort(([a], [b]) => a - b)
      .map(([number, name]) => ({ number, name }));
  });

  /**
   * `null` means "no filter", which is both the no-levels case and the state
   * before a tab exists. `linkedSignal` so a feed reload keeps the learner on
   * the tab they picked, as long as that level is still in the response.
   */
  protected readonly selectedLevel = linkedSignal<LevelTab[], number | null>({
    source: this.levels,
    computation: (levels, previous) => {
      if (levels.length === 0) return null;
      const kept = previous?.value ?? null;
      return levels.some((level) => level.number === kept) ? kept : levels[0].number;
    },
  });

  protected readonly filtered = computed(() => {
    const level = this.selectedLevel();
    const all = this.webinars();
    if (level === null) return all;
    return all.filter((webinar) => webinar.level_details?.level_number === level);
  });

  /**
   * How many rows are on screen. Re-seeded whenever the filter or the feed
   * changes, so switching to Level 2 does not inherit Level 1's expanded state.
   */
  private readonly visibleCount = linkedSignal<readonly WebinarCardModel[], number>({
    source: this.filtered,
    computation: () =>
      (this.isStrip() ? Number.MAX_SAFE_INTEGER : this.pageSize()) || Number.MAX_SAFE_INTEGER,
  });

  protected readonly visible = computed(() => this.filtered().slice(0, this.visibleCount()));

  protected readonly canShowMore = computed(
    () => !this.isStrip() && this.pageSize() > 0 && this.filtered().length > this.visibleCount(),
  );

  protected showMore(): void {
    this.visibleCount.update((count) => count + this.pageSize());
  }
}
