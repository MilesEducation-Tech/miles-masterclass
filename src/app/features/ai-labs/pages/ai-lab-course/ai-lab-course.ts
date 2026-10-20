import {
  Component,
  computed,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matPlayArrowRound } from '@ng-icons/material-icons/round';
import {
  lucideArrowUpRight,
  lucideCheck,
  lucideChevronDown,
  lucideDownload,
  lucideExternalLink,
  lucideLock,
  lucideMail,
  lucidePause,
  lucideRefreshCw,
} from '@ng-icons/lucide';
import { RouterLink } from '@angular/router';
import { ContentDetails } from '@core/models/course.model';
import { PlayerMode, VideoConfig, VideoSource } from '@core/models/video-player.model';
import { AiLabTokenMeter } from '@features/ai-labs/components/ai-lab-token-meter/ai-lab-token-meter';
import {
  AI_LAB_QUIZ_BEHIND,
  AiLabAgent,
  AiLabAssignmentBrief,
  AiLabAssignmentStatus,
  AiLabCtaStage,
  AiLabFlow,
  AiLabLabStatus,
  AiLabMaterial,
  AiLabPick,
  AiLabTokenBalance,
} from '@features/ai-labs/models/ai-labs.model';
import { AriaSelectOption } from '@core/models/aria.model';
import { Backward } from '@shared/components/backward/backward';
import { AiLabCourseSkeleton } from '@shared/components/skeleton/ai-lab-course-skeleton/ai-lab-course-skeleton';
import { VideoJs } from '@shared/components/video-js/video-js';
import { DurationPipe } from '@shared/pipes/duration/duration-pipe';
import { TotalCpeCreditsPipe } from '@shared/pipes/total-cpe-credits/total-cpe-credits-pipe';
import { Button } from '@shared/ui/button/button';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { Progress } from '@shared/ui/progress/progress';
import { Select } from '@shared/ui/select/select';
import { Spinner } from '@shared/ui/spinner/spinner';

/** How much of the brief is shown before the learner asks for the rest. */
const BRIEF_PREVIEW_REQUIREMENTS = 3;

/**
 * One AI Lab course, end to end: watch the video, pass the final assessment, then build an agent
 * in Copilot Studio and submit it for evaluation — without leaving AI Labs.
 *
 * FOUR-STEP COMPLETION — watch → quiz → final assessment → AI Lab. The lab opens only once the
 * exam is passed, and feedback / certificate open only once the lab reports `completed`.
 *
 * ## Presentational, and why
 *
 * Upstream this page injects four facades (`MicroLearningCourseFacade`, `ChapterFacade`,
 * `FinalAssessmentFacade`, `FeedbackFacade`), four `resource()`s and a submission service; the
 * TypeScript is mostly that wiring. None of it is bound here, so **every root is an input and
 * every action is an output**, and what is left is the derivation the design actually encodes —
 * the gates, the CTA labels, the picker's either/or rule, the brief's clamp.
 *
 * Three things could not come across as-is, each for a boundary reason rather than a design one:
 *
 *  - **`ctaStage`** is an input rather than `deriveActionStatus(reel)`. That helper and its
 *    `ActionStatus` enum live in `features/offerings`, and a feature may not import another
 *    feature (AGENTS.md §3). The spellings match the API so binding is a cast.
 *  - **`completed`** is an input rather than `isReelCompleted(reel)`, same reason.
 *  - **`labMapped`** is an input rather than reading `lab_assignment_id` off the payload, which
 *    our `ContentDetails` does not carry yet. Adding a field to a core model for a page that
 *    cannot use it yet would be speculative.
 *
 * Binding this page means feeding these inputs and handling the outputs. Nothing in this file has
 * to change for that.
 */
@Component({
  selector: 'app-ai-lab-course',
  imports: [
    AiLabCourseSkeleton,
    AiLabTokenMeter,
    Backward,
    Button,
    DatePipe,
    DurationPipe,
    ErrorState,
    NgIcon,
    Progress,
    RouterLink,
    Select,
    Spinner,
    TotalCpeCreditsPipe,
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
      lucideMail,
      lucidePause,
      lucideRefreshCw,
    }),
  ],
})
export class AiLabCourse {
  // `DOCUMENT` from `@angular/core`: the `common` re-export is deprecated in v22.
  private readonly document = inject(DOCUMENT);

  // ---- Roots -------------------------------------------------------------

  /** The course payload. `null` renders the skeleton or the error state. */
  readonly course = input<ContentDetails | null>(null);

