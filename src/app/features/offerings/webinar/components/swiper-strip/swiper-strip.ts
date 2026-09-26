import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
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
  TemplateRef,
  viewChild,
} from '@angular/core';
import type { SwiperOptions } from 'swiper/types';
import { ensureSwiperElement } from '@shared/utils/swiper/ensure-swiper-element';

/**
 * A horizontally scrollable strip of cards, on Swiper's custom elements.
 *
 * This is the Swiper half of `app-carousel` (@shared/components/carousel), and
 * nothing else. That component also owns a filter button, a filter dialog, the
 * API-vs-client filter fallback and the hover-preview card — a ~105-file
 * closure — and every webinar rail passed it
 * `filterConfig: { filterEnabled: false }`. The scroll behaviour is what the
 * rails actually wanted, so that is what this is.
 *
 * Mechanics kept verbatim from that component, because each line of it is load
 * -bearing:
 * - `init="false"` plus a manual `initialize()`, so params are assigned before
 *   Swiper reads them.
 * - `ensureSwiperElement()` registers `swiper/element` (~90 kB) on demand, so
 *   it stays out of the initial bundle.
 * - An effect on slide COUNT calls `update()`. Swiper caches its slide list, so
 *   without this an `@for` that adds or removes a `<swiper-slide>` leaves the
 *   instance out of step with the DOM.
 * - `destroy(true, true)` on teardown, via `DestroyRef`.
 *
 * Cards come in as a content-projected template, so the strip knows nothing
 * about what it is scrolling:
 *
 * ```html
 * <app-swiper-strip [items]="rows()">
 *   <ng-template let-item let-i="$index"><app-my-card [row]="item" /></ng-template>
 * </app-swiper-strip>
 * ```
 */
@Component({
  selector: 'app-swiper-strip',
  imports: [NgTemplateOutlet],
  templateUrl: './swiper-strip.html',
  styleUrl: './swiper-strip.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  host: { class: 'block w-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SwiperStrip {
  readonly items = input.required<readonly unknown[]>();
  /**
   * Swiper params. A preset from `@core/config/swiper.config.ts` is the
   * usual value; anything here overrides the defaults in `initSwiper`.
   */
  readonly swiperConfig = input<SwiperOptions>();
  /** Classes for the placeholder tiles, so they match the real card's shape. */
  readonly skeletonClass = input('aspect-video');

  readonly cardTemplate = contentChild<TemplateRef<unknown>>(TemplateRef);

  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  private readonly containerRef = viewChild<ElementRef<HTMLElement>>('swiperContainer');
  private container: HTMLElement | null = null;
  private isDestroyed = false;
  private previousCount = 0;

  protected readonly config = computed(() => this.swiperConfig());
  protected readonly skeletons = [0, 1, 2, 3];

  constructor() {
    this.destroyRef.onDestroy(() => this.cleanup());

    // Initialise once the host element exists — it appears only after the
    // `@defer` block in the template resolves.
    effect(() => {
      const ref = this.containerRef();
      if (!ref || this.container) return;
      if (!isPlatformBrowser(this.platformId) || this.isDestroyed) return;

      this.container = ref.nativeElement;
      afterNextRender(() => void this.initSwiper(), { injector: this.injector });
    });

    // Re-register slides whenever the rendered set changes size.
    effect(() => {
      const count = this.items().length;
      const swiper = this.swiperInstance();
      if (!swiper) {
        this.previousCount = count;
        return;
      }
      if (count === this.previousCount) return;
      this.previousCount = count;

      afterNextRender(() => this.swiperInstance()?.update(), { injector: this.injector });
    });
  }

  /** Swiper attaches its instance to the element; there is no typed accessor. */
  private swiperInstance(): { update(): void; destroy(a: boolean, b: boolean): void } | null {
    return (this.container as unknown as { swiper?: never } | null)?.swiper ?? null;
  }

  private async initSwiper(): Promise<void> {
    if (!this.container) return;

    // swiper/modules loads alongside swiper/element, not with this component.
    const [, { FreeMode, Mousewheel }] = await Promise.all([
      ensureSwiperElement(),
      import('swiper/modules'),
    ]);
    // The registration import is one-off but still async, so the component can
    // have been torn down while it was in flight.
    if (this.isDestroyed || !this.container) return;

    // Defaults first, caller last, so a preset can turn any of them off.
    // `pagination` is deliberately absent: `swiper/element` ships only the core
    // stylesheet, so bullets from a JS-passed module render as real-but-unstyled
    // 0×0 nodes. These strips signal "more to the right" with a partly visible
    // next card instead, which is what the design does.
    const params: SwiperOptions = {
      direction: 'horizontal',
      mousewheel: { forceToAxis: true },
      freeMode: { enabled: true, sticky: false, minimumVelocity: 1 },
      ...this.config(),
      modules: [Mousewheel, FreeMode],
    };

    Object.assign(this.container, params);
    (this.container as unknown as { initialize(): void }).initialize();
  }

  private cleanup(): void {
    this.isDestroyed = true;
    this.swiperInstance()?.destroy(true, true);
    this.container = null;
  }
}
