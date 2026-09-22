import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  Injector,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Router, UrlSegment } from '@angular/router';
import { Observable, catchError, finalize, of, tap } from 'rxjs';
import { ApiClient } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import { Dialog } from '@core/services/dialog/dialog';
import { Utils } from '@core/services/utils/utils';
import { Analytics } from '@core/services/analytics/analytics';
import {
  CommonResponse,
  RouteParams,
  RouteRequest,
  RouteResponse,
  SKIP_ERROR_NOTIFICATION,
} from '@core/models/http.model';
import {
  ChapterQuizResponse,
  CourseContentResponse,
  MASTERCLASS_ROUTES,
} from '@core/models/masterclass.model';
import { ContentDetails } from '@core/models/course.model';
import { UtilsDialog } from '@shared/components/dialog/utils-dialog/utils-dialog';
import {
  MicroLearningQuizDialog,
  MicroLearningQuizDialogData,
} from '../../../micro-learning/shared/components/micro-learning-quiz-dialog/micro-learning-quiz-dialog';
import { PaymentFacade } from '@features/payment/shared/service/payment-facade/payment-facade';
import {
  ActionStatus,
  deriveActionStatus,
  isReelCompleted,
  MicroLearningReel,
  NANO_LEARNING_HANDOFF_KEY,
  NANO_LEARNING_ROUTES,
  NanoLearningListResponse,
  ReelActivityPayload,
  MicroLearningFieldOfStudy,
  NanoLearningPage,
} from '@core/models/micro-learning-course.model';

type ActivityEvent = 'heartbeat' | 'completed' | 'exit';
type SetCpeModeRequest = RouteRequest<typeof MASTERCLASS_ROUTES.setCpeMode>;
type SetCpeModeResponse = RouteResponse<typeof MASTERCLASS_ROUTES.setCpeMode>;
type SubmitQuizAnswerRequest = RouteRequest<typeof MASTERCLASS_ROUTES.submitQuizAnswer>;
type SubmitQuizAnswerResponse = RouteResponse<typeof MASTERCLASS_ROUTES.submitQuizAnswer>;
type CourseContentParams = RouteParams<typeof MASTERCLASS_ROUTES.getCourseContent>;

/** Window (ms) after a programmatic scroll during which scroll events are ignored. */
const PROGRAMMATIC_SCROLL_DEBOUNCE_MS = 600;

/**
 * The reel fields the course-level details endpoint is authoritative for — the
 * ones `applyCourseDetails` copies over. Everything else on a reel stays owned
 * by the anchor response, deliberately: `video_url` and `chapter_id` only exist
 * there, `total_duration` comes back as 0 on the details payload, and
 * `last_activity` means different things on the two shapes (seconds watched on
 * a reel, a date string on ContentDetails).
 */
type StateField =
  | 'cpe_mode_details'
  | 'action_status'
  | 'user_assessment_details'
  | 'user_feedback_details'
  | 'exam_rules';

/** Build a minimal ContentDetails shape from a reel for Utils.openCertificateDownloadDialog. */
function reelToContentDetails(reel: MicroLearningReel): ContentDetails {
  return {
    ...reel,
    active_plan: null,
    can_purchase_individually: false,
    is_subscription_excluded: !!reel.is_subscription_excluded,
    is_added_to_cart: !!reel.is_added_to_cart,
    user_feedback_details: reel.user_feedback_details ?? {
      user_feedback_submitted: false,
      user_rating: 0,
    },
  } as unknown as ContentDetails;
}

/** `Exam_Passed` / `Retake` — anything but the backend's "not appeared" status. */
function examAttempted(details: MicroLearningReel['user_assessment_details']): boolean {
  const status = details?.status;
  return status === 'Exam_Passed' || status === 'Retake';
}

/** A details payload that carries what the player needs, so it can stand in for the anchor row. */
type SeedableDetails = ContentDetails & Required<Pick<ContentDetails, 'video_url' | 'chapter_id'>>;

/**
 * Whether a course page can run off the details payload alone. Needs the
 * video, the chapter it tracks against, and a real duration — the
 * micro-learning serializer sends none of those yet (`total_duration` is 0),
 * which is what keeps the anchor fetch alive as a fallback.
 */
function canSeedReel(details: ContentDetails): details is SeedableDetails {
  return !!details.video_url && details.chapter_id != null && details.total_duration > 0;
}

/** The reel the facade runs on, built from a course details payload. */
function detailsToReel(details: SeedableDetails): MicroLearningReel {
  return {
    ...details,
    fields_of_study: (details.fields_of_study ?? []) as MicroLearningFieldOfStudy[],
    has_exercise_files: !!details.has_exercise_files,
    is_downloadable: false,
    additional_resource: [],
    // Seconds watched on a reel; on details the same name is a date string.
    last_activity: details.total_duration_watched ?? 0,
  };
}

@Injectable()
export class MicroLearningCourseFacade {
  private readonly http = inject(ApiClient);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly utils = inject(Utils);
  private readonly analytics = inject(Analytics);
  private readonly payment = inject(PaymentFacade);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * First page handed off by the landing hero via router navigation state,
   * captured at construction (during route activation, while
   * `getCurrentNavigation()` is still live). Consumed once by `initForCourse`
   * so the Start Watching path skips the redundant `:id` fetch. Null on card /
   * deep-link / refresh (no in-app navigation state).
   */
  private pendingHandoff: NanoLearningPage | null =
    (this.router.getCurrentNavigation()?.extras?.state?.[NANO_LEARNING_HANDOFF_KEY] as
      NanoLearningPage | undefined) ?? null;
  /**
   * Route-scoped injector passed to `Dialog.open` so the opened dialog can
   * resolve route-level providers (e.g., `ChapterFacade`, which `ChapterQuiz`
   * injects).
   */
  private readonly injector = inject(Injector);

