import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  contentChild,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  PLATFORM_ID,
  signal,
  TemplateRef,
  viewChild,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs/operators';
import { SwiperOptions } from 'swiper/types';
import { ensureSwiperElement } from '../../utils/swiper/ensure-swiper-element';
import { NgIcon } from '@ng-icons/core';
import { Heading } from '../heading/heading';
import { filterIcon } from '@core/constants/icon';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { Hover } from '../cards/hover/hover';
import {
  apiDataToDialogShape,
  ApiCourseType,
  CourseFilterSelection,
  dialogShapeToSelection,
  isEmptySelection,
  SectionApiKey,
} from '@core/models/library-filters.model';
import { SectionFiltersFacade } from '@core/services/section-filters-facade/section-filters-facade';

/**
 * Swiper's own pagination stylesheet, injected into `<swiper-container>`'s
 * shadow root.
 *
 * `swiper/element` ships only the core stylesheet: a module passed as JS (see
 * `modules` below) never gets its CSS, so the bullets render as real-but-
 * unstyled 0x0 nodes and the rail silently has no dots. The element bundle
 * would carry them, but it also drags in every other module.
 *
 * Verbatim from `swiper/modules/pagination-element.min.css` (swiper 12.2.0),
 * minus the progressbar / fraction / vertical / rtl variants this app has no
 * use for. Re-copy that file on a swiper major.
 */
const PAGINATION_STYLES = `
  .swiper-pagination{position:absolute;text-align:center;transform:translateZ(0);transition:opacity .3s;z-index:10}
  .swiper-pagination.swiper-pagination-hidden{opacity:0}
  .swiper-pagination-disabled>.swiper-pagination,.swiper-pagination.swiper-pagination-disabled{display:none!important}
  .swiper-pagination-bullets-dynamic{font-size:0;overflow:hidden}
  .swiper-pagination-bullets-dynamic .swiper-pagination-bullet{position:relative;transform:scale(.33)}
  .swiper-pagination-bullets-dynamic .swiper-pagination-bullet-active,.swiper-pagination-bullets-dynamic .swiper-pagination-bullet-active-main{transform:scale(1)}
  .swiper-pagination-bullets-dynamic .swiper-pagination-bullet-active-prev{transform:scale(.66)}
  .swiper-pagination-bullets-dynamic .swiper-pagination-bullet-active-prev-prev{transform:scale(.33)}
  .swiper-pagination-bullets-dynamic .swiper-pagination-bullet-active-next{transform:scale(.66)}
  .swiper-pagination-bullets-dynamic .swiper-pagination-bullet-active-next-next{transform:scale(.33)}
  .swiper-pagination-bullet{background:var(--swiper-pagination-bullet-inactive-color,#000);border-radius:var(--swiper-pagination-bullet-border-radius,50%);display:inline-block;height:var(--swiper-pagination-bullet-height,var(--swiper-pagination-bullet-size,8px));opacity:var(--swiper-pagination-bullet-inactive-opacity,.2);width:var(--swiper-pagination-bullet-width,var(--swiper-pagination-bullet-size,8px))}
  button.swiper-pagination-bullet{appearance:none;border:none;box-shadow:none;margin:0;padding:0}
  .swiper-pagination-clickable .swiper-pagination-bullet{cursor:pointer}
  .swiper-pagination-bullet:only-child{display:none!important}
  .swiper-pagination-bullet-active{background:var(--swiper-pagination-color,var(--swiper-theme-color));opacity:var(--swiper-pagination-bullet-opacity,1)}
  .swiper-horizontal>.swiper-pagination-bullets .swiper-pagination-bullet,.swiper-pagination-horizontal.swiper-pagination-bullets .swiper-pagination-bullet{margin:0 var(--swiper-pagination-bullet-horizontal-gap,4px)}
  .swiper-horizontal>.swiper-pagination-bullets.swiper-pagination-bullets-dynamic,.swiper-pagination-horizontal.swiper-pagination-bullets.swiper-pagination-bullets-dynamic{left:50%;transform:translateX(-50%);white-space:nowrap}
  .swiper-horizontal>.swiper-pagination-bullets.swiper-pagination-bullets-dynamic .swiper-pagination-bullet,.swiper-pagination-horizontal.swiper-pagination-bullets.swiper-pagination-bullets-dynamic .swiper-pagination-bullet{transition:transform .2s,left .2s}
`;

