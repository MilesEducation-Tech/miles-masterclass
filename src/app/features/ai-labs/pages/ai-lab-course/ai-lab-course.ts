import {
  afterRenderEffect,
  Component,
  computed,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  linkedSignal,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matPlayArrowRound } from '@ng-icons/material-icons/round';
import {
  lucideArrowUpRight,
  lucideCheck,
  lucideChevronDown,
  lucideDownload,
  lucideExternalLink,
  lucideLock,
  lucidePause,
  lucideRefreshCw,
} from '@ng-icons/lucide';
import { PlayerMode, VideoConfig, VideoSource } from '@core/models/video-player.model';
import { AiLabTokenMeter } from '@features/ai-labs/components/ai-lab-token-meter/ai-lab-token-meter';
import {
  AI_LAB_QUIZ_BEHIND,
  AiLabAgent,
  AiLabFlow,
  AiLabInputFile,
  AiLabLabStatus,
  AiLabMaterial,
  AiLabSubmitBody,
} from '@features/ai-labs/models/ai-labs.model';
import { AiLabCourseFacade } from '@features/ai-labs/services/ai-lab-course-facade';
import { AiLabCredits } from '@features/ai-labs/services/ai-lab-credits';
import { AiLabQuizFacade } from '@features/ai-labs/services/ai-lab-quiz-facade';
import { AiLabQuiz } from '@features/ai-labs/components/ai-lab-quiz/ai-lab-quiz';
import { AriaSelectOption } from '@core/models/aria.model';
import { Backward } from '@shared/components/backward/backward';
import { AiLabCourseSkeleton } from '@shared/components/skeleton/ai-lab-course-skeleton/ai-lab-course-skeleton';
import { VideoJs } from '@shared/components/video-js/video-js';
import { Button } from '@shared/ui/button/button';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { Progress } from '@shared/ui/progress/progress';
import { Select } from '@shared/ui/select/select';
import { Spinner } from '@shared/ui/spinner/spinner';

/** What the learner picked: one agent, or one flow, never both. */
interface LabPick {
  kind: AiLabSubmitBody['artefact_kind'];
  id: string;
}

/**
 * One AI Lab course, end to end: watch the video, pass the final assessment, then build an agent
 * in Copilot Studio and submit it for evaluation — without leaving AI Labs.
 *
 * FOUR-STEP COMPLETION — watch → quiz → final assessment → AI Lab. The lab opens only once the
 * exam is passed, and feedback / certificate open only once the lab reports `completed`.
 *
 * ## Data
 *
 * Everything comes from `AiLabCourseFacade`, route-scoped and keyed by `:courseId`: the lab
 * (`course/<uuid>/`), whether it's started (`course-started/`) and the gate flags
 * (`course-progress/`). The page reads the facade's signals under its own names, so the template
 * stays upstream's; what is left here is presentation — the CTA labels, the picker's either/or
 * rule, the brief's clamp.
 *
 * The lab has no playable video on any read yet (backend question Q1), so the frame shows the
 * lab's artwork, and with no video the "keep watching" stage has nothing to play.
 */
@Component({
  selector: 'app-ai-lab-course',
  imports: [
    AiLabCourseSkeleton,
    AiLabQuiz,
    AiLabTokenMeter,
    Backward,
    Button,
    DatePipe,
    DecimalPipe,
    ErrorState,
    NgIcon,
    Progress,
    Select,
    Spinner,
    VideoJs,
  ],
  templateUrl: './ai-lab-course.html',
  // `fluid: false` hands sizing to CSS, so the player needs to be told to fill the 16:9 frame;
  // `contain` then letterboxes a portrait source inside it.
  styles: `
    /* video.js writes width/height inline when \`fluid\` is off, so these have to win with
       !important — the same override the reel card needs. */
    :host ::ng-deep .video-js {
      width: 100% !important;
      height: 100% !important;
    }

    :host ::ng-deep .video-js .vjs-tech {
      width: 100% !important;
      height: 100% !important;
      object-fit: contain;
    }
  `,
  providers: [
    provideIcons({
      matPlayArrowRound,
      lucideArrowUpRight,
      lucideCheck,
      lucideChevronDown,
      lucideDownload,
      lucideExternalLink,
      lucideLock,
      lucidePause,
      lucideRefreshCw,
    }),
  ],
})
export class AiLabCourse {
  // `DOCUMENT` from `@angular/core`: the `common` re-export is deprecated in v22.
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // ---- Roots -------------------------------------------------------------