  readonly detailsList = signal<MicroLearningReel[]>([]);
  readonly selectedReelId = signal<number | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Course anchor id already initialized — guards `initForCourse` against re-fires that would reorder the list. */
  private loadedCourseId: number | null = null;

  /**
   * Endpoint `loadNextPage` paginates against — set to whichever endpoint the
   * course was loaded from: `v2/nano-learning/:id/` for the card/deep-link
   * path, or the list endpoint for the Start Watching handoff path. Both take
   * the same opaque `?cursor=`.
   */
  private paginationPath: string = NANO_LEARNING_ROUTES.getCourseList.path;

  /** Opaque cursor for the next feed page; null once the feed is exhausted. */
  readonly nextCursor = signal<string | null>(null);
  /** True while a `loadNextPage` append is in flight — guards against duplicate fetches. */
  readonly loadingMore = signal(false);

  /** True while a CTA request is in flight — bind `[disabled]` on the button. */
  readonly ctaLoading = signal(false);

  /** Monotonic tokens the page/reel card observe to scroll / rewatch / pause. */
  private tokenSeq = 0;
  readonly scrollToIdRequest = signal<{ id: number; token: number } | null>(null);
  readonly rewatchRequest = signal<{ id: number; token: number } | null>(null);
  /** Reel-card pauses its player when this token changes (e.g. quiz dialog opened). */
  readonly pauseRequest = signal<{ id: number; token: number } | null>(null);

  /** Timestamp of the last programmatic scroll — guards `onReelScroll` from overwriting. */
  private lastProgrammaticScrollAt = 0;

  readonly activeIndex = computed(() => {
    const list = this.detailsList();
    const id = this.selectedReelId();
    if (id == null) return 0;
    const idx = list.findIndex((r) => r.id === id);
    return idx >= 0 ? idx : 0;
  });

  readonly activeReel = computed<MicroLearningReel | null>(
    () => this.detailsList()[this.activeIndex()] ?? null,
  );

  /** Alias for the currently-focused reel — single source of truth derived from selectedReelId. */
  readonly courseDetails = this.activeReel;

  readonly actionStatus = computed<ActionStatus | null>(() => {
    const reel = this.activeReel();
    return reel ? deriveActionStatus(reel) : null;
  });

  /** Overall series progress (0–100) — ratio of completed reels to total reels. */
  readonly currentProgress = computed(() => {
    const list = this.detailsList();
    if (list.length === 0) return 0;
    const completed = list.filter((r) => isReelCompleted(r)).length;
    return Math.round((completed / list.length) * 100);
  });

  /**
   * Reel IDs for which we've already fired the auto-init setCpeMode(false)
   * request. Guards against re-calling the API on every scroll/selection.
   */
  private readonly autoInitedReelIds = new Set<number>();

  constructor() {
    // Sync local cart state when a reel is removed via the cart drawer.
    effect(() => {
      const removedId = this.payment.cartItemRemoved();
      untracked(() => {
        if (removedId == null) return;
        this.detailsList.update((list) =>
          list.map((r) => (r.id === removedId ? { ...r, is_added_to_cart: false } : r)),
        );
      });
    });

    // Per product spec: when the user lands on a reel that has no cpe_mode
    // decision yet (`cpe_mode_details === null`), auto-initialize it to
    // Preview mode server-side.
    // ponytail: guests used to skip this — the API requires auth.
    effect(() => {
      const reel = this.activeReel();
      if (!reel) return;
      if (reel.cpe_mode_details !== null && reel.cpe_mode_details !== undefined) return;
      if (this.autoInitedReelIds.has(reel.id)) return;
      untracked(() => {
        this.autoInitedReelIds.add(reel.id);
        this.selectCpeMode(false, { silent: true });
      });
    });
  }

  // ─── Loaders ──────────────────────────────────────────────────────────────

  /**
   * Entry point for the course page. On the Start Watching path the hero has
   * already fetched the first page and stashed it in the catalog — consume it
   * and skip the `:id` call. Otherwise (card click / deep-link / refresh) fall
   * back to the anchored `v2/nano-learning/:id` load.
   *
   * A page that already holds the course's details payload passes it in: when
   * it carries the video (`canSeedReel`) the course is seeded from it and the
   * anchor feed — a page of unrelated reels around the one course — is never
   * fetched. When it doesn't, the anchor is fetched and the details merged on
   * top as soon as it lands.
   */
  initForCourse(id: number, details?: ContentDetails): void {
    // The `courseId` route-input effect can fire more than once (Angular
    // re-emits the input). Guard on the *course* we've already initialized —
    // NOT on `selectedReelId`, which drifts as the user scrolls/clicks. A late
    // re-fire after such drift would otherwise re-run `loadCourseDetails` and
    // REPLACE `detailsList` with a freshly seed-shuffled order, desyncing the
    // scroll position from the active reel + episode grid.
    if (this.loadedCourseId === id) return;
    this.loadedCourseId = id;
    const page = this.pendingHandoff;
    this.pendingHandoff = null; // one-shot
    if (page) {
      this.selectedReelId.set(id);
      this.hydrateFromArray(page.reels);
      this.nextCursor.set(page.nextCursor);
      this.paginationPath = NANO_LEARNING_ROUTES.getCourseList.path;
      const reel = this.activeReel();
      if (reel) {
        this.analytics.trackEvent('view_item', {
          course_id: reel.id,
          course_name: reel.title,
          course_type: 'nano_learning',
        });
      }
      return;
    }
    if (details && canSeedReel(details)) {
      this.selectedReelId.set(id);
      this.hydrateFromArray([detailsToReel(details)]);
      this.nextCursor.set(null);
      return;
    }
    this.loadCourseDetails(id);
    // Parks as `pendingDetails` until the anchor row hydrates.
    if (details) this.applyCourseDetails(details);
  }