  /** The "about" payload — topics, objectives, exam rules, lab materials. */
  readonly details = input<ContentDetails | null>(null);

  readonly brief = input<AiLabAssignmentBrief | null>(null);
  readonly agents = input<readonly AiLabAgent[]>([]);
  readonly flows = input<readonly AiLabFlow[]>([]);
  readonly assignment = input<AiLabAssignmentStatus | null>(null);
  readonly balance = input<AiLabTokenBalance | null>(null);

  /** Where the learner is in the course — see the class doc for why this is an input. */
  readonly ctaStage = input<AiLabCtaStage | null>(null);

  /** The video has been watched through. */
  readonly completed = input(false);

  /**
   * Percentage watched, 0–100 — drives the progress bar under the player.
   *
   * An input rather than a computed: upstream derives it from `last_activity`, which is watched
   * seconds on their payload and an ISO timestamp on ours. Deriving it here would silently
   * compute nonsense from a date.
   */
  readonly progress = input(0);

  /** The course is mapped to an AI Labs assignment. Without one there is nothing to submit against. */
  readonly labMapped = input(false);

  /** False while the learner's Copilot environment is still being created. */
  readonly labProvisioned = input(true);

  /** The SharePoint workspace link, once resolved. */
  readonly workspaceUrl = input<string | null>(null);

  /** Why the workspace row isn't a link yet — loading, failed, or simply not configured. */
  readonly workspaceHint = input('No workspace link for this lab');

  readonly isLoading = input(false);

  /** The brief is still being fetched. */
  readonly briefLoading = input(false);

  /** The agent / workflow lists are still being fetched. */
  readonly artefactsLoading = input(false);

  /** The agent list failed to load — the picker says so rather than reading as empty. */
  readonly artefactsError = input(false);
  readonly error = input(false);
  readonly ctaLoading = input(false);
  readonly submitting = input(false);
  readonly statusLoading = input(false);
  readonly sendingTestEmails = input(false);
  readonly downloadingExerciseFiles = input(false);
  readonly signInLabel = input('Sign in & launch AI');

  // ---- Actions -----------------------------------------------------------

  readonly cta = output<void>();
  readonly launchLab = output<void>();
  readonly submitLab = output<AiLabPick>();
  readonly resubmit = output<void>();
  readonly refreshStatus = output<void>();
  readonly refreshArtefacts = output<void>();
  readonly sendTestEmails = output<void>();
  readonly openMaterial = output<AiLabMaterial>();
  readonly topUp = output<void>();
  readonly videoEnded = output<void>();
  readonly timeUpdate = output<number>();
  readonly retry = output<void>();

  /** The CPE conditions this course is credited under. Fixed copy, not payload. */
  protected readonly cpeRequirements: readonly string[] = [
    'Complete all videos and chapter quizzes',
    'Complete the final exam within one year of starting the course',
    'Score 70% or higher on the final exam',
  ];

  // ---- Player ------------------------------------------------------------

  private readonly player = viewChild(VideoJs);
  protected readonly playing = signal(false);
  protected readonly theater = signal(false);
  protected readonly PlayerMode = PlayerMode;

  protected readonly videoSources = computed<VideoSource[]>(() => {
    const url = this.course()?.video_url;
    if (!url) return [];
    const isHls = url.toLowerCase().endsWith('.m3u8');
    return [{ src: url, type: isHls ? 'application/x-mpegURL' : 'video/mp4' }];
  });

  /**
   * CPE mode locks the seekbar and the speed menu until the course is watched through; Preview
   * mode is an ordinary player. The same rule as the reel card.
   */
  protected readonly playerMode = computed<PlayerMode>(() => {
    const inCpe = !!this.course()?.cpe_mode_details?.cpe_mode;
    return inCpe && !this.completed() ? PlayerMode.CPE : PlayerMode.DEFAULT;
  });

  protected readonly videoConfig = computed<VideoConfig>(() => ({
    controls: true,
    autoplay: false,
    // AI Lab videos come from the reel library, so the source can be portrait (720x1280) even
    // though the artwork is landscape. `fluid` would size the player to the source and blow the
    // 16:9 frame open, so size it from the frame instead and let the tech letterbox inside.
    fluid: false,
    responsive: false,
    // Never loop: `ended` has to fire so the post-video flow (quiz → exam) can open. The reel card
    // loops because it's a feed; a course page isn't.
    loop: false,
    poster: this.course()?.horizontal_thumbnail || this.course()?.thumbnail || undefined,
    preload: 'auto',
  }));

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

