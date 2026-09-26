import { isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { Component, computed, DestroyRef, inject, model, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matArrowForwardIosRound,
  matArrowBackIosRound,
  matPlayArrowRound,
} from '@ng-icons/material-icons/round';
import { Content } from '@core/models/course.model';
import { VideoPoster } from '../video-poster/video-poster';
import { MilesSlug } from '../miles-slug/miles-slug';
import { Button } from '../../ui/button/button';
import { CairaCredlyBadge } from '../cards/caira-credly-badge/caira-credly-badge';
import { TotalCpeCreditsPipe } from '@shared/pipes/total-cpe-credits/total-cpe-credits-pipe';
import { matInfoOutline } from '@ng-icons/material-icons/outline';
import { Utils } from '@shared/services/utils';
import { Router } from '@angular/router';
import { FeatureFacade } from '@core/services/feature-facade/feature-facade';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { Viewport } from '@core/services/viewport/viewport';

/**
 * A responsive image slider component with animated transitions.
 *
 * SOLID Principles applied:
 * - Single Responsibility: Handles only slider navigation and display
 * - Open/Closed: Extendable via inputs without modification
 * - Liskov Substitution: Works with any SliderItem implementation
 * - Interface Segregation: SliderItem has only required properties
 * - Dependency Inversion: Uses Angular DI for platform detection
 *
 * @example
 * ```html
 * <app-slider [items]="sliderItems" />
 * ```
 */
/*
 * Slide classes, one complete list per position. Complete rather than a base
 * plus modifiers: a base `xl:w-[150px]` would outrank a modifier's `w-full` at
 * `xl` (variants sort after plain utilities), which the old stylesheet avoided
 * only by rule order.
 */
const SLIDE_BASE =
  'absolute bg-center bg-cover overflow-hidden transition-all duration-700 ease-out';
const SLIDE_FULL = `${SLIDE_BASE} sm:bottom-32 bottom-8 md:aspect-9/16 aspect-video left-0 top-0 w-full h-full translate-y-0 rounded-none shadow-none opacity-100`;
const SLIDE_THUMB = `${SLIDE_BASE} sm:bottom-32 bottom-8 xl:w-[150px] w-[120px] md:aspect-9/16 aspect-video rounded-xl shadow-[inset_0_20px_30px_rgba(255,255,255,0.3)]`;
const SLIDE_CLASS = [
  `${SLIDE_FULL} z-0`, // behind the hero
  `${SLIDE_FULL} z-1`, // hero
  `${SLIDE_THUMB} left-1/2 z-2`,
  `${SLIDE_THUMB} xl:left-[calc(50%+180px)] left-[calc(50%+140px)] z-2`,
  `${SLIDE_THUMB} xl:left-[calc(50%+360px)] left-[calc(50%+280px)] z-2`,
];
const SLIDE_HIDDEN = `${SLIDE_THUMB} xl:left-[calc(50%+660px)] left-[calc(50%+500px)] opacity-0 z-1`;

const CONTENT_BASE =
  'absolute bottom-20 left-6 z-2 mx-auto w-10/12 sm:left-20 sm:w-2/5 text-sm font-normal text-white opacity-0 font-[Helvetica,sans-serif] text-shadow-[0_3px_8px_rgba(0,0,0,0.5)]';
// `slideIn` is the global keyframe in styles/animation.css.
const CONTENT_VISIBLE = `${CONTENT_BASE} flex flex-col gap-2 sm:gap-4 animate-[slideIn_0.75s_ease-in-out_0.3s_forwards]`;
const CONTENT_HIDDEN = `${CONTENT_BASE} hidden`;

@Component({
  selector: 'app-slider',
  imports: [
    NgIcon,
    VideoPoster,
    NgOptimizedImage,
    MilesSlug,
    Button,
    CairaCredlyBadge,
    TotalCpeCreditsPipe,
  ],
  templateUrl: './slider.html',
  styleUrl: './slider.css',
  providers: [
    provideIcons({
      matArrowForwardIosRound,
      matArrowBackIosRound,
      matPlayArrowRound,
      matInfoOutline,
    }),
  ],
  host: {
    // Aspect flips at `md` (768) to match the Viewport service's mobile
    // breakpoint, so the CSS layout and the `isMobile` signal agree.
    class: 'block relative w-full md:aspect-video aspect-9/16 overflow-hidden',
  },
})
export class Slider {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly utils = inject(Utils);
  private readonly router = inject(Router);
  private readonly feature = inject(FeatureFacade);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly destroyRef = inject(DestroyRef);
  private readonly viewport = inject(Viewport);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private animationTimerId: ReturnType<typeof setTimeout> | null = null;

  /** The items to display in the slider */
  readonly items = model.required<readonly Content[]>();

  /** Current active slide index (0-based, represents the "hero" slide) */
  protected readonly activeIndex = signal(0);

  /** Whether transitions are currently animating */
  protected readonly isAnimating = signal(false);

  /** Whether the screen is in the mobile bucket (<768). From the shared Viewport service. */
  protected readonly isMobile = this.viewport.isMobile;

  /** Animation duration in milliseconds */
  private readonly animationDuration = 750;

  /**
   * Computed array of items ordered for display.
   * The first item is behind, second is the hero (visible), rest are thumbnails.
   */
  protected readonly orderedItems = computed(() => {
    const allItems = this.items();
    const index = this.activeIndex();
    if (allItems.length === 0) return [];

    // Reorder: items before activeIndex go after items from activeIndex
    return [...allItems.slice(index), ...allItems.slice(0, index)];
  });

  /** Total number of slides */
  protected readonly totalSlides = computed(() => this.items().length);

  protected itemClass(position: number): string {
    return SLIDE_CLASS[position] ?? SLIDE_HIDDEN;
  }

  protected contentClass(visible: boolean): string {
    return visible ? CONTENT_VISIBLE : CONTENT_HIDDEN;
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.animationTimerId) clearTimeout(this.animationTimerId);
    });
  }

  /**
   * Navigate to the next slide.
   * Moves the first item to the end of the list.
   */
  protected next(): void {
    if (this.isAnimating() || !this.isBrowser) return;

    this.isAnimating.set(true);
    const total = this.totalSlides();

    this.activeIndex.update((current) => (current + 1) % total);

    this.resetAnimation();
  }

  /**
   * Navigate to the previous slide.
   * Moves the last item to the beginning of the list.
   */
  protected prev(): void {
    if (this.isAnimating() || !this.isBrowser) return;

    this.isAnimating.set(true);
    const total = this.totalSlides();

    this.activeIndex.update((current) => (current - 1 + total) % total);

    this.resetAnimation();
  }

  /**
   * Handles keyboard navigation for accessibility.
   */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      this.prev();
    } else if (event.key === 'ArrowRight') {
      this.next();
    }
  }

  /**
   * Resets the animation state after the transition completes.
   */
  private resetAnimation(): void {
    if (this.animationTimerId) clearTimeout(this.animationTimerId);
    this.animationTimerId = setTimeout(() => {
      this.isAnimating.set(false);
    }, this.animationDuration);
  }

  baseRoute = computed<string>(() => {
    const { country, profession } = this.utils.getRouteParams();
    return `/${country}/${profession}`;
  });

  navigateToCourse(id: number, title: string) {
    const titleSlug = this.utils.slugify(title);
    this.router.navigate([this.baseRoute(), 'masterclass', id, titleSlug]);
  }

  openCourseInfo(card: Content) {
    if (!card.allDataFetched) {
      this.feature
        .getAbout(card.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((res: any) => {
          const updatedCard = {
            ...card,
            ...res.data,
            allDataFetched: true,
            learning_objective_list: res.data.learning_objectives.split('\r\n'),
          };
          this.items.update((items) => {
            const updatedItems = [...items];
            updatedItems[this.activeIndex()] = updatedCard;
            return updatedItems;
          });
          this.openCourseInfoDialog(updatedCard);
        });
    } else {
      this.openCourseInfoDialog(card);
    }
  }

  async openCourseInfoDialog(card: Content) {
    // Loaded on open, so the dialog is not part of this component's chunk (§4.4).
    const { CourseInfo } = await import('../../dialogs/course-info/course-info');
    const dialogRef = this.dialogs.open(CourseInfo, { data: card });

    dialogRef.afterClosed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
}
