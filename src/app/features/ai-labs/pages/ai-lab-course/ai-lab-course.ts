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
import { DatePipe, DecimalPipe, formatDate, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matPlayArrowRound } from '@ng-icons/material-icons/round';
import {
  lucideArrowRight,
  lucideArrowUpRight,
  lucideAward,
  lucideBookOpen,
  lucideCheck,
  lucideChevronDown,
  lucideChevronLeft,
  lucideChevronRight,
  lucideCircleCheck,
  lucideClipboardList,
  lucideCopy,
  lucideDownload,
  lucideExternalLink,
  lucideFileArchive,
  lucideFlag,
  lucideFlaskConical,
  lucideFolderOpen,
  lucideLightbulb,
  lucideListChecks,
  lucideLock,
  lucideMail,
  lucidePause,
  lucideRefreshCw,
  lucideRocket,
  lucideScrollText,
  lucideSend,
  lucideSparkles,
  lucideTriangleAlert,
  lucideTrophy,
} from '@ng-icons/lucide';
import { NgpTabButton, NgpTabList, NgpTabPanel, NgpTabset } from 'ng-primitives/tabs';
import { iconCopilot } from '@core/constants/icon';
import { PlayerMode, VideoConfig, VideoSource } from '@core/models/video-player.model';
import { NotificationService } from '@core/services/notification/notification';
import { AiLabStep } from '@features/ai-labs/components/ai-lab-step/ai-lab-step';
import { AiLabTokenMeter } from '@features/ai-labs/components/ai-lab-token-meter/ai-lab-token-meter';
import {
  AI_LAB_QUIZ_BEHIND,
  AiLabAgent,
  AiLabAttempt,
  AiLabFile,
  AiLabFlow,
  AiLabLabStatus,
  AiLabSubmitBody,
} from '@features/ai-labs/models/ai-labs.model';
import { AiLabAuth } from '@core/services/ai-lab-auth/ai-lab-auth';
import { AiLabCourseFacade } from '@features/ai-labs/services/ai-lab-course-facade';
import { AiLabAccount } from '@features/ai-labs/services/ai-lab-account';
import { AiLabCredits } from '@features/ai-labs/services/ai-lab-credits';
import { AiLabQuizFacade } from '@features/ai-labs/services/ai-lab-quiz-facade';
import { renderBriefMarkdown } from '@features/ai-labs/utils/brief-markdown';
import {
  courseJourney,
  courseProgress,
  ProgressStage,
  ProgressTarget,
  StepState,
} from '@features/ai-labs/utils/course-journey';
import { AriaSelectOption } from '@core/models/aria.model';
import { Backward } from '@shared/components/backward/backward';
import { AiLabCourseSkeleton } from '@shared/components/skeleton/ai-lab-course-skeleton/ai-lab-course-skeleton';
import { VideoJs } from '@shared/components/video-js/video-js';
import { detectVideoMimeType } from '@shared/services/utils';
import { Button } from '@shared/ui/button/button';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { Progress } from '@shared/ui/progress/progress';
import { Select } from '@shared/ui/select/select';
import { Spinner } from '@shared/ui/spinner/spinner';
import { cn } from '@shared/utils/cn';

/** What the learner picked: one agent, or one flow, never both. */
interface LabPick {
  kind: AiLabSubmitBody['artefact_kind'];
  id: string;
}

/** An evaluated attempt passes at this percentage — the score ring's colour and the history label. */
const LAB_PASS_PERCENT = 70;

/** Illustrative score out of 10 for the sample grade card when the lab sends none. Labelled "Sample". */
const SAMPLE_GRADE_FALLBACK = '7.85';

/**
 * Step 01's card per journey state: its surface, the status tile's icon and colour, and the status
 * title. The tint says where the learner stands before they read a word; locked goes dashed —
 * present, not yet theirs.
 */
const FINAL_VIEW: Record<
  StepState,
  { surface: string; icon: string; tile: string; title: string }
> = {
  current: {
    surface: 'ai-glow border-accent/40 bg-linear-to-br from-accent/10 via-card to-card',
    icon: 'lucideClipboardList',
    tile: 'text-accent',
    title: 'Not attempted',
  },
  done: {
    surface: 'border-accent/30 bg-linear-to-br from-accent/10 via-card to-card',
    icon: 'lucideCircleCheck',
    tile: 'text-accent',
    title: 'Passed',
  },
  attention: {
    surface: 'border-amber-400/30 bg-linear-to-br from-amber-400/10 via-card to-card',
    icon: 'lucideTriangleAlert',
    tile: 'text-amber-400',
    title: 'Retake required',
  },
  locked: {
    surface: 'border-dashed border-border bg-card',
    icon: 'lucideLock',
    tile: 'text-muted-foreground',
    title: 'Locked',
  },
  // Step 01 is never `open` — a plain card keeps the record total.
  open: {
    surface: 'border-border bg-card',
    icon: 'lucideClipboardList',
    tile: 'text-muted-foreground',
    title: 'Not attempted',
  },
};

/**
 * The progress overview's look per stage, so a course not yet opened, one half done and one
 * finished read differently at a glance. `ring` is the gauge colour; `icon` replaces the
 * percentage in the ring at the two ends of the journey, where a number says less than a symbol.
 */