/**
 * Carousel filter configuration. When `courseType` + `section` are both set
 * (and `trackId` if `section === 'track'`), the carousel attempts API-driven
 * filtering via `/v2/filters/`. On API failure/empty response, falls back to
 * client-side extraction from the rendered cards.
 */
export interface CarouselFilterConfig {
  filterEnabled: boolean;
  courseType?: ApiCourseType;
  section?: SectionApiKey;
  trackId?: number;
}

/** Mode used by the most recently opened filter dialog. */
type FilterMode = 'api' | 'client';

@Component({
  selector: 'app-carousel',
  imports: [NgTemplateOutlet, NgIcon, Heading, Hover],
  templateUrl: './carousel.html',
  styleUrl: './carousel.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  host: { class: 'w-full flex flex-col space-y-4' },
})
export class Carousel {
  readonly cardTemplate = contentChild<TemplateRef<unknown>>(TemplateRef);

  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly injector = inject(Injector);
  private readonly sectionFilters = inject(SectionFiltersFacade);

  private readonly swiperContainerRef = viewChild<ElementRef<HTMLElement>>('swiperContainer');
  private swiperEl: ElementRef<HTMLElement> | null = null;
  private isDestroyed = false;
  private previousCount = 0;
  /** Set when growth is driven by a loadMore tail-append, so scroll is preserved. */
  private appendingMore = false;

  /**
   * Section title rendered above the rail. Optional: a page that already owns
   * its own heading (AI Labs) renders the carousel bare rather than stacking a
   * second <h2> on top of the one it already wrote.
   */
  heading = input<{ text: string; subText?: string }>();
  /**
   * Presentation. `peek` centres the active slide and shrinks/fades its
   * neighbours — pair it with `centeredSlides` + `freeMode: { enabled: false }`
   * in `swiperConfig`, or nothing snaps to centre.
   */
  readonly variant = input<'default' | 'peek'>('default');
  cards = input.required<any[]>();
  swiperConfig = input<SwiperOptions>();
  filterConfig = input<CarouselFilterConfig>({ filterEnabled: false });
  isLoading = input<boolean>(false);
  skeletonClass = input<string>('aspect-9/16');
  appliedFilters = signal<any>({ hasFilters: false });
  filterOptions = signal<any>({});

  /**
   * Selection state when the dialog last applied in API mode. Used to (a)
   * pre-check options when re-opening the dialog and (b) drive the filter
   * badge count alongside `appliedFilters` (client-mode badge).
   */
  private readonly apiSelection = signal<CourseFilterSelection | null>(null);

  shouldHoverAnimate = input<boolean>(false);

  icons = signal({ filterIcon });
  readonly loadMore = output<void>();
  /**
   * Emitted after API-mode filter apply. Page bindings forward this to
   * `FeatureResource.setFilters($event)` (or `setTrackFilters(trackId, $event)`
   * for the track section).
   */
  readonly filtersChanged = output<CourseFilterSelection>();

