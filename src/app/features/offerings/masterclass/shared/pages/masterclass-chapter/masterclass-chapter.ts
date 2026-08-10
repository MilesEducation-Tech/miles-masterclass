import { Component, computed, effect, inject, input } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { VideoChapter } from '../../../../shared/components/video-chapter/video-chapter';
import { Backward } from '../../../../../../shared/components/backward/backward';
import { Utils } from '../../../../../../shared/core/services/utils/utils';
import { Auth } from '../../../../../../shared/core/services/auth/auth';
import { Logger } from '../../../../../../shared/core/services/logger/logger';
import { CairaUuid } from '../../../../../../shared/core/models/caira/envelope.model';
import { ChapterProgress } from '../../../../shared/services/chapter-progress/chapter-progress';
import { CourseDetail } from '../../../../shared/services/course-detail/course-detail';

/**
 * How far the learner must move before another #18 write goes out, as a
 * percentage of the chapter's duration.
 */
const SAVE_INTERVAL_PERCENT = 5;

/**
 * The masterclass chapter player — CAIRA #6 and #18 through `ChapterProgress`.
 *
 * The course itself comes from `CourseDetail`, provided one route level up, so
 * this page does not re-read #4. Chapter navigation and completion are
 * `computed()` over that; nothing is copied into local state.
 *
 * Three behaviours from the placeholder are deliberately gone:
 *
 * - **Client-side completion.** The old `updateTime` marked a chapter complete
 *   at `percentage > 95`. CAIRA owns that rule (`Max_Watched >= duration *
 *   0.95`), so the client reports positions and reads the server's flag.
 * - **CPE / preview mode.** `cpe_mode_details` is pinned `null` (G-30) — CAIRA
 *   has no mode toggle and gates chapters server-side with `is_locked`. The
 *   "Switch to CPE Mode" dialog could never fire correctly, so it is removed.
 * - **The final-assessment session id.** CAIRA identifies an attempt by
 *   `(user, course, attempt_number)`; `user_assessment_details.session_id` does
 *   not exist, so the report link is routed by course instead.
 */
@Component({
  selector: 'app-masterclass-chapter',
  imports: [VideoChapter, Backward],
  templateUrl: './masterclass-chapter.html',
  styleUrl: './masterclass-chapter.css',
})
export class MasterclassChapter {
  readonly courseId = input<string>();
  readonly courseTitle = input<string>();
  readonly chapterId = input<string>();

  protected readonly chapter = inject(ChapterProgress);
  private readonly courseDetail = inject(CourseDetail);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(Auth);
  private readonly utils = inject(Utils);
  private readonly logger = inject(Logger);

  protected readonly navigation = this.chapter.navigation;
  protected readonly isVideoCompleted = this.chapter.isVideoCompleted;
  protected readonly courseNavigation = computed(() => '../../..');

  private lastPosition = 0;
  private lastSavedPercent = 0;

  constructor() {
    // #6 must run before anything can be written against the chapter. Keyed on
    // the id so moving between chapters starts each one exactly once; the
    // service holds the guard.
    effect(() => {
      if (!this.chapter.chapterId()) return;
      // A new chapter restarts the save cadence — 40% of chapter 2 is not a
      // continuation of 40% of chapter 1.
      this.lastSavedPercent = 0;
      this.lastPosition = 0;
      this.chapter.start();
    });

    // Signing out mid-chapter drops back to the course page. The chapter route
    // is `.../:courseId/:courseTitle/chapter/:chapterId/:chapterTitle`, so the
    // course page is three segments up.
    effect(() => {
      if (this.auth.isLoggedIn()) return;
      const tree = this.router.parseUrl(this.router.url);
      const segments = tree.root.children['primary']?.segments;
      if (segments && segments.length >= 3) {
        segments.splice(segments.length - 3, 3);
        this.router.navigateByUrl(tree);
      }
    });
  }

  protected handleNavigation(chapterId: CairaUuid): void {
    const chapter = this.chapter.chapters().find((c) => c.id === chapterId);
    if (!chapter) {
      this.logger.warn('handleNavigation: unknown chapter', { chapterId });
      return;
    }
    // Access is the server's call — a locked chapter has no video to play.
    if (chapter.is_locked) return;

    // CPE mode holds the next chapter until this one is complete. Going *back*
    // is always allowed: re-watching earned material is not a compliance risk,
    // and blocking it would strand a learner who wanted to check something.
    const isGoingBack = this.chapter.navigation().prev?.id === chapterId;
    if (!isGoingBack && this.chapter.cpeMode() && !this.chapter.isVideoCompleted()) return;

    // Save where they got to before the route changes — see `saveProgress`'s
    // note on why the final write is not cancelled on destroy.
    this.chapter.saveProgress(this.lastPosition, { final: true });

    this.router.navigate(['../../', chapterId, this.utils.slugify(chapter.chapter_name)], {
      relativeTo: this.route,
    });
  }

  protected startFinalAssessment(): void {
    const courseId = this.courseId();
    const courseTitle = this.courseTitle();
    if (!courseId || !courseTitle) return;
    this.courseDetail.startFinalAssessment(courseId, courseTitle, 'masterclass');
  }

  /**
   * ponytail: the route still carries a `:sessionId` segment that CAIRA has no
   * counterpart for. `'latest'` keeps the URL shape while the report page reads
   * the attempt by course (#11); `legacy-redirects.ts` owns the old links.
   */
  protected handleViewReport(): void {
    this.router.navigate(['../../../', 'final-assessment', 'latest', 'report'], {
      relativeTo: this.route,
    });
  }

  /**
   * Position reports, throttled to every 5% of the chapter.
   *
   * `timeUpdate` fires several times a second and #18 is a write, so it cannot
   * be forwarded raw. 5% is the cadence this page has always used; what changed
   * is that it reports a position rather than deciding completion.
   */
  protected updateTime(data: { currentTime: number; duration: number }): void {
    this.lastPosition = data.currentTime;
    if (data.duration <= 0) return;

    const percent = (data.currentTime / data.duration) * 100;
    if (Math.abs(percent - this.lastSavedPercent) < SAVE_INTERVAL_PERCENT) return;

    this.lastSavedPercent = percent;
    this.chapter.saveProgress(data.currentTime);
  }

  protected handleExit(data?: { currentTime: number; duration: number }): void {
    const position = data?.currentTime ?? this.lastPosition;
    this.lastPosition = position;
    this.chapter.saveProgress(position, { final: true });
  }

  /**
   * The player reached the end. This is still only a position report — the
   * server decides whether that counts as complete.
   */
  protected handleVideoEnded(): void {
    this.chapter.saveProgress(this.lastPosition, { final: true });
  }
}
