import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  PLATFORM_ID,
  Service,
  Signal,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { AnalyticsEvent } from '@core/constants/analytics-events';
import { Analytics } from '@core/services/analytics/analytics';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import {
  CHAPTER_COPY,
  CHAPTER_WATCHED_PERCENT,
  VIDEO_PROGRESS_MILESTONES,
} from '@features/offerings/constants/course-detail';
import {
  ChapterNavigation,
  MasterclassChapterLink,
  readCourseStepRefusal,
} from '@features/offerings/models/course-detail.model';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';
// Type-only: each dialog loads with `import()` when it opens (AGENTS.md §4.4).
import type { HtmlContentDialogData } from '@features/offerings/dialogs/html-content-dialog/html-content-dialog';
import type {
  SelectCpeModeData,
  SelectCpeModeResult,
} from '@features/offerings/dialogs/select-cpe-mode/select-cpe-mode';
import type { UtilsDialogData, UtilsDialogResult } from '@shared/dialogs/utils-dialog/utils-dialog';

/**
 * State and actions for one chapter page of a course on the offerings' web API.
 *
 * Route-scoped, on the chapter route, over the `CourseDetailFacade` its parent
 * route provides: the course and its chapters come from that one
 * `course-detail/` read, shared with the course page, so opening a chapter or
 * moving between chapters costs no new read. The player injects this facade and
 * calls it; it never calls the API itself.
 *
 * What it does NOT do yet, each its own ticket: save progress
 * (`course-progress-update/`), so the server's chapter ladder only moves once
 * that lands; the chapter quiz; the final assessment.
 */
@Service({ autoProvided: false })
export class CourseChapterFacade {
  private readonly detail = inject(CourseDetailFacade);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly analytics = inject(Analytics);
  private readonly logger = inject(Logger);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Set when the page goes, so an answer that lands later doesn't navigate or open a dialog. */
  private destroyed = false;

  /** The chapter id from the URL, as a signal; `null` until `connect()`. */
  private readonly chapterId = signal<Signal<string | undefined> | null>(null);

  readonly notFound = this.detail.notFound;
  readonly loadError = this.detail.loadError;

  readonly navigation = computed<ChapterNavigation>(() => {
    const chapters = this.detail.chapters();
    const id = this.chapterId()?.();
    const index = id ? chapters.findIndex((chapter) => chapter.id === id) : -1;
    return {
      index,
      previous: index > 0 ? chapters[index - 1] : null,
      current: index >= 0 ? chapters[index] : null,
      next: index >= 0 ? (chapters[index + 1] ?? null) : null,
    };
  });

  readonly current = computed(() => this.navigation().current);

  readonly isCpeMode = computed(() => this.detail.course()?.course_mode === 'cpe');

  /**
   * Chapters watched to `CHAPTER_WATCHED_PERCENT` on this visit. Nothing saves
   * it yet, so it lasts until the page reloads; it only frees seeking.
   */
  private readonly watchedHere = signal<ReadonlySet<string>>(new Set());

  /**
   * CPE mode lets the learner seek only once the server says the video is
   * seekable or watched, or once they've watched it here. Preview seeks freely.
   */
  readonly canSeek = computed(() => {
    const chapter = this.current();
    if (!chapter || !this.isCpeMode()) return true;
    const progress = chapter.user_chapter_progress;
    return (
      !!progress.is_video_seekable ||
      !!progress.is_video_completed ||
      this.watchedHere().has(chapter.id)
    );
  });

  /** Where the video picks up: the saved position, unless the chapter is finished. */
  readonly resumeAt = computed(() => {
    const progress = this.current()?.user_chapter_progress;
    return progress && !progress.is_video_completed
      ? (progress.last_watched_position_seconds ?? 0)
      : 0;
  });

  /**
   * One key per chapter opened, so the opening steps run once for each: a
   * re-read of the same course (a mode switch, a reset) keeps the key and
   * doesn't start the chapter again.
   */
  private readonly openKey = computed(() => {
    const course = this.detail.course();
    const chapterId = this.chapterId()?.();
    return course && chapterId ? `${course.id}/${chapterId}` : null;
  });