  constructor() {
    this.destroyRef.onDestroy(() => this.cleanup());

    afterNextRender(() => {
      this.extractClientFilters();
    });

    // Initialize Swiper once its host element becomes available (after @defer loads).
    effect(() => {
      const el = this.swiperContainerRef();
      if (!el || this.swiperEl) return;
      if (!isPlatformBrowser(this.platformId) || this.isDestroyed) return;
      this.swiperEl = el;
      afterNextRender(
        () => {
          if (this.isDestroyed) return;
          this.initSwiper();
        },
        { injector: this.injector },
      );
    });

    // Keep Swiper in sync whenever the rendered slide set changes. Swiper is
    // initialized with `init="false"` and caches its slide list, so after
    // Angular's @for adds/removes <swiper-slide> nodes we must call
    // `swiper.update()` for it to re-register them — otherwise a removed
    // bookmark leaves a stale slide and a prepended one never registers.
    effect(() => {
      const count = this.filteredCards().length;
      const swiper = this.swiperEl?.nativeElement && (this.swiperEl.nativeElement as any).swiper;
      if (!swiper) {
        this.previousCount = count;
        return;
      }

      const prev = this.previousCount;
      this.previousCount = count;
      if (count === prev) return;

      // Preserve the scroll offset only for a loadMore tail-append. For a
      // removal, a prepended bookmark, or a filter change we let Swiper
      // re-clamp so the !removed / new front slide is positioned correctly.
      const keepScroll = this.appendingMore && count > prev;
      this.appendingMore = false;
      const prevTranslate = swiper.translate;

      afterNextRender(
        () => {
          if (this.isDestroyed) return;
          const current =
            this.swiperEl?.nativeElement && (this.swiperEl.nativeElement as any).swiper;
          if (!current) return;
          current.update();
          if (keepScroll) current.setTranslate(prevTranslate);
        },
        { injector: this.injector },
      );
    });
  }

  /**
   * True when any filter is currently applied — covers both API mode
   * (`apiSelection` populated) and client mode (`appliedFilters.hasFilters`).
   * Drives the badge dot/count in the template.
   */
  readonly hasAppliedFilters = computed(() => {
    const api = this.apiSelection();
    if (api && !isEmptySelection(api)) return true;
    return !!this.appliedFilters().hasFilters;
  });

  filteredCards = computed(() => {
    const filters = this.appliedFilters();
    const source = this.cards();

    // Happy path: no filters → return source as-is (identity-stable).
    if (!filters.hasFilters) {
      return source;
    }

    let cards = [...source];

    // Apply filters dynamically for each filter category
    Object.keys(filters).forEach((filterKey) => {
      if (filterKey === 'hasFilters') return;

      const selectedItems = filters[filterKey];
      if (selectedItems && selectedItems.length > 0) {
        const selectedIds = selectedItems
          .filter((item: any) => item.selected)
          .map((item: any) => item.id);

        if (selectedIds.length > 0) {
          cards = this.applyFilterForCategory(cards, filterKey, selectedIds);
        }
      }
    });

    return cards;
  });

  private cleanup(): void {
    this.isDestroyed = true;
    if (this.swiperEl?.nativeElement) {
      const instance = (this.swiperEl.nativeElement as any).swiper;
      if (instance) instance.destroy(true, true);
    }
    this.swiperEl = null;
  }

  private async initSwiper(): Promise<void> {
    if (!this.swiperEl?.nativeElement) {
      return;
    }

    // Register swiper's custom elements on demand, then bail if the component
    // was destroyed while the (one-time) import was in flight.
    // swiper/modules loads alongside swiper/element, not with this component.
    const [, { FreeMode, Mousewheel, Pagination }] = await Promise.all([
      ensureSwiperElement(),
      import('swiper/modules'),
    ]);
    if (this.isDestroyed || !this.swiperEl?.nativeElement) {
      return;
    }

    // Defaults first, caller last: `swiperConfig` has to be able to turn
    // freeMode off, because freeMode never snaps and so can't hold a centred
    // active slide (`centeredSlides` + `loop`). Every existing caller passes a
    // preset from swiper.config.ts, none of which sets these keys, so the
    // resolved params are unchanged for them.
    const swiperParams: SwiperOptions = {
      direction: 'horizontal',
      mousewheel: {
        forceToAxis: true,
      },
      // Off by default: without the injected stylesheet above, dots never
      // actually rendered for any existing caller — turning them on for all of
      // them now would be a change none of those pages asked for. Opt in through
      // `swiperConfig`.
      pagination: false,
      freeMode: { enabled: true, sticky: false, minimumVelocity: 1 },
      ...this.swiperConfig(),
      modules: [Mousewheel, Pagination, FreeMode],
    };
    if (swiperParams.pagination) {
      swiperParams.injectStyles = [PAGINATION_STYLES];
    }
    Object.assign(this.swiperEl.nativeElement, swiperParams);
    (this.swiperEl.nativeElement as any).initialize();

    // Capture the handler reference so we can detach it on destroy.
    // Without this, navigating away leaves the Swiper instance with a
    // dangling listener bound to a destroyed component's `loadMore` output.
    const swiper = (this.swiperEl.nativeElement as any).swiper;
    const onReachEnd = () => {
      // Mark this growth as a tail-append so the count effect preserves scroll.
      this.appendingMore = true;
      this.loadMore.emit();
    };
    swiper.on('reachEnd', onReachEnd);
    this.destroyRef.onDestroy(() => swiper.off('reachEnd', onReachEnd));
  }

