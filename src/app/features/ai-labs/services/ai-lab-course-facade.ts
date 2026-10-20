import { HttpContext, HttpErrorResponse, httpResource } from '@angular/common/http';
import {
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  inject,
  Service,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, takeWhile, timer } from 'rxjs';
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
  AiLabInputFile,
  AiLabSubmitBody,
} from '@features/ai-labs/models/ai-labs.model';

/** How often watched seconds go to the server while the video plays. */
const VIDEO_REPORT_EVERY_S = 15;

/** The guide asks for 10–15 s between status reads while grading. */
const STATUS_POLL_MS = 12_000;

/** Grading takes minutes; a poll still running after this won't settle by itself. */
const STATUS_POLL_TIMEOUT_MS = 30 * 60_000;

/** Brief file links are signed for an hour — re-fetch the brief before handing out an older one. */
const BRIEF_LINK_MAX_AGE_MS = 50 * 60_000;

/** AI Labs refused this login token: it predates the account, and only a fresh login fixes it. */
const SESSION_REFUSED = new Set(['AI_LABS_ACCESS_DENIED', 'AI_LABS_TOKEN_REJECTED']);

/** What every practical read answers: `{status, is_provisioned, <key>}`. */
type AiLabVendorBody<K extends string, T> = { is_provisioned: boolean } & Record<K, T>;

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
 * **The practical** — the brief, the agents and flows to pick from, the submission and its
 * status — is read once the lab is started (the picker's lists once the exam is passed), and the
 * status is polled every 12 s while a submission is being graded. Copilot Credits are
 * `AiLabCredits`, shared with the landing page.
 */
@Service({ autoProvided: false })
export class AiLabCourseFacade {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthSession);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  private readonly courseId = signal<string | null>(null);

  /** The lab the page is on, for the services beside this one on the route (the quiz). */
  readonly id = this.courseId.asReadonly();

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

  // ---- The practical -----------------------------------------------------------
  // These call AI Labs. A `200 is_provisioned: false` means "no AI Labs account yet" and is not
  // an error; 403 AI_LABS_ACCESS_DENIED / AI_LABS_TOKEN_REJECTED means the login token predates the
  // account. All quiet: the page renders its own states, and a toast per poll would be noise.

  /** Read once the lab is started (404 `no_ai_lab_enrollment` before), locked or not. */
  private readonly briefRes = httpResource<AiLabVendorBody<'brief', AiLabAssignmentBrief> | null>(
    () => (this.started()?.started ? this.labRequest(AI_LABS_API.assignmentBrief) : undefined),
    { defaultValue: null, parse: unwrap<AiLabVendorBody<'brief', AiLabAssignmentBrief>>() },
  );

  readonly brief = computed(() =>
    this.briefRes.hasValue() ? (this.briefRes.value()?.brief ?? null) : null,
  );
  readonly briefLoading = computed(() => this.briefRes.isLoading());
  private readonly briefReason = computed(() => reasonOf(this.briefRes.error()));

  /** The lab has a practical to submit against — everything but a 409 from the brief says so. */
  readonly labMapped = computed(() => this.briefReason() !== 'ai_lab_assignment_not_configured');

  /** The one line shown in place of the brief when the lab has no practical configured. */
  readonly briefUnavailable = computed(() =>
    this.labMapped() ? null : messageOf(this.briefRes.error()),
  );

  /** The picker's lists, once the exam is passed — the lab is open from then on. */
  private readonly agentsRes = httpResource<AiLabVendorBody<'agents', AiLabAgent[]> | null>(
    () => this.vendorRequest(AI_LABS_API.agents),
    { defaultValue: null, parse: unwrap<AiLabVendorBody<'agents', AiLabAgent[]>>() },
  );

  private readonly flowsRes = httpResource<AiLabVendorBody<'flows', AiLabFlow[]> | null>(
    () => this.vendorRequest(AI_LABS_API.flows),
    { defaultValue: null, parse: unwrap<AiLabVendorBody<'flows', AiLabFlow[]>>() },
  );

  readonly agents = computed<readonly AiLabAgent[]>(() =>
    this.agentsRes.hasValue() ? (this.agentsRes.value()?.agents ?? []) : [],
  );
  readonly flows = computed<readonly AiLabFlow[]>(() =>
    this.flowsRes.hasValue() ? (this.flowsRes.value()?.flows ?? []) : [],
  );
  readonly artefactsLoading = computed(
    () => this.agentsRes.isLoading() || this.flowsRes.isLoading(),
  );

  /** Both lists failed — one alone still leaves something to pick from. */
  readonly artefactsError = computed(() => !!this.agentsRes.error() && !!this.flowsRes.error());

  /** What the picker's error says: a session AI Labs refused needs a fresh login, not a retry. */
  readonly artefactsErrorMessage = computed(() =>
    SESSION_REFUSED.has(reasonOf(this.agentsRes.error()) ?? '')
      ? 'AI Labs didn’t accept your session. Sign out and back in, then try again.'
      : 'We hit a snag reaching your Copilot environment. Try again in a moment.',
  );

  /** False when AI Labs has no account for this learner — the picker says to create one. */
  readonly labProvisioned = computed(
    () =>
      this.agentsRes.value()?.is_provisioned !== false &&
      this.flowsRes.value()?.is_provisioned !== false,
  );

  /** The practical's state; also the missed-webhook reconciler, so polling heals one. */
  private readonly statusRes = httpResource<AiLabAssignmentStatus | null>(
    () => (this.started()?.started ? this.labRequest(AI_LABS_API.assignmentStatus) : undefined),
    { defaultValue: null, parse: unwrap<AiLabAssignmentStatus>() },
  );

  readonly assignment = computed(() => (this.statusRes.hasValue() ? this.statusRes.value() : null));
  readonly statusLoading = computed(() => this.statusRes.isLoading());

  /** A submission is with the evaluator — the grading poll runs while this holds. */
  private readonly grading = computed(() => {
    const a = this.assignment();
    return !!a?.submission_id && a.assessment_status === 'in_progress';
  });

  readonly submitting = signal(false);
  readonly gradeCardBusy = signal(false);

  // ---- Actions ---------------------------------------------------------------

  /** The lab the URL names. Re-running with a new id re-keys every read. */
  open(courseId: string): void {
    this.courseId.set(courseId);
    this.lastReported = 0;
    this.videoDuration.set(null);
  }

  /** Re-read the gate flags — after the quiz completes, so the CTA moves on to the exam. */
  refreshProgress(): void {
    this.progressRes.reload();
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

  /**
   * `POST assignment-submit/<uuid>/` with the picked artefact. A 202 means "with the evaluator":
   * the status re-read that follows reports `in_progress`, which starts the poll. Refusals carry a
   * sentence written for the learner, relayed as-is.
   */
  submitPractical(body: AiLabSubmitBody): void {
    const id = this.courseId();
    if (!id || this.submitting()) return;
    this.submitting.set(true);
    const route = AI_LABS_API.assignmentSubmit;
    this.api
      .call({ ...route, path: route.path.replace(':id', id) }, body, {
        context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.notification.success('Submitted for grading', res.message);
          this.statusRes.reload();
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          const message = SESSION_REFUSED.has(reasonOf(err) ?? '')
            ? 'AI Labs didn’t accept your session. Sign out and back in, then try again.'
            : messageOf(err);
          this.notification.error("Couldn't submit", message);
          this.statusRes.reload();
        },
      });
  }

  /** The picker's Refresh — after building something new in Copilot Studio. */
  refreshArtefacts(): void {
    this.agentsRes.reload();
    this.flowsRes.reload();
  }

  /** The evaluation section's manual re-read, on top of the poll. */
  refreshStatus(): void {
    this.statusRes.reload();
  }

  /**
   * Open the grade card. Its signed link expires (`grade_card_is_expired`), so an expired one is
   * re-read from `assignment-status/` first. The tab is opened inside the click and pointed at the
   * link afterwards — opening it after the await would be blocked as a popup.
   */
  downloadGradeCard(): void {
    const a = this.assignment();
    if (!a?.grade_card_pdf_url || this.gradeCardBusy()) return;
    if (!a.grade_card_is_expired) {
      this.openTab(a.grade_card_pdf_url);
      return;
    }
    const tab = this.openTab('');
    this.gradeCardBusy.set(true);
    this.api
      .get<CommonResponse<AiLabAssignmentStatus>>(
        `${AI_LABS_API.assignmentStatus}${this.courseId()}/`,
        { context: QUIET() },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.gradeCardBusy.set(false);
          const url = res.data?.grade_card_pdf_url;
          if (url && tab) tab.location.href = url;
          else tab?.close();
          this.statusRes.reload();
        },
        error: () => {
          this.gradeCardBusy.set(false);
          tab?.close();
          this.notification.error('Grade card unavailable', 'Please try again in a moment.');
        },
      });
  }

  /**
   * Open one of the brief's input files. The links are signed for an hour, so a brief older than
   * that is re-fetched and the file's fresh link used — matched by name, the only key it has.
   */
  openInputFile(file: AiLabInputFile): void {
    if (Date.now() - this.briefFetchedAt < BRIEF_LINK_MAX_AGE_MS) {
      this.openTab(file.url);
      return;
    }
    const tab = this.openTab('');
    this.api
      .get<CommonResponse<AiLabVendorBody<'brief', AiLabAssignmentBrief>>>(
        `${AI_LABS_API.assignmentBrief}${this.courseId()}/`,
        { context: QUIET() },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const fresh = res.data?.brief?.input_files.find((f) => f.name === file.name);
          if (fresh && tab) tab.location.href = fresh.url;
          else tab?.close();
          this.briefRes.reload();
        },
        error: () => {
          tab?.close();
          this.notification.error('File unavailable', 'Please try again in a moment.');
        },
      });
  }

  // ---- Internals -------------------------------------------------------------

  /** When the brief's signed links were issued — see `openInputFile`. */
  private briefFetchedAt = 0;
  private statusPoll: Subscription | null = null;

  constructor() {
    effect(() => {
      if (this.brief()) untracked(() => (this.briefFetchedAt = Date.now()));
    });

    // Poll while a submission is being graded; stop when it settles, then re-read progress so the
    // CTA moves on to feedback.
    effect(() => {
      const grading = this.grading();
      untracked(() => (grading ? this.startStatusPoll() : this.stopStatusPoll(true)));
    });

    this.destroyRef.onDestroy(() => this.stopStatusPoll(false));
  }

  private startStatusPoll(): void {
    if (this.statusPoll) return;
    const started = Date.now();
    this.statusPoll = timer(STATUS_POLL_MS, STATUS_POLL_MS)
      .pipe(
        takeWhile(() => Date.now() - started < STATUS_POLL_TIMEOUT_MS),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.statusRes.reload(),
        complete: () => (this.statusPoll = null),
      });
  }

  private stopStatusPoll(settled: boolean): void {
    if (!this.statusPoll) return;
    this.statusPoll.unsubscribe();
    this.statusPoll = null;
    if (settled) this.progressRes.reload();
  }

  /** A new tab, `noopener` by hand so a blank one can still be pointed at a link later. */
  private openTab(url: string): Window | null {
    const tab = this.document.defaultView?.open(url, '_blank') ?? null;
    if (tab) tab.opener = null;
    return tab;
  }

  /** A practical read that takes no id: the picker's lists, once the lab is open. */
  private vendorRequest(url: string) {
    return this.auth.isAuthenticated() && this.examPassed() && this.labMapped()
      ? { url: apiUrl(url), context: QUIET() }
      : undefined;
  }

  private labRequest(base: string) {
    const id = this.courseId();
    return this.auth.isAuthenticated() && id
      ? { url: apiUrl(`${base}${id}/`), context: QUIET() }
      : undefined;
  }
}

/** `data.reason` off an error envelope, which is what every AI Labs refusal branches on. */
function reasonOf(err: unknown): string | null {
  const body = err instanceof HttpErrorResponse ? (err.error as CommonResponse<unknown>) : null;
  const data = body?.data as { reason?: unknown } | null | undefined;
  return typeof data?.reason === 'string' ? data.reason : null;
}

/** The envelope's sentence on an error, which on these routes is written for the learner. */
function messageOf(err: unknown): string {
  const body = err instanceof HttpErrorResponse ? (err.error as CommonResponse<unknown>) : null;
  return body?.message || 'Please try again in a moment.';
}