const PROGRESS_VIEW: Record<
  ProgressStage,
  { surface: string; orb: string; ring: string; eyebrow: string; icon: string | null }
> = {
  fresh: {
    surface: 'border-dashed border-border bg-card',
    orb: 'bg-foreground/10',
    ring: 'var(--muted-foreground)',
    eyebrow: 'text-muted-foreground',
    icon: 'lucideRocket',
  },
  started: {
    surface: 'border-accent/25 bg-linear-to-br from-accent/10 via-card to-card',
    orb: 'bg-accent/30',
    ring: 'var(--accent)',
    eyebrow: 'text-accent',
    icon: null,
  },
  halfway: {
    surface: 'border-accent/30 bg-linear-to-br from-accent/15 via-card to-card',
    orb: 'bg-accent/40',
    ring: 'var(--accent)',
    eyebrow: 'text-accent',
    icon: null,
  },
  retake: {
    surface: 'border-amber-400/30 bg-linear-to-br from-amber-400/10 via-card to-card',
    orb: 'bg-amber-400/30',
    ring: 'var(--color-amber-400)',
    eyebrow: 'text-amber-400',
    icon: null,
  },
  lab: {
    surface: 'ai-glow border-accent/40 bg-linear-to-br from-accent/20 via-card to-card',
    orb: 'bg-accent/50',
    ring: 'var(--accent)',
    eyebrow: 'text-accent',
    icon: null,
  },
  evaluating: {
    surface: 'ai-glow border-accent/40 bg-linear-to-br from-accent/20 via-card to-card',
    orb: 'bg-accent/50',
    ring: 'var(--accent)',
    eyebrow: 'text-accent',
    icon: null,
  },
  complete: {
    surface: 'border-accent/40 bg-linear-to-br from-accent/20 via-card to-card',
    orb: 'bg-accent/50',
    ring: 'var(--accent)',
    eyebrow: 'text-accent',
    icon: 'lucideTrophy',
  },
};

/** The sidebar navigator's state badge (the icon's colour on the dark tile), per step state. */
const NAV_ICON: Record<StepState, string> = {
  done: 'text-accent',
  current: 'text-accent',
  attention: 'text-amber-400',
  locked: 'text-muted-foreground',
  open: 'text-muted-foreground',
};

/** A stepper segment (hints, history attempts): behind the open one, the open one, or ahead. */
type StepperTabState = 'seen' | 'open' | 'ahead';

const HINT_TAB: Record<StepperTabState, string> = {
  seen: 'w-5 bg-amber-400/50 group-hover:bg-amber-400/80',
  open: 'w-9 bg-amber-400',
  ahead: 'w-5 bg-muted-foreground/30 group-hover:bg-muted-foreground/60',
};

/** The history's attempt switcher — the hints stepper, in the page's blue. */
const HISTORY_TAB: Record<StepperTabState, string> = {
  seen: 'w-5 bg-accent/50 group-hover:bg-accent/80',
  open: 'w-9 bg-accent',
  ahead: 'w-5 bg-muted-foreground/30 group-hover:bg-muted-foreground/60',
};

const stepperState = (i: number, open: number): StepperTabState =>
  i < open ? 'seen' : i === open ? 'open' : 'ahead';