  /**
   * Builds the client-side filter universe from the rendered card data. Used
   * both before render (initial extraction) and as the fallback path when the
   * server filter API isn't available for this section.
   */
  private extractClientFilters(): void {
    if (!this.filterConfig().filterEnabled) return;

    // Define filter extraction configuration - easily extensible for new filter types
    const filterExtractionConfig = this.getFilterExtractionConfig();

    const filterMaps: Record<string, Map<any, any>> = {};

    // Initialize filter maps
    filterExtractionConfig.forEach(
      (config: { key: string; cardField: string; isArray?: boolean; isCustom?: boolean }) => {
        filterMaps[config.key] = new Map();

        // Handle custom filters (like CPE Credits) - generate options once
        if (config.isCustom && config.key === 'cpe_credits') {
          const cpeOptions = [
            { id: 'less_than_2', credits_range: 'Less than 2 credits', selected: false },
            { id: '2_to_5', credits_range: '2 to 5 credits', selected: false },
            { id: 'greater_than_5', credits_range: 'Greater than 5 credits', selected: false },
          ];
          cpeOptions.forEach((option) => {
            filterMaps[config.key].set(option.id, option);
          });
        }
      },
    );

    // Extract filter options from cards
    this.cards().forEach((card: any) => {
      filterExtractionConfig.forEach(
        (config: { key: string; cardField: string; isArray?: boolean; isCustom?: boolean }) => {
          // Skip custom filters as they're already handled above
          if (config.isCustom) return;

          const fieldData = card[config.cardField];

          if (config.isArray && Array.isArray(fieldData)) {
            // Handle array fields
            fieldData.forEach((item: any) => {
              if (item?.id) {
                filterMaps[config.key].set(item.id, { ...item, selected: false });
              }
            });
          } else if (fieldData?.id) {
            // Handle single object fields
            filterMaps[config.key].set(fieldData.id, { ...fieldData, selected: false });
          }
        },
      );
    });

    // Convert maps to arrays and build final options
    const baseOptions: Record<string, any[]> = {};
    Object.keys(filterMaps).forEach((key) => {
      const mapValues = Array.from(filterMaps[key].values());
      if (mapValues.length > 0) {
        baseOptions[key] = mapValues;
      }
    });

    this.filterOptions.set({ ...baseOptions });
  }