  /** Bound from the `:courseId` route param by `withComponentInputBinding()`. */
  readonly courseId = input.required<string>();

  protected readonly facade = inject(AiLabCourseFacade);

  /** The lab. `null` renders the skeleton or the error state. */
  protected readonly course = this.facade.lab;
  protected readonly isLoading = this.facade.isLoading;
  protected readonly error = this.facade.error;

  protected readonly ctaStage = this.facade.ctaStage;
  protected readonly ctaLoading = this.facade.ctaLoading;
  protected readonly completed = this.facade.completed;
  /** Percentage watched, 0–100 — drives the hero's Play / Resume label and hint. */
  protected readonly progress = this.facade.progressPercent;
  protected readonly labMapped = this.facade.labMapped;

  // The practical — idle in the facade until its ticket binds it.
  protected readonly brief = this.facade.brief;
  protected readonly briefLoading = this.facade.briefLoading;
  protected readonly briefUnavailable = this.facade.briefUnavailable;
  protected readonly agents = this.facade.agents;
  protected readonly flows = this.facade.flows;
  protected readonly artefactsLoading = this.facade.artefactsLoading;
  protected readonly artefactsError = this.facade.artefactsError;
  protected readonly artefactsErrorMessage = this.facade.artefactsErrorMessage;
  protected readonly assignment = this.facade.assignment;
  protected readonly statusLoading = this.facade.statusLoading;
  protected readonly submitting = this.facade.submitting;
  protected readonly gradeCardBusy = this.facade.gradeCardBusy;
  /** The lab quiz, shown in the video frame while it's open. */
  protected readonly quiz = inject(AiLabQuizFacade);

  /** Copilot Credits, shared with the landing page's meter. */
  protected readonly credits = inject(AiLabCredits);
  protected readonly labProvisioned = this.facade.labProvisioned;

  protected readonly signInLabel = signal('Sign in & launch AI');

  /** The CPE conditions this course is credited under. Fixed copy, not payload. */
  protected readonly cpeRequirements: readonly string[] = [
    'Complete all videos and chapter quizzes',
    'Complete the final exam within one year of starting the course',
    'Score 70% or higher on the final exam',
  ];

  // ---- Player ------------------------------------------------------------

  private readonly player = viewChild(VideoJs);
  protected readonly playing = signal(false);
  protected readonly PlayerMode = PlayerMode;

  /**
   * ponytail: empty until a read carries the lab's video. `course/<uuid>/` has only a trailer
   * (null on UAT), and `course-video-progress/` measures a video no field names — Q1. The
   * reporting below is wired, so the source is the only missing piece.
   */
  protected readonly videoSources = computed<VideoSource[]>(() => []);

  /** The 16:9 frame's artwork, while there is no video to play. */
  protected readonly poster = computed(() => {
    const lab = this.course();
    return lab?.ai_lab_course_horizontal_thumbnail_url || lab?.ai_lab_course_square_thumbnail_url;
  });

  /**
   * Every lab enrolment is on the CPE path, so the seekbar and speed menu stay locked until the
   * video is watched through — the reel card's CPE rule, without a Preview mode to fall back to.
   */
  protected readonly playerMode = computed<PlayerMode>(() =>
    this.completed() ? PlayerMode.DEFAULT : PlayerMode.CPE,
  );

  protected readonly videoConfig = computed<VideoConfig>(() => ({
    controls: true,
    autoplay: false,
    // `fluid` would size the player to the source and blow the 16:9 frame open for a portrait
    // source, so size it from the frame instead and let the tech letterbox inside.
    fluid: false,
    responsive: false,
    // Never loop: `ended` has to fire so the last progress report goes out.
    loop: false,
    poster: this.poster() || undefined,
    preload: 'auto',
  }));

  /** The last playback position, so `ended` can send the final report. */
  private lastTime = 0;

  protected onTimeUpdate(seconds: number): void {
    this.lastTime = seconds;
    this.facade.reportVideoProgress(seconds);
  }

  protected onEnded(): void {
    this.playing.set(false);
    this.facade.reportVideoProgress(this.lastTime, true);
  }

