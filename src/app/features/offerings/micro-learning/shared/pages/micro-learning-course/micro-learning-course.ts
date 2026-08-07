import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Dialog } from '../../../../../../shared/core/services/dialog/dialog';
import { AppDownloadPrompt } from '../../../../../../shared/core/services/app-download-prompt/app-download-prompt';
import { NotificationService } from '../../../../../../shared/core/services/notification/notification';
import { MicroLearningCourseFacade } from '../../../../shared/services/micro-learning-course-facade/micro-learning-course-facade';
import { FeatureFacade } from '../../../../../shared/services/feature-facade/feature-facade';
import {
  HtmlContentDialog,
  HtmlContentDialogData,
} from '../../../../../../shared/components/dialog/html-content-dialog/html-content-dialog';
import { MicroLearningTopBar } from '../../components/micro-learning-top-bar/micro-learning-top-bar';
import {
  MicroLearningReelCard,
  ReelActivityPayload,
} from '../../components/micro-learning-reel-card/micro-learning-reel-card';
import { MicroLearningReelNav } from '../../components/micro-learning-reel-nav/micro-learning-reel-nav';
import {
  MicroLearningFilterSheet,
  MicroLearningFilterSheetData,
  MicroLearningFilterSheetResult,
} from '../../components/micro-learning-filter-sheet/micro-learning-filter-sheet';
import { MicroLearningAboutPanel } from '../../components/micro-learning-about-panel/micro-learning-about-panel';
import {
  MicroLearningFilterOption,
  MicroLearningOptionId,
  MicroLearningReel,
} from '../../../../../../shared/core/models/micro-learning-course.model';
import { ContentAbout } from '../../../../../../shared/core/models/course.model';
import { setupCourseSeo } from '../../../../../../shared/utils/seo/course-seo-setup';

@Component({
  selector: 'app-micro-learning-course',
  imports: [MicroLearningTopBar, MicroLearningReelCard, MicroLearningReelNav],
  templateUrl: './micro-learning-course.html',
  styleUrl: './micro-learning-course.css',
})
export class MicroLearningCourse {
  readonly facade = inject(MicroLearningCourseFacade);
  private readonly feature = inject(FeatureFacade);
  private readonly dialog = inject(Dialog);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reelScroller = viewChild<ElementRef<HTMLElement>>('reelScroller');

  readonly courseId = input<string>();
  readonly courseTitle = input<string>();

  // Default unmuted per product requirement. `safePlay` swallows autoplay-
  // block rejections if the browser refuses to autoplay an unmuted video;
  // the user can always tap the CTA to start playback.
  readonly muted = signal<boolean>(false);
  readonly filters = signal<MicroLearningFilterOption[]>([]);

  readonly activeIndex = this.facade.activeIndex;

  readonly canGoPrev = computed(() => this.activeIndex() > 0);
  readonly canGoNext = computed(() => this.activeIndex() < this.facade.detailsList().length - 1);

  /** Reels currently in the ±1 preload window — they mount <app-video-js>. */
  readonly preloadedIds = computed<Set<number>>(() => {
    const list = this.facade.detailsList();
    const idx = this.activeIndex();
    const ids = new Set<number>();
    for (const delta of [-1, 0, 1]) {
      const neighbour = list[idx + delta];
      if (neighbour) ids.add(neighbour.id);
    }
    return ids;
  });

  /** Per-reel rewatch token — matches the facade's request when scoped to this reel. */
  rewatchTokenFor(reelId: number): number | null {
    const req = this.facade.rewatchRequest();
    return req && req.id === reelId ? req.token : null;
  }

  /** Per-reel pause token — fires when the facade requests a pause for this reel. */
  pauseTokenFor(reelId: number): number | null {
    const req = this.facade.pauseRequest();
    return req && req.id === reelId ? req.token : null;
  }