  openFilterDialog(): void {
    // Only open dialog on client side
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const cfg = this.filterConfig();
    const apiCapable =
      !!cfg.courseType && !!cfg.section && (cfg.section !== 'track' || cfg.trackId != null);

    if (!apiCapable) {
      this.extractClientFilters();
      this.openDialog(this.filterOptions(), 'client');
      return;
    }

    this.sectionFilters
      .fetch(cfg.courseType!, cfg.section!, cfg.trackId)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        if (!data) {
          // Fall back silently — no toast, no empty dialog.
          this.extractClientFilters();
          this.openDialog(this.filterOptions(), 'client');
        } else {
          this.openDialog(apiDataToDialogShape(data, this.apiSelection()), 'api');
        }
      });
  }

  private async openDialog(data: Record<string, any[]>, mode: FilterMode): Promise<void> {
    // Loaded on open, so the dialog is not part of this component's chunk (§4.4).
    const { FilterDialog } = await import('../../dialogs/filter-dialog/filter-dialog');
    const dialogRef = this.dialogs.open<Record<string, any[]>, Record<string, any[]>>(
      FilterDialog,
      { data },
    );

    dialogRef.afterClosed
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((result: any) => {
        if (!result) return;
        if (mode === 'api') {
          this.handleApiDialogResult(result);
        } else {
          this.handleClientDialogResult(result);
        }
      });
  }

  /** Client-side mode: apply selections in-memory via `filteredCards`. */
  private handleClientDialogResult(result: Record<string, any[]>): void {
    let hasFilters = false;
    Object.keys(result).forEach((key) => {
      if (Array.isArray(result[key]) && result[key].some((item: any) => item.selected)) {
        hasFilters = true;
      }
    });

    const filtersWithState = { ...result, hasFilters };
    this.appliedFilters.set(filtersWithState);
    this.filterOptions.set(result);
  }

  /** API-mode: emit a `CourseFilterSelection` so the page can refetch the listing. */
  private handleApiDialogResult(result: Record<string, any[]>): void {
    const selection = dialogShapeToSelection(result);
    this.apiSelection.set(selection);
    // Don't touch `appliedFilters` — in API mode the listing API filters the
    // results server-side, and `filteredCards()` must pass cards through.
    this.filtersChanged.emit(selection);
  }

  getAppliedFilterCount(): number {
    // API mode wins when there's an active server-side selection.
    const api = this.apiSelection();
    if (api) {
      let count = 0;
      for (const vals of Object.values(api)) {
        if (Array.isArray(vals)) count += vals.length;
      }
      if (count > 0) return count;
    }

    const filters = this.appliedFilters();
    let count = 0;
    Object.keys(filters).forEach((key) => {
      if (key !== 'hasFilters' && Array.isArray(filters[key])) {
        count += filters[key].filter((item: any) => item.selected).length;
      }
    });
    return count;
  }

  private applyFilterForCategory(cards: any[], filterKey: string, selectedIds: any[]): any[] {
    const config = this.getFilterExtractionConfig().find((c) => c.key === filterKey);
    if (!config) return cards;

    return cards.filter((card) => {
      const fieldData = card[config.cardField];

      if (config.isCustom && filterKey === 'cpe_credits') {
        const credits = parseFloat(fieldData);
        if (isNaN(credits)) return false;

        return selectedIds.some((id) => {
          if (id === 'less_than_2') return credits < 2;
          if (id === '2_to_5') return credits >= 2 && credits <= 5;
          if (id === 'greater_than_5') return credits > 5;
          return false;
        });
      }

      if (config.isArray && Array.isArray(fieldData)) {
        return fieldData.some((item: any) => selectedIds.includes(item.id));
      } else if (fieldData?.id) {
        return selectedIds.includes(fieldData.id);
      }

      // Fallback for primitive values if needed, though current config uses objects/IDs
      return selectedIds.includes(fieldData);
    });
  }

  /**
   * Configuration for extracting filter options from card data.
   * To add a new filter type:
   * 1. Add configuration here with: { key: 'filterName', cardField: 'card_field_name', isArray?: boolean }
   * 2. Add display configuration in filter.ts filterCategoryConfigs
   * 3. Add filter logic in applyFilterForCategory method
   */
  private getFilterExtractionConfig(): {
    key: string;
    cardField: string;
    isArray?: boolean;
    isCustom?: boolean;
  }[] {
    return [
      { key: 'topics', cardField: 'course_category_details' },
      { key: 'experts', cardField: 'instructor_details' },
      { key: 'cpe_credits', cardField: 'cpe_credits', isCustom: true },
      { key: 'completion_date', cardField: 'completion_date_range' },
      // Add more filter types here as needed:
      // { key: 'tags', cardField: 'tag_details' },
      // { key: 'departments', cardField: 'department_details' },
    ];
  }
}