/** An image renders inline; anything else (a PDF) is a row that opens it. */
function isImageFile(file: AiLabFile): boolean {
  return (
    !!file.content_type?.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(file.doc_type.toLowerCase())
  );
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
 * The frame plays the trailer until the lab is started, then `chapter.hls_video_link` — which the
 * detail carries only once started, so the facade re-reads it after `course-start/`. With neither,
 * it shows the lab's artwork.
 */
@Component({
  selector: 'app-ai-lab-course',
  imports: [
    AiLabCourseSkeleton,
    AiLabStep,
    AiLabTokenMeter,
    Backward,
    Button,
    DatePipe,
    DecimalPipe,
    ErrorState,
    NgIcon,
    NgpTabButton,
    NgpTabList,
    NgpTabPanel,
    NgpTabset,
    Progress,
    Select,
    Spinner,
    VideoJs,
  ],
  templateUrl: './ai-lab-course.html',
  // `fluid: false` hands the player's sizing to CSS; the stylesheet fills the 16:9 frame with it.
  styleUrl: './ai-lab-course.css',
  providers: [
    provideIcons({
      matPlayArrowRound,
      lucideArrowRight,
      lucideArrowUpRight,
      lucideAward,
      lucideBookOpen,
      lucideCheck,
      lucideChevronDown,
      lucideChevronLeft,
      lucideChevronRight,
      lucideCircleCheck,
      lucideClipboardList,
      lucideCopy,
      lucideDownload,
      lucideExternalLink,
      lucideFileArchive,
      lucideFlag,
      lucideFlaskConical,
      lucideFolderOpen,
      lucideLightbulb,
      lucideListChecks,
      lucideLock,
      lucideMail,
      lucidePause,
      lucideRefreshCw,
      lucideRocket,
      lucideScrollText,
      lucideSend,
      lucideSparkles,
      lucideTriangleAlert,
      lucideTrophy,
    }),
  ],
})
export class AiLabCourse {
  // `DOCUMENT` from `@angular/core`: the `common` re-export is deprecated in v22.
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notification = inject(NotificationService);

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

  // The practical: brief, artefacts, submission and grading.
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
  /** The lab quiz — a pop-up its facade opens and closes. */
  protected readonly quiz = inject(AiLabQuizFacade);

  /** Copilot Credits, shared with the landing page's meter. */
  protected readonly credits = inject(AiLabCredits);
  protected readonly labProvisioned = this.facade.labProvisioned;

  /** The Microsoft sign-in to the lab — Launch AI signs in first, then opens Copilot Studio. */
  protected readonly labAuth = inject(AiLabAuth);
  /** Whose lab this is — the sign-in and Launch are checked against it (`AiLabAccount`). */
  protected readonly labAccount = inject(AiLabAccount);

  protected readonly signInLabel = computed(() =>
    this.labAuth.isSignedIn() ? 'Launch AI Lab' : 'Sign in & launch AI',
  );

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
   * The trailer plays until the lab video is there to replace it — before the start, and on a
   * started lab whose video the admin hasn't set. Its seconds are never reported.
   */
  protected readonly isTrailer = computed(
    () => !this.facade.labVideoUrl() && !!this.course()?.ai_lab_course_trailer_url,
  );

  protected readonly videoSources = computed<VideoSource[]>(() => {
    const src = this.facade.labVideoUrl() ?? this.course()?.ai_lab_course_trailer_url;
    return src ? [{ src, type: detectVideoMimeType(src) }] : [];
  });

  /** The 16:9 frame's artwork, and the player's poster. The trailer brings its own. */
  protected readonly poster = computed(() => {
    const lab = this.course();
    return (
      (this.isTrailer() && lab?.ai_lab_course_trailer_thumbnail) ||
      lab?.ai_lab_course_horizontal_thumbnail_url ||
      lab?.ai_lab_course_square_thumbnail_url
    );
  });

  /**
   * Every lab enrolment is on the CPE path, so the seekbar and speed menu stay locked until the
   * video is watched through — the reel card's CPE rule, without a Preview mode to fall back to.
   * The trailer counts for nothing, so it seeks freely.
   */
  protected readonly playerMode = computed<PlayerMode>(() =>
    this.completed() || this.isTrailer() ? PlayerMode.DEFAULT : PlayerMode.CPE,
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
    if (this.isTrailer()) return;
    this.lastTime = seconds;
    this.facade.reportVideoProgress(seconds);
  }

  protected onEnded(): void {
    this.playing.set(false);
    if (this.isTrailer()) return;
    this.facade.reportVideoProgress(this.lastTime, true);
    this.quizAfterVideo.set(true);
  }

  /** The video just ended: the quiz opens once its last report moves the CTA on to it. */
  private readonly quizAfterVideo = signal(false);

  protected togglePlayback(): void {
    this.player()?.togglePlay();
  }

  protected scrollToLab(): void {
    this.scrollToSection('lab');
  }

  /**
   * Jump to a step section. Local DOM, not a route — a plain `#lab` fragment would make the router
   * re-resolve the URL, and the fixed header would cover the target anyway. The 128px offset
   * matches the sections' `scroll-mt-32`.
   */
  protected scrollToSection(id: string): void {
    const el = this.document.getElementById(id);
    if (!el) return;
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - 128,
      behavior: 'smooth',
    });
  }

  /** Back up to the player — step 01's way forward while the video is unfinished. */
  protected scrollToVideo(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** The overview's button: the player for the video, otherwise the step's section. */
  protected goTo(target: ProgressTarget): void {
    if (target === 'video') this.scrollToVideo();
    else this.scrollToSection(target);
  }

  // ---- The single CTA ----------------------------------------------------

  /** Feedback gets the amber treatment every other course hero gives it. */
  protected readonly feedbackCta = computed(() => this.ctaStage() === 'FEEDBACK');

  /**
   * No stage means "keep watching" — on this page playback follows this button, not the scroll.
   * Only the lab video counts; the trailer plays from the player's own controls.
   */
  protected readonly playbackCta = computed(
    () => this.ctaStage() === null && !!this.facade.labVideoUrl(),
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
      case 'COOL_OFF':
        return `Retake after ${this.coolOffTime()}`;
      case 'FEEDBACK':
        return 'Submit Feedback';
      case 'DOWNLOAD':
        return 'Download Certificate';
      case 'CERTIFICATE_PENDING':
        return 'Certificate is being generated';
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
      this.ctaStage() === 'COOL_OFF' ||
      this.ctaStage() === 'CERTIFICATE_PENDING' ||
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
        void this.facade.startExam();
        return;
      case 'FEEDBACK':
        void this.router.navigate(['feedback'], { relativeTo: this.route });
        return;
      case 'REWATCH':
        this.togglePlayback();
        return;
      case 'DOWNLOAD':
        void this.facade.openCertificate();
        return;
    }
  }

  /**
   * The sub-bar's "Back to AI Labs": `/:country/:profession_type/ai-labs`, off this route's own
   * params (not `Utils`, which pulls the subscription dialog and the feature facade in for two
   * strings). An explicit path, not history: after the exam or the feedback page, the previous entry
   * is that page, not the landing.
   */
  protected readonly labsHome = (() => {
    const params = Object.assign({}, ...this.route.snapshot.pathFromRoot.map((r) => r.params));
    return `/${params['country']}/${params['profession_type']}/ai-labs`;
  })();

  // ---- 03 Lab materials --------------------------------------------------

  /**
   * The SharePoint workspace the learner builds in: the brief's first link, else the lab's own
   * artefact URL. One row, as upstream designs it — "Resource workspace".
   */
  protected readonly workspaceLink = computed(
    () =>
      this.facade.workspaceLinks()[0]?.url ??
      this.course()?.ai_lab_course_sharepoint_artefact_url ??
      null,
  );

  /** The lab's exercise files — the first one, the lab's zip, is the row upstream shows. */
  protected readonly exerciseZip = computed(() => this.facade.exerciseFiles()[0] ?? null);

  /**
   * The brief turns AI Labs' test-email helper on, the lab is open, and the send route hasn't said
   * this exercise has none.
   */
  protected readonly triggerEmailEnabled = computed(
    () =>
      this.labUnlocked() &&
      this.brief()?.tools?.trigger_email === true &&
      !this.facade.testEmailsOff(),
  );
  protected readonly sendingTestEmails = this.facade.sendingTestEmails;

  protected sendTestEmails(): void {
    this.facade.sendTestEmails();
  }

  /**
   * Copies the workspace's share link. It's a view-only "anyone" link on another organisation's
   * SharePoint, so a learner opening it is a guest there and SharePoint offers no "Copy link".
   */
  protected copyWorkspaceLink(url: string): void {
    if (!url || !this.isBrowser) return;
    navigator.clipboard.writeText(url).then(
      () =>
        this.notification.success(
          'Link copied',
          'The resource workspace link is on your clipboard.',
        ),
      () => this.notification.error('Copy failed', 'Could not copy the link. Please try again.'),
    );
  }

  /** A brief file, in a new tab — a stale signed link is re-read first. */
  protected openFile(file: AiLabFile): void {
    this.facade.openFile(file);
  }

  /** A brief file shown in a viewer tab, with a Download button — v3's `openBriefPreview`. */
  protected previewFile(file: AiLabFile, label: string): void {
    this.facade.previewFile(file, label);
  }

  // ---- 04 Hints ----------------------------------------------------------

  protected readonly hints = this.facade.hints;

  /**
   * The open hint, as its tab value. One at a time on purpose: the next one is a click away when
   * the learner is still stuck, not on screen up front. Resets to the first when the hints change.
   */
  protected readonly hintTab = linkedSignal(() => String(this.hints()[0]?.id ?? ''));

  protected readonly hintIndex = computed(() =>
    Math.max(
      0,
      this.hints().findIndex((hint) => String(hint.id) === this.hintTab()),
    ),
  );

  protected readonly hintTabClass = computed(() =>
    this.hints().map((_, i) => HINT_TAB[stepperState(i, this.hintIndex())]),
  );

  /** Which way the last switch went, so the new hint slides in from that side. */
  protected readonly hintDirection = signal<1 | -1>(1);

  /** The cards peeking out under the open hint — one per hint still ahead, at most three. */
  protected readonly hintStack = computed(() => {
    const ahead = Math.min(3, this.hints().length - 1 - this.hintIndex());
    // Deepest first, so the nearest card paints on top. Each drops a little further below the
    // open hint, a little narrower, tilted the other way.
    return Array.from({ length: ahead }, (_, i) => {
      const depth = ahead - i;
      return {
        depth,
        transform: `translateY(${depth * 11}px) scale(${1 - depth * 0.045}) rotate(${depth % 2 ? 1.1 : -1.1}deg)`,
        opacity: 1 - depth * 0.2,
      };
    });
  });

  protected selectHint(value: string | undefined): void {
    const index = this.hints().findIndex((hint) => String(hint.id) === value);
    if (index < 0 || index === this.hintIndex()) return;
    this.hintDirection.set(index > this.hintIndex() ? 1 : -1);
    this.hintTab.set(String(value));
  }

  protected stepHint(delta: number): void {
    const next = this.hints()[this.hintIndex() + delta];
    if (next) this.selectHint(String(next.id));
  }

  protected readonly flowChart = this.facade.flowChart;

  protected readonly flowChartIsImage = computed(() => {
    const file = this.flowChart();
    return !!file && isImageFile(file);
  });

  // ---- Instructor ----------------------------------------------------------

  /** The hero's instructor line. `[]` hides it. */
  protected readonly instructorNames = computed(() =>
    (this.course()?.instructors ?? []).map((instructor) => instructor.name).join(', '),
  );

  /**
   * Instructors worth their own card — more than a name, which the hero already shows. An empty
   * card reads as a bug rather than as missing data.
   */
  protected readonly instructorProfiles = computed(() =>
    (this.course()?.instructors ?? [])
      .map((instructor) => ({
        ...instructor,
        image: instructor.profile_image ?? instructor.square_image_url,
      }))
      .filter((instructor) => instructor.designation || instructor.bio || instructor.image),
  );

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

  /** The progress read's NASBA block once started; the detail carries it before (2026-10-28). */
  protected readonly deliveryMethod = computed(
    () => this.facade.progress()?.nasba?.delivery_method ?? this.course()?.delivery_method ?? null,
  );

  /** When the final assessment was passed — progress once started, else the detail's. */
  protected readonly passedAt = computed(
    () =>
      this.facade.progress()?.final_assessment_passed_at ??
      this.course()?.final_assessment_passed_at ??
      null,
  );

  /** Step 01's facts off the detail (2026-10-28); `null` until the lab sends them. */
  protected readonly examQuestions = computed(
    () => this.course()?.assessment_questions_to_show ?? null,
  );
  protected readonly examPassMark = computed(
    () => this.course()?.assessment_pass_threshold_percent ?? null,
  );

  /**
   * An attempt exists to read back: passed, or failed and waiting on a retake. The report opens on
   * the exam page, which shows it when the paper is refused for either reason.
   */
  protected readonly reportOpen = computed(
    () => this.examPassed() || this.ctaStage() === 'RETAKE_EXAM' || this.ctaStage() === 'COOL_OFF',
  );

  /** The CPE credited, once the lab closes — a number since 2026-10-28, a boolean before. */
  private readonly cpeEarned = computed(() => {
    const awarded = this.facade.progress()?.cpe_awarded;
    return typeof awarded === 'number' && awarded > 0 ? awarded : null;
  });

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

  /** A brief read that failed for a reason a retry can fix. */
  protected readonly briefProblem = this.facade.briefProblem;

  /**
   * The problem statement as HTML: escaped first, then a small Markdown subset, then Angular's
   * sanitizer on the `[innerHTML]` binding. Plain prose reads the same as before.
   */
  protected readonly briefStatementHtml = computed(() =>
    renderBriefMarkdown(this.brief()?.problem_statement),
  );

  protected readonly briefRequirements = computed(() =>
    this.facade
      .requirements()
      .map((requirement) => requirement.trim())
      .filter(Boolean),
  );

  /** Walkthroughs to keep open while building — rows above Launch AI. */
  protected readonly buildGuides = this.facade.buildGuides;

  /**
   * ponytail: placeholder copy until the content team sends the real line. Swap the string;
   * nothing else depends on it.
   */
  protected readonly buildGuideDescription = 'Your step-by-step walkthrough for this lab';

  /** Copilot Studio's mark, on the Launch row — the same glyph the AI Labs landing uses. */
  protected readonly copilotIcon = iconCopilot;

  /** Expanded in place — the brief belongs in the section it describes, not in a dialog. */
  protected readonly briefExpanded = signal(false);

  /** Sections only the expanded brief shows: requirements and guardrails. */
  private readonly briefHasMore = computed(
    () => this.briefRequirements().length > 0 || !!this.brief()?.guardrails?.trim(),
  );

  /** The problem statement's clamp is actually cutting text off — its last line then fades. */
  protected readonly statementClamped = signal(false);

  /**
   * Whether there is anything behind the fold at all. Measured rather than guessed: a "Read more"
   * that expands to the same lines is worse than no button, and the statement's length in
   * characters says nothing about how many lines it wraps to.
   */
  protected readonly briefTruncated = computed(
    () => this.statementClamped() || this.briefHasMore(),
  );

  protected toggleBrief(): void {
    this.briefExpanded.update((open) => !open);
  }

  private readonly briefStatement = viewChild<ElementRef<HTMLElement>>('briefStatement');

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    // A lab session from an earlier visit; a no-op on the server.
    void this.labAuth.restoreSession();

    // The quiz is a pop-up: the video stops behind it.
    effect(() => {
      if (this.quiz.isOpen()) untracked(() => this.player()?.pause());
    });

    // At the video's end the quiz opens by itself, as the v3 lab and micro-learning do — once the
    // final progress report has moved the CTA on to it (completion is the server's call: the higher of
    // 95% and the lab's own minimum).
    effect(() => {
      if (!this.quizAfterVideo() || this.ctaStage() !== 'TAKE_QUIZ') return;
      untracked(() => {
        this.quizAfterVideo.set(false);
        this.quiz.open();
      });
    });

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

    // Scrollspy for the sidebar navigator: whichever step section crosses the band a third of the
    // way down the viewport is the one being read. The sections only exist once the lab has
    // loaded, hence keyed on it.
    afterRenderEffect((onCleanup) => {
      if (!this.course() || !this.isBrowser) return;
      const sections = this.navSteps()
        .map((item) => this.document.getElementById(item.id))
        .filter((el): el is HTMLElement => !!el);
      if (!sections.length) return;
      const observer = new IntersectionObserver(
        (entries) => {
          const hit = entries.find((entry) => entry.isIntersecting);
          if (hit) this.activeStep.set(hit.target.id);
        },
        { rootMargin: '-30% 0px -60% 0px' },
      );
      sections.forEach((el) => observer.observe(el));
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
    if (!picked) return;
    this.retrying.set(false);
    void this.facade
      .submitPractical({ artefact_kind: picked.kind, agent_ref: picked.id })
      .then((outcome) => {
        if (outcome === 'pick-again') this.pick.set(null);
      });
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
   * Graded attempts on record. The status carries the count; the attempts list, once read, agrees.
   * This — not `completed`, nor `ai_assessment_completed` — is what proves a grade: learners
   * latched before the practical left the CPE flow read `completed` with no attempt behind it.
   */
  protected readonly attemptsUsed = computed(
    () => this.attemptsData()?.attempts_used ?? this.assignment()?.attempts_used ?? 0,
  );

  /**
   * The latest submission is graded. ponytail: no pass mark was specified for the lab — gate on
   * `percentage >= 70` here if one is.
   */
  protected readonly labDone = computed(
    () => this.phase() === 'completed' && this.attemptsUsed() > 0,
  );

  /** Graded at least once — keeps the step ticked while a resubmission is with the evaluator. */
  private readonly labEverGraded = computed(() => this.attemptsUsed() > 0);

  /** The allowance is used: the submit would answer 409 `practical_attempts_exhausted`. */
  protected readonly attemptsExhausted = computed(() => this.assignment()?.attempts_left === 0);

  /**
   * Submit is closed: an attempt is with the evaluator, or the server takes no more
   * (`can_resubmit` is false once the allowance is used). The picker stays on screen either way,
   * showing what was sent.
   */
  protected readonly submitClosed = computed(
    () => this.evaluating() || this.assignment()?.can_resubmit === false,
  );

  /**
   * Everything the picker can't do right now. Not a status re-read: the grading poll would grey
   * the select every 12 s, and a submit that lands mid-grading gets a 409 the facade explains.
   */
  protected readonly pickerLocked = computed(() => this.submitting() || this.submitClosed());

  protected readonly submitDisabled = computed(() => !this.pick() || this.pickerLocked());

  /** "Submit again" on a failed evaluation: the error card steps aside for the picker. */
  private readonly retrying = signal(false);

  /** Which panel the evaluation section shows — `in_progress` only counts once something was sent. */
  protected readonly evaluationView = computed<AiLabLabStatus>(() => {
    if (this.labDone()) return 'completed';
    if (this.evaluating()) return 'in_progress';
    return this.phase() === 'error' && !this.retrying() ? 'error' : 'not_started';
  });

  /** The picker block shows once the lab is open. */
  protected readonly pickerOpen = computed(() => this.labUnlocked());

  // ---- 05 Scores -----------------------------------------------------------
  // The grade card reads the attempts list: every graded attempt, oldest first, with the allowance.
  // Without the list it shows the best grade off `assignment-status/`, and before a first grade a
  // sample card, tagged and watermarked as such.

  private readonly attemptsData = this.facade.attempts;

  protected readonly attempts = computed(() => this.attemptsData()?.attempts ?? []);

  /** The grade card: the attempt the server names best — a worse retry never lowers it. */
  protected readonly bestAttempt = computed<AiLabAttempt | null>(() => {
    const best = this.attemptsData()?.best_attempt_number;
    return this.attempts().find((attempt) => attempt.attempt_number === best) ?? null;
  });

  /** The lab's allowance of graded attempts; `null` until the list is read. */
  protected readonly maxAttempts = computed(
    () => this.attemptsData()?.max_attempts ?? this.assignment()?.max_attempts ?? null,
  );

  protected readonly attemptsLeft = computed(
    () => this.attemptsData()?.attempts_left ?? this.assignment()?.attempts_left ?? null,
  );

  protected readonly passMark = LAB_PASS_PERCENT;

  /** Percentages arrive as decimal strings. */
  protected attemptPassed(attempt: AiLabAttempt): boolean {
    return Number(attempt.percentage ?? 0) >= LAB_PASS_PERCENT;
  }

  /** A stale signed link is re-read first — see the facade. */
  protected openAttemptGradeCard(attempt: AiLabAttempt): void {
    this.facade.openAttemptGradeCard(attempt);
  }

  /** Attempts failed to load for a reason a retry can fix. */
  protected readonly attemptsProblem = this.facade.attemptsProblem;

  /** Every listed attempt in the order made — the history reads as a timeline. */
  protected readonly historyAttempts = computed(() =>
    [...this.attempts()].sort((a, b) => a.attempt_number - b.attempt_number),
  );

  /** One history row per attempt: its score (`null` when unscored, never 0%), pass, best, latest. */
  protected readonly historyRows = computed(() => {
    const all = this.historyAttempts();
    const best = this.bestAttempt()?.attempt_number;
    const latest = all.at(-1)?.attempt_number;
    return all.map((attempt) => ({
      attempt,
      pct: attempt.percentage === null ? null : Number(attempt.percentage),
      passed: this.attemptPassed(attempt),
      best: attempt.attempt_number === best,
      latest: attempt.attempt_number === latest,
    }));
  });

  /** The attempt on screen, as its tab value. Opens on the latest, and back there on change. */
  protected readonly historyTab = linkedSignal(() =>
    String(this.historyAttempts().at(-1)?.attempt_number ?? ''),
  );

  protected readonly historyIndex = computed(() =>
    Math.max(
      0,
      this.historyRows().findIndex(
        (row) => String(row.attempt.attempt_number) === this.historyTab(),
      ),
    ),
  );

  protected readonly historyTabClass = computed(() =>
    this.historyRows().map((_, i) => HISTORY_TAB[stepperState(i, this.historyIndex())]),
  );

  protected readonly historyDirection = signal<1 | -1>(1);

  protected selectHistory(value: string | undefined): void {
    const index = this.historyRows().findIndex(
      (row) => String(row.attempt.attempt_number) === value,
    );
    if (index < 0 || index === this.historyIndex()) return;
    this.historyDirection.set(index > this.historyIndex() ? 1 : -1);
    this.historyTab.set(String(value));
  }

  protected stepHistory(delta: number): void {
    const next = this.historyRows()[this.historyIndex() + delta];
    if (next) this.selectHistory(String(next.attempt.attempt_number));
  }

  /** The best grade off `assignment-status/` — the card while there's no attempts list. */
  protected readonly latestGrade = computed(() => {
    if (this.attempts().length) return null;
    const result = this.assignment();
    return result && this.labEverGraded() && result.percentage !== null ? result : null;
  });

  /** Graded at least once — submitting becomes a re-evaluation, a quieter block. */
  protected readonly hasAttempts = computed(
    () => this.attempts().length > 0 || this.latestGrade() !== null,
  );

  /** The sample card's PDF, when the lab ships one. */
  protected readonly sampleCard = this.facade.sampleGradeCard;

  /** The sample card's score: the lab's own when it sends one, otherwise illustrative. */
  protected readonly sampleGrade = computed(
    () => this.sampleCard()?.sample_grade ?? SAMPLE_GRADE_FALLBACK,
  );

  /** The sample out of 10, as the ring's and bar's percentage. */
  protected readonly samplePercent = computed(() => Number(this.sampleGrade()) * 10);

  /**
   * The sample card's verdict — illustrative copy in the evaluator's voice, so the sample reads
   * like the real card it previews.
   * ponytail: replace with the lab's own sample verdict if one is ever sent.
   */
  protected readonly sampleVerdict = {
    title: 'A solid agent that handles the main cases, with room to tighten its guardrails.',
    detail:
      "Sample feedback. Your grade card scores the agent on its logic, its use of the lab files and how it behaves in live tests, with the evaluator's verdict on each.",
  } as const;

  protected openSampleCard(): void {
    const sample = this.sampleCard();
    if (sample) this.openFile(sample);
  }

  // ---- The course journey ------------------------------------------------

  /** The last exam was failed — the CTA asks for a retake. */
  protected readonly examRetake = computed(
    () => this.ctaStage() === 'RETAKE_EXAM' || this.ctaStage() === 'COOL_OFF',
  );

  /** A running cool-off's end, as a time of day — the wait is short (30 minutes on UAT). */
  protected readonly coolOffTime = computed(() => {
    const ends = this.facade.coolOffEndsAt();
    return ends ? formatDate(ends, 'shortTime', 'en-US') : '';
  });

  private readonly gates = computed(() => ({
    videoDone: this.completed(),
    examPassed: this.examPassed(),
    examRetake: this.examRetake(),
    labMapped: this.labMapped(),
    labGraded: this.labEverGraded(),
    evaluating: this.evaluating(),
    evaluationFailed: this.evaluationView() === 'error',
    labOpen: this.examPassed(),
  }));

  /** State + status chip for each numbered section — see `courseJourney`. */
  protected readonly journey = computed(() => courseJourney(this.gates()));

  /** The whole course at a glance, for the sidebar's overview — see `courseProgress`. */
  protected readonly overview = computed(() => {
    const progress = courseProgress({
      ...this.gates(),
      videoPercent: this.progress(),
      quizDone: this.quizDone(),
    });
    return { ...progress, view: PROGRESS_VIEW[progress.stage] };
  });

  /** The sidebar navigator: the five steps, each with its journey state. */
  protected readonly navSteps = computed(() => {
    const journey = this.journey();
    return [
      { id: 'final', label: 'Final MCQ assessment', step: journey.final },
      { id: 'lab', label: 'Miles AI Lab', step: journey.lab },
      { id: 'materials', label: 'Lab materials', step: journey.materials },
      { id: 'hints', label: 'Hints', step: journey.hints },
      { id: 'grade', label: 'Your evaluation & scores', step: journey.grade },
    ]
      .filter((item) => item.id !== 'hints' || this.hasHintsStep())
      .map((item, i) => ({
        ...item,
        index: String(i + 1).padStart(2, '0'),
        iconClass: NAV_ICON[item.step.state],
      }));
  });

  /**
   * Step 04 has something to show: hints (locked or not), or — once the lab is open — the flow
   * chart. Otherwise the guide's rule ("`[]` → hide the card") takes the whole step, and the steps
   * after it renumber.
   */
  protected readonly hasHintsStep = computed(
    () =>
      this.hints().length > 0 || (!!this.flowChart() && this.journey().hints.state !== 'locked'),
  );

  /** A step's number as the navigator counts it — "05" becomes "04" when the hints step is gone. */
  protected stepIndex(id: string): string {
    return this.navSteps().find((item) => item.id === id)?.index ?? '';
  }

  /** The step section in view, marked in the navigator — see the scrollspy in the constructor. */
  protected readonly activeStep = signal('final');

  /** Step 01's surface, status tile and title, off its journey state. */
  protected readonly finalView = computed(() => FINAL_VIEW[this.journey().final.state]);

  /** "View report": the exam page reads the latest attempt back when the paper is refused. */
  protected openReport(): void {
    void this.router.navigate(['final-assessment'], { relativeTo: this.route });
  }

  /** Step 01's exam rules, folded behind a toggle in the card's footer row. */
  protected readonly rulesOpen = signal(false);

  /**
   * What a pass opens, shown on step 01: feedback and the certificate, as upstream — and, on our
   * backend, the lab too. The lab gates nothing in return.
   */
  protected readonly examUnlocks = computed(() => [
    { label: 'Feedback', icon: 'lucideClipboardList', open: this.examPassed() },
    { label: 'Certificate', icon: 'lucideAward', open: this.examPassed() },
    { label: 'AI Lab', icon: 'lucideFlaskConical', open: this.examPassed() },
  ]);

  /** The step 01 CTA is the exam itself — the one that leaves this page. */
  protected readonly examCta = computed(() => {
    const stage = this.ctaStage();
    return stage === 'TAKE_EXAM' || stage === 'RETAKE_EXAM';
  });

  /** The Launch row's label, which carries the lab sign-in state. */
  protected readonly launchLabel = computed(() => {
    if (this.labAuth.restoring()) return 'Checking sign-in…';
    if (this.labAuth.signingIn()) return 'Signing in…';
    if (this.labAuth.isSignedIn() && this.labAccount.isLoading())
      return 'Checking your lab account…';
    return this.labAuth.isSignedIn() ? 'Launch AI' : 'Sign in & launch AI';
  });

  /** The read-then-build panel (build guides + Launch AI), glowing while the lab is up next. */
  protected readonly launchPanelClass = computed(() =>
    cn(
      'divide-y divide-white/5 rounded-2xl border transition-colors duration-500',
      // Spaced off the brief (or its "unavailable" line) when one sits above.
      (this.brief() || this.briefUnavailable() || this.briefLoading()) && 'mt-6',
      !this.labUnlocked() && 'border-border bg-black/25',
      this.labUnlocked() && 'border-accent/30 bg-linear-to-br from-accent/5 via-card to-card',
      this.journey().lab.state === 'current' && 'ai-glow border-accent/40 from-accent/10',
    ),
  );

  // ---- Hints -------------------------------------------------------------

  /** What is standing between the learner and the exam, said at the exam card. */
  protected readonly finalHint = computed(() => {
    if (!this.completed()) return 'Finish the video first.';
    if (this.ctaStage() === 'COOL_OFF') {
      return `Not passed this time — you can retake it after ${this.coolOffTime()}.`;
    }
    if (!this.examPassed())
      return 'Pass the assessment to unlock feedback, your certificate and the AI Lab.';
    return this.feedbackDone()
      ? 'Passed, feedback in. The AI Lab is open below.'
      : 'Passed — leave feedback for your certificate. The AI Lab is open below.';
  });

  /** Status line under the picker. */
  protected readonly labHint = computed(() => {
    if (this.labDone()) {
      return this.attemptsExhausted()
        ? `Evaluated — your best score is above. You've used all ${this.maxAttempts()} attempts.`
        : 'Evaluated — your best score is above. Submit again to improve it.';
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
    if (this.ctaStage() === 'COOL_OFF') {
      return `Not passed this time — the retake opens at ${this.coolOffTime()}.`;
    }
    if (!this.examPassed()) {
      return 'Video complete — pass the final assessment to unlock feedback, your certificate and the AI Lab.';
    }
    if (!this.feedbackDone()) {
      return "Assessment passed — leave feedback to get your certificate. The AI Lab is open below whenever you're ready.";
    }
    const earned = this.cpeEarned();
    const done = earned ? `Course complete — ${earned} CPE earned` : 'Course complete';
    return this.ctaStage() === 'DOWNLOAD'
      ? `${done}. Download your certificate; the AI Lab stays open below.`
      : `${done}. Your certificate appears here once it is issued.`;
  });

  /** Feedback is in: the lab is closed for CPE, and only the certificate is left. */
  private readonly feedbackDone = computed(() => !!this.facade.progress()?.feedback_submitted);

  // ---- The practical's actions -------------------------------------------

  /**
   * Upstream's rule: not signed in to the lab → the Microsoft popup (straight from the click, or
   * it's blocked), hinted to this learner's lab account; signed in → Copilot Studio, in their own
   * environment, once the session is checked to be theirs.
   */
  protected launchLab(): void {
    if (this.labAuth.isSignedIn()) this.labAccount.launch();
    else void this.labAccount.signIn();
  }

  protected refreshArtefacts(): void {
    this.facade.refreshArtefacts();
  }

  protected refreshStatus(): void {
    this.facade.refreshStatus();
  }

  /**
   * "Submit again" after a failed evaluation, as upstream: the error card makes way, the lists are
   * re-read (a fix in Copilot Studio may have renamed or republished the agent), and the learner is
   * taken to the picker in this step.
   */
  protected resubmit(): void {
    this.retrying.set(true);
    this.facade.refreshArtefacts();
    this.scrollToSection('grade');
  }

  protected downloadGradeCard(): void {
    this.facade.downloadGradeCard();
  }
}