  loadCourseDetails(id: number, cursor?: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.pendingDetails = null;
    this.selectedReelId.set(id);

    const path = NANO_LEARNING_ROUTES.getCourseDetails.path.replace(':id', id.toString() + '/');
    // Paginate subsequent pages against this same `:id` endpoint. Always send
    // `cursor` (empty on first load) so the backend returns `next_cursor`.
    this.paginationPath = path;
    this.http
      .get<NanoLearningListResponse>(path, { params: { cursor: cursor ?? '' } })
      .pipe(
        tap((res) => {
          this.hydrateFromArray(res?.data ?? []);
          this.nextCursor.set(res?.pagination_data?.next_cursor ?? null);
          const reel = this.activeReel();
          if (reel) {
            this.analytics.trackEvent('view_item', {
              course_id: reel.id,
              course_name: reel.title,
              course_type: 'nano_learning',
            });
          }
        }),
        catchError((err) => {
          this.logger.error('Failed to load micro-learning course details', err);
          this.error.set(err?.error?.message || 'Failed to load reel');
          this.notification.error('Error', 'Failed to load reel');
          return of(null);
        }),
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /**
   * Append the next feed page using the tracked cursor. Fired as the user
   * nears the end of the loaded reels. Self-guards on `nextCursor` (feed
   * exhausted) and `loadingMore` (already in flight) so repeated scrollends
   * are safe.
   */
  loadNextPage(): void {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore()) return;
    this.loadingMore.set(true);
    this.http
      .get<NanoLearningListResponse>(this.paginationPath, { params: { cursor } })
      .pipe(
        tap((res) => {
          this.hydrateAppend(res?.data ?? []);
          this.nextCursor.set(res?.pagination_data?.next_cursor ?? null);
        }),
        catchError((err) => {
          this.logger.error('Failed to load next micro-learning page', err);
          return of(null);
        }),
        finalize(() => this.loadingMore.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  trackActivity(
    chapterId: number,
    timeStatus: number,
    event: ActivityEvent,
  ): Observable<CommonResponse<void> | null> {
    // ponytail: guests skipped the network call and only got a local playhead
    // update. Without a session layer every caller takes the network path.

    // Product gate (CPE mode): once the reel is considered completed by the
    // 95% rule on server-reported `last_activity`, suppress all activity
    // events — no more heartbeats, no duplicate 'completed', no pause-exit.
    // The server is authoritative once we've crossed the threshold.
    const reel = this.detailsList().find((r) => r.chapter_id === chapterId);
    if (
      reel?.cpe_mode_details?.cpe_mode &&
      reel.total_duration &&
      ((reel.last_activity ?? 0) / reel.total_duration) * 100 >= 95
    ) {
      return of(null);
    }

    // Persist the player's position locally so `last_activity` (seconds
    // watched) stays in sync with what we send to `myclassactivity`.
    this.updateLocalProgress(chapterId, timeStatus, event);

    const body = { chapter_id: chapterId, time_status: timeStatus, event };
    return this.http.post<CommonResponse<void>>(MASTERCLASS_ROUTES.myClassActivity.path, body).pipe(
      catchError((err) => {
        this.logger.error('Failed to track reel activity', err);
        return of(null);
      }),
      takeUntilDestroyed(this.destroyRef),
    );
  }

  /** Details that arrived before their reel — applied by `hydrateFromArray`. */
  private pendingDetails:
    (Pick<ContentDetails, 'id'> & Partial<Pick<MicroLearningReel, StateField>>) | null = null;

  /**
   * Merge the course-level `v2/:course_type/details/` payload onto the matching
   * reel.
   *
   * The anchor serializer (`v2/nano-learning/:id/`) ships a lean row — no
   * `cpe_mode_details`, `action_status`, `last_activity` or
   * `user_assessment_details` — so on a reload the CTA would fall back to
   * "Play" for a learner who is actually mid-exam. The details endpoint is the
   * authority on that state; the anchor stays the authority on `video_url` and
   * `chapter_id`, which details doesn't carry. Only the fields details owns are
   * copied, and only when present, so a lean details payload can't blank a reel.
   */
  applyCourseDetails(
    details: Pick<ContentDetails, 'id'> & Partial<Pick<MicroLearningReel, StateField>>,
  ): void {
    // The anchor and details requests race. If details lands first there is
    // no reel to merge onto yet — hold it, and apply once the anchor hydrates.
    if (!this.detailsList().some((r) => r.id === details.id)) {
      this.pendingDetails = details;
      return;
    }
    this.detailsList.update((list) =>
      list.map((r) =>
        r.id !== details.id
          ? r
          : {
              ...r,
              // The anchor row carries no progress. An attempted exam can only
              // exist for a watched-through video, so fill the gap — otherwise
              // `deriveActionStatus` never gets past playback after a refresh
              // and the feedback / certificate stages are unreachable.
              ...(r.last_activity == null && examAttempted(details.user_assessment_details)
                ? { last_activity: r.total_duration ?? 0 }
                : {}),
              ...(details.cpe_mode_details !== undefined
                ? { cpe_mode_details: details.cpe_mode_details }
                : {}),
              ...(details.action_status !== undefined
                ? { action_status: details.action_status }
                : {}),
              ...(details.user_assessment_details !== undefined
                ? { user_assessment_details: details.user_assessment_details }
                : {}),
              ...(details.user_feedback_details !== undefined
                ? { user_feedback_details: details.user_feedback_details }
                : {}),
              ...(details.exam_rules ? { exam_rules: details.exam_rules } : {}),
            },
      ),
    );
  }

  // ─── Activity tracking (heartbeat / completion) ───────────────────────────
  // Lives here, not on the page: both the reel page and the AI Lab course page
  // report playback against the same rules, and the throttle state has to sit
  // next to `trackActivity` for the CPE gates below to stay in one place.

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

    const reel = this.detailsList().find((r) => r.chapter_id === event.chapterId);
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
      this.trackActivity(event.chapterId, event.duration, 'completed').subscribe();
      // Trigger the post-video flow now (open quiz / start exam). We can't
      // wait for video.js's `ended` event: crossing 95% sets last_activity
      // to total_duration, which flips `isCompleted` → `loop = true` via
      // the videoConfig effect *before* the player reaches 100%, so `ended`
      // never fires. 95% is the reliable signal. `completedChapterIds`
      // already dedups, so this only runs once per reel per session.
      if (reel.id === this.activeReel()?.id) {
        this.handleVideoEnded();
      }
      return;
    }

    // Once a reel has emitted completion, stop sending heartbeats.
    if (alreadyEmittedCompleted) return;

    if (Math.abs(currentPercent - this.lastTrackedPercentage) >= 5) {
      this.lastTrackedPercentage = currentPercent;
      this.trackActivity(event.chapterId, event.currentTime, 'heartbeat').subscribe();
    }
  }

  handleExited(event: ReelActivityPayload): void {
    this.trackActivity(event.chapterId, event.currentTime, 'exit').subscribe();
  }

  /** Clears throttle + completion state — call when the course changes. */
  resetActivityTracking(): void {
    this.lastTrackedPercentage = 0;
    this.trackedReelChapterId = null;
    this.completedChapterIds.clear();
  }

  /** Drops one chapter's completion dedup + throttle, so REWATCH can re-report. */
  resetChapterActivity(chapterId: number): void {
    this.completedChapterIds.delete(chapterId);
    if (this.trackedReelChapterId === chapterId) {
      this.trackedReelChapterId = null;
      this.lastTrackedPercentage = 0;
    }
  }

  clear(): void {
    this.detailsList.set([]);
    this.selectedReelId.set(null);
    this.loading.set(false);
    this.error.set(null);
    this.nextCursor.set(null);
    this.loadingMore.set(false);
    this.loadedCourseId = null;
    this.paginationPath = NANO_LEARNING_ROUTES.getCourseList.path;
    this.ctaLoading.set(false);
    this.scrollToIdRequest.set(null);
    this.rewatchRequest.set(null);
    this.pauseRequest.set(null);
    this.autoInitedReelIds.clear();
    this.resetActivityTracking();
  }

  // ─── Navigation / CPE-mode guards ─────────────────────────────────────────

  isReelComplete(reelId: number): boolean {
    const reel = this.detailsList().find((r) => r.id === reelId);
    return !!reel && isReelCompleted(reel);
  }

  /** In CPE mode, the first incomplete reel before target blocks forward navigation. */
  getBlockingReel(targetIndex: number): MicroLearningReel | undefined {
    const list = this.detailsList();
    const active = this.activeReel();
    const isCpeMode = !!active?.cpe_mode_details?.cpe_mode;
    if (!isCpeMode) return undefined;

    for (let i = 0; i < targetIndex; i++) {
      if (!this.isReelComplete(list[i].id)) return list[i];
    }
    return undefined;
  }

  findInProgressReel(): MicroLearningReel | undefined {
    const list = this.detailsList();
    if (list.length === 0) return undefined;
    const isCpeMode = !!this.activeReel()?.cpe_mode_details?.cpe_mode;

    if (isCpeMode) return list.find((r) => !this.isReelComplete(r.id));

    const incomplete = list.filter((r) => !isReelCompleted(r));
    if (incomplete.length === 0) return undefined;

    // Highest `last_activity` (seconds watched) == most-recently-touched reel.
    const recentlyWatched = incomplete
      .filter((r) => (r.last_activity ?? 0) > 0)
      .sort((a, b) => (b.last_activity ?? 0) - (a.last_activity ?? 0))[0];
    return recentlyWatched ?? incomplete[0];
  }

  /**
   * Block forward navigation while the active reel is in CPE mode and not yet
   * completed. Backward navigation is always allowed — same rule as masterclass.
   */
  canAdvanceTo(targetIndex: number): boolean {
    if (targetIndex <= this.activeIndex()) return true;
    const active = this.activeReel();
    if (!active?.cpe_mode_details?.cpe_mode) return true;
    if (isReelCompleted(active)) return true;
    // this.notification.info('Finish watching', 'Complete this reel before advancing in CPE mode.');
    return true;
  }

  navigateToReel(reelId: number): void {
    const index = this.detailsList().findIndex((r) => r.id === reelId);
    if (index < 0) return;
    if (!this.canAdvanceTo(index)) return;
    this.selectedReelId.set(reelId);
    this.lastProgrammaticScrollAt = Date.now();
    this.scrollToIdRequest.set({ id: reelId, token: ++this.tokenSeq });
    this.syncUrlToReel(reelId);
  }

  /**
   * Called by the course page when the reel list scrolls. Guards against
   * overriding a recent programmatic scroll triggered by `navigateToReel`.
   */
  onScrollSelect(reelId: number): void {
    if (Date.now() - this.lastProgrammaticScrollAt < PROGRAMMATIC_SCROLL_DEBOUNCE_MS) return;
    if (reelId === this.selectedReelId()) return;
    this.selectedReelId.set(reelId);
    this.syncUrlToReel(reelId);
  }

  /**
   * Replace the `:courseId/:courseTitle` path segments with the active reel's
   * id + slugified title. `Location.replaceState` bypasses the Angular
   * router, so `ActivatedRoute` doesn't fire and the `effect()` watching
   * `courseId` does not refire — `loadCourseDetails` stays put. Refresh /
   * share-link entry points work because the route's existing param parsing
   * picks up the new id and the load runs once on cold mount.
   */
  private syncUrlToReel(reelId: number): void {
    const reel = this.detailsList().find((r) => r.id === reelId);
    if (!reel) return;
    const tree = this.router.parseUrl(this.router.url);
    const primary = tree.root.children['primary'];
    const segments = primary?.segments ?? [];
    if (segments.length < 2) return;
    const titleSlug = this.utils.slugify(reel.title) || segments[segments.length - 1].path;
    // Build a fresh segment array instead of mutating the parsed tree in
    // place — keeps us off Angular's `UrlSegment` internals.
    const replaced = segments.map((seg, i) => {
      if (i === segments.length - 2) return new UrlSegment(String(reelId), seg.parameters);
      if (i === segments.length - 1) return new UrlSegment(titleSlug, seg.parameters);
      return seg;
    });
    primary!.segments = replaced;
    this.location.replaceState(this.router.serializeUrl(tree));
  }

  // ─── Bookmark / Cart ──────────────────────────────────────────────────────

  toggleBookmark(): void {
    const reel = this.activeReel();
    if (!reel) return;
    this.utils
      .toggleBookmarkCourse(reel.id, { course_type: reel.course_type })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        if (!response?.status) return;
        this.detailsList.update((list) =>
          list.map((r) =>
            r.id === reel.id ? { ...r, added_bookmark: response.is_bookmarked } : r,
          ),
        );
      });
  }

