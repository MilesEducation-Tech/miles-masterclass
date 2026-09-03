import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  linkedSignal,
  PLATFORM_ID,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matPlayArrowRound } from '@ng-icons/material-icons/round';
import {
  lucideArrowUpRight,
  lucideCheck,
  lucideDownload,
  lucideLock,
  lucidePause,
  lucideRefreshCw,
} from '@ng-icons/lucide';
import { finalize, firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import { Backward } from '../../../shared/components/backward/backward';
import { AriaSelect } from '../../../shared/components/ui/aria/aria-select/aria-select';
import { Button } from '../../../shared/components/ui/button/button';
import { ErrorState } from '../../../shared/components/ui/error-state/error-state';
import { Progress } from '../../../shared/components/ui/progress/progress';
import { Spinner } from '../../../shared/components/ui/spinner/spinner';
import {
  PlayerMode,
  VideoConfig,
  VideoJs,
  VideoSource,
} from '../../../shared/components/video-js/video-js';
import { ASSESSMENT_ROUTES } from '../../../shared/core/models/assessment.model';
import { AriaSelectOption } from '../../../shared/core/models/aria.model';
import { ContentDetails } from '../../../shared/core/models/course.model';
import { SKIP_ERROR_NOTIFICATION } from '../../../shared/core/models/http.model';
import {
  ActionStatus,
  deriveActionStatus,
  isReelCompleted,
} from '../../../shared/core/models/micro-learning-course.model';
import { DurationPipe } from '../../../shared/core/pipes/duration/duration-pipe';
import { TotalCpeCreditsPipe } from '../../../shared/core/pipes/total-cpe-credits/total-cpe-credits.pipe';
import { AiLabsAuth } from '../../../shared/core/services/ai-labs-auth/ai-labs-auth';
import { ApiClient } from '../../../shared/core/services/api-client/api-client';
import { Auth } from '../../../shared/core/services/auth/auth';
import { NotificationService } from '../../../shared/core/services/notification/notification';
import { Utils } from '../../../shared/core/services/utils/utils';
import { MicroLearningCourseFacade } from '../../../features/offerings/shared/services/micro-learning-course-facade/micro-learning-course-facade';
import { setupCourseSeo } from '../../../shared/utils/seo/course-seo-setup';
import {
  AiLabAgent,
  AiLabAgentsResponse,
  AiLabAssignmentStatus,
  AiLabLabStatus,
} from '../ai-labs.model';
import { AiLabSubmission } from '../ai-lab-submission';
import { AiLabCourseSkeleton } from '../../../shared/components/skeleton/ai-lab-course-skeleton/ai-lab-course-skeleton';

/** CTA stages that sit past the chapter quiz — reaching any of them means it's behind the learner. */
const QUIZ_BEHIND = new Set<ActionStatus>([
  ActionStatus.TAKE_EXAM,
  ActionStatus.RETAKE_EXAM,
  ActionStatus.FEEDBACK,
  ActionStatus.DOWNLOAD,
]);

/**
 * One AI Lab course, end to end: watch the video, pass the final assessment,
 * then build an agent in Copilot Studio and submit it for evaluation — without
 * leaving AI Labs.
 *
 * An AI Lab course is a nano-learning row that reports `course_type: 'ai_lab'`,
 * so the data layer is the micro-learning flow in a landscape frame: same
 * `MicroLearningCourseFacade` (route-scoped), same `action_status` CTA state
 * machine, same activity tracking. What differs is the layout and the lab step
 * wedged between the exam and the feedback / certificate tail.
 *
 * FOUR-STEP COMPLETION — watch → quiz → final assessment → AI Lab. The first
 * three come off the course payload; the fourth is `ai-lab/assignments/status/`,
 * read on load, after a submit, and on demand from the section's refresh
 * button — never on a timer. The lab opens only on `Exam_Passed`, and
 * feedback / certificate open only once the lab reports `completed`.
 *
 * ONE request, `v2/micro-learning/details/?id=`, is meant to drive the page:
 * it carries the CPE / assessment state and is handed to
 * `facade.initForCourse(id, details)`, which seeds the reel from it. Until the
 * serializer also sends `video_url` / `chapter_id` / a real `total_duration`,
 * the facade falls back to the `v2/nano-learning/:id/` anchor for those and
 * merges the details on top — see `canSeedReel` in the facade.
 */
@Component({
  selector: 'app-ai-lab-course',
  imports: [
    AiLabCourseSkeleton,
    AriaSelect,
    Backward,
    Button,
    DatePipe,
    DurationPipe,
    ErrorState,
    NgIcon,
    Progress,
    RouterLink,
    Spinner,
    TotalCpeCreditsPipe,
    VideoJs,
  ],
  templateUrl: './ai-lab-course.html',
  // `fluid: false` hands sizing to CSS, so the player needs to be told to fill
  // the 16:9 frame; `contain` then letterboxes a portrait source inside it.
  styles: `
    /* video.js writes width/height inline when \`fluid\` is off, so these have
       to win with !important — same override the reel card needs. */
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    provideIcons({
      matPlayArrowRound,
      lucideArrowUpRight,
      lucideCheck,
      lucideDownload,
      lucideLock,
      lucidePause,
      lucideRefreshCw,
    }),
  ],
})
export class AiLabCourse {
  /** Route params, via `withComponentInputBinding`. */
  readonly courseId = input<string>();
  readonly courseTitle = input<string>();

  protected readonly facade = inject(MicroLearningCourseFacade);
  /** The Entra session behind Copilot Studio — distinct from the Miles session below. */
  protected readonly labsAuth = inject(AiLabsAuth);
  private readonly milesAuth = inject(Auth);
  private readonly apiClient = inject(ApiClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly submission = inject(AiLabSubmission);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly utils = inject(Utils);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Course-level payload (`v2/micro-learning/details/`) — feeds the lower sections. */
  protected readonly details = signal<ContentDetails | null>(null);
  /** The details request is in flight — the page's first request, so it gates the skeleton. */
  protected readonly detailsLoading = signal(false);

  protected readonly PlayerMode = PlayerMode;

  /** What the learner does in the lab. Fixed copy — every AI Lab course runs the same three moves. */
  protected readonly labSteps: readonly string[] = [
    'Launch AI to open Copilot Studio in a new tab',
    'Build and publish your agent for this course',
    'Refresh the list below, pick your agent and submit it for evaluation',
  ];

  /** NASBA's three conditions for releasing credit. Fixed copy, not API data. */
  protected readonly cpeRequirements: readonly string[] = [
    'Complete all videos and chapter quizzes',
    'Complete the final exam within one year of starting the course',
    'Score 70% or higher on the final exam',
  ];

  /** The anchored course. The facade calls it `courseDetails` (the active reel). */
  protected readonly course = this.facade.courseDetails;

  /** The player, for the hero's play / pause and the facade's rewatch request. */
  private readonly player = viewChild(VideoJs);
  protected readonly playing = signal(false);

  protected readonly completed = computed(() => {
    const reel = this.course();
    return !!reel && isReelCompleted(reel);
  });

  /** Percentage watched — drives the progress bar under the player. */
  protected readonly progress = computed(() => {
    const reel = this.course();
    const duration = reel?.total_duration ?? 0;
    if (!reel || duration <= 0) return 0;
    return Math.min(100, Math.round(((reel.last_activity ?? 0) / duration) * 100));
  });

  protected readonly videoSources = computed<VideoSource[]>(() => {
    const url = this.course()?.video_url;
    if (!url) return [];
    const isHls = url.toLowerCase().endsWith('.m3u8');
    return [{ src: url, type: isHls ? 'application/x-mpegURL' : 'video/mp4' }];
  });

  /**
   * CPE mode locks the seekbar and the speed menu until the course is watched
   * through; Preview mode is an ordinary player. Same rule as the reel card.
   */
  protected readonly playerMode = computed<PlayerMode>(() => {
    const inCpe = !!this.course()?.cpe_mode_details?.cpe_mode;
    return inCpe && !this.completed() ? PlayerMode.CPE : PlayerMode.DEFAULT;
  });

  protected readonly videoConfig = computed<VideoConfig>(() => ({
    controls: true,
    autoplay: false,
    // AI Lab videos come from the reel library, so the source can be portrait
    // (720x1280) even though the artwork is landscape. `fluid` would size the
    // player to the source and blow the 16:9 frame open, so size it from the
    // frame instead and let the tech letterbox inside — works either way.
    fluid: false,
    responsive: false,
    // Never loop: `ended` has to fire so the post-video flow (quiz → exam) can
    // open. The reel card loops because it's a feed; a course page isn't.
    loop: false,
    poster: this.course()?.horizontal_thumbnail || this.course()?.thumbnail || undefined,
    preload: 'auto',
  }));

  /**
   * The single CTA. Its label is the server-pushed `action_status` (with the
   * feedback/certificate tail derived locally), and the click hands straight
   * back to the facade — the same dispatcher the reel card uses, so an AI Lab
   * course can't drift out of step with a reel.
   */
  protected readonly ctaStage = computed(() => {
    const reel = this.course();
    return reel ? deriveActionStatus(reel) : null;
  });

  /** Feedback gets the amber treatment every other course hero gives it. */
  protected readonly feedbackCta = computed(() => this.ctaStage() === ActionStatus.FEEDBACK);
  protected readonly feedbackClass = computed(() =>
    this.feedbackCta() ? 'text-black rounded-lg bg-amber-400' : '',
  );

  /**
   * No stage yet in CPE mode means "keep watching". The facade's dispatcher
   * has nothing to do with that here — on the reel feed playback follows the
   * scroll, on this page it follows this button — so it drives the player.
   */
  protected readonly playbackCta = computed(
    () => !!this.course()?.cpe_mode_details?.cpe_mode && this.ctaStage() === null,
  );

  protected readonly playbackLabel = computed(() => {
    if (this.playing()) return 'Pause';
    return this.progress() > 0 ? 'Resume' : 'Play';
  });

  protected togglePlayback(): void {
    this.player()?.togglePlay();
  }

  protected readonly ctaLabel = computed(() => {
    const reel = this.course();
    if (!reel) return 'Play';
    switch (this.ctaStage()) {
      case ActionStatus.TAKE_QUIZ:
        return 'Take Quiz';
      case ActionStatus.TAKE_EXAM:
        return 'Take Final Assessment';
      case ActionStatus.RETAKE_EXAM:
        return 'Retake Final Assessment';
      case ActionStatus.FEEDBACK:
        return 'Submit Feedback';
      case ActionStatus.DOWNLOAD:
        return 'Download Certificate';
      case ActionStatus.REWATCH:
        return 'Rewatch';
    }
    return reel.cpe_mode_details?.cpe_mode ? 'Continue' : 'Watch in CPE Mode';
  });

  /**
   * Downloadable / linkable lab material carried by the course payload.
   *
   * ponytail: links only. The masterclass resources block also offers exercise
   * files and the AI kit, but both dispatch through `MasterclassFacade`
   * (`downloadExerciseFiles` / `openAdditionalResources`), which this route
   * doesn't provide — it provides `MicroLearningCourseFacade`, which has no
   * equivalent. Wire those in by adding the two methods to the micro-learning
   * facade; until then a course with only `has_exercise_files` shows no block
   * rather than a button that can't do anything.
   */
  protected readonly labMaterials = computed(() => {
    const d = this.details();
    if (!d) return [];
    return [
      { label: 'Course navigation', hint: 'Walkthrough video', url: d.navigation_link },
      { label: 'Glossary', hint: 'Terms used in this lab', url: d.glossary_doc },
      { label: 'Sample', hint: 'Worked example', url: d.sample_link },
    ].filter((m): m is { label: string; hint: string; url: string } => !!m.url);
  });

  // ---------------------------------------------------------------------------
  // Theater mode — collapses the hero's two columns onto one so the player runs
  // full width. Pure layout, so it's a plain signal with no persistence.
  // ---------------------------------------------------------------------------
  protected readonly theater = signal(false);

  protected toggleTheater(): void {
    this.theater.update((on) => !on);
  }

  // ---------------------------------------------------------------------------
  // Gates. watch → quiz → exam → lab, each read off the payload, plus the lab's
  // own evaluation state below.
  // ---------------------------------------------------------------------------

  protected readonly examPassed = computed(
    () => this.course()?.user_assessment_details?.status === 'Exam_Passed',
  );

  /**
   * The quiz is behind the learner once the CTA has moved past it. Read off the
   * stage rather than `quiz_details`, which isn't on the reel until the quiz is
   * opened. A course with no quiz flips here the moment the exam is reachable.
   */
  protected readonly quizDone = computed(() => {
    const reel = this.course();
    if (!reel) return false;
    const stage = deriveActionStatus(reel);
    return this.examPassed() || (stage !== null && QUIZ_BEHIND.has(stage));
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

  /** The lab opens only on a passed exam. Everything in the section stays readable while locked. */
  protected readonly labUnlocked = this.examPassed;

  // ---------------------------------------------------------------------------
  // The learner's agents. Listed as soon as the exam is passed — the lab is
  // open from then on — and re-listed from the Refresh button after the
  // learner has built one in Copilot Studio. Browser only, like the status read.
  // ---------------------------------------------------------------------------

  protected readonly agentsRes = resource({
    params: () =>
      this.isBrowser && this.labUnlocked() ? { courseId: this.course()?.id } : undefined,
    loader: ({ abortSignal }) =>
      firstValueFrom(
        this.submission.listAgents().pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: { is_provisioned: true, agents: [] } as AiLabAgentsResponse },
      ),
  });

  /** `value()` throws on an errored resource — guard, and let the template branch on `error()`. */
  protected readonly agents = computed<AiLabAgent[]>(() =>
    this.agentsRes.hasValue() ? this.agentsRes.value().agents : [],
  );

  /** False while the learner's Copilot environment is still being created. */
  protected readonly labProvisioned = computed(
    () => !this.agentsRes.hasValue() || this.agentsRes.value().is_provisioned,
  );

  /**
   * Keyed by `id`, not `envId`: every agent sits in the one shared Miles lab
   * environment, so `envId` is the same string for all of them.
   */
  protected readonly agentOptions = computed<AriaSelectOption<string>[]>(() =>
    this.agents().map((a) => ({ value: a.id, label: a.name })),
  );

  /** The pick survives a Refresh while the agent still exists, and clears if it vanished. */
  protected readonly agentId = linkedSignal<AiLabAgent[], string | null>({
    source: this.agents,
    computation: (list, prev) => {
      const id = prev?.value ?? null;
      return id !== null && list.some((a) => a.id === id) ? id : null;
    },
  });

  protected readonly selectedAgent = computed(
    () => this.agents().find((a) => a.id === this.agentId()) ?? null,
  );

  // ---------------------------------------------------------------------------
  // Submission + evaluation. `assignment` mirrors the status endpoint, re-read
  // only when the learner asks (refresh button) or after a submit.
  // ---------------------------------------------------------------------------

  protected readonly assignment = signal<AiLabAssignmentStatus | null>(null);
  protected readonly submitting = signal(false);
  /** A status read is in flight — spins the refresh icon and blocks a second click. */
  protected readonly statusLoading = signal(false);

  protected readonly phase = computed<AiLabLabStatus>(
    () => this.assignment()?.lab_status ?? 'not_started',
  );

  /**
   * A submission exists on the server. `submission_id` is the proof — not
   * `lab_status`, which the backend can report as `in_progress` for a lab the
   * learner has merely opened. `not_started` never carries an id.
   */
  protected readonly hasSubmission = computed(() => !!this.assignment()?.submission_id);

  /** Submitted and still with the evaluator. */
  protected readonly evaluating = computed(
    () => this.hasSubmission() && this.phase() === 'in_progress',
  );

  /**
   * ponytail: `completed` alone counts — no pass mark was specified for the
   * lab. Gate on `percentage >= 70` here if one is.
   */
  protected readonly labDone = computed(() => this.phase() === 'completed');

  /**
   * Feedback and the certificate wait for the lab: while this holds, the CTAs
   * that would dispatch FEEDBACK / DOWNLOAD point at the lab instead.
   */
  protected readonly postLabLocked = computed(() => this.examPassed() && !this.labDone());

  /**
   * An attempt is with the evaluator (or already scored). The picker stays on
   * screen showing what was sent, but nothing about it can be changed.
   */
  protected readonly alreadySubmitted = computed(() => this.evaluating() || this.labDone());

  /**
   * Everything the picker can't do right now: no pick, a POST in flight, the
   * status read that follows it, or an attempt already on record.
   */
  protected readonly pickerLocked = computed(
    () => this.submitting() || this.statusLoading() || this.alreadySubmitted(),
  );

  protected readonly submitDisabled = computed(() => !this.selectedAgent() || this.pickerLocked());

  /** Which panel section 03 shows — `in_progress` only counts once something was submitted. */
  protected readonly evaluationView = computed<AiLabLabStatus>(() => {
    if (this.labDone()) return 'completed';
    if (this.evaluating()) return 'in_progress';
    return this.phase() === 'error' ? 'error' : 'not_started';
  });

  /** The picker block shows once the agents have been asked for. */
  protected readonly pickerOpen = computed(() => this.agentsRes.status() !== 'idle');

  /** Steps cleared of the four the sub-bar tracks: watch → quiz → exam → lab. */
  protected readonly stepsDone = computed(
    () =>
      [this.completed(), this.quizDone(), this.examPassed(), this.labDone()].filter(Boolean).length,
  );

  protected readonly stepsPercent = computed(() => (this.stepsDone() / 4) * 100);

  protected readonly launchLabel = computed(() => {
    if (this.labsAuth.restoring()) return 'Checking sign-in…';
    if (this.labsAuth.signingIn()) return 'Signing in…';
    return this.labsAuth.isSignedIn() ? 'Launch AI' : 'Sign in & launch AI';
  });

  /** What is standing between the learner and the exam, said at the exam card. */
  protected readonly finalHint = computed(() => {
    if (!this.completed()) return 'Finish the video first.';
    if (!this.examPassed()) return 'Pass the assessment to unlock the AI Lab.';
    if (!this.labDone())
      return 'Passed — complete the AI Lab below, then leave feedback and download your certificate.';
    return 'All done — leave feedback, then download your certificate.';
  });

  /** Status line under the agent picker. */
  protected readonly labHint = computed(() => {
    if (this.labDone()) return 'Submitted and evaluated — your scores are below.';
    if (this.evaluating()) return 'Submitted — the evaluation is running.';
    const agent = this.selectedAgent();
    return agent ? `Ready to submit ${agent.name}.` : 'Select the agent to submit.';
  });

  protected readonly heroHint = computed(() => {
    if (!this.completed()) {
      const pct = this.progress();
      return pct > 0
        ? `${pct}% viewed — finish the video, then take the final assessment.`
        : 'Credit is recorded only for sessions started in CPE Mode.';
    }
    if (!this.examPassed())
      return 'Video complete — pass the final assessment to unlock the AI Lab.';
    if (!this.labDone())
      return 'Assessment passed — submit your AI Lab agent to unlock feedback and your certificate.';
    return 'AI Lab evaluated — leave feedback, then download your certificate.';
  });

  constructor() {
    setupCourseSeo({
      kind: 'aiLab',
      courseTitle: this.courseTitle,
      courseDetails: this.facade.courseDetails,
    });

    effect(() => {
      const id = Number(this.courseId());
      if (!id) return;
      untracked(() => {
        this.facade.resetActivityTracking();
        this.loadDetails(id);
      });
    });

    // REWATCH resets the reel's progress in the facade and asks the player to
    // start over — the reel card listens for the same token.
    effect(() => {
      const request = this.facade.rewatchRequest();
      const player = this.player();
      if (!request || !player || request.id !== this.course()?.id) return;
      untracked(() => {
        player.seek(0, true);
        player.play();
      });
    });

    // Rehydrate the Entra session from storage, as the landing page does. A
    // direct load / refresh of this page is otherwise a signed-out page: the
    // root service only knows about a session once someone asks it to look.
    void this.labsAuth.restoreSession();

    this.destroyRef.onDestroy(() => this.facade.clear());
  }

  /**
   * Jump to the lab section.
   *
   * A plain `<a href="#lab">` cannot be used here: changing the fragment makes
   * the router re-resolve the URL, it fails to match, and the `**` catch-all
   * lands the learner on /home — it navigates away from the course entirely.
   * `section-nav.scrollToSection()` avoids this the same way, with a button and
   * an explicit `window.scrollTo`. The 128px offset matches `scroll-mt-32`.
   */
  protected scrollToLab(): void {
    const el = this.document.getElementById('lab');
    if (!el) return;
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - 128,
      behavior: 'smooth',
    });
  }

  /**
   * Launch AI: open Copilot Studio. The agent list is not tied to this click —
   * it loads with the lab and re-lists from the Refresh button.
   *
   * Same tail as the landing page's `activate()` — Entra signed in → launch,
   * else sign in — minus the Miles login / plan gates, which passing a CPE exam
   * already implies. No `await` before `launchCopilot`: `window.open` only
   * survives inside the click's own gesture, so a signed-out learner signs in
   * on this click and launches on the next (the label says which).
   *
   * Account provisioning (agreement → POST → check-your-email → resend) lives
   * on the landing hero and isn't duplicated here — a learner without a lab
   * account is sent there.
   */
  protected launchAi(): void {
    if (this.labsAuth.isSignedIn()) {
      this.labsAuth.launchCopilot();
      return;
    }
    if (this.milesAuth.currentUser()?.is_ai_lab_user !== true) {
      this.notification.info(
        'Activate AI Lab',
        'Accept the participant agreement on the AI Labs page to create your lab account.',
      );
      void this.router.navigate(['/', this.utils.country(), this.utils.profession(), 'ai-labs']);
      return;
    }
    void this.labsAuth.signIn();
  }

  protected refreshAgents(): void {
    this.agentsRes.reload();
  }

  /** Submit the picked agent for this course and start watching the evaluation. */
  protected submitAssignment(): void {
    const reel = this.course();
    const agent = this.selectedAgent();
    if (!reel || !agent || this.submitDisabled()) return;

    this.submitting.set(true);
    this.submission
      .submitAssignment({
        course_id: reel.id,
        agent_env_id: agent.envId,
        agent_schema: agent.schemaName,
      })
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          // The POST body isn't relied on — the status read that follows is the
          // truth, and `pickerLocked` covers the gap until it lands.
          this.notification.success('Submitted', 'Evaluation started.');
          this.refreshStatus(reel.id);
        },
        // Errors are already toasted by the interceptor.
      });
  }

  /** Back to the picker for another attempt — after a failed evaluation, or to better a score. */
  /** Re-open the picker after a failed evaluation. A scored attempt is final. */
  protected resubmit(): void {
    this.assignment.set({ lab_status: 'not_started' });
    this.agentsRes.reload();
  }

  /**
   * One read of the evaluation status — on load with the exam passed, after a
   * submit, and from the section's refresh button. Deliberately no timer: the
   * backend doesn't want to be polled, so the learner refreshes when they're
   * ready. Browser only, the course route is server-rendered.
   */
  protected refreshStatus(courseId = this.course()?.id): void {
    if (!this.isBrowser || courseId === undefined || this.statusLoading()) return;
    this.statusLoading.set(true);
    this.submission
      .assignmentStatus(courseId)
      .pipe(
        finalize(() => this.statusLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (status) => this.assignment.set(status),
        // The status call skips the global toast (it's silent on load), so a
        // click that fails has to say so itself.
        error: () =>
          this.notification.error('Evaluation', 'Could not fetch the status. Please try again.'),
      });
  }

  /**
   * The course, off the details endpoint. The payload is handed to the facade,
   * which seeds the player from it — or, while the serializer lacks the video
   * fields, fetches the anchor row and merges this on top. Errors are silent
   * (`SKIP_ERROR_NOTIFICATION`) and drop to the anchor too, so the page still
   * plays without the lower sections.
   *
   * Also the restore point for the lab: on a passed exam the evaluation state
   * is read straight away, so a reload — or the trip back from the exam route,
   * which re-creates this component — picks up where the learner left off.
   */
  private loadDetails(id: number): void {
    this.details.set(null);
    this.detailsLoading.set(true);
    this.apiClient
      .get<{ data: ContentDetails }>(
        ASSESSMENT_ROUTES.getCourseDetails.path.replace(':course_type', 'micro-learning'),
        { params: { id }, context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) },
      )
      .pipe(
        finalize(() => this.detailsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          const d = res?.data;
          if (!d) {
            this.facade.initForCourse(id);
            return;
          }
          // Same normalisation every other about-block caller does — the API
          // ships one `\r\n`-joined string, the component wants a list.
          d.learning_objective_list = (d.learning_objectives ?? '').split('\r\n').filter(Boolean);
          // An AI Lab course is a single chapter — its `chapter_id` — and the
          // details serializer doesn't send a count, which would render "0
          // Chapter" in the stats strip.
          d.no_of_chapters ||= 1;
          this.details.set(d);
          this.facade.initForCourse(id, d);
          // Read off the payload, not `examPassed()`: on the anchor fallback the
          // reel isn't there yet and the merge is still pending.
          if (d.user_assessment_details?.status === 'Exam_Passed') this.refreshStatus(id);
        },
        error: () => this.facade.initForCourse(id),
      });
  }
}
