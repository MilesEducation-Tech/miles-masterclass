import { HttpContext, HttpErrorResponse, httpResource } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  inject,
  PLATFORM_ID,
  Service,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { firstValueFrom, map, Observable, of, Subscription, takeWhile, timer } from 'rxjs';
import { CommonResponse, SKIP_ERROR_NOTIFICATION, SKIP_LOADING } from '@core/models/http.model';
import { ApiClient, apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { NotificationService } from '@core/services/notification/notification';
import { AI_LABS_API } from '@features/ai-labs/constants/ai-labs-api';
// Type-only: the rules dialog loads with `import()` when the exam is started (AGENTS.md §4.4).
import type { UtilsDialogData, UtilsDialogResult } from '@shared/dialogs/utils-dialog/utils-dialog';
// Type-only: the certificate pop-up loads with `import()` on Download Certificate.
import type { CertificateDialogData } from '@shared/dialogs/certificate-download-dialog/certificate-download-dialog';
import { renderFileViewer } from '@features/ai-labs/utils/file-viewer';
import {
  AiLabAgent,
  AiLabAssignmentBrief,
  AiLabAssignmentStatus,
  AiLabAttempts,
  AiLabCourseDetail,
  AiLabCourseProgress,
  AiLabCourseStarted,
  AiLabCtaStage,
  AiLabFile,
  AiLabFlow,
  AiLabAttempt,
  AiLabHint,
  AiLabSubmitBody,
} from '@features/ai-labs/models/ai-labs.model';

/** The rules pop-up before the exam — masterclass's `ASSESSMENT_COPY`, which a feature can't import. */
const EXAM_RULES_COPY = {
  title: 'Final Assessment',
  intro: 'QAS Self-Study Qualified Assessment Rules:',
  start: 'Start Exam',
  /** Masterclass's `ASSESSMENT_DIALOG_WIDTH`. */
  maxWidth: '500px',
} as const;

/** How often watched seconds go to the server while the video plays. */
const VIDEO_REPORT_EVERY_S = 15;

/** The guide asks for 10–15 s between status reads while grading. */
const STATUS_POLL_MS = 12_000;

/** Grading takes minutes; a poll still running after this won't settle by itself. */
const STATUS_POLL_TIMEOUT_MS = 30 * 60_000;

/** Brief file links are signed for ~15 minutes — re-read the brief before handing out an older one. */
const BRIEF_LINK_MAX_AGE_MS = 10 * 60_000;

/**
 * A closed lab whose certificate PDF isn't issued yet: re-read progress this often, for this long.
 * The guide says "a few seconds"; past the budget the URL is likely never coming (generation failed,
 * or the lab has no certificate template), so the CTA stops claiming it is.
 */
const CERTIFICATE_POLL_MS = 5_000;
const CERTIFICATE_POLL_TIMEOUT_MS = 60_000;

/**
 * Brief / attempts failures a retry can fix, in AI Labs' vocabulary (`docs/AI_LABS_API.md` §2).
 * `CONFIGURATION_REJECTED` is our platform key — a backend fault, so "try later", never "sign in".
 */
const VENDOR_RETRY: Record<string, string> = {
  AI_LABS_STORAGE_UNAVAILABLE: "AI Labs couldn't prepare the file links. Try again in a moment.",
  AI_LABS_RATE_LIMITED: 'AI Labs is busy right now. Try again shortly.',
  AI_LABS_CALL_FAILED: "We couldn't reach AI Labs. Try again in a moment.",
  AI_LABS_RESPONSE_UNREADABLE: "We couldn't reach AI Labs. Try again in a moment.",
  AI_LABS_CONFIGURATION_REJECTED: 'AI Labs is unavailable right now. Please try again later.',
  AI_LABS_LMS_UNCONFIGURED: 'AI Labs is switched off right now. Please try again later.',
};

const byOrder = <T extends { sort_order: number }>(list: readonly T[] | null | undefined): T[] =>
  [...(list ?? [])].sort((a, b) => a.sort_order - b.sort_order);

/** Every file in a brief, signed or not — `openFile` finds the fresh copy of a stale link here. */
const briefFiles = (b: AiLabAssignmentBrief): AiLabFile[] => [
  ...(b.exercise_files ?? []),
  ...(b.build_guides ?? []),
  ...(b.flow_chart ? [b.flow_chart] : []),
  ...(b.sample_grade_card ? [b.sample_grade_card] : []),
];

/** AI Labs refused this login token: it predates the account, and only a fresh login fixes it. */
const SESSION_REFUSED = new Set(['AI_LABS_ACCESS_DENIED', 'AI_LABS_TOKEN_REJECTED']);

/** Test-email refusals that mean the row should not be offered at all. */
const TEST_EMAILS_OFF = new Set(['AI_LABS_TRIGGER_EMAIL_DISABLED', 'AI_LABS_LMS_UNCONFIGURED']);

/** What every practical read answers: `{status, is_provisioned, <key>}`. */
type AiLabVendorBody<K extends string, T> = { is_provisioned: boolean } & Record<K, T>;

/** Quiet, and the page renders its own failure states. */
const QUIET = () => new HttpContext().set(SKIP_LOADING, true).set(SKIP_ERROR_NOTIFICATION, true);

/** `next_step` → the CTA stage. `video` has no stage: the CTA drives the player instead. */
const STAGE_FOR_STEP: Record<string, AiLabCtaStage | null> = {
  video: null,
  quiz: 'TAKE_QUIZ',
  final_assessment: 'TAKE_EXAM',
  feedback: 'FEEDBACK',
  // Refined by `lab_certificate_url` in `ctaStage`: Download, or the wait for the PDF.
  done: 'DOWNLOAD',
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
  private readonly router = inject(Router);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

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

  /** The learner's issued lab certificate PDF; `null` until it is issued (guide §4, Lab progress). */
  readonly certificateUrl = computed(() => this.progress()?.lab_certificate_url ?? null);
  /** The certificate re-reads ran out of budget without a URL — see `CERTIFICATE_POLL_TIMEOUT_MS`. */
  private readonly certificateWaitOver = signal(false);

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

  /**
   * The lab video, once there is an enrolment to report against. The link is `null` before
   * `course-start/` anyway; gating on `started` as well keeps an early link from playing seconds
   * that `reportVideoProgress` would drop.
   */
  readonly labVideoUrl = computed(() =>
    this.started()?.started ? (this.lab()?.chapter?.hls_video_link ?? null) : null,
  );

  /**
   * Watched share of the video, 0–100. The progress report's duration, then the chapter's — the
   * length the completion check measures against — then the lab's total.
   */
  readonly progressPercent = computed(() => {
    const watched = this.progress()?.video_watched_seconds ?? 0;
    const lab = this.lab();
    const total =
      this.videoDuration() ??
      lab?.chapter?.duration_seconds ??
      lab?.ai_lab_course_total_duration_seconds ??
      0;
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
    if (step === 'final_assessment') return this.examStage();
    if (step === 'done' && !this.certificateUrl()) {
      return this.certificateWaitOver() ? 'REWATCH' : 'CERTIFICATE_PENDING';
    }
    return step === undefined ? null : (STAGE_FOR_STEP[step] ?? null);
  });

  /**
   * `final_assessment_status`, off `course-progress/` once started (it tracks attempts), else the
   * detail's. Descriptive only — the exam routes enforce every rule themselves.
   */
  readonly finalAssessment = computed(
    () => this.progress()?.final_assessment_status ?? this.lab()?.final_assessment_status ?? null,
  );

  /**
   * When a failed attempt's wait ends, while it is running. A wait already past (a stale read)
   * counts as over — the timer below re-reads progress at the end of a live one.
   */
  readonly coolOffEndsAt = computed(() => {
    const status = this.finalAssessment();
    const ends = status?.final_assessment_cool_off_ends_at;
    return status?.final_assessment_enum_values === 'cool_off' &&
      ends &&
      Date.parse(ends) > Date.now()
      ? ends
      : null;
  });

  /** The exam CTA: Take, Retake, or the cool-off's disabled wait. */
  private examStage(): AiLabCtaStage {
    switch (this.finalAssessment()?.final_assessment_enum_values) {
      case 'retake':
        return 'RETAKE_EXAM';
      case 'cool_off':
        return this.coolOffEndsAt() ? 'COOL_OFF' : 'RETAKE_EXAM';
      default:
        return 'TAKE_EXAM';
    }
  }

  /** `course-start/` is in flight. */
  readonly ctaLoading = signal(false);

  /** The rules pop-up is open — a second click doesn't stack another. */
  private readonly examStarting = signal(false);

  /**
   * Take or retake the final assessment, as masterclass does (`FinalAssessmentFacade.start`): the
   * lab's exam rules in a pop-up first, then — on "Start Exam" — the exam page, one segment below
   * this lab's URL. The exam routes still enforce every gate, cool-off included.
   */
  async startExam(): Promise<void> {
    if (this.examStarting()) return;
    const coursePath = this.router.url.split(/[?#]/)[0];
    const rules = (this.lab()?.ai_lab_course_exam_rules ?? '')
      .split(/\r?\n/)
      .map((rule) => rule.trim())
      .filter(Boolean);
    this.examStarting.set(true);
    try {
      const { UtilsDialog } = await import('@shared/dialogs/utils-dialog/utils-dialog');
      const ref = this.dialogs.open<UtilsDialogData, UtilsDialogResult>(UtilsDialog, {
        data: {
          title: EXAM_RULES_COPY.title,
          // A long address in the rules wraps rather than leave a phone's panel.
          containerClass: 'flex flex-col space-y-4 text-start wrap-break-word',
          content: [
            { type: 'text', value: EXAM_RULES_COPY.intro },
            ...(rules.length ? [{ type: 'list' as const, items: rules, ordered: true }] : []),
          ],
          buttons: [{ label: EXAM_RULES_COPY.start, variant: 'default', action: 'confirm' }],
          maxWidth: EXAM_RULES_COPY.maxWidth,
        },
      });
      const result = await firstValueFrom(ref.afterClosed);
      if (result?.result && result.action === 'confirm') {
        await this.router.navigateByUrl(`${coursePath}/final-assessment`);
      }
    } finally {
      this.examStarting.set(false);
    }
  }

  // ---- The practical -----------------------------------------------------------
  // These call AI Labs. A `200 is_provisioned: false` means "no AI Labs account yet" and is not
  // an error; 403 AI_LABS_ACCESS_DENIED / AI_LABS_TOKEN_REJECTED means the login token predates the
  // account. All quiet: the page renders its own states, and a toast per poll would be noise.

  /** Read once the lab is started (404 `no_ai_lab_enrollment` before), locked or not. */
  private readonly briefRes = httpResource<AiLabVendorBody<'brief', AiLabAssignmentBrief> | null>(
    () => (this.started()?.started ? this.labRequest(AI_LABS_API.assignmentBrief) : undefined),
    { defaultValue: null, parse: unwrap<AiLabVendorBody<'brief', AiLabAssignmentBrief>>() },
  );

  /**
   * The brief, or `null`. A learner with no AI Labs account answers `200 is_provisioned: false` with
   * `brief: {}` — no brief at all, not an empty one.
   */
  readonly brief = computed(() => {
    const body = this.briefRes.hasValue() ? this.briefRes.value() : null;
    return body?.is_provisioned && body.brief?.name ? body.brief : null;
  });
  readonly briefLoading = computed(() => this.briefRes.isLoading());
  private readonly briefReason = computed(() => reasonOf(this.briefRes.error()));

  /** The lab has a practical to submit against — everything but a 409 from the brief says so. */
  readonly labMapped = computed(() => this.briefReason() !== 'ai_lab_assignment_not_configured');

  /** The one line shown in place of the brief when the lab has no practical configured. */
  readonly briefUnavailable = computed(() =>
    this.labMapped() ? null : messageOf(this.briefRes.error()),
  );

  /** A failed brief read a retry can fix, as one line with a Retry beside it. */
  readonly briefProblem = computed(() => {
    const err = this.briefRes.error();
    if (!err || !this.labMapped()) return null;
    return (
      VENDOR_RETRY[this.briefReason() ?? ''] ?? "We couldn't load the brief. Try again in a moment."
    );
  });

  /** What the learner needs before starting. `null` on the wire reads as none. */
  readonly requirements = computed<readonly string[]>(() => this.brief()?.requirements ?? []);
  /** Walkthroughs on public links — rows above Launch AI. */
  readonly buildGuides = computed(() => byOrder(this.brief()?.build_guides));
  /** The files the learner builds against (signed). */
  readonly exerciseFiles = computed(() => byOrder(this.brief()?.exercise_files));
  /** SharePoint workspaces, in order. */
  readonly workspaceLinks = computed(() => byOrder(this.brief()?.sharepoint_links));
  readonly flowChart = computed(() => this.brief()?.flow_chart ?? null);
  readonly sampleGradeCard = computed(() => this.brief()?.sample_grade_card ?? null);

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

  /**
   * A list failed and the other leaves nothing to pick — otherwise the picker would say "no agents
   * yet" when AI Labs simply refused to list them.
   */
  readonly artefactsError = computed(() => {
    const agentsFailed = !!this.agentsRes.error();
    const flowsFailed = !!this.flowsRes.error();
    if (agentsFailed && flowsFailed) return true;
    if (agentsFailed) return !this.flows().some((flow) => flow.enabled);
    return flowsFailed && !this.agents().length;
  });

  /** What the picker's error says: a session AI Labs refused needs a fresh login, not a retry. */
  readonly artefactsErrorMessage = computed(() =>
    SESSION_REFUSED.has(reasonOf(this.agentsRes.error() ?? this.flowsRes.error()) ?? '')
      ? 'AI Labs didn’t accept your session. Sign out and back in, then try again.'
      : 'We hit a snag reaching your Copilot environment. Try again in a moment.',
  );

  /**
   * False when AI Labs has no account for this learner — the picker says to create one. Read
   * behind `hasValue()`: a failed list throws on `value()`, and one list can fail alone.
   */
  readonly labProvisioned = computed(
    () =>
      (!this.agentsRes.hasValue() || this.agentsRes.value()?.is_provisioned !== false) &&
      (!this.flowsRes.hasValue() || this.flowsRes.value()?.is_provisioned !== false),
  );

  /** The practical's state; also the missed-webhook reconciler, so polling heals one. */
  private readonly statusRes = httpResource<AiLabAssignmentStatus | null>(
    () => (this.started()?.started ? this.labRequest(AI_LABS_API.assignmentStatus) : undefined),
    { defaultValue: null, parse: unwrap<AiLabAssignmentStatus>() },
  );

  readonly assignment = computed(() => (this.statusRes.hasValue() ? this.statusRes.value() : null));
  /** `assessment-refresh/` is in flight. */
  private readonly checkingResult = signal(false);
  readonly statusLoading = computed(() => this.statusRes.isLoading() || this.checkingResult());

  /** A submission is with the evaluator — the grading poll runs while this holds. */
  private readonly grading = computed(() => {
    const a = this.assignment();
    return !!a?.submission_id && a.assessment_status === 'in_progress';
  });

  readonly submitting = signal(false);
  readonly gradeCardBusy = signal(false);
  /** `assignment-trigger-email/` is in flight — the row is disabled so one tap sends one batch. */
  readonly sendingTestEmails = signal(false);
  /** The route said this lab has no test emails here (disabled exercise, AI Labs switched off). */
  readonly testEmailsOff = signal(false);

  // ---- Hints -------------------------------------------------------------------

  /**
   * The Hints card, off the detail's `ai_lab_course_hints` — plain strings in display order, each
   * numbered by its place so the card's tabs have a stable value. Blank entries are dropped.
   */
  readonly hints = computed<readonly AiLabHint[]>(() =>
    (this.lab()?.ai_lab_course_hints ?? [])
      .map((hint) => hint.trim())
      .filter(Boolean)
      .map((hint, i) => ({ id: i + 1, hint })),
  );

  // ---- Attempts ----------------------------------------------------------------

  /**
   * `assignment-attempts/`: the newest graded attempts, best first. Read once the lab is open (its
   * practical exists only past the exam); `is_provisioned: false` answers an empty list.
   */
  private readonly attemptsRes = httpResource<AiLabAttempts | null>(
    () =>
      this.examPassed() && this.labMapped()
        ? this.labRequest(AI_LABS_API.assignmentAttempts)
        : undefined,
    { defaultValue: null, parse: unwrap<AiLabAttempts>() },
  );

  readonly attempts = computed(() =>
    this.attemptsRes.hasValue() ? this.attemptsRes.value() : null,
  );

  /** Attempts failed to load for a reason a retry can fix — said in one line, never a toast. */
  readonly attemptsProblem = computed(() => {
    const err = this.attemptsRes.error();
    const reason = reasonOf(err);
    if (!err || reason === 'ai_lab_assignment_not_configured') return null;
    return SESSION_REFUSED.has(reason ?? '')
      ? 'AI Labs didn’t accept your session. Sign out and back in to see your attempts.'
      : (VENDOR_RETRY[reason ?? ''] ?? "We couldn't load your attempts.");
  });

  retryAttempts(): void {
    this.attemptsRes.reload();
  }

  retryBrief(): void {
    this.briefRes.reload();
  }

  // ---- Actions ---------------------------------------------------------------

  /**
   * The lab the URL names. A new id re-keys every read. The same id re-reads them: the route's
   * injector — and so this facade — outlives the page, so coming back from the exam or the feedback
   * page would otherwise show the state from before it.
   */
  open(courseId: string): void {
    this.lastReported = 0;
    this.videoDuration.set(null);
    this.certificateWaitOver.set(false);
    this.testEmailsOff.set(false);
    if (this.courseId() !== courseId) {
      this.courseId.set(courseId);
      return;
    }
    for (const res of [
      this.detailRes,
      this.startedRes,
      this.progressRes,
      this.briefRes,
      this.statusRes,
      this.attemptsRes,
    ]) {
      res.reload();
    }
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
   * re-keys `course-progress/`, and the detail, which only carries `chapter.hls_video_link` once
   * started. A 409 is the parent course's lock — its message is the sentence to show, so it is
   * relayed as-is. Restarting a lab the learner already finished keeps it finished (2026-10-28):
   * the re-read progress answers `next_step: done`, so the CTA goes straight to the certificate.
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
          this.detailRes.reload();
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
   * When a report crosses the completion line — the higher of 95% and the lab's own minimum, so
   * never assumed here — progress is re-read so the CTA moves on.
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
   * the status re-read that follows reports `in_progress`, which starts the poll. A refusal is told
   * by its reason (upstream's wording where it has the case); `'pick-again'` asks the page to drop
   * the pick, because AI Labs refused that artefact.
   */
  submitPractical(body: AiLabSubmitBody): Promise<'sent' | 'pick-again' | 'refused'> {
    const id = this.courseId();
    if (!id || this.submitting()) return Promise.resolve('refused');
    this.submitting.set(true);
    const route = AI_LABS_API.assignmentSubmit;
    return new Promise((resolve) => {
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
            resolve('sent');
          },
          error: (err: unknown) => {
            this.submitting.set(false);
            this.statusRes.reload();
            resolve(this.submitRefused(err));
          },
        });
    });
  }

  /** Says why a submit was refused and re-reads what the reason makes stale. */
  private submitRefused(err: unknown): 'pick-again' | 'refused' {
    const reason = reasonOf(err) ?? '';
    const status = err instanceof HttpErrorResponse ? err.status : 0;
    if (reason === 'practical_attempts_exhausted') {
      const max = this.assignment()?.max_attempts;
      this.notification.info(
        'No attempts left',
        max ? `You've used all ${max} graded attempts for this lab.` : messageOf(err),
      );
      this.attemptsRes.reload();
    } else if (reason === 'ai_lab_assignment_not_configured') {
      this.notification.error('Lab not set up', "This AI Lab's practical is not set up yet.");
    } else if (status === 409) {
      // The guide: every other 409 here means "already being graded — check the status".
      this.notification.info('Already submitted', 'An evaluation is already running.');
    } else if (reason === 'final_assessment_not_passed') {
      this.notification.info('Not yet', 'Pass the final assessment before submitting the lab.');
    } else if (reason === 'AI_LABS_VALIDATION_REJECTED') {
      this.notification.error('Pick again', messageOf(err));
      this.refreshArtefacts();
      return 'pick-again';
    } else if (reason === 'AI_LABS_NOT_PROVISIONED') {
      this.notification.info(
        'Lab not ready',
        'Your AI Lab account is still being set up. Try again in a few minutes.',
      );
    } else if (SESSION_REFUSED.has(reason)) {
      this.notification.error(
        "Couldn't submit",
        'AI Labs didn’t accept your session. Sign out and back in, then try again.',
      );
    } else {
      this.notification.error("Couldn't submit", messageOf(err));
    }
    return 'refused';
  }

  /** The picker's Refresh — after building something new in Copilot Studio. */
  refreshArtefacts(): void {
    this.agentsRes.reload();
    this.flowsRes.reload();
  }

  /**
   * The evaluation section's manual "check result", on top of the poll: `assessment-refresh/`
   * reconciles the grade with AI Labs, then the status and the gate flags are re-read, so a missed
   * webhook moves the CTA on to feedback. Whatever the outcome, the re-reads show the truth.
   */
  refreshStatus(): void {
    const id = this.courseId();
    if (!id || this.checkingResult()) return;
    this.checkingResult.set(true);
    const route = AI_LABS_API.assessmentRefresh;
    this.api
      .call({ ...route, path: route.path.replace(':id', id) }, undefined, { context: QUIET() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.afterResultCheck(),
        error: (err: unknown) => {
          this.notification.error("Couldn't check your result", messageOf(err));
          this.afterResultCheck();
        },
      });
  }

  private afterResultCheck(): void {
    this.checkingResult.set(false);
    this.statusRes.reload();
    this.progressRes.reload();
    this.attemptsRes.reload();
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
   * The Test emails row: `POST assignment-trigger-email/<uuid>/`, which has AI Labs post sample
   * emails into the lab mailbox. A success spends one of the exercise's sends, so it is never
   * retried for the learner — a lost answer says to check the mailbox first. AI Labs' own sentence
   * is shown as-is either way.
   */
  sendTestEmails(): void {
    const id = this.courseId();
    if (!id || this.sendingTestEmails()) return;
    this.sendingTestEmails.set(true);
    const route = AI_LABS_API.assignmentTriggerEmail;
    this.api
      .call({ ...route, path: route.path.replace(':id', id) }, undefined, { context: QUIET() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.sendingTestEmails.set(false);
          this.notification.success('Test emails sent', res.data?.message ?? res.message);
        },
        error: (err: unknown) => {
          this.sendingTestEmails.set(false);
          this.testEmailsRefused(err);
        },
      });
  }

  /** Says why test emails weren't sent; a reason meaning "never here" hides the row. */
  private testEmailsRefused(err: unknown): void {
    const reason = reasonOf(err) ?? '';
    const status = err instanceof HttpErrorResponse ? err.status : 0;
    if (TEST_EMAILS_OFF.has(reason)) this.testEmailsOff.set(true);
    if (reason === 'AI_LABS_TRIGGER_EMAIL_LIMIT_REACHED') {
      this.notification.info('No test emails left', messageOf(err));
    } else if (reason === 'AI_LABS_NOT_PROVISIONED') {
      this.notification.info(
        'Lab not ready',
        'Your AI Lab account is still being set up. Try again in a few minutes.',
      );
    } else if (SESSION_REFUSED.has(reason)) {
      this.notification.error(
        "Couldn't send test emails",
        'AI Labs didn’t accept your session. Sign out and back in, then try again.',
      );
    } else if (status === 0 || status === 504) {
      // No answer reached us, so the batch may have gone out — the guide says never resend blind.
      this.notification.error(
        "Couldn't confirm the test emails",
        'They may still have been sent. Check your lab mailbox before sending again.',
      );
    } else {
      this.notification.error("Couldn't send test emails", messageOf(err));
    }
  }

  /**
   * Open a brief file in a new tab. The tab opens inside the click; pointing it after the read is
   * what keeps it from being blocked.
   */
  openFile(file: AiLabFile): void {
    const tab = this.openTab('');
    this.freshFileUrl(file).subscribe({
      next: (url) => (url && tab ? (tab.location.href = url) : tab?.close()),
      error: () => {
        tab?.close();
        this.notification.error('File unavailable', 'Please try again in a moment.');
      },
    });
  }

  /**
   * A brief file shown in a viewer tab with a Download button, rather than downloading itself —
   * v3's `openBriefPreview` (`utils/file-viewer.ts`). Tab opened first, inside the click.
   */
  previewFile(file: AiLabFile, label: string): void {
    const tab = this.openTab('');
    if (!tab) return;
    tab.document.title = 'Opening…';
    const labName = this.brief()?.name ?? this.lab()?.ai_lab_course_name ?? 'AI Lab';
    this.freshFileUrl(file).subscribe({
      next: (url) => (url ? void renderFileViewer(tab, url, file, label, labName) : tab.close()),
      error: () => {
        tab.close();
        this.notification.error(
          label,
          `Could not open the ${label.toLowerCase()}. Please try again.`,
        );
      },
    });
  }

  /**
   * A brief file's link, fresh. Build guides are public; the rest are signed for ~15 minutes, so a
   * brief older than 10 is re-read and the file's new link used — matched by `sort_order` and name.
   * `null` when the re-read no longer carries the file.
   */
  private freshFileUrl(file: AiLabFile): Observable<string | null> {
    const fresh = Date.now() - this.briefFetchedAt < BRIEF_LINK_MAX_AGE_MS;
    if (fresh || this.buildGuides().some((g) => g.url === file.url)) return of(file.url);
    return this.api
      .get<CommonResponse<AiLabVendorBody<'brief', AiLabAssignmentBrief>>>(
        `${AI_LABS_API.assignmentBrief}${this.courseId()}/`,
        { context: QUIET() },
      )
      .pipe(
        map((res) => {
          const brief = res.data?.brief;
          this.briefRes.reload();
          return brief?.name
            ? (briefFiles(brief).find(
                (f) => f.sort_order === file.sort_order && f.filename === file.filename,
              )?.url ?? null)
            : null;
        }),
        takeUntilDestroyed(this.destroyRef),
      );
  }

  /**
   * Download Certificate: the shared certificate pop-up (the one v3 opens), handed the link
   * `course-progress/` carries. The learner downloads from there.
   */
  async openCertificate(): Promise<void> {
    const certificateUrl = this.certificateUrl();
    if (!certificateUrl) return;
    const { CertificateDownloadDialog } =
      await import('@shared/dialogs/certificate-download-dialog/certificate-download-dialog');
    const data: CertificateDialogData = {
      certificateUrl,
      courseTitle: this.lab()?.ai_lab_course_name,
    };
    this.dialogs.open(CertificateDownloadDialog, { data });
  }

  /**
   * Open an attempt's grade card. Its link dies at `grade_card_urls_expire_at`, so past that the
   * attempts are re-read and the same attempt's fresh link used.
   */
  openAttemptGradeCard(attempt: AiLabAttempt): void {
    const expires = this.attempts()?.grade_card_urls_expire_at;
    if (attempt.grade_card_url && (!expires || Date.parse(expires) > Date.now() + 30_000)) {
      this.openTab(attempt.grade_card_url);
      return;
    }
    const tab = this.openTab('');
    this.api
      .get<CommonResponse<AiLabAttempts>>(`${AI_LABS_API.assignmentAttempts}${this.courseId()}/`, {
        context: QUIET(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const url = res.data?.attempts.find(
            (a) => a.attempt_number === attempt.attempt_number,
          )?.grade_card_url;
          if (url && tab) tab.location.href = url;
          else tab?.close();
          this.attemptsRes.reload();
        },
        error: () => {
          tab?.close();
          this.notification.error('Grade card unavailable', 'Please try again in a moment.');
        },
      });
  }

  // ---- Internals -------------------------------------------------------------

  /** When the brief's signed links were issued — see `openFile`. */
  private briefFetchedAt = 0;
  private statusPoll: Subscription | null = null;

  constructor() {
    effect(() => {
      if (this.brief()) untracked(() => (this.briefFetchedAt = Date.now()));
    });

    // A running cool-off ends on its own: re-read progress just after it, so "Retake after …"
    // turns into Retake without a reload.
    effect((onCleanup) => {
      const ends = this.coolOffEndsAt();
      if (!ends || !this.isBrowser) return;
      const timer = setTimeout(
        () => this.progressRes.reload(),
        Date.parse(ends) - Date.now() + 1000,
      );
      onCleanup(() => clearTimeout(timer));
    });

    // Poll while a submission is being graded; stop when it settles, then re-read progress so the
    // CTA moves on to feedback.
    effect(() => {
      const grading = this.grading();
      untracked(() => (grading ? this.startStatusPoll() : this.stopStatusPoll(true)));
    });

    // A closed lab whose certificate isn't issued yet: re-read progress until the link lands, within
    // a budget. A reload keeps the value, so the stage holds steady between reads.
    effect((onCleanup) => {
      if (this.ctaStage() !== 'CERTIFICATE_PENDING' || !this.isBrowser) return;
      const started = Date.now();
      const poll = setInterval(() => {
        if (Date.now() - started < CERTIFICATE_POLL_TIMEOUT_MS) {
          this.progressRes.reload();
          return;
        }
        clearInterval(poll);
        this.certificateWaitOver.set(true);
      }, CERTIFICATE_POLL_MS);
      onCleanup(() => clearInterval(poll));
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
    if (settled) {
      this.progressRes.reload();
      this.attemptsRes.reload();
    }
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