  /**
   * Per-reel response caches so reopening the same menu item doesn't refetch.
   * Lifetime is bounded by the route component (re-instantiated per
   * `:courseId`), so size is naturally capped at the number of reels in the
   * current course tree — no LRU eviction needed.
   */
  private readonly aboutCache = new Map<number, ContentAbout>();
  private readonly transcriptCache = new Map<number, string>();
  private readonly glossaryCache = new Map<number, string>();

  constructor() {
    inject(AppDownloadPrompt).maybePrompt();

    // SSR gate, URL-derived fallback SEO, slug signal, Supabase load,
    // error fallback, and seoManager.reset() on destroy. Mirrors the
    // masterclass + podcast course pages — see `setupCourseSeo` for the full
    // SSR lifecycle.
    setupCourseSeo({
      kind: 'microLearning',
      courseTitle: this.courseTitle,
      courseDetails: this.facade.courseDetails,
    });

    effect(() => {
      const id = this.courseId();
      if (id) {
        // Route component is reused across `:courseId` changes (withComponentInputBinding),
        // so reset throttle + completion-dedup state for the new course.
        untracked(() => this.resetActivityTracking());
        this.facade.initForCourse(Number(id));
      }
    });

    // Scroll into view whenever the facade asks for it (e.g. navigateToReel).
    effect(() => {
      const req = this.facade.scrollToIdRequest();
      if (!req) return;
      untracked(() => {
        const index = this.facade.detailsList().findIndex((r) => r.id === req.id);
        if (index >= 0) this.scrollReelTo(index);
      });
    });

    // When the facade fires REWATCH, drop the reel's completion-dedup entry
    // and reset the throttle so a fresh sequence of heartbeats + completion
    // can flow. `last_activity` is reset in the facade; this clears the
    // session-only local dedup the page owns.
    effect(() => {
      const req = this.facade.rewatchRequest();
      if (!req) return;
      untracked(() => {
        const reel = this.facade.detailsList().find((r) => r.id === req.id);
        if (!reel) return;
        this.completedChapterIds.delete(reel.chapter_id);
        if (this.trackedReelChapterId === reel.chapter_id) {
          this.trackedReelChapterId = null;
          this.lastTrackedPercentage = 0;
        }
      });
    });

    this.destroyRef.onDestroy(() => this.facade.clear());
  }

  private resetActivityTracking(): void {
    this.lastTrackedPercentage = 0;
    this.trackedReelChapterId = null;
    this.completedChapterIds.clear();
  }

  goToEpisode(episode: MicroLearningReel): void {
    this.facade.navigateToReel(episode.id);
  }

  goNext(): void {
    if (!this.canGoNext()) return;
    const next = this.facade.detailsList()[this.activeIndex() + 1];
    if (next) this.facade.navigateToReel(next.id);
  }

  goPrev(): void {
    if (!this.canGoPrev()) return;
    const prev = this.facade.detailsList()[this.activeIndex() - 1];
    if (prev) this.facade.navigateToReel(prev.id);
  }

  /** Throttle key — tracks the last % milestone reported to the API, per reel. */
  private lastTrackedPercentage = 0;
  private trackedReelChapterId: number | null = null;
  /**
   * Chapter IDs we've already sent a `completed` event for in this session.
   * Decoupled from `isReelComplete` (derived from last_activity) so the
   * `completed` event fires exactly once per reel even after the heartbeat
   * that crossed 95% updated local progress.
   */
  private readonly completedChapterIds = new Set<number>();

