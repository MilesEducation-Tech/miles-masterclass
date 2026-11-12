import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import { Button } from '@shared/ui/button/button';
import { setupCourseSeo } from '@shared/utils/seo/course-seo-setup';
import { AppDownloadPrompt } from '@features/offerings/services/app-download-prompt';
import { MicroLearningCourseFacade } from '@features/offerings/services/micro-learning-course-facade';
import { REEL_PLAYER_COPY } from '@features/offerings/constants/reels';
import { MicroLearningTopBar } from '@features/offerings/micro-learning/components/micro-learning-top-bar/micro-learning-top-bar';
import { MicroLearningReelCard } from '@features/offerings/micro-learning/components/micro-learning-reel-card/micro-learning-reel-card';
import { MicroLearningReelNav } from '@features/offerings/micro-learning/components/micro-learning-reel-nav/micro-learning-reel-nav';

/**
 * The reel player: a vertical feed of reels, opened on the one in the URL. The
 * facade reads the feed and decides what each reel plays; this page connects
 * it to the URL, scrolls, and owns the SEO.
 */
@Component({
  selector: 'app-micro-learning-course',
  imports: [Button, MicroLearningTopBar, MicroLearningReelCard, MicroLearningReelNav],
  templateUrl: './micro-learning-course.html',
  host: { class: 'block h-screen overflow-hidden' },
})
export class MicroLearningCourse {
  protected readonly facade = inject(MicroLearningCourseFacade);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reelScroller = viewChild<ElementRef<HTMLElement>>('reelScroller');

  readonly courseId = input<string>();
  readonly courseTitle = input<string>();

  protected readonly copy = REEL_PLAYER_COPY;

  protected readonly canGoPrev = computed(() => this.facade.activeIndex() > 0);
  protected readonly canGoNext = computed(
    () => this.facade.activeIndex() < this.facade.reels().length - 1,
  );

  /** The active reel under the keys the SEO fallback reads (`WebCourseSeoSource`). */
  private readonly seoSource = computed(() => {
    const reel = this.facade.activeReel();
    return reel
      ? {
          id: reel.id,
          name: reel.title,
          mini_description: reel.short_description ?? '',
          horizontal_thumbnail_url: reel.thumbnails.horizontal || null,
          horizontal_trailer_url: reel.horizontal_trailer_url,
          instructors: reel.instructors,
        }
      : null;
  });

  constructor() {
    inject(AppDownloadPrompt).maybePrompt();

    this.facade.connect(
      computed(() => ({ courseId: this.courseId() ?? '', slug: this.courseTitle() ?? '' })),
    );
    // The facade outlives this page (route injector), so it's told when the learner leaves.
    this.destroyRef.onDestroy(() => this.facade.leave());

    // SSR gate, URL-derived fallback SEO, Supabase load, error fallback and the
    // reset on destroy, as on the masterclass and podcast course pages.
    setupCourseSeo({
      kind: 'microLearning',
      courseTitle: this.courseTitle,
      courseDetails: this.seoSource,
    });

    // Scroll a reel into view when the facade asks (next / previous).
    effect(() => {
      const request = this.facade.scrollRequest();
      if (!request) return;
      untracked(() => {
        const index = this.facade.reels().findIndex((reel) => reel.id === request.id);
        if (index >= 0) this.scrollReelTo(index);
      });
    });
  }

  protected goNext(): void {
    const next = this.facade.reels()[this.facade.activeIndex() + 1];
    if (next) this.facade.navigateToReel(next.id);
  }

  protected goPrev(): void {
    const prev = this.facade.reels()[this.facade.activeIndex() - 1];
    if (prev) this.facade.navigateToReel(prev.id);
  }

  /** The feed settled on a reel: select it, and read the next page near the end. */
  protected onReelScroll(): void {
    const el = this.reelScroller()?.nativeElement;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    const containerTop = el.getBoundingClientRect().top;
    const index = children.findIndex((child) => {
      const rect = child.getBoundingClientRect();
      return rect.top >= containerTop - rect.height / 2;
    });
    if (index < 0) return;
    const reels = this.facade.reels();
    const reel = reels[index];
    if (reel) this.facade.onScrollSelect(reel.id);
    if (index >= reels.length - 2) this.facade.loadNextPage();
  }

  private scrollReelTo(index: number): void {
    const el = this.reelScroller()?.nativeElement;
    const target = el?.children.item(index) as HTMLElement | null | undefined;
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
