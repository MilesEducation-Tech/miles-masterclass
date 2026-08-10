import { DestroyRef, Service, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { ApiClient } from '../../../../../shared/core/services/api-client/api-client';
import { Dialog } from '../../../../../shared/core/services/dialog/dialog';
import { Logger } from '../../../../../shared/core/services/logger/logger';
import { CAIRA } from '../../../../../shared/core/http/caira.endpoints';
import { cairaError } from '../../../../../shared/core/http/caira-error';
import { CairaUuid } from '../../../../../shared/core/models/caira/envelope.model';
import { ChapterView } from '../../../../../shared/core/models/caira/course-detail.model';
import {
  ChapterNavigation,
  ChapterStartResponse,
  ChapterProgressUpdateResponse,
  chapterNavigation,
  isResetRequired,
} from '../../../../../shared/core/models/caira/progress.model';
import {
  UtilsDialog,
  UtilsDialogData,
} from '../../../../../shared/components/dialog/utils-dialog/utils-dialog';
import { CourseDetail } from '../course-detail/course-detail';

/**
 * Whether a chapter runs in CPE mode when the backend has not said otherwise.
 *
 * **Every chapter is CPE mode today.** CAIRA has no mode flag on any endpoint
 * (G-30), and CPE is the mode that matters: it locks seeking to watched
 * territory, holds the next chapter until this one is complete, and puts the
 * chapter quiz in front of the learner. Running the alternative — preview mode,
 * which is a free-seek walkthrough that earns nothing — would silently drop
 * every compliance rule the credential depends on.
 *
 * The enrollment API is due to carry the real flag. When it does, the only
 * change is `setCpeMode()` at the one call site marked below; this constant
 * becomes the fallback for a response that omits it.
 */
const CPE_MODE_DEFAULT = true;

/**
 * The chapter player — #6 (start) and #18 (progress update).
 *
 * **Route-scoped**, provided on `chapter/:chapterId/:chapterTitle` in both the
 * masterclass and podcast trees. `CourseDetail` is provided one level up on
 * `:courseId/:courseTitle`, so injecting it here reaches the *same instance*
 * the course page already loaded — the chapter list, exam rules and course id
 * come from there rather than from a second read of #4.
 *
 * The reactive root is the chapter id, read off the route the service is
 * provided on. The page used to copy it into facade state through an
 * `effect()`; that is a state-propagating effect over information the router
 * already holds.
 *
 * There is no `httpResource` here. Both endpoints are commands — #6 is a POST
 * fired once on open, #18 a POST fired as the learner watches — and progress is
 * read back from #4's `user_chapter_progress`, which `CourseDetail` owns. #17,
 * the progress GET, is not called: the shipped LMS does not call it either.
 */
@Service({ autoProvided: false })
export class ChapterProgress {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);
  private readonly courseDetail = inject(CourseDetail);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /**
   * The reactive root — `chapter/<uuid>/<slug>` off the current URL.
   *
   * Read from the URL rather than an `ActivatedRoute` snapshot so it updates
   * when the learner moves between chapters without leaving the route.
   */
  readonly chapterId = computed<CairaUuid | null>(() => {
    const match = /\/chapter\/([^/]+)/.exec(this.url().split('?')[0]);
    return match ? decodeURIComponent(match[1]) : null;
  });

  readonly chapters = this.courseDetail.courseChapters;
  readonly courseDetails = this.courseDetail.courseDetails;
  readonly loading = this.courseDetail.isLoading;

  /**
   * prev / current / next. Always an object, never `null` — the template binds
   * `navigation().current` straight into the player.
   */
  readonly navigation = computed<ChapterNavigation<ChapterView>>(() =>
    chapterNavigation(this.chapters(), this.chapterId()),
  );

  readonly current = computed(() => this.navigation().current);

  /**
   * Completion is the **server's** answer, not a percentage the client
   * computes. #4 reports `play_history.is_completed`; #18's response can flip
   * it mid-session, so a write patches this and a course reload resets it.
   */
  private readonly completedOverride = signal<boolean | null>(null);

  readonly isVideoCompleted = computed(
    () => this.completedOverride() ?? this.current()?.play_history?.is_completed ?? false,
  );

  /** Server-side seek lock. `is_locked` chapters expose no video at all. */
  readonly isLocked = computed(() => this.current()?.is_locked ?? false);
  readonly showQuiz = computed(() => this.current()?.show_quiz ?? false);

  /**
   * The mode flag once the enrollment API supplies one. `null` means it has not
   * spoken, which is every response today.
   */
  private readonly serverCpeMode = signal<boolean | null>(null);

  /**
   * Whether the player enforces CPE rules. Both players take this as an input
   * and derive their seek lock (`PlayerMode.CPE`), their quiz hand-off and
   * their next-chapter gate from it.
   */
  readonly cpeMode = computed(() => this.serverCpeMode() ?? CPE_MODE_DEFAULT);

  /**
   * The per-chapter completion signal both players gate on.
   *
   * The Django API sent a `chapter_wise_details` list and the templates read
   * `?.status` off the entry for the open chapter; CAIRA has no such list, so
   * it is rebuilt here from the chapter's own state. `status` truthy means the
   * learner may seek freely, advance to the next chapter, and start the final
   * assessment.
   *
   * ponytail: video completion only. The quiz half of the rule needs #7's
   * per-question `user_selected_option`, which is P-P4 — until then a chapter
   * with an unanswered quiz still counts as done for navigation, and the player
   * still shows the quiz on video end.
   */
  readonly chapterWiseDetails = computed(() => {
    const id = this.chapterId();
    if (!id) return undefined;
    return { chapter_id: id, status: this.isVideoCompleted() };
  });

  /**
   * Adopt a mode the backend reported.
   *
   * The single seam for the enrollment flag: call it from `start()`'s response
   * once #6 (or #14) carries the field, and CPE mode stops being an assumption.
   */
  setCpeMode(mode: boolean | null): void {
    this.serverCpeMode.set(mode);
  }

  /** Highest position reported so far, so #18 always carries a monotonic max. */
  private maxWatchedSeconds = 0;
  private startedChapterId: CairaUuid | null = null;
  private saving = false;

  /**
   * #6 · `POST chapter/{id}/start/` — **no body**.
   *
   * Fires once per chapter. Creates the 365-day enrollment and the progress
   * row, so nothing can be written before it lands.
   *
   * Two non-error answers to handle: `reset_required` (the window expired and
   * progress was wiped) opens a dialog, and a 409 `already_started_via_7dc` is
   * a domain state the learner should see as copy, not a toast.
   */
  start(): void {
    const id = this.chapterId();
    if (!id || this.startedChapterId === id) return;
    this.startedChapterId = id;
    // A new chapter resets the watched high-water mark and the completion
    // override; both are per-chapter, not per-course.
    this.maxWatchedSeconds = 0;
    this.completedOverride.set(null);
    // The mode is per-enrollment, and #6 is what reports it — drop the previous
    // chapter's answer rather than carrying it across.
    this.serverCpeMode.set(null);

    this.api
      .post<ChapterStartResponse>(CAIRA.chapterStart(id), null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          // Before any other key — the reset branch carries none of them.
          if (isResetRequired(response)) {
            this.openResetDialog(response.message);
            return;
          }
          // ponytail: the enrollment mode flag lands here. When #6 grows the
          // field, read it and call `this.setCpeMode(response.<field>)`; the
          // default in `CPE_MODE_DEFAULT` then only covers a response that
          // omits it. Nothing else in the chapter tree needs to change.
        },
        error: (error: unknown) => {
          const failure = cairaError(error);
          if (failure.kind === 'domain') {
            // `already_started_via_7dc` and friends: the chapter is usable, the
            // enrollment just came from somewhere else. Nothing to show.
            this.logger.warn('chapterStart returned a domain state', failure.reason);
            return;
          }
          // Let it be diagnosable. `errorInterceptor` has already decided
          // whether the learner sees a toast.
          this.startedChapterId = null;
          this.logger.error('chapterStart failed', failure);
        },
      });
  }

  /**
   * #18 · `POST course-progress/{courseId}/update/`.
   *
   * Path is keyed on the **course**, body names the chapter. The client reports
   * positions only — `Max_Watched >= duration * 0.95` is the server's rule for
   * completion and seekability, and `Max_Watched_Duration_Seconds` is
   * `max(existing, incoming)` server-side too.
   *
   * `final` marks the save that fires as the player tears down during
   * navigation. That one is **deliberately not cancelled on destroy**: the LMS
   * carries the same exception, because cancelling it drops the learner's last
   * watched position every time they hit Back.
   */
  saveProgress(positionSeconds: number, options: { final?: boolean } = {}): void {
    const courseId = this.courseDetail.courseId();
    const chapterId = this.chapterId();
    if (!courseId || !chapterId) return;
    // Skip overlapping saves, except the final one — that must always land.
    if (this.saving && !options.final) return;

    const position = Math.max(0, Math.floor(positionSeconds));
    this.maxWatchedSeconds = Math.max(this.maxWatchedSeconds, position);
    this.saving = true;

    const request = this.api.post<ChapterProgressUpdateResponse>(
      CAIRA.courseProgressUpdate(courseId),
      {
        chapter_id: chapterId,
        last_watched_position_seconds: position,
        max_watched_duration_seconds: this.maxWatchedSeconds,
      },
    );

    // The final save runs to completion outside the DestroyRef on purpose.
    const stream = options.final ? request : request.pipe(takeUntilDestroyed(this.destroyRef));

    stream.subscribe({
      next: (response) => {
        this.saving = false;
        if (isResetRequired(response)) {
          this.openResetDialog(response.message);
          return;
        }
        const completed = response?.data?.is_video_completed;
        // The server decides. `undefined` means it did not say, so keep #4's.
        if (typeof completed === 'boolean') this.completedOverride.set(completed);
      },
      error: (error: unknown) => {
        this.saving = false;
        this.logger.warn('Progress save failed', cairaError(error));
      },
    });
  }

  /**
   * The 365-day window expired and the server wiped this course's progress.
   *
   * A dialog rather than an error: the learner has not done anything wrong, and
   * the course is still available from the start. Reloading #4 is what brings
   * the emptied progress back into the UI.
   */
  private openResetDialog(message?: string | null): void {
    const data: UtilsDialogData = {
      title: 'Your course access has been renewed',
      containerClass: 'max-w-lg text-left!',
      content: [
        {
          type: 'text',
          value:
            message ??
            'Your one-year access window for this course had expired, so your progress has been reset. You can start the course again from the first chapter.',
        },
      ],
      buttons: [{ label: 'Start again', variant: 'default', action: 'confirm' }],
    };

    this.dialog
      .open<UtilsDialog, { action?: string; result: boolean }>(UtilsDialog, {
        data,
        width: 'auto',
        maxWidth: '32rem',
        disableClose: true,
      })
      .afterClosed$.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.startedChapterId = null;
        this.maxWatchedSeconds = 0;
        this.completedOverride.set(null);
        this.courseDetail.reload();
      });
  }
}
