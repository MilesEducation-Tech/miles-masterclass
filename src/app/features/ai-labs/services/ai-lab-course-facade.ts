import { HttpContext, HttpErrorResponse, httpResource } from '@angular/common/http';
import { computed, DestroyRef, inject, Service, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonResponse, SKIP_ERROR_NOTIFICATION, SKIP_LOADING } from '@core/models/http.model';
import { ApiClient, apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { NotificationService } from '@core/services/notification/notification';
import { AI_LABS_API } from '@features/ai-labs/constants/ai-labs-api';
import {
  AiLabAgent,
  AiLabAssignmentBrief,
  AiLabAssignmentStatus,
  AiLabCourseDetail,
  AiLabCourseProgress,
  AiLabCourseStarted,
  AiLabCtaStage,
  AiLabFlow,
  AiLabSubmitBody,
  AiLabTokenBalance,
} from '@features/ai-labs/models/ai-labs.model';

/** How often watched seconds go to the server while the video plays. */
const VIDEO_REPORT_EVERY_S = 15;

/** Quiet, and the page renders its own failure states. */
const QUIET = () => new HttpContext().set(SKIP_LOADING, true).set(SKIP_ERROR_NOTIFICATION, true);

/** `next_step` → the CTA stage. `video` has no stage: the CTA drives the player instead. */
const STAGE_FOR_STEP: Record<string, AiLabCtaStage | null> = {
  video: null,
  quiz: 'TAKE_QUIZ',
  final_assessment: 'TAKE_EXAM',
  ai_assessment: 'AI_LAB',
  feedback: 'FEEDBACK',
  // There is no lab-certificate link to download on any read yet, so a closed lab rewatches.
  done: 'REWATCH',
};

const unwrap =
  <T>() =>
  (raw: unknown): T | null =>
    (raw as CommonResponse<T> | null)?.data ?? null;

/**
 * One AI Lab's page: the lab, whether the learner has started it, and where they are in it.
 *
 * Route-scoped (`autoProvided: false`, listed on the `:courseId/:courseTitle` route). The page
 * hands it the id from the URL through `open()`, the same shape as `LiveSessionFacade`.
 *
 * Every read is `IsAuthenticated` and the route is behind `authGuard`, so the reads gate on the
 * boolean `isAuthenticated()` as well as on an id. `course-progress/` 404s until the lab is
 * started, so it waits for `course-started/` to say so rather than asking and failing.
 *
 * **The practical** — brief, agents and flows, the submission and its status, Copilot Credits —
 * is declared below as idle state with its defaults. The page already reads it from here; the
 * practical ticket binds it.
 */
@Service({ autoProvided: false })
export class AiLabCourseFacade {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthSession);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly courseId = signal<string | null>(null);

  // ---- Reads -----------------------------------------------------------------

  private readonly detailRes = httpResource<AiLabCourseDetail | null>(
    () => this.labRequest(AI_LABS_API.courseDetail),
    { defaultValue: null, parse: unwrap<AiLabCourseDetail>() },
  );

  private readonly startedRes = httpResource<AiLabCourseStarted | null>(
    () => this.labRequest(AI_LABS_API.courseStarted),
    { defaultValue: null, parse: unwrap<AiLabCourseStarted>() },
  );

  private readonly progressRes = httpResource<AiLabCourseProgress | null>(
    () => (this.started()?.started ? this.labRequest(AI_LABS_API.courseProgress) : undefined),
    { defaultValue: null, parse: unwrap<AiLabCourseProgress>() },
  );

  readonly lab = computed(() => (this.detailRes.hasValue() ? this.detailRes.value() : null));
  readonly started = computed(() => (this.startedRes.hasValue() ? this.startedRes.value() : null));
  readonly progress = computed(() =>
    this.progressRes.hasValue() ? this.progressRes.value() : null,
  );

  /** The first paint is waiting on the lab itself; the rest fill in behind it. */
  readonly isLoading = computed(() => !this.lab() && this.detailRes.isLoading());
  readonly error = computed(() => !!this.detailRes.error());

  // ---- Gates -----------------------------------------------------------------

  /** The parent masterclass course holds the lab shut. Reported, not derived. */
  readonly lockRemark = computed(() => {
    const lock = this.started()?.lock_state ?? this.lab()?.lock_state;
    return lock?.locked ? (lock.lock_remark ?? 'This AI Lab is locked.') : null;
  });

  readonly completed = computed(() => !!this.progress()?.video_completed);

  /** Watched share of the video, 0–100. The detail's seconds until a progress report says better. */
  readonly progressPercent = computed(() => {
    const watched = this.progress()?.video_watched_seconds ?? 0;
    const total = this.videoDuration() ?? this.lab()?.ai_lab_course_total_duration_seconds ?? 0;
    return total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : 0;
  });

  readonly quizDone = computed(() => {
    const p = this.progress();
    return !!p && (!p.quiz_required || p.quiz_passed);
  });

  readonly examPassed = computed(() => !!this.progress()?.final_assessment_passed);

  /**
   * Where the CTA points. No enrolment is `START`; after that it follows `next_step`. `null` means
   * "keep watching", which the page turns into the player's Play / Resume.
   */
  readonly ctaStage = computed<AiLabCtaStage | null>(() => {
    const started = this.started();
    if (!started) return null;
    if (!started.started) return 'START';
    const step = this.progress()?.next_step;
    return step === undefined ? null : (STAGE_FOR_STEP[step] ?? null);
  });

  /** `course-start/` is in flight. */
  readonly ctaLoading = signal(false);

  /**
   * The lab has a practical to submit against. Assumed until the brief says otherwise — it answers
   * 409 `ai_lab_assignment_not_configured` for a lab without one (bound with the practical).
   */
  readonly labMapped = signal(true);

  // ---- The practical (idle until the practical ticket binds it) ----------------

  readonly brief = signal<AiLabAssignmentBrief | null>(null);
  readonly briefLoading = signal(false);
  readonly briefUnavailable = signal<string | null>(null);
  readonly agents = signal<readonly AiLabAgent[]>([]);
  readonly flows = signal<readonly AiLabFlow[]>([]);
  readonly artefactsLoading = signal(false);
  readonly artefactsError = signal(false);
  readonly assignment = signal<AiLabAssignmentStatus | null>(null);
  readonly statusLoading = signal(false);
  readonly submitting = signal(false);
  readonly gradeCardBusy = signal(false);
  readonly balance = signal<AiLabTokenBalance | null>(null);
  readonly labProvisioned = signal(true);

  // ---- Actions ---------------------------------------------------------------

  /** The lab the URL names. Re-running with a new id re-keys every read. */
  open(courseId: string): void {
    this.courseId.set(courseId);
    this.lastReported = 0;
    this.videoDuration.set(null);
  }

  /** The error state's Retry. */
  retry(): void {
    this.detailRes.reload();
    this.startedRes.reload();
  }

  /**
   * `course-start/`: creates the enrolment (idempotent), then re-reads `course-started/`, which
   * re-keys `course-progress/`. A 409 is the parent course's lock — its message is the sentence to
   * show, so it is relayed as-is.
   */
  start(): void {
    const id = this.courseId();
    if (!id || this.ctaLoading()) return;
    this.ctaLoading.set(true);
    const route = AI_LABS_API.courseStart;
    this.api
      .call({ ...route, path: route.path.replace(':id', id) }, undefined, {
        context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.ctaLoading.set(false);
          this.startedRes.reload();
        },
        error: (err: unknown) => {
          this.ctaLoading.set(false);
          this.notification.error("Couldn't start this lab", messageOf(err));
          this.startedRes.reload();
        },
      });
  }

  private lastReported = 0;
  private readonly videoDuration = signal<number | null>(null);

  /**
   * Watched seconds, from the player's time updates. Sent every 15 s of playback and on `ended`
   * (`force`), never more often — completion is decided server-side, so precision buys nothing.
   * When a report crosses the 95% line, progress is re-read so the CTA moves on.
   */
  reportVideoProgress(seconds: number, force = false): void {
    const id = this.courseId();
    if (!id || !this.started()?.started) return;
    const watched = Math.floor(seconds);
    if (!force && watched - this.lastReported < VIDEO_REPORT_EVERY_S) return;
    this.lastReported = watched;
    this.api
      .call(
        AI_LABS_API.courseVideoProgress,
        { ai_lab_course_id: id, watched_duration_seconds: watched },
        { context: QUIET() },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const data = res.data as { duration_seconds?: number; just_completed?: boolean } | null;
          if (data?.duration_seconds) this.videoDuration.set(data.duration_seconds);
          if (data?.just_completed) this.progressRes.reload();
        },
        // A dropped report is re-covered by the next one; nothing to tell the learner.
        error: () => undefined,
      });
  }

  /** `POST assignment-submit/<uuid>/` with the picked artefact. */
  submitPractical(_body: AiLabSubmitBody): void {
    // ponytail: bound with the practical ticket — submit, then poll `assignment-status/`.
  }

  // ---- Internals -------------------------------------------------------------

  private labRequest(base: string) {
    const id = this.courseId();
    return this.auth.isAuthenticated() && id
      ? { url: apiUrl(`${base}${id}/`), context: QUIET() }
      : undefined;
  }
}

/** The envelope's sentence on an error, which on these routes is written for the learner. */
function messageOf(err: unknown): string {
  const body = err instanceof HttpErrorResponse ? (err.error as CommonResponse<unknown>) : null;
  return body?.message || 'Please try again in a moment.';
}
