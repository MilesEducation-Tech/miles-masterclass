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
  PROGRESS_SAVE_INTERVAL_SECONDS,
  SEEK_JUMP_SECONDS,
  VIDEO_PROGRESS_MILESTONES,
} from '@features/offerings/constants/course-detail';
import {
  ChapterNavigation,
  ChapterProgressTracker,
  CourseProgressChapter,
  CourseProgressUpdate,
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

/** A save's positions, to tell a repeat from a change. */
const saveKey = (update: CourseProgressUpdate): string =>
  `${update.last_watched_position_seconds}/${update.max_watched_duration_seconds}`;

/**
 * State and actions for one chapter page of a course on the offerings' web API.
 *
 * Page-scoped (the chapter page's own `providers`, which says why), over the
 * `CourseDetailFacade` the parent route provides: the course and its chapters
 * come from that one `course-detail/` read, shared with the course page, so
 * opening a chapter or moving between chapters costs no new read. The player
 * injects this facade and calls it; it never calls the API itself.
 *
 * Progress is saved as the learner watches (`course-progress-update/`), and
 * the server's answer moves the lock ladder in place. In CPE mode the next
 * chapter opens only after this one's quiz, which `CourseChapterQuizFacade`
 * runs over this facade; the final assessment is its own ticket.
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
   * CPE mode lets the learner seek only once the server says the video is
   * seekable or watched; the saves below are what tell it. Preview seeks freely.
   */
  readonly canSeek = computed(() => {
    const chapter = this.current();
    if (!chapter || !this.isCpeMode()) return true;
    const progress = chapter.user_chapter_progress;
    return !!progress.is_video_seekable || !!progress.is_video_completed;
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

  // ── Progress ───────────────────────────────────────────────────────────────
  /** The chapter on screen, between saves. */
  private tracker: ChapterProgressTracker | null = null;
  /** The latest unsent save per chapter; the newest positions win. */
  private readonly unsent = new Map<string, CourseProgressUpdate>();
  /**
   * Saves that failed, held for the next save rather than retried at once, so
   * a server that keeps failing isn't sent a request in a loop.
   */
  private readonly failed = new Map<string, CourseProgressUpdate>();
  /** What each chapter last saved, so the same positions aren't sent twice (pause, then end). */
  private readonly lastSaved = new Map<string, string>();
  /** The queue being sent, one request at a time; `null` when idle. */
  private draining: Promise<void> | null = null;
  /** Chapters `chapter-start/` accepted: a save before that is a 400 "Not enrolled". */
  private readonly started = new Set<string>();
  /** Chapters already warned about a failed save, so a flaky connection warns once. */
  private readonly warned = new Set<string>();

  // Analytics dedup: each milestone fires once per chapter.
  private trackedChapterId: string | null = null;
  private readonly firedMilestones = new Set<number>();

  constructor() {
    // Leaving the page saves where the learner got to. The request outlives the
    // page; only its UI (toasts, navigation) is skipped once `destroyed` is set.
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.queueSave();
    });

    // `chapter-start/` and the dialogs are browser work; the server renders
    // the skeleton (the signed-in read never runs there anyway). Moving to
    // another chapter first saves the one being left.
    effect(() => {
      const key = this.openKey();
      if (!key || !this.isBrowser) return;
      untracked(() => {
        this.queueSave();
        this.tracker = null;
        void this.open(key);
      });
    });
  }

  /** Follow the chapter in the URL; called once, from the page's constructor. */
  connect(chapterId: Signal<string | undefined>): void {
    this.chapterId.set(chapterId);
  }

  reload(): void {
    this.detail.reload();
  }

  /**
   * Open a neighbouring chapter, unless the server's ladder still locks it. A
   * next chapter held back by this chapter's quiz says so.
   */
  goTo(chapter: MasterclassChapterLink): void {
    if (chapter.is_locked) {
      const current = this.current();
      const copy =
        current?.show_quiz && !current.user_chapter_progress.is_mcq_completed
          ? CHAPTER_COPY.quizLocked
          : CHAPTER_COPY.chapterLocked;
      this.notification.info(copy.title, copy.body);
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

  /**
   * The player's clock. A forward step of under `SEEK_JUMP_SECONDS` is play;
   * anything else is a seek, which moves the resume point and nothing more.
   * Play counts towards the next save, and it moves the furthest point watched
   * only when it starts inside what has already been watched: playing on after
   * a seek ahead doesn't credit the part that was skipped.
   */
  videoTime(currentTime: number, duration: number): void {
    const chapter = this.current();
    if (!chapter || duration <= 0) return;

    const tracker = this.trackerFor(chapter);
    const from = tracker.lastTime ?? currentTime;
    const step = currentTime - from;
    if (step > 0 && step < SEEK_JUMP_SECONDS) {
      if (from <= tracker.furthest + SEEK_JUMP_SECONDS) {
        tracker.furthest = Math.max(tracker.furthest, currentTime);
      }
      tracker.sincePlayedSave += step;
    }
    tracker.lastTime = currentTime;
    tracker.position = currentTime;

    const percent = (currentTime / duration) * 100;
    if (percent > 0) this.track('video_start', chapter.id, 0);
    for (const milestone of VIDEO_PROGRESS_MILESTONES) {
      if (percent >= milestone) this.track('video_progress', chapter.id, milestone);
    }

    if (tracker.sincePlayedSave >= PROGRESS_SAVE_INTERVAL_SECONDS) this.queueSave();
  }

  videoPaused(): void {
    this.queueSave();
  }

  /**
   * The video ended. Its progress is saved first, so the server's answer can
   * open the next chapter before the page tries it. Then preview mode moves
   * on: after chapter 1 it first offers CPE mode, and after the last chapter it
   * rewinds. CPE mode stays put, because the chapter quiz comes next
   * (`CourseChapterQuizFacade`).
   *
   * Resolves `true` when the player should rewind and pause: after the last
   * chapter, and after a switch to CPE mode, whose rules start the chapter over.
   */
  async videoEnded(): Promise<boolean> {
    const ended = this.current();
    if (!ended) return false;
    this.track('video_complete', ended.id, 100);
    this.queueSave();
    await this.drain();

    const { current, next, index } = this.navigation();
    if (this.isCpeMode() || current?.id !== ended.id) return false;
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
      this.redirectLocked(chapter);
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
      this.started.add(chapter.id);
      void this.drain();
    } catch (error) {
      this.logger.error('[CourseChapter] chapter-start failed', error);
      if (this.isStill(key)) this.refuse(error);
      return;
    }

    if (this.detail.course()?.course_mode === null) await this.askMode(key);
  }

  /**
   * A refused chapter step. A 4xx is the server saying no (the ladder, the
   * entitlement, an AI Lab or partner lock), so the learner goes back to the
   * course page; its generic "could not be completed" message is replaced by
   * ours where the reason is known. A 5xx or a dropped connection only warns:
   * the stream doesn't depend on this call.
   */
  refuse(error: unknown): void {
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

  /** The tracker for `chapter`, starting from what the server already has. */
  private trackerFor(chapter: MasterclassChapterLink): ChapterProgressTracker {
    if (this.tracker?.chapterId !== chapter.id) {
      this.queueSave();
      const saved = chapter.user_chapter_progress;
      this.tracker = {
        chapterId: chapter.id,
        position: saved.last_watched_position_seconds ?? 0,
        furthest: saved.max_watched_duration_seconds ?? 0,
        lastTime: null,
        sincePlayedSave: 0,
      };
    }
    return this.tracker;
  }

  /**
   * Queue the chapter on screen for saving, with any earlier failed saves,
   * then send what's queued. Positions already saved aren't sent again.
   */
  private queueSave(): void {
    for (const [chapterId, update] of this.failed) {
      if (!this.unsent.has(chapterId)) this.unsent.set(chapterId, update);
    }
    this.failed.clear();

    const tracker = this.tracker;
    if (tracker && tracker.position > 0) {
      // Whole seconds: the server's fields are integers.
      const update: CourseProgressUpdate = {
        chapter_id: tracker.chapterId,
        last_watched_position_seconds: Math.floor(tracker.position),
        max_watched_duration_seconds: Math.floor(tracker.furthest),
      };
      if (this.lastSaved.get(update.chapter_id) !== saveKey(update)) {
        this.unsent.set(update.chapter_id, update);
      }
      tracker.sincePlayedSave = 0;
    }
    void this.drain();
  }

  /**
   * Send the queue, one request at a time. Resolves once it's empty, so the
   * end of a video can wait for the server's answer. A chapter whose
   * `chapter-start/` hasn't answered yet keeps its save until it does.
   */
  private drain(): Promise<void> {
    this.draining ??= this.sendQueued().finally(() => {
      this.draining = null;
      // A save queued in the gap between the last send and this line.
      if (this.nextUnsent()) void this.drain();
    });
    return this.draining;
  }

  private async sendQueued(): Promise<void> {
    for (let update = this.nextUnsent(); update; update = this.nextUnsent()) {
      this.unsent.delete(update.chapter_id);
      // Counted as saved while in flight, so the same positions queued again
      // meanwhile (a pause, then the end) aren't sent twice; undone on failure.
      this.lastSaved.set(update.chapter_id, saveKey(update));
      try {
        const progress = await this.detail.saveProgress(update);
        if (progress.reset_required) {
          if (!this.destroyed) {
            this.notification.info(
              CHAPTER_COPY.enrolmentReset.title,
              CHAPTER_COPY.enrolmentReset.body,
            );
          }
          this.detail.reload();
        } else {
          // Applied even after the page has gone: the course page reads the
          // same course, so its chapter list shows the new locks too.
          this.trackCompletion(progress.chapters);
          this.detail.applyProgress(progress.chapters);
        }
      } catch (error) {
        this.logger.error('[CourseChapter] course-progress-update failed', error);
        this.lastSaved.delete(update.chapter_id);
        this.saveFailed(error, update);
      }
    }
  }

  private nextUnsent(): CourseProgressUpdate | null {
    return [...this.unsent.values()].find((u) => this.started.has(u.chapter_id)) ?? null;
  }

  /**
   * A failed save. A 403 or 409 is the server closing the course to the
   * learner (entitlement, an AI Lab lock), handled as on `chapter-start/`.
   * Anything else (a 400 "Not enrolled", a 5xx, a dropped connection) warns
   * once per chapter and is held for the next save, never retried at once.
   */
  private saveFailed(error: unknown, update: CourseProgressUpdate): void {
    const refusal = readCourseStepRefusal(error);
    if (refusal.status === 403 || refusal.status === 409) {
      if (!this.destroyed) this.refuse(error);
      return;
    }
    this.failed.set(update.chapter_id, update);
    if (this.destroyed || this.warned.has(update.chapter_id)) return;
    this.warned.add(update.chapter_id);
    this.notification.error(
      CHAPTER_COPY.progressNotSaved.title,
      CHAPTER_COPY.progressNotSaved.body,
    );
  }

  /**
   * `chapter_complete` the first time the server reports a chapter's video
   * complete, and `course_complete` once it reports every chapter's: compared
   * with the course as held before the answer is applied.
   */
  private trackCompletion(saved: CourseProgressChapter[]): void {
    const before = new Map(
      this.detail
        .chapters()
        .map((chapter) => [chapter.id, !!chapter.user_chapter_progress.is_video_completed]),
    );
    const params = {
      course_id: this.detail.course()?.id,
      course_type: this.detail.analyticsType(),
    };
    for (const chapter of saved) {
      if (chapter.progress.is_video_completed && before.get(chapter.chapter_id) === false) {
        this.analytics.trackEvent('chapter_complete', {
          ...params,
          chapter_id: chapter.chapter_id,
        });
      }
    }
    const wasComplete = before.size > 0 && [...before.values()].every(Boolean);
    const isComplete =
      saved.length > 0 && saved.every((chapter) => !!chapter.progress.is_video_completed);
    if (isComplete && !wasComplete) this.analytics.trackEvent('course_complete', params);
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

  /**
   * A locked chapter (a course-page row, a deep link): open the chapter that
   * holds it instead, where the learner left off. When that one's quiz is what's
   * holding it, its quiz opens there (`CourseChapterQuizFacade`), and finishing
   * it moves on. With nowhere open to go, back to the course page.
   */
  private redirectLocked(chapter: MasterclassChapterLink): void {
    const resume = this.detail.resumeChapter();
    const path =
      resume && resume.id !== chapter.id && !resume.is_locked
        ? this.detail.chapterPath(resume)
        : null;
    if (!resume || !path) {
      this.leave(CHAPTER_COPY.chapterLocked.title, CHAPTER_COPY.chapterLocked.body);
      return;
    }
    const quizHolds =
      this.isCpeMode() && resume.show_quiz && !resume.user_chapter_progress.is_mcq_completed;
    const copy = quizHolds ? CHAPTER_COPY.quizLocked : CHAPTER_COPY.chapterLocked;
    this.notification.info(copy.title, copy.body);
    void this.router.navigateByUrl(path, { replaceUrl: true });
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

  backToCourse(): void {
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