  protected toggleTheater(): void {
    this.theater.update((on) => !on);
  }

  /** Native fullscreen on the player — exit is Esc or video.js's own control. */
  protected enterFullscreen(): void {
    this.player()?.requestFullscreen();
  }

  // ---- The single CTA ----------------------------------------------------

  /** Feedback gets the amber treatment every other course hero gives it. */
  protected readonly feedbackCta = computed(() => this.ctaStage() === 'FEEDBACK');

  protected readonly feedbackClass = computed(() =>
    this.feedbackCta() ? 'text-black rounded-lg bg-amber-400' : '',
  );

  /**
   * No stage yet in CPE mode means "keep watching" — on this page playback follows this button
   * rather than the scroll, so the CTA drives the player.
   */
  protected readonly playbackCta = computed(
    () => !!this.course()?.cpe_mode_details?.cpe_mode && this.ctaStage() === null,
  );

  protected readonly playbackLabel = computed(() => {
    if (this.playing()) return 'Pause';
    return this.progress() > 0 ? 'Resume' : 'Play';
  });

  protected readonly ctaLabel = computed(() => {
    const reel = this.course();
    if (!reel) return 'Play';
    switch (this.ctaStage()) {
      case 'TAKE_QUIZ':
        return 'Take Quiz';
      case 'TAKE_EXAM':
        return 'Take Final Assessment';
      case 'RETAKE_EXAM':
        return 'Retake Final Assessment';
      case 'FEEDBACK':
        return 'Submit Feedback';
      case 'DOWNLOAD':
        return 'Download Certificate';
      case 'REWATCH':
        return 'Rewatch';
    }
    return reel.cpe_mode_details?.cpe_mode ? 'Continue' : 'Watch in CPE Mode';
  });

  // ---- Lab materials -----------------------------------------------------

  /**
   * Lab material carried by the course payload: three links, plus the two resource options — the
   * exercise-file download and the SharePoint workspace.
   */
  protected readonly labMaterials = computed<AiLabMaterial[]>(() => {
    const d = this.details();
    if (!d) return [];

    const links: AiLabMaterial[] = (
      [
        { label: 'Course navigation', hint: 'Walkthrough video', url: d.navigation_link },
        { label: 'Glossary', hint: 'Terms used in this lab', url: d.glossary_doc },
        { label: 'Sample', hint: 'Worked example', url: d.sample_link },
      ] as const
    )
      .filter((m) => !!m.url)
      .map((m) => ({ kind: 'link', label: m.label, hint: m.hint, url: m.url }) as AiLabMaterial);

    const actions: AiLabMaterial[] = [];
    if (d.has_exercise_files) {
      actions.push({
        kind: 'action',
        label: 'Exercise files',
        hint: 'Download the lab files as a zip',
        action: 'exercise',
      });
    }
    if (d.has_additional_resources) {
      const url = this.workspaceUrl();
      // A resolved URL renders as a real anchor — middle-click, "open in new tab", the lot. The
      // button is only the not-yet / couldn't state.
      if (url) {
        links.push({
          kind: 'link',
          label: 'Resource workspace',
          hint: 'Opens SharePoint in a new tab',
          url,
        });
      } else {
        actions.push({
          kind: 'action',
          label: 'Resource workspace',
          hint: this.workspaceHint(),
          action: 'workspace',
        });
      }
    }

    return [...links, ...actions];
  });

  /** Exercise files spin while the zip streams; the workspace row while its link resolves. */
  protected materialBusy(material: AiLabMaterial): boolean {
    if (material.kind === 'link') return false;
    return material.action === 'exercise' ? this.downloadingExerciseFiles() : this.isLoading();
  }

  /**
   * The workspace row is only ever the not-yet / couldn't state — a resolved link renders as an
   * anchor — so it is inert unless the fetch failed, where a click retries.
   */
  protected materialDisabled(material: AiLabMaterial): boolean {
    return material.kind === 'action' && material.action === 'workspace' && !this.workspaceUrl();
  }

  // ---- Gates: watch → quiz → exam → lab ----------------------------------

  protected readonly examPassed = computed(
    () => this.course()?.user_assessment_details?.status === 'Exam_Passed',
  );

  /**
   * The quiz is behind the learner once the CTA has moved past it. Read off the stage rather than
   * `quiz_details`, which isn't on the payload until the quiz is opened.
   */
  protected readonly quizDone = computed(() => {
    const stage = this.ctaStage();
    return this.examPassed() || (stage !== null && AI_LAB_QUIZ_BEHIND.includes(stage));
  });