  addToCart(): void {
    const reel = this.activeReel();
    if (!reel) return;
    this.utils
      .addCourseToCart(reel.id, !!reel.is_added_to_cart)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        if (!response?.status) return;
        this.detailsList.update((list) =>
          list.map((r) => (r.id === reel.id ? { ...r, is_added_to_cart: response.in_cart } : r)),
        );
      });
  }

  // ─── CPE mode ─────────────────────────────────────────────────────────────

  /**
   * Entry point for the bottom CTA in the default state. When the user isn't
   * authenticated, bounce to login. Otherwise — because reels now default to
   * Preview mode (cpe_mode: false) when the server hasn't set a mode yet —
   * a click on "Watch in CPE MODE" flips CPE mode to true directly. No picker
   * dialog is shown; the button is a one-click upgrade from Preview → CPE.
   */
  launchCourse(): void {
    // ponytail: bounced guests to `/auth/login` first. No session layer now.
    const reel = this.activeReel();
    if (!reel) return;
    if (reel.cpe_mode_details?.cpe_mode) {
      // Already in CPE mode — playback is driven by scroll/active state.
      return;
    }
    // Reels show no picker — this CTA *is* the mode selection, so it carries
    // the same subscription gate the masterclass picker does. Without it this
    // is an unguarded one-click route into the paid tier.
    // ponytail: `active_plan` is not on the reel payload (see
    // `reelToContentDetails`), so an individually-purchased reel currently
    // hits the upsell. Fix upstream by returning `active_plan` from
    // `v2/nano-learning`; the gate picks it up with no client change.
    if (!this.utils.requireCpeModeAccess(reel)) return;
    this.selectCpeMode(true);
  }

  /**
   * Set the CPE mode for the active reel.
   *
   * @param cpeModeStatus `true` = CPE Certification Mode, `false` = Preview.
   * @param options.silent when true (used by auto-init), suppress success and
   *   error notifications AND the Preview→CPE restart side-effect. Failures
   *   still log but don't reload the course.
   *
   * Per product spec: when switching Preview → CPE (cpe_mode_details was
   * null/false and becomes true), reset progress and restart playback from 0
   * with restrictions re-applied. Switching to Preview pauses tracking but
   * keeps the current playhead + `last_activity`.
   */
  selectCpeMode(cpeModeStatus: boolean, options: { silent?: boolean } = {}): void {
    const reel = this.activeReel();
    if (!reel) {
      if (!options.silent) this.notification.error('Error', 'Reel data not available');
      return;
    }

    // Capture the previous state BEFORE the server response mutates it — so
    // we can detect the Preview → CPE transition and fire the restart.
    const wasInCpeMode = !!reel.cpe_mode_details?.cpe_mode;
    const enteringCpeMode = cpeModeStatus && !wasInCpeMode;

    if (!options.silent) this.loading.set(true);
    const body: SetCpeModeRequest = {
      nano_learning_id: reel.id,
      cpe_mode_status: cpeModeStatus,
    };

    this.http
      .post<SetCpeModeResponse>(MASTERCLASS_ROUTES.setCpeMode.path, body)
      .pipe(
        tap(() => {
          this.loading.set(false);
          if (!options.silent) {
            this.notification.success(
              'Mode Selected',
              cpeModeStatus ? 'CPE Certification Mode enabled' : 'Preview Mode enabled',
            );
          }
          const date = new Date().toISOString();
          // Only reset progress when entering CPE mode (fresh-start semantics).
          // Preview mode just pauses tracking; keep `last_activity` intact.
          // Silent auto-init to Preview also preserves `last_activity`.
          const resetProgress = enteringCpeMode;
          const applyMode = (r: MicroLearningReel): MicroLearningReel => ({
            ...r,
            cpe_mode_details: {
              cpe_mode: cpeModeStatus,
              class_started: date,
              class_ends_on: date,
            },
            ...(resetProgress ? { last_activity: 0, action_status: null } : {}),
          });
          // Scope the mutation to the reel we set — CPE mode is per-course.
          this.detailsList.update((list) => list.map((r) => (r.id === reel.id ? applyMode(r) : r)));

          // Preview → CPE: restart the live player from 0. Reuse the rewatch
          // channel the reel card already listens to — it seeks to 0 + plays.
          if (enteringCpeMode && !options.silent) {
            this.rewatchRequest.set({ id: reel.id, token: ++this.tokenSeq });
          }
        }),
        catchError((err) => {
          this.loading.set(false);
          this.logger.error('Failed to set CPE mode for micro-learning', err);
          if (!options.silent) {
            this.notification.error(
              'Mode Change Failed',
              err?.error?.message || 'Unable to update CPE mode. Please try again.',
            );
            const id = this.activeReel()?.id;
            if (id != null) this.loadCourseDetails(id);
          }
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  toggleCpeMode(cpeModeStatus: boolean): void {
    const isSwitchingToCpe = cpeModeStatus === true;

    // Upgrade only. Switching down to Preview stays open to everyone.
    if (isSwitchingToCpe) {
      const reel = this.activeReel();
      if (!reel) return;
      if (!this.utils.requireCpeModeAccess(reel)) return;
    }

    const title = isSwitchingToCpe ? 'Switching to CPE Mode?' : 'Switching to Preview Mode?';
    const description = isSwitchingToCpe
      ? 'Heads up! Switching means starting fresh - your current progress will reset. Step into CPE Mode to earn your certificate and level up your learning journey.'
      : 'Heads up! Switching to Preview Mode means you can explore freely without CPE tracking. Your CPE progress will be paused.';

    const dialogRef = this.dialog.open<UtilsDialog>(UtilsDialog, {
      maxWidth: '100%',
      enterAnimationDuration: '300ms',
      exitAnimationDuration: '300ms',
      disableClose: false,
      data: {
        title,
        content: [{ type: 'text', value: description }],
        buttons: [{ label: 'Switch', variant: 'default', action: 'confirm' }],
      },
    });
    dialogRef.afterClosed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (result) this.selectCpeMode(cpeModeStatus);
    });
  }

  // ─── Quiz / assessment / feedback / download ──────────────────────────────

  submitQuizAnswer(answer: string, quizQuestionId: number): Observable<SubmitQuizAnswerResponse> {
    const body: SubmitQuizAnswerRequest = { answer, quiz_question: quizQuestionId };
    return this.http
      .post<SubmitQuizAnswerResponse>(MASTERCLASS_ROUTES.submitQuizAnswer.path, body)
      .pipe(takeUntilDestroyed(this.destroyRef));
  }

  startFinalAssessment(): void {
    const reel = this.activeReel();
    if (!reel) return;
    // The type comes off the payload (`micro_learning` | `ai_lab`), not a
    // literal — `Utils.startFinalAssessment` maps it to the id key and the URL
    // segment, so an AI Lab exam lands on the /ai-labs route.
    this.utils.startFinalAssessment(
      String(reel.id),
      reel.title,
      reel.course_type || 'micro_learning',
      reel.exam_rules ?? '',
    );
  }

  submitFeedback(): void {
    const reel = this.activeReel();
    if (!reel) return;
    const url = this.router.url.split('?')[0];
    this.router.navigate([url, 'feedback'], { queryParams: { redirect: this.router.url } });
  }

  openCertificateDownloadDialog(): void {
    const reel = this.activeReel();
    if (!reel) return;
    this.utils.openCertificateDownloadDialog(reelToContentDetails(reel));
  }

  openShareDialog(): void {
    if (!this.activeReel()) return;
    this.utils.openShareDialog();
  }

  /**
   * Dispatch the CTA defined by a reel's `action_status`. `reelId` scopes the
   * action to the card whose button was clicked — the scroll-driven active reel
   * can lag behind the visible card, so without this a click on reel B could
   * run reel A's action (e.g. open A's certificate dialog).
   */
  handleActionStatus(reelId?: number): void {
    // Promote the clicked reel to active so every `activeReel()` read below
    // (action_status dispatch, quiz, download, rewatch) targets the right reel.
    if (reelId != null && reelId !== this.selectedReelId()) {
      this.selectedReelId.set(reelId);
    }
    // Every deliberate CTA on an in-progress reel — quiz, exam, feedback,
    // certificate, rewatch — is paid-tier, and a reel already in CPE mode
    // never reaches `launchCourse`'s gate. Check once here so resuming is
    // gated the same way starting is.
    const clicked = this.activeReel();
    if (clicked && !this.utils.requireCpeModeAccess(clicked)) return;

    // Debounce rapid clicks; cleared by the handlers below or by the next interaction.
    if (this.ctaLoading()) return;
    this.ctaLoading.set(true);
    // Short auto-clear so the button re-enables even when the target action is fire-and-forget.
    setTimeout(() => this.ctaLoading.set(false), 500);

    // Server-pushed `action_status` is authoritative — dispatch it first.
    // `TAKE_EXAM` / `RETAKE_EXAM` route to Utils.startFinalAssessment (the
    // canonical rules-dialog + /user-assessment/start_assessment flow).
    switch (this.actionStatus()) {
      case ActionStatus.TAKE_QUIZ:
        this.openChapterQuiz();
        return;
      case ActionStatus.TAKE_EXAM:
      case ActionStatus.RETAKE_EXAM:
        this.startFinalAssessment();
        return;
      case ActionStatus.FEEDBACK:
        this.submitFeedback();
        return;
      case ActionStatus.DOWNLOAD:
        this.openCertificateDownloadDialog();
        return;
      case ActionStatus.REWATCH: {
        const reel = this.activeReel();
        if (reel) {
          // Product spec: REWATCH resets all user progress for this reel and
          // starts playback from 0. The reel card's `rewatchRequest` effect
          // handles the seek + play; we reset `last_activity` and clear
          // `action_status` locally so CTA / gating reflect a fresh start.
          this.detailsList.update((list) =>
            list.map((r) =>
              r.id === reel.id ? { ...r, last_activity: 0, action_status: null } : r,
            ),
          );
          this.rewatchRequest.set({ id: reel.id, token: ++this.tokenSeq });
        }
        return;
      }
    }

    // No action_status set — fall back based on local state:
    //  • CPE + locally completed → the chapter quiz is the next step.
    //  • Otherwise → launch flow (login / CPE-mode upgrade).
    const active = this.activeReel();
    if (active?.cpe_mode_details?.cpe_mode && isReelCompleted(active)) {
      this.openChapterQuiz();
      return;
    }
    this.launchCourse();
  }

  /**
   * Locally override the active reel's `action_status`. Used by the quiz
   * dialog when the user submits the last question — flips the CTA to
   * "Take Final Assessment" immediately, ahead of the next server fetch.
   */
  markActiveReelActionStatus(status: ActionStatus | null): void {
    const reel = this.activeReel();
    if (!reel) return;
    this.detailsList.update((list) =>
      list.map((r) => (r.id === reel.id ? { ...r, action_status: status } : r)),
    );
  }

  /**
   * Handle natural end-of-video for the active reel:
   *  • `nano_learning` (micro-learning) → open the chapter quiz dialog.
   *    `action_status` is flipped to TAKE_QUIZ inside `openChapterQuiz`,
   *    only once the quiz is confirmed available — empty-quiz responses
   *    don't leave the CTA stuck on a "Take Quiz" that opens nothing.
   *  • Anything else → set TAKE_EXAM + start the final assessment flow.
   *
   * Defensive `else` branch: production data in this module is always
   * `nano_learning`, but this keeps the action_status consistent if a
   * non-micro-learning reel ever lands in this list.
   */
  handleVideoEnded(): void {
    const reel = this.activeReel();
    if (!reel) return;
    // The post-video flow (chapter quiz → final assessment) is CPE-mode only.
    // In Preview mode the reel just plays/loops; crossing 95% must not open the
    // quiz. `handleTimeUpdate` calls this at 95% regardless of mode (video-js
    // `ended` never fires while Preview loops), so the CPE gate lives here — the
    // single chokepoint every end-of-video path routes through.
    if (!reel.cpe_mode_details?.cpe_mode) return;
    // Response-driven: AI Lab courses come back as `ai_lab` and carry the same
    // chapter quiz as a micro-learning reel.
    if (reel.course_type === 'micro_learning' || reel.course_type === 'ai_lab') {
      this.openChapterQuiz();
      return;
    }
    this.markActiveReelActionStatus(ActionStatus.TAKE_EXAM);
    this.startFinalAssessment();
  }

  /**
   * Open the chapter quiz for the active reel. Invoked from:
   *  • the reel card CTA when a reel is locally completed in CPE mode
   *  • the page `handleVideoEnded` when the video ends in CPE mode
   *
   * Fetches quiz data from `/chapter-quiz?chapter_id=<id>` (if not already
   * cached on the reel), caches it on the reel, then opens the shared
   * `ChapterQuiz` component inside `MicroLearningQuizDialog` — a thin
   * adapter that maps the reel → CourseChapter shape ChapterQuiz expects.
   * The route-scoped `injector` is passed so `ChapterQuiz` can resolve
   * `ChapterFacade`.
   */
  openChapterQuiz(): void {
    const reel = this.activeReel();
    if (!reel) return;

    if (reel.quiz_details?.questions?.length) {
      this.markActiveReelActionStatus(ActionStatus.TAKE_QUIZ);
      this.launchQuizDialog(reel);
      return;
    }

    this.ctaLoading.set(true);
    this.http
      .get<ChapterQuizResponse>(MASTERCLASS_ROUTES.getChapterQuiz.path, {
        params: { chapter_id: reel.chapter_id },
      })
      .pipe(
        tap((res) => {
          const quiz = res?.data;
          if (!quiz?.questions?.length) {
            // An AI Lab course without a quiz goes straight to the exam — the
            // same hand-off `handleVideoEnded` makes for non-reel content.
            // Without it the CTA sits on "Continue" and every click re-toasts.
            if (reel.course_type === 'ai_lab') {
              this.markActiveReelActionStatus(ActionStatus.TAKE_EXAM);
              this.startFinalAssessment();
              return;
            }
            // Empty quiz — leave action_status untouched so the CTA doesn't
            // get stuck on "Take Quiz" that opens nothing.
            this.notification.info('Quiz', 'No quiz questions are available for this reel yet.');
            return;
          }
          // Cache the quiz on the reel so reopening is instant and the CTA
          // label keeps rendering against up-to-date data.
          this.detailsList.update((list) =>
            list.map((r) => (r.id === reel.id ? { ...r, quiz_details: quiz } : r)),
          );
          // Use the freshly-merged reel from state to avoid passing a stale ref.
          const fresh = this.detailsList().find((r) => r.id === reel.id) ?? {
            ...reel,
            quiz_details: quiz,
          };
          this.markActiveReelActionStatus(ActionStatus.TAKE_QUIZ);
          this.launchQuizDialog(fresh);
        }),
        catchError((err) => {
          this.logger.error('Failed to fetch chapter quiz', err);
          this.notification.error('Quiz', 'Unable to load the chapter quiz. Please try again.');
          return of(null);
        }),
        finalize(() => this.ctaLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private launchQuizDialog(reel: MicroLearningReel): void {
    // Pause the active reel's player before the modal mounts so audio doesn't
    // continue behind the dialog. Token-based — reel card pauses inside an
    // effect when the value flips.
    this.pauseRequest.set({ id: reel.id, token: ++this.tokenSeq });
    this.dialog.open<MicroLearningQuizDialog>(MicroLearningQuizDialog, {
      data: { reel } as MicroLearningQuizDialogData,
      injector: this.injector,
      ariaLabel: 'Chapter quiz',
      maxWidth: '100%',
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private hydrateFromArray(list: MicroLearningReel[]): void {
    const normalized = list.map((reel) => this.normalize(reel));
    this.detailsList.set(normalized);
    const pending = this.pendingDetails;
    if (pending) {
      this.pendingDetails = null;
      this.applyCourseDetails(pending);
    }
  }

  /** Append a fetched page, skipping reels already loaded (seed-shuffled feeds can overlap). */
  private hydrateAppend(list: MicroLearningReel[]): void {
    this.detailsList.update((current) => {
      const seen = new Set(current.map((r) => r.id));
      const fresh = list.filter((r) => !seen.has(r.id)).map((reel) => this.normalize(reel));
      return fresh.length ? [...current, ...fresh] : current;
    });
  }

  private normalize(reel: MicroLearningReel): MicroLearningReel {
    // Bookmark first so the local field is canonical — the API can ship
    // either `added_bookmark` or `is_bookmarked` and we want the UI to only
    // ever read `added_bookmark`.
    const bookmarkResolved = reel.added_bookmark ?? reel.is_bookmarked;
    return {
      ...reel,
      added_bookmark: bookmarkResolved,
      thumbnail_gif: reel.thumbnail_gif ?? '',
      mobile_thumbnail_gif: reel.mobile_thumbnail_gif ?? '',
      instructor_details: reel.instructor_details ?? {
        id: 0,
        first_name: '',
        last_name: '',
      },
    };
  }

  /**
   * Persist the player's current time (and, on completion, the full duration)
   * into `last_activity` on the matching reel. Completion is derived from the
   * 95% threshold in `isReelCompleted` — no separate flag to keep in sync.
   */
  private updateLocalProgress(chapterId: number, timeStatus: number, event: ActivityEvent): void {
    this.detailsList.update((list) =>
      list.map((reel) => {
        if (reel.chapter_id !== chapterId) return reel;
        // On 'completed', snap to full duration so the 95% check is satisfied
        // even if the player over/under-shoots by a frame.
        const watched = event === 'completed' ? (reel.total_duration ?? timeStatus) : timeStatus;
        // Never regress — heartbeats past a seek-back shouldn't drop progress.
        const next = Math.max(reel.last_activity ?? 0, watched);
        return { ...reel, last_activity: next };
      }),
    );
  }

  /**
   * Fetch glossary or per-chapter transcript text from the course-content
   * endpoint. Pass a `chapter_id` to get that chapter's transcript;
   * omit it to get the course-level glossary. Caller is responsible for
   * subscription cleanup (`takeUntilDestroyed`).
   */
  fetchCourseContent(
    params: CourseContentParams,
    options: { skipErrorNotification?: boolean } = {},
  ): Observable<CourseContentResponse> {
    const requestOptions: { params: CourseContentParams; context?: HttpContext } = { params };
    if (options.skipErrorNotification) {
      requestOptions.context = new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);
    }
    return this.http.get<CourseContentResponse>(
      MASTERCLASS_ROUTES.getCourseContent.path,
      requestOptions,
    );
  }
}