  /**
   * Mirrors masterclass-chapter.updateTime:
   *  • fires a `heartbeat` every 5% of progress
   *  • fires a `completed` once crossing 95% (only once per reel)
   *  • CPE-mode gate: if the reel is already at ≥95% (by progress or
   *    server-reported last_activity) AND the user has seeked back below
   *    last_activity, skip the API — don't regress completed progress.
   */
  handleTimeUpdate(event: ReelActivityPayload): void {
    if (event.duration <= 0) return;

    // Reset the throttle when the active reel changes.
    if (this.trackedReelChapterId !== event.chapterId) {
      this.trackedReelChapterId = event.chapterId;
      this.lastTrackedPercentage = 0;
    }

    const reel = this.facade.detailsList().find((r) => r.chapter_id === event.chapterId);
    if (!reel) return;

    const inCpeMode = !!reel.cpe_mode_details?.cpe_mode;
    const totalDuration = reel.total_duration ?? event.duration;
    const lastActivity = reel.last_activity ?? 0;
    const currentPercent = (event.currentTime / event.duration) * 100;
    const lastActivityPercent = totalDuration > 0 ? (lastActivity / totalDuration) * 100 : 0;
    const alreadyEmittedCompleted = this.completedChapterIds.has(event.chapterId);

    // CPE-mode API gate per product spec:
    //  (a) Server already considers the reel completed (last_activity >= 95%)
    //      → suppress ALL activity events (no more heartbeats, no duplicate
    //      `completed`). The reel is done; server state is authoritative.
    //  (b) Progress crossed 95% this session AND the user has seeked back
    //      below last_activity → suppress (don't regress completed progress).
    if (inCpeMode) {
      if (lastActivityPercent >= 95) return;
      if (currentPercent >= 95 && event.currentTime < lastActivity) return;
    }

    if (currentPercent >= 95 && !alreadyEmittedCompleted) {
      this.completedChapterIds.add(event.chapterId);
      this.lastTrackedPercentage = 100;
      this.facade.trackActivity(event.chapterId, event.duration, 'completed').subscribe();
      // Trigger the post-video flow now (open quiz / start exam). We can't
      // wait for video.js's `ended` event: crossing 95% sets last_activity
      // to total_duration, which flips `isCompleted` → `loop = true` via
      // the videoConfig effect *before* the player reaches 100%, so `ended`
      // never fires. 95% is the reliable signal. `completedChapterIds`
      // already dedups, so this only runs once per reel per session.
      if (reel.id === this.facade.activeReel()?.id) {
        this.facade.handleVideoEnded();
      }
      return;
    }

    // Once a reel has emitted completion, stop sending heartbeats.
    if (alreadyEmittedCompleted) return;

    if (Math.abs(currentPercent - this.lastTrackedPercentage) >= 5) {
      this.lastTrackedPercentage = currentPercent;
      this.facade.trackActivity(event.chapterId, event.currentTime, 'heartbeat').subscribe();
    }
  }

  handleExited(event: ReelActivityPayload): void {
    this.facade.trackActivity(event.chapterId, event.currentTime, 'exit').subscribe();
  }

  onReelScroll(): void {
    const el = this.reelScroller()?.nativeElement;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    const containerTop = el.getBoundingClientRect().top;
    const index = children.findIndex((child) => {
      const rect = child.getBoundingClientRect();
      return rect.top >= containerTop - rect.height / 2;
    });
    if (index < 0) return;
    const list = this.facade.detailsList();
    const reel = list[index];
    if (reel) this.facade.onScrollSelect(reel.id);
    // Prefetch the next page once the active reel is the last or second-last.
    if (index >= list.length - 2) this.facade.loadNextPage();
  }