  protected readonly examRetake = computed(
    () => this.course()?.user_assessment_details?.status === 'Retake',
  );

  /** The QAS rules, one per line on the payload — the same list the start dialog shows. */
  protected readonly examRules = computed(() =>
    (this.course()?.exam_rules ?? this.details()?.exam_rules ?? '')
      .split(/\r?\n/)
      .map((rule) => rule.trim())
      .filter(Boolean),
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

  protected readonly briefRequirements = computed(() =>
    (this.brief()?.requirements ?? []).map((r) => r.trim()).filter(Boolean),
  );

  /** The brief says this assignment ships seed emails for the lab mailbox. */
  protected readonly testEmailsEnabled = computed(() => this.brief()?.tools?.test_emails === true);

  /** Expanded in place — the brief belongs in the section it describes, not in a dialog. */
  protected readonly briefExpanded = signal(false);

  protected readonly visibleRequirements = computed(() =>
    this.briefExpanded()
      ? this.briefRequirements()
      : this.briefRequirements().slice(0, BRIEF_PREVIEW_REQUIREMENTS),
  );

  protected readonly hiddenRequirements = computed(() =>
    Math.max(0, this.briefRequirements().length - BRIEF_PREVIEW_REQUIREMENTS),
  );

  /** The problem statement's 3-line clamp is actually cutting text off. */
  private readonly statementClamped = signal(false);

  /**
   * Whether there is anything behind the fold at all. Measured rather than guessed: a "Read more"
   * that expands to the same three lines is worse than no button, and the statement's length in
   * characters says nothing about how many lines it wraps to.
   */
  protected readonly briefTruncated = computed(
    () => this.statementClamped() || this.hiddenRequirements() > 0,
  );

  protected toggleBrief(): void {
    this.briefExpanded.update((open) => !open);
  }

  protected readonly briefStatement = viewChild<ElementRef<HTMLElement>>('briefStatement');

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
    AiLabPick | null
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

  protected choose(kind: AiLabPick['kind'], id: string | null): void {
    this.pick.set(id ? { kind, id } : null);
  }

  protected submit(): void {
    const picked = this.pick();
    if (picked) this.submitLab.emit(picked);
  }

  // ---- Submission + evaluation -------------------------------------------

  protected readonly phase = computed<AiLabLabStatus>(
    () => this.assignment()?.lab_status ?? 'not_started',
  );

  /**
   * A submission exists on the server. `submission_id` is the proof — not `lab_status`, which the
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
   * An attempt is with the evaluator. The picker stays on screen showing what was sent, but
   * nothing about it can be changed. A scored attempt doesn't lock it — the learner can submit
   * again to better the score.
   */
  protected readonly alreadySubmitted = computed(() => this.evaluating());

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
      [this.completed(), this.quizDone(), this.examPassed(), this.labDone()].filter(Boolean).length,
  );

  /** Three without a mapped lab — otherwise a finished course sticks at 75%. */
  protected readonly stepsTotal = computed(() => (this.labMapped() ? 4 : 3));

  protected readonly stepsPercent = computed(() => (this.stepsDone() / this.stepsTotal()) * 100);

  // ---- Hints -------------------------------------------------------------

  /** What is standing between the learner and the exam, said at the exam card. */
  protected readonly finalHint = computed(() => {
    if (!this.completed()) return 'Finish the video first.';
    if (!this.examPassed()) return 'Pass the assessment to unlock the AI Lab.';
    return 'Passed — leave feedback and download your certificate. The AI Lab is open below.';
  });

  /** Status line under the picker. */
  protected readonly labHint = computed(() => {
    if (this.labDone()) return 'Evaluated — your scores are below. Submit again to improve them.';
    if (this.evaluating()) return 'Submitted — the evaluation is running.';
    const name = this.pickedName();
    return name ? `Ready to submit ${name}.` : 'Select the agent or workflow to submit.';
  });

  protected readonly heroHint = computed(() => {
    if (!this.completed()) {
      const pct = this.progress();
      return pct > 0
        ? `${pct}% viewed — finish the video, then take the final assessment.`
        : 'Credit is recorded only for sessions started in CPE Mode.';
    }
    if (!this.examPassed()) {
      return 'Video complete — pass the final assessment to unlock the AI Lab.';
    }
    return 'Assessment passed — leave feedback and download your certificate. Try the AI Lab anytime.';
  });
}