  // Analytics dedup: each milestone fires once per chapter.
  private trackedChapterId: string | null = null;
  private readonly firedMilestones = new Set<number>();

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));

    // `chapter-start/` and the dialogs are browser work; the server renders
    // the skeleton (the signed-in read never runs there anyway).
    effect(() => {
      const key = this.openKey();
      if (key && this.isBrowser) untracked(() => void this.open(key));
    });
  }

  /** Follow the chapter in the URL; called once, from the page's constructor. */
  connect(chapterId: Signal<string | undefined>): void {
    this.chapterId.set(chapterId);
  }

  reload(): void {
    this.detail.reload();
  }

  /** Open a neighbouring chapter, unless the server's ladder still locks it. */
  goTo(chapter: MasterclassChapterLink): void {
    if (chapter.is_locked) {
      this.notification.info(CHAPTER_COPY.chapterLocked.title, CHAPTER_COPY.chapterLocked.body);
      return;
    }
    const path = this.detail.chapterPath(chapter);
    if (path) void this.router.navigateByUrl(path);
  }

  /** The transcript is in the payload, so this opens it with no request. */
  async openTranscript(): Promise<void> {
    const chapter = this.current();
    if (!chapter?.transcript_text) return;
    const { HtmlContentDialog } =
      await import('@features/offerings/dialogs/html-content-dialog/html-content-dialog');
    this.dialogs.open<HtmlContentDialogData>(HtmlContentDialog, {
      data: { title: `Transcript - ${chapter.name}`, htmlContent: chapter.transcript_text },
    });
  }

  /** The player's progress, as a percentage of the video: analytics, and "watched". */
  videoProgress(percent: number): void {
    const chapter = this.current();
    if (!chapter || percent <= 0) return;

    this.track('video_start', chapter.id, 0);
    for (const milestone of VIDEO_PROGRESS_MILESTONES) {
      if (percent >= milestone) this.track('video_progress', chapter.id, milestone);
    }
    if (percent >= CHAPTER_WATCHED_PERCENT && !this.watchedHere().has(chapter.id)) {
      this.watchedHere.update((ids) => new Set(ids).add(chapter.id));
    }
  }

  /**
   * The video ended. Preview mode moves on: after chapter 1 it first offers CPE
   * mode, and after the last chapter it rewinds. CPE mode stays put, because
   * the chapter quiz comes next and that is its own ticket.
   *
   * Resolves `true` when the player should rewind and pause: after the last
   * chapter, and after a switch to CPE mode, whose rules start the chapter over.
   */
  async videoEnded(): Promise<boolean> {
    const { current, next, index } = this.navigation();
    if (!current) return false;
    this.track('video_complete', current.id, 100);

    if (this.isCpeMode()) return false;
    if (!next) return true;
    if (index === 0 && (await this.offerCpeMode())) return true;
    this.goTo(next);
    return false;
  }

  /**
   * The opening steps for one chapter, in order: the locks the read already
   * shows, then `chapter-start/` (which re-checks them on the server and
   * creates the enrolment), then the mode if the learner has none yet.
   */
  private async open(key: string): Promise<void> {
    const course = this.detail.course();
    const chapter = this.current();
    if (!course) return;

    if (course.course_is_locked) {
      this.leave(
        CHAPTER_COPY.courseLocked.title,
        course.course_pop_up_remark ?? CHAPTER_COPY.courseLocked.body,
      );
      return;
    }
    if (!chapter) {
      this.leave(CHAPTER_COPY.chapterNotFound.title, CHAPTER_COPY.chapterNotFound.body);
      return;
    }
    if (chapter.is_locked) {
      this.leave(CHAPTER_COPY.chapterLocked.title, CHAPTER_COPY.chapterLocked.body);
      return;
    }

    try {
      const started = await this.detail.startChapter(chapter.id);
      if (!this.isStill(key)) return;
      if (started.reset_required) {
        this.notification.info(CHAPTER_COPY.enrolmentReset.title, CHAPTER_COPY.enrolmentReset.body);
        this.detail.reload();
        return;
      }
    } catch (error) {
      this.logger.error('[CourseChapter] chapter-start failed', error);
      if (this.isStill(key)) this.refuse(error);
      return;
    }

    if (this.detail.course()?.course_mode === null) await this.askMode(key);
  }

  /**
   * A refused `chapter-start/`. A 4xx is the server saying no (the ladder, the
   * entitlement, an AI Lab or partner lock), so the learner goes back to the
   * course page; its generic "could not be completed" message is replaced by
   * ours where the reason is known. A 5xx or a dropped connection only warns:
   * the stream doesn't depend on this call.
   */
  private refuse(error: unknown): void {
    const refusal = readCourseStepRefusal(error);
    if (refusal.reason === 'chapter_locked') {
      this.leave(CHAPTER_COPY.chapterLocked.title, CHAPTER_COPY.chapterLocked.body);
    } else if (refusal.reason === 'caira_access_required') {
      this.leave(CHAPTER_COPY.courseLocked.title, CHAPTER_COPY.courseLocked.body);
    } else if (refusal.status >= 400 && refusal.status < 500) {
      this.leave(CHAPTER_COPY.cannotStart.title, refusal.message ?? CHAPTER_COPY.cannotStart.body);
    } else {
      this.notification.error(CHAPTER_COPY.cannotStart.title, CHAPTER_COPY.cannotStart.body);
    }
  }

  /** No mode stored yet: ask, as the legacy launch flow did. No answer, no chapter. */
  private async askMode(key: string): Promise<void> {
    const { SelectCpeMode } =
      await import('@features/offerings/dialogs/select-cpe-mode/select-cpe-mode');
    if (!this.isStill(key)) return;
    const ref = this.dialogs.open<SelectCpeModeData, SelectCpeModeResult>(SelectCpeMode, {
      // Masterclass is the only offering on this API so far.
      data: { type: 'Masterclass', format: 'video' },
    });
    const result = await firstValueFrom(ref.afterClosed);
    if (!this.isStill(key)) return;
    if (result) await this.detail.setMode(result.cpe_mode_status ? 'cpe' : 'preview');
    else this.backToCourse();
  }

  /** After chapter 1 in preview: offer CPE mode. Resolves `true` once it's switched. */
  private async offerCpeMode(): Promise<boolean> {
    const { UtilsDialog } = await import('@shared/dialogs/utils-dialog/utils-dialog');
    if (this.destroyed) return false;
    const ref = this.dialogs.open<UtilsDialogData, UtilsDialogResult>(UtilsDialog, {
      data: {
        title: CHAPTER_COPY.switchToCpe.title,
        containerClass: 'max-w-lg text-start!',
        content: [{ type: 'text', value: CHAPTER_COPY.switchToCpe.body }],
        buttons: [
          { label: 'Skip', variant: 'ghost', action: 'cancel' },
          { label: 'Switch to CPE Mode', variant: 'default', action: 'confirm' },
        ],
        maxWidth: '32rem',
        disableClose: true,
      },
    });
    const result = await firstValueFrom(ref.afterClosed);
    return result?.action === 'confirm' && result.result && !this.destroyed
      ? this.detail.setMode('cpe')
      : false;
  }

  /** Whether the chapter `key` named is still the one on screen. */
  private isStill(key: string): boolean {
    return !this.destroyed && this.openKey() === key;
  }

  /** Back to the course page with the reason, replacing the chapter in history. */
  private leave(title: string, message: string): void {
    this.notification.info(title, message);
    this.backToCourse();
  }

  private backToCourse(): void {
    const path = this.detail.coursePath();
    if (path) void this.router.navigateByUrl(path, { replaceUrl: true });
  }

  /** One analytics event per chapter and milestone (`0` = start, `100` = complete). */
  private track(event: AnalyticsEvent, chapterId: string, milestone: number): void {
    if (chapterId !== this.trackedChapterId) {
      this.trackedChapterId = chapterId;
      this.firedMilestones.clear();
    }
    if (this.firedMilestones.has(milestone)) return;
    this.firedMilestones.add(milestone);
    this.analytics.trackEvent(event, {
      course_id: this.detail.course()?.id,
      course_type: this.detail.analyticsType(),
      chapter_id: chapterId,
      ...(event === 'video_progress' ? { percent: milestone } : {}),
    });
  }
}