  /** Right-section episode grid: fetch the next page as it nears the bottom. */
  onGridScroll(el: HTMLElement): void {
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) {
      this.facade.loadNextPage();
    }
  }

  private scrollReelTo(index: number): void {
    const el = this.reelScroller()?.nativeElement;
    if (!el) return;
    if (index < 0 || index >= (el.children?.length ?? 0)) return;
    const target = el.children.item(index) as HTMLElement | null;
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  toggleMute(): void {
    this.muted.update((value) => !value);
  }

  openFilters(): void {
    const ref = this.dialog.open<MicroLearningFilterSheet, MicroLearningFilterSheetResult>(
      MicroLearningFilterSheet,
      {
        data: {
          title: 'Field of study',
          options: this.filters(),
          visibleCount: 5,
        } as MicroLearningFilterSheetData,
        ariaLabel: 'Filter by field of study',
      },
    );
    ref.afterClosed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (result) this.filters.set(result);
    });
  }

  /**
   * Dispatch table for the inline reel menu. The `Record<MicroLearningOptionId, …>`
   * type is itself the exhaustiveness guard: adding a new variant to the union
   * fails to compile here until a handler is registered.
   */
  private readonly optionHandlers: Record<MicroLearningOptionId, () => void> = {
    about: () => this.openAbout(),
    transcript: () => this.openTranscript(),
    glossary: () => this.openGlossary(),
  };

  onOptionSelected(id: MicroLearningOptionId): void {
    this.optionHandlers[id]();
  }

  /**
   * Mirrors `VideoChapter.openTranscript`: hits `v2/course-content/` with
   * `chapter_id` and renders `data.chapter.transcript_text` in an HtmlContentDialog.
   * Cached per reel id so reopening the menu doesn't refetch.
   */
  openTranscript(): void {
    const reel = this.facade.courseDetails();
    if (!reel) return;
    const cached = this.transcriptCache.get(reel.id);
    if (cached) {
      this.showHtmlDialog(`Transcript - ${reel.title}`, cached);
      return;
    }
    this.facade
      .fetchCourseContent(
        { id: reel.id, course_type: 'micro_learning', chapter_id: reel.chapter_id },
        { skipErrorNotification: true },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        const html = response?.data?.chapter?.transcript_text;
        if (!html) {
          this.notification.info('Transcript', 'No transcript is available for this reel.');
          return;
        }
        this.transcriptCache.set(reel.id, html);
        this.showHtmlDialog(`Transcript - ${reel.title}`, html);
      });
  }

  /**
   * Mirrors `CourseResources.openGlossary`: same `v2/course-content/` endpoint,
   * but without `chapter_id` so the response carries the course-level
   * `glossary_transcript_text`. Cached per reel id.
   */
  openGlossary(): void {
    const reel = this.facade.courseDetails();
    if (!reel) return;
    const cached = this.glossaryCache.get(reel.id);
    if (cached) {
      this.showHtmlDialog(`${reel.title} - Glossary`, cached);
      return;
    }
    this.facade
      .fetchCourseContent({ id: reel.id, course_type: 'micro_learning' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        const html = response?.data?.glossary_transcript_text;
        if (!html) {
          this.notification.info('Glossary', 'No glossary is available for this reel.');
          return;
        }
        this.glossaryCache.set(reel.id, html);
        this.showHtmlDialog(`${reel.title} - Glossary`, html);
      });
  }

  private showHtmlDialog(title: string, htmlContent: string): void {
    this.dialog.open<HtmlContentDialog, HtmlContentDialogData>(HtmlContentDialog, {
      maxWidth: '100%',
      data: { title, htmlContent },
    });
  }

  openAbout(): void {
    const reel = this.facade.courseDetails();
    if (!reel) return;
    const cached = this.aboutCache.get(reel.id);
    if (cached) {
      this.showAboutPanel(cached);
      return;
    }
    this.feature
      .getAbout<ContentAbout>(reel.id, 'micro_learning')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        const data = res?.data;
        if (!data) {
          this.notification.info('About', 'No details are available for this reel.');
          return;
        }
        const enriched: ContentAbout = {
          ...data,
          learning_objective_list: (data.learning_objectives ?? '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean),
        };
        this.aboutCache.set(reel.id, enriched);
        this.showAboutPanel(enriched);
      });
  }

  private showAboutPanel(data: ContentAbout): void {
    this.dialog.open(MicroLearningAboutPanel, {
      data,
      position: 'right',
      ariaLabel: 'About this course',
    });
  }
}