  protected togglePlayback(): void {
    this.player()?.togglePlay();
  }

  /**
   * Jump to the lab section. Local DOM, not a route — `scroll-mt-*` on the section would handle an
   * anchor, but the sub-bar is sticky and a plain `#lab` lands under it.
   */
  protected scrollToLab(): void {
    const el = this.document.getElementById('lab');
    if (!el) return;
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - 128,
      behavior: 'smooth',
    });
  }

  // ---- The single CTA ----------------------------------------------------

  /** Feedback gets the amber treatment every other course hero gives it. */
  protected readonly feedbackCta = computed(() => this.ctaStage() === 'FEEDBACK');

  protected readonly feedbackClass = computed(() =>
    this.feedbackCta() ? 'text-black rounded-lg bg-amber-400' : '',
  );

  /** No stage means "keep watching" — on this page playback follows this button, not the scroll. */
  protected readonly playbackCta = computed(
    () => this.ctaStage() === null && this.videoSources().length > 0,
  );

  protected readonly playbackLabel = computed(() => {
    if (this.playing()) return 'Pause';
    return this.progress() > 0 ? 'Resume' : 'Play';
  });

  protected readonly ctaLabel = computed(() => {
    switch (this.ctaStage()) {
      case 'START':
        return 'Start AI Lab';
      case 'TAKE_QUIZ':
        return 'Take Quiz';
      case 'TAKE_EXAM':
        return 'Take Final Assessment';
      case 'RETAKE_EXAM':
        return 'Retake Final Assessment';
      case 'AI_LAB':
        return 'Continue to AI Lab';
      case 'FEEDBACK':
        return 'Submit Feedback';
      case 'DOWNLOAD':
        return 'Download Certificate';
      case 'REWATCH':
        return 'Rewatch';
    }
    return 'Watch the lab video';
  });

  /**
   * Nothing to do yet: a start in flight, the parent course's lock, or "keep watching" with no
   * video to watch.
   */
  protected readonly ctaDisabled = computed(
    () =>
      this.ctaLoading() ||
      !!this.facade.lockRemark() ||
      (this.ctaStage() === null && !this.playbackCta()),
  );

  /**
   * The hero CTA. Start and the lab are this page's; the quiz, exam, feedback and certificate
   * screens join with their ticket.
   */
  protected runCta(): void {
    switch (this.ctaStage()) {
      case 'START':
        this.facade.start();
        return;
      case 'TAKE_QUIZ':
        this.quiz.open();
        return;
      case 'TAKE_EXAM':
      case 'RETAKE_EXAM':
        void this.router.navigate(['final-assessment'], { relativeTo: this.route });
        return;
      case 'FEEDBACK':
        void this.router.navigate(['feedback'], { relativeTo: this.route });
        return;
      case 'AI_LAB':
        this.scrollToLab();
        return;
      case 'REWATCH':
        this.togglePlayback();
        return;
      default:
      // ponytail: DOWNLOAD has nothing to open — no read carries the lab certificate's link; it is
      // in the feedback submit's answer and in the CPE tracker.
    }
  }

  // ---- Lab materials -----------------------------------------------------

  /**
   * What the lab payload links to. Only the SharePoint workspace survives on the lab read — the
   * masterclass page's navigation video, glossary, sample and exercise-file download have no
   * counterpart here.
   */
  protected readonly labMaterials = computed<AiLabMaterial[]>(() => {
    const url = this.course()?.ai_lab_course_sharepoint_artefact_url;
    return url
      ? [{ kind: 'link', label: 'Resource workspace', hint: 'Opens SharePoint in a new tab', url }]
      : [];
  });

  // ---- Gates: watch → quiz → exam → lab ----------------------------------

  protected readonly examPassed = this.facade.examPassed;

  /**
   * The quiz is behind the learner once `course-progress/` says so, or once the CTA has moved
   * past it.
   */
  protected readonly quizDone = computed(() => {
    const stage = this.ctaStage();
    return this.facade.quizDone() || (stage !== null && AI_LAB_QUIZ_BEHIND.includes(stage));
  });

  /** The lab's exam rules, one per line on the payload. */
  protected readonly examRules = computed(() =>
    (this.course()?.ai_lab_course_exam_rules ?? '')
      .split(/\r?\n/)
      .map((rule) => rule.trim())
      .filter(Boolean),
  );

  /** Shown once started: the delivery method lives on the progress read's NASBA block. */
  protected readonly deliveryMethod = computed(
    () => this.facade.progress()?.nasba?.delivery_method ?? null,
  );

  /** The learner's own access window, once enrolled. */
  protected readonly accessEndsAt = computed(
    () => this.facade.started()?.enrollment?.ai_lab_enrollment_expires_at ?? null,
  );

  /** The lab opens on a mapped assignment plus a passed exam. Everything stays readable while locked. */
  protected readonly labUnlocked = computed(() => this.labMapped() && this.examPassed());

  /** What's holding the lab shut, said where the learner is looking. */
  protected readonly labLockHint = computed(() => {
    if (!this.labMapped()) {
      return 'This lab has no assessment mapped yet. It will open once one is assigned.';
    }
    if (!this.examPassed()) return 'Pass the final assessment to unlock the lab.';
    return 'Opens Copilot Studio in a new tab';
  });

  // ---- The assignment brief ----------------------------------------------
  // Deliberately NOT gated on `labUnlocked()`: reading the brief while the lab is still locked is
  // the reason to go and pass the exam.

  /** Sorted as sent; a file list is what the learner builds against, so it is always visible. */
  protected readonly briefFiles = computed(() => this.brief()?.input_files ?? []);

  protected readonly briefScenarios = computed(() =>
    (this.brief()?.scenarios ?? []).map((s) => s.trim()).filter(Boolean),
  );

  /** Expanded in place — the brief belongs in the section it describes, not in a dialog. */
  protected readonly briefExpanded = signal(false);

  /** Sections only the expanded brief shows: logic flow, guardrails, scenarios. */
  private readonly briefHasMore = computed(() => {
    const b = this.brief();
    return (
      !!b && (!!b.logic_flow?.trim() || !!b.guardrails?.trim() || this.briefScenarios().length > 0)
    );
  });

  /** The problem statement's 2-line clamp is actually cutting text off. */
  private readonly statementClamped = signal(false);

  /**
   * Whether there is anything behind the fold at all. Measured rather than guessed: a "Read more"
   * that expands to the same lines is worse than no button, and the statement's length in
   * characters says nothing about how many lines it wraps to.
   */
  protected readonly briefTruncated = computed(
    () => this.statementClamped() || this.briefHasMore(),
  );

  /** `FY2026_AP_Ledger_Extract.xlsx` → `XLSX file`. The guide sends no size to show instead. */
  protected fileKind(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? `${name.slice(dot + 1).toUpperCase()} file` : 'File';
  }

  protected toggleBrief(): void {
    this.briefExpanded.update((open) => !open);
  }

  private readonly briefStatement = viewChild<ElementRef<HTMLElement>>('briefStatement');

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    // The id comes off the URL; a new one re-keys every read in the facade.
    effect(() => {
      const id = this.courseId();
      untracked(() => this.facade.open(id));
    });

    // Whether the statement's clamp is cutting text off, measured twice over.
    // Content: new brief text re-measures after it renders — a clamped box keeps
    // the same height when the text changes, so no resize is reported.
    afterRenderEffect(() => {
      const el = this.briefStatement()?.nativeElement;
      // Tracked so new brief text re-measures; skipped while expanded, where
      // scrollHeight === clientHeight would reset the flag and take the
      // "Show less" control away with it.
      this.brief();
      if (!el || this.briefExpanded()) return;
      this.statementClamped.set(el.scrollHeight - el.clientHeight > 1);
    });

    // Geometry: a viewport change rewraps the text without any signal moving.
    effect((onCleanup) => {
      const el = this.briefStatement()?.nativeElement;
      if (!el || !this.isBrowser) return;
      const observer = new ResizeObserver(() => {
        if (this.briefExpanded()) return;
        this.statementClamped.set(el.scrollHeight - el.clientHeight > 1);
      });
      observer.observe(el);
      // The paragraph unmounts and remounts whenever the brief reloads, so this
      // has to drop the old observer on every re-run, not just on destroy.
      onCleanup(() => observer.disconnect());
    });
  }

  // ---- The artefact picker -----------------------------------------------

  /**
   * Keyed by `id`, not `envId`: every agent sits in the one shared Miles lab environment, so
   * `envId` is the same string for all of them.
   */
  protected readonly agentOptions = computed<AriaSelectOption<string>[]>(() =>
    this.agents().map((a) => ({ value: a.id, label: a.name })),
  );

  /** Offerable flows only — a disabled flow can't run, so it can't be evaluated. */
  protected readonly offerableFlows = computed(() => this.flows().filter((f) => f.enabled));

  protected readonly flowOptions = computed<AriaSelectOption<string>[]>(() =>
    this.offerableFlows().map((f) => ({ value: f.id, label: f.name })),
  );

  /**
   * The one artefact being submitted. A single signal *is* the either/or rule: picking in one
   * select overwrites whatever the other held, and both selects read their value back off this.
   * Survives a refresh while the artefact still exists, and clears if it vanished.
   */
  protected readonly pick = linkedSignal<
    { agents: readonly AiLabAgent[]; flows: readonly AiLabFlow[] },
    LabPick | null
  >({
    source: () => ({ agents: this.agents(), flows: this.offerableFlows() }),
    computation: ({ agents, flows }, prev) => {
      const p = prev?.value ?? null;
      if (!p) return null;
      const list: readonly { id: string }[] = p.kind === 'agent' ? agents : flows;
      return list.some((x) => x.id === p.id) ? p : null;
    },
  });

  protected readonly agentId = computed(() => {
    const p = this.pick();
    return p?.kind === 'agent' ? p.id : null;
  });

  protected readonly flowId = computed(() => {
    const p = this.pick();
    return p?.kind === 'flow' ? p.id : null;
  });

  protected readonly selectedAgent = computed(
    () => this.agents().find((a) => a.id === this.agentId()) ?? null,
  );

  protected readonly selectedFlow = computed(
    () => this.offerableFlows().find((f) => f.id === this.flowId()) ?? null,
  );

  /** Name of whatever is picked, for the hint line. */
  protected readonly pickedName = computed(
    () => this.selectedAgent()?.name ?? this.selectedFlow()?.name ?? null,
  );

  /** Something to pick from at all — agents, workflows, or both. */
  protected readonly hasArtefacts = computed(
    () => this.agents().length > 0 || this.offerableFlows().length > 0,
  );

  protected choose(kind: LabPick['kind'], id: string | null): void {
    this.pick.set(id ? { kind, id } : null);
  }

  /** Exactly what the submit POST carries: the picked row's `id` as `agent_ref`, and its list. */
  protected submit(): void {
    const picked = this.pick();
    if (picked) this.facade.submitPractical({ artefact_kind: picked.kind, agent_ref: picked.id });
  }

  // ---- Submission + evaluation -------------------------------------------

  /**
   * `assessment_status` as a panel. An open string on the wire: `in_progress` and `completed` are
   * evidenced, and a failed grading reads as the error panel rather than as "not started".
   */
  protected readonly phase = computed<AiLabLabStatus>(() => {
    switch (this.assignment()?.assessment_status) {
      case 'completed':
        return 'completed';
      case 'in_progress':
        return 'in_progress';
      case 'failed':
      case 'error':
        return 'error';
      default:
        return 'not_started';
    }
  });

  /**
   * A submission exists on the server. `submission_id` is the proof — not the status, which the
   * backend can report as `in_progress` for a lab the learner has merely opened.
   */
  protected readonly hasSubmission = computed(() => !!this.assignment()?.submission_id);

  /** Submitted and still with the evaluator. */
  protected readonly evaluating = computed(
    () => this.hasSubmission() && this.phase() === 'in_progress',
  );

  /**
   * ponytail: `completed` alone counts — no pass mark was specified for the lab. Gate on
   * `percentage >= 70` here if one is.
   */
  protected readonly labDone = computed(() => this.phase() === 'completed');

  /**
   * The lab has been graded at least once. Keeps its step ticked while a resubmission is with the
   * evaluator, when `labDone()` reads false again. `ai_assessment_completed` is the server's latch.
   */
  private readonly labEverGraded = computed(
    () =>
      this.labDone() ||
      !!this.assignment()?.ai_assessment_completed ||
      !!this.facade.progress()?.ai_assessment_completed,
  );

  /**
   * Nothing about the pick can be changed: an attempt is with the evaluator, or a graded one the
   * backend won't take again. Upstream reopens the picker on every graded lab; ours answers 409
   * `practical_already_completed` unless `can_resubmit`, so the picker follows that flag. Either
   * way it stays on screen, showing what was sent.
   */
  protected readonly alreadySubmitted = computed(
    () => this.evaluating() || (this.labDone() && !this.assignment()?.can_resubmit),
  );

  /** Everything the picker can't do right now. */
  protected readonly pickerLocked = computed(
    () => this.submitting() || this.statusLoading() || this.alreadySubmitted(),
  );

  protected readonly submitDisabled = computed(() => !this.pick() || this.pickerLocked());

  /** Which panel the evaluation section shows — `in_progress` only counts once something was sent. */
  protected readonly evaluationView = computed<AiLabLabStatus>(() => {
    if (this.labDone()) return 'completed';
    if (this.evaluating()) return 'in_progress';
    return this.phase() === 'error' ? 'error' : 'not_started';
  });

  /** The picker block shows once the lab is open. */
  protected readonly pickerOpen = computed(() => this.labUnlocked());

  // ---- The four-step sub-bar ---------------------------------------------

  protected readonly stepsDone = computed(
    () =>
      [this.completed(), this.quizDone(), this.examPassed(), this.labEverGraded()].filter(Boolean)
        .length,
  );

  /** Three without a mapped lab — otherwise a finished course sticks at 75%. */
  protected readonly stepsTotal = computed(() => (this.labMapped() ? 4 : 3));

  protected readonly stepsPercent = computed(() => (this.stepsDone() / this.stepsTotal()) * 100);

  // ---- Hints -------------------------------------------------------------

  /** What is standing between the learner and the exam, said at the exam card. */
  protected readonly finalHint = computed(() => {
    if (!this.completed()) return 'Finish the video first.';
    if (!this.examPassed()) return 'Pass the assessment to unlock the AI Lab.';
    // Our backend opens feedback only once the lab is graded — upstream opens it on the pass.
    if (!this.labEverGraded())
      return 'Passed — the AI Lab is open below. Feedback opens once it is graded.';
    return 'Passed and graded — leave feedback and download your certificate.';
  });

  /** Status line under the picker. */
  protected readonly labHint = computed(() => {
    if (this.labDone()) {
      return this.assignment()?.can_resubmit
        ? 'Evaluated — your scores are below. Submit again to improve them.'
        : 'Evaluated — your scores are below.';
    }
    if (this.evaluating()) return 'Submitted — the evaluation is running.';
    const name = this.pickedName();
    return name ? `Ready to submit ${name}.` : 'Select the agent or workflow to submit.';
  });

  protected readonly heroHint = computed(() => {
    const locked = this.facade.lockRemark();
    if (locked) return locked;
    if (this.ctaStage() === 'START') {
      const days = this.course()?.ai_lab_course_access_duration_days;
      return days
        ? `Starting opens your ${days}-day lab window and records your CPE progress.`
        : 'Starting opens the lab and records your CPE progress.';
    }
    if (!this.completed()) {
      const pct = this.progress();
      if (!this.videoSources().length) return "The lab video isn't available yet.";
      return pct > 0
        ? `${pct}% viewed — finish the video, then take the final assessment.`
        : 'Watch the lab video through to unlock the quiz and the final assessment.';
    }
    if (!this.examPassed()) {
      return 'Video complete — pass the final assessment to unlock the AI Lab.';
    }
    if (!this.labEverGraded()) {
      return 'Assessment passed — submit your AI Lab build; feedback and the certificate follow its grade.';
    }
    return 'Lab graded — leave feedback and download your certificate.';
  });

  // ---- The practical's actions -------------------------------------------

  protected launchLab(): void {
    this.facade.launchLab();
  }

  protected refreshArtefacts(): void {
    this.facade.refreshArtefacts();
  }

  protected refreshStatus(): void {
    this.facade.refreshStatus();
  }

  /** "Submit again" after a failed evaluation: the picker is open again, so take the learner to it. */
  protected resubmit(): void {
    this.scrollToLab();
  }

  protected downloadGradeCard(): void {
    this.facade.downloadGradeCard();
  }

  protected openInputFile(file: AiLabInputFile): void {
    this.facade.openInputFile(file);
  }
}
