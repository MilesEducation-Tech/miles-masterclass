import { isPlatformBrowser, Location } from '@angular/common';
import { HttpContext, HttpErrorResponse, httpResource } from '@angular/common/http';
import {
  computed,
  DOCUMENT,
  effect,
  inject,
  Injector,
  linkedSignal,
  PLATFORM_ID,
  Service,
  Signal,
  signal,
  untracked,
} from '@angular/core';
import { Router, UrlSegment } from '@angular/router';
import { NgpDialogManager, NgpDialogRef } from 'ng-primitives/dialog';
import { firstValueFrom } from 'rxjs';
import { SKIP_ERROR_NOTIFICATION, SKIP_LOADING } from '@core/models/http.model';
import { ApiClient, apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { SUBSCRIPTION_DIALOG } from '@core/services/dialog/feature-dialog-tokens';
import { Logger } from '@core/services/logger/logger';
import { MasterclassBookmarks } from '@core/services/masterclass-bookmarks/masterclass-bookmarks';
import { NotificationService } from '@core/services/notification/notification';
import { withPreviousValue } from '@core/utils/with-previous-value';
import { VideoSource } from '@shared/components/video-js/video-js';
import { detectVideoMimeType, Utils } from '@shared/services/utils';
import {
  CERTIFICATE_COPY,
  CHAPTER_COPY,
  COURSE_DETAIL_API,
  COURSE_DETAIL_CHAPTERS_PAGE_SIZE,
  COURSE_ID_PATTERN,
  PROGRESS_SAVE_INTERVAL_SECONDS,
  SEEK_JUMP_SECONDS,
} from '@features/offerings/constants/course-detail';
import {
  REEL_ACCESS_COPY,
  REEL_COURSE_MODE_ROUTE,
  REEL_COURSE_TYPES,
  REEL_MODE_COPY,
  REEL_PLAYER_COPY,
  REEL_PROGRESS_CLEARED,
  REEL_STEP_COPY,
  REEL_STEP_LABELS,
  REELS_FEED_PAGE_SIZE,
  REELS_FEED_URL,
} from '@features/offerings/constants/reels';
import {
  ChapterProgressTracker,
  CourseMode,
  CourseProgressUpdate,
  MasterclassCourseDetail,
  parseAboutCourseId,
  parseChapterStart,
  parseCourseDetail,
  parseCourseProgress,
  readCourseStepRefusal,
} from '@features/offerings/models/course-detail.model';
import { MicroLearningOptionId } from '@features/offerings/models/micro-learning-course.model';
import {
  MicroLearningQuizDialogData,
  parseCourseModeResult,
  parseReelAnchor,
  parseReelFeed,
  Reel,
  ReelAccess,
  ReelButtonAction,
  ReelFeedPage,
  ReelPendingStep,
  ReelRequest,
  ReelRouteParams,
  ReelStep,
  ReelUserState,
} from '@features/offerings/models/reel.model';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';
import { FinalAssessmentFacade } from '@features/offerings/services/final-assessment-facade';
// Type-only: both dialogs load with `import()` when opened (AGENTS.md §4.4).
import type { HtmlContentDialogData } from '@features/offerings/dialogs/html-content-dialog/html-content-dialog';

/** Window (ms) after a programmatic scroll during which scroll events are ignored. */
const PROGRAMMATIC_SCROLL_DEBOUNCE_MS = 600;

/** A 404 for a reel the feed doesn't show, or a 400 for a malformed id or slug. */
const isMissing = (error: unknown): boolean =>
  error instanceof HttpErrorResponse && (error.status === 404 || error.status === 400);

/** The positions a save sends, so the same ones aren't sent twice. */
const saveKey = (update: CourseProgressUpdate): string =>
  `${update.last_watched_position_seconds}/${update.max_watched_duration_seconds}`;

/**
 * The reel player, on the web API's reel feed. The page `connect()`s it to the
 * reel in its URL; the feed opens on that reel (`reels-feed/<uuid>/`), and
 * scrolling to the end reads the next page. A reel carries the learner's state
 * on it, so what plays is decided from the reel itself: the server's
 * `course_is_locked` strips the stream, and the player then plays the trailer
 * with a sign-in (signed out) or subscribe (signed in) button. Signing in
 * re-reads the feed as `post_login`, so a reel the learner may watch unlocks in
 * place.
 *
 * A reel the learner may watch is tracked as the chapter page tracks a
 * chapter: `chapter-start/` on its first play (and Preview when it has no mode
 * yet), then `course-progress-update/` as it plays. "Watch in CPE mode" posts
 * `course-mode/`; in CPE mode the button follows the server's next step
 * (`action_status`), re-read once a reel is watched to its end.
 *
 * The steps after a reel are the course pages' own: the chapter quiz in a
 * pop-up over the player, and the final assessment, its report and the course
 * evaluation on the pages under the reel. The reel's route provides the course
 * read and the final assessment they share; this facade connects that read to
 * a reel only when a step needs it.
 *
 * Route-scoped: the player's route lists it in `providers`. The page and the
 * reel cards inject it, read its signals and call its methods; none of them
 * calls the API.
 */
@Service({ autoProvided: false })
export class MicroLearningCourseFacade {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthSession);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly subscriptionDialog = inject(SUBSCRIPTION_DIALOG);
  private readonly bookmarks = inject(MasterclassBookmarks);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly utils = inject(Utils);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  // From the reel's route, shared with the exam, report and evaluation pages.
  private readonly detail = inject(CourseDetailFacade);
  private readonly assessment = inject(FinalAssessmentFacade);

  // ─── The reel in the URL ──────────────────────────────────────────────────

  /** The reel the page opened on, as a signal; `null` until `connect()`. */
  private readonly params = signal<Signal<ReelRouteParams> | null>(null);

  private readonly routeId = computed(() => {
    const id = this.params()?.().courseId;
    return id && COURSE_ID_PATTERN.test(id) ? id : null;
  });

  /** An old numeric link (still in search results and shared links) is looked up by slug. */
  private readonly legacySlug = computed(() =>
    this.routeId() ? null : this.params()?.().slug || null,
  );

  private readonly unresolvable = computed(
    () => this.params() !== null && !this.routeId() && !this.legacySlug(),
  );

  /** The feed takes a UUID only, so an old link's slug asks `about-course/` for it first. */
  private readonly legacyIdResource = httpResource<string>(
    () => {
      const slug = this.legacySlug();
      return slug
        ? { url: apiUrl(COURSE_DETAIL_API.reels.aboutCourse), params: { slug } }
        : undefined;
    },
    { parse: parseAboutCourseId },
  );

  /** The reel the feed opens on. */
  private readonly openedId = computed(
    () =>
      this.routeId() ?? (this.legacyIdResource.hasValue() ? this.legacyIdResource.value() : null),
  );

  /** From the session's boolean, never the token, so a token rotation doesn't refetch. */
  private readonly loginType = computed(() =>
    this.auth.isAuthenticated() ? 'post_login' : 'pre_login',
  );

  /** What the feed is keyed on: a new reel, or signing in or out, starts it over. */
  private readonly feedKey = computed(() => `${this.openedId()}|${this.loginType()}`);

  private readonly feedParams = (page?: number) => ({
    login_type: this.loginType(),
    course_type: REEL_COURSE_TYPES.join(','),
    page_size: REELS_FEED_PAGE_SIZE,
    ...(page ? { page } : {}),
  });

  // ─── The feed ─────────────────────────────────────────────────────────────

  /**
   * The feed opened on the reel: that reel, then page 1 without it. `pre_login`
   * is public, so the SERVER reads it: the reel is in the SSR HTML and the
   * browser reuses it. `post_login` needs the learner's token, which lives in
   * the browser.
   */
  private readonly anchorResource = httpResource(
    () => {
      const id = this.openedId();
      if (!id) return undefined;
      if (!this.isBrowser && this.loginType() === 'post_login') return undefined;
      return { url: apiUrl(`${REELS_FEED_URL}${id}/`), params: this.feedParams() };
    },
    { parse: parseReelAnchor },
  );

  /** Holds the feed through a re-read (sign-in), so the player doesn't flash empty. */
  private readonly anchor = withPreviousValue(this.anchorResource);

  /** The feed page asked for beyond the first; 1 (none) until the learner nears the end. */
  private readonly requestedPage = linkedSignal({ source: this.feedKey, computation: () => 1 });

  private readonly pageResource = httpResource(
    () => {
      const page = this.requestedPage();
      if (page < 2 || !this.openedId()) return undefined;
      return { url: apiUrl(REELS_FEED_URL), params: this.feedParams(page) };
    },
    { parse: parseReelFeed },
  );

  /** The reels of the pages read after the first, in order; reset with the feed. */
  private readonly appended = linkedSignal<string, Reel[]>({
    source: this.feedKey,
    computation: () => [],
  });

  /** The last page read, and whether there is another. */
  private readonly lastPage = linkedSignal<
    ReelFeedPage | undefined,
    Pick<ReelFeedPage, 'page' | 'hasNext'>
  >({
    source: () => (this.anchor.hasValue() ? this.anchor.value().rest : undefined),
    computation: (rest) => ({ page: rest?.page ?? 1, hasNext: rest?.hasNext ?? false }),
  });

  private readonly appendPage = effect(() => {
    if (!this.pageResource.hasValue()) return;
    const page = this.pageResource.value();
    untracked(() => {
      this.appended.update((reels) => [...reels, ...page.reels]);
      this.lastPage.set({ page: page.page, hasNext: page.hasNext });
    });
  });

  /**
   * The learner's state as this visit changed it (a mode switch, a save, a
   * re-read), ahead of the next feed read; reset with the feed.
   */
  private readonly stateOverrides = linkedSignal<
    string,
    ReadonlyMap<string, Partial<ReelUserState>>
  >({
    source: this.feedKey,
    computation: () => new Map(),
  });

  /**
   * Every reel read so far: the one opened on first, each with the state this
   * visit changed. A later page can repeat a reel (the anchor's page leaves it
   * out, the plain feed doesn't), so each reel is listed once.
   */
  readonly reels = computed<Reel[]>(() => {
    if (!this.anchor.hasValue()) return [];
    const { anchor, rest } = this.anchor.value();
    const overrides = this.stateOverrides();
    const seen = new Set<string>();
    return [anchor, ...rest.reels, ...this.appended()]
      .filter((reel) => {
        if (seen.has(reel.id)) return false;
        seen.add(reel.id);
        return true;
      })
      .map((reel) => {
        const override = overrides.get(reel.id);
        return override ? { ...reel, user_state: { ...reel.user_state, ...override } } : reel;
      });
  });

  /** Change one reel's state on screen, ahead of the server's next answer. */
  private patchState(id: string, patch: Partial<ReelUserState>): void {
    this.stateOverrides.update((overrides) =>
      new Map(overrides).set(id, { ...overrides.get(id), ...patch }),
    );
  }

  /** The reel as it stands now, with this visit's changes. */
  private current(id: string): Reel | undefined {
    return this.reels().find((reel) => reel.id === id);
  }

  readonly loading = computed(
    () => this.legacyIdResource.isLoading() || this.anchorResource.isLoading(),
  );

  /** No such reel: a URL that names none, or a 404 / 400 for its id or slug. */
  readonly notFound = computed(
    () =>
      this.unresolvable() ||
      isMissing(this.legacyIdResource.error()) ||
      isMissing(this.anchorResource.error()),
  );

  /** Any other failed read, a contract mismatch included; the page shows it with a retry. */
  readonly loadError = computed(() =>
    this.notFound() ? null : (this.legacyIdResource.error() ?? this.anchorResource.error() ?? null),
  );

  /** Follow the reel in the page's URL; called once, from the page's constructor. */
  connect(params: Signal<ReelRouteParams>): void {
    this.params.set(params);
    // Back from a page after the player (the exam, its report, feedback): what
    // happened there moved the reel's next step, which the feed doesn't know yet.
    this.returning.set(this.away);
    this.away = false;
  }

  /** The page came back after `leave()`: the reel in the URL is re-read once the feed is in. */
  private readonly returning = signal(false);

  private readonly refreshOnReturn = effect(() => {
    const id = this.openedId();
    if (!this.returning() || !id || this.anchorResource.isLoading()) return;
    const reel = this.reels().find((item) => item.id === id);
    if (!reel) return;
    untracked(() => {
      this.returning.set(false);
      void this.refreshReel(reel);
    });
  });

  reload(): void {
    if (this.legacyIdResource.error()) this.legacyIdResource.reload();
    else this.anchorResource.reload();
  }

  /** Read the next page; the page calls it as the learner nears the end. */
  loadNextPage(): void {
    if (this.pageResource.isLoading()) return;
    if (this.pageResource.error()) {
      this.pageResource.reload();
      return;
    }
    const { page, hasNext } = this.lastPage();
    if (hasNext) this.requestedPage.set(page + 1);
  }

  // ─── The reel on screen ───────────────────────────────────────────────────

  private readonly selectedId = linkedSignal(() => this.openedId());

  readonly activeIndex = computed(() => {
    const index = this.reels().findIndex((reel) => reel.id === this.selectedId());
    return index >= 0 ? index : 0;
  });

  readonly activeReel = computed<Reel | null>(() => this.reels()[this.activeIndex()] ?? null);

  /** The page scrolls a reel into view when this changes. */
  readonly scrollRequest = signal<ReelRequest | null>(null);

  /** A reel's card restarts it from the beginning when this names it (CPE switch, Rewatch). */
  readonly restartRequest = signal<ReelRequest | null>(null);

  private requestToken = 0;

  /** When a programmatic scroll started, so the scroll it causes doesn't re-select. */
  private lastProgrammaticScrollAt = 0;

  /** Sound on by default; `VideoJs` swallows an autoplay the browser blocks. */
  readonly muted = signal(false);

  isActive(reel: Reel): boolean {
    return reel.id === this.activeReel()?.id;
  }

  /** The reel on screen and its neighbours mount a player, so a swipe starts at once. */
  isPreloaded(reel: Reel): boolean {
    const index = this.reels().findIndex((item) => item.id === reel.id);
    return index >= 0 && Math.abs(index - this.activeIndex()) <= 1;
  }

  toggleMute(): void {
    this.muted.update((muted) => !muted);
  }

  navigateToReel(id: string): void {
    if (!this.reels().some((reel) => reel.id === id)) return;
    this.selectedId.set(id);
    this.lastProgrammaticScrollAt = Date.now();
    this.scrollRequest.set({ id, token: ++this.requestToken });
    this.syncUrlToReel(id);
  }

  /** The page's scroll settled on a reel. Ignored right after a programmatic scroll. */
  onScrollSelect(id: string): void {
    if (Date.now() - this.lastProgrammaticScrollAt < PROGRAMMATIC_SCROLL_DEBOUNCE_MS) return;
    if (id === this.selectedId()) return;
    this.selectedId.set(id);
    this.syncUrlToReel(id);
  }

  // An old numeric link: once the feed answers, the URL carries the reel's UUID and slug.
  private readonly urlFromLegacyLink = effect(() => {
    if (this.routeId() || !this.anchor.hasValue()) return;
    const id = this.anchor.value().anchor.id;
    untracked(() => this.syncUrlToReel(id));
  });

  /**
   * Put the reel's UUID and slug in the URL's last two segments.
   * `Location.replaceState` bypasses the router, so the route's inputs (and so
   * the feed) stay put; a refresh or a shared link opens on this reel.
   */
  private syncUrlToReel(id: string): void {
    const reel = this.reels().find((item) => item.id === id);
    if (!reel || !this.isBrowser) return;
    const tree = this.router.parseUrl(this.router.url);
    const primary = tree.root.children['primary'];
    const segments = primary?.segments ?? [];
    if (!primary || segments.length < 2) return;
    primary.segments = segments.map((segment, index) => {
      if (index === segments.length - 2) return new UrlSegment(reel.id, segment.parameters);
      if (index === segments.length - 1) return new UrlSegment(reel.slug, segment.parameters);
      return segment;
    });
    this.location.replaceState(this.router.serializeUrl(tree));
  }

  /** The reel's own page: what sign-in returns to and what share sends. */
  private reelPath(reel: Reel): string {
    return `/${this.utils.country()}/${this.utils.profession()}/${COURSE_DETAIL_API.reels.urlSegment}/${reel.id}/${reel.slug}`;
  }

  // ─── Access ───────────────────────────────────────────────────────────────

  /** Decided by the server: `course_is_locked` is set signed out and without an entitlement. */
  access(reel: Reel): ReelAccess {
    if (!this.auth.isAuthenticated()) return 'guest';
    return reel.user_state.course_is_locked ? 'locked' : 'open';
  }

  /** What the overlay over a locked reel says; `null` when the learner may watch it. */
  accessCopy(reel: Reel): (typeof REEL_ACCESS_COPY)[keyof typeof REEL_ACCESS_COPY] | null {
    const access = this.access(reel);
    return access === 'open' ? null : REEL_ACCESS_COPY[access];
  }

  /** The reel's stream when the learner may watch it, its trailer otherwise. */
  sources(reel: Reel): VideoSource[] {
    const url =
      this.access(reel) === 'open' ? reel.chapter.hls_video_url : reel.vertical_trailer_url;
    return url ? [{ src: url, type: detectVideoMimeType(url) }] : [];
  }

  /** The overlay's button: sign in and come back to this reel, or the subscription offer. */
  async unlock(reel: Reel): Promise<void> {
    if (this.access(reel) === 'guest') {
      void this.router.navigate(['/auth/login'], {
        queryParams: { redirect: this.reelPath(reel) },
      });
      return;
    }
    const SubscriptionDialog = await this.subscriptionDialog();
    this.dialogs.open(SubscriptionDialog);
  }

  // ─── The reel's button ────────────────────────────────────────────────────

  /**
   * What the reel's main button does: unlock a reel the learner can't watch;
   * switch one in Preview (or with no mode yet) to CPE; in CPE mode follow the
   * server's next step (`action_status`), else play and pause.
   */
  buttonAction(reel: Reel): ReelButtonAction {
    if (this.access(reel) !== 'open') return 'unlock';
    const { course_mode, action_status } = reel.user_state;
    if (course_mode !== 'cpe' || action_status === 'WATCH_IN_CPE_MODE') return 'cpe';
    if (action_status === 'REWATCH') return 'rewatch';
    return action_status ? 'step' : 'play';
  }

  /** The button's words; `null` for play / pause, which the card words from its player. */
  buttonLabel(reel: Reel): string | null {
    const action = this.buttonAction(reel);
    if (action === 'unlock') return this.accessCopy(reel)?.button ?? null;
    if (action === 'cpe') return REEL_STEP_LABELS.WATCH_IN_CPE_MODE;
    const status = reel.user_state.action_status;
    return action === 'play' || !status ? null : REEL_STEP_LABELS[status];
  }

  /** The button, for every action but play / pause (the card drives its own player). */
  onButton(reel: Reel): void {
    switch (this.buttonAction(reel)) {
      case 'unlock':
        void this.unlock(reel);
        return;
      case 'cpe':
        void this.switchToCpe(reel);
        return;
      case 'rewatch':
        this.restart(reel);
        return;
      case 'step':
        this.runStep(reel);
        return;
    }
  }

  /** The button waits: a mode switch, a step waiting for its course read, a sitting starting. */
  isBusy(reel: Reel): boolean {
    return (
      this.modePending() === reel.id ||
      this.pendingStep()?.reelId === reel.id ||
      (this.assessment.starting() && this.stepReel()?.id === reel.id)
    );
  }

  /** Play the reel from the beginning: its card seeks to 0 and plays. */
  private restart(reel: Reel): void {
    this.restartRequest.set({ id: reel.id, token: ++this.requestToken });
  }

  // ─── The steps after a reel ───────────────────────────────────────────────
  // The quiz and the exam are the course pages' own, on the course read and the
  // final assessment the reel's route provides. Feedback is a page under the
  // reel, and the certificate a link the feed already sends.

  /** The reel the course read follows: the last one a quiz or exam was asked on. */
  private readonly stepReel = signal<Reel | null>(null);

  private readonly stepParams = computed(() => {
    const reel = this.stepReel();
    return { courseId: reel?.id, slug: reel?.slug };
  });

  /** A quiz or exam asked, waiting for its reel's course read. */
  private readonly pendingStep = signal<ReelPendingStep | null>(null);

  /** The reel whose quiz is open over the player; its card pauses. */
  readonly quizOpenFor = signal<string | null>(null);

  private quizRef: NgpDialogRef | null = null;

  /** The server's next step, from the reel's button. */
  private runStep(reel: Reel): void {
    switch (reel.user_state.action_status) {
      case 'TAKE_QUIZ':
        this.askStep(reel, 'quiz');
        return;
      case 'TAKE_EXAM':
      case 'RETAKE_EXAM':
        this.askStep(reel, 'exam');
        return;
      case 'FEEDBACK':
        // Back to this reel after: the shared page's own redirect reads the
        // router's URL, which a swipe has left behind.
        void this.router.navigate([this.reelPath(reel), 'feedback'], {
          queryParams: { redirect: this.reelPath(reel) },
        });
        return;
      case 'DOWNLOAD':
        this.downloadCertificate(reel);
        return;
    }
  }

  /**
   * Read the reel's `course-detail/` for a quiz (its chapter) or the exam (its
   * rules), then run the step. Connected here rather than on load, so the player
   * never reads it unasked, and so it follows the player again after the exam
   * page connected it to its own URL. A second step on the same reel reads it
   * again: the feed and this read are two sources, and a stale mode or quiz
   * flag would close the quiz as soon as it opened.
   */
  private askStep(reel: Reel, step: ReelStep): void {
    if (this.pendingStep() || this.quizOpenFor()) return;
    this.detail.connect('reels', this.stepParams);
    if (this.stepReel()?.id === reel.id) this.detail.reload();
    else this.stepReel.set(reel);
    this.pendingStep.set({ reelId: reel.id, step });
  }

  private readonly runPendingStep = effect(() => {
    const pending = this.pendingStep();
    if (!pending || this.detail.isLoading()) return;
    const ready = this.detail.course()?.id === pending.reelId;
    const failed = !!this.detail.loadError() || this.detail.notFound();
    if (!ready && !failed) return;
    untracked(() => {
      this.pendingStep.set(null);
      const reel = this.current(pending.reelId);
      if (!ready || !reel) {
        const { title, body } = REEL_STEP_COPY.unavailable;
        this.notification.error(title, body);
      } else if (pending.step === 'quiz') {
        void this.openQuiz(reel);
      } else {
        // The rules, a sitting, then the exam page under the reel; a refusal toasts.
        void this.assessment.start();
      }
    });
  });

  /** The chapter quiz in a pop-up over the reel, opened with this route's injector. */
  private async openQuiz(reel: Reel): Promise<void> {
    if (this.quizOpenFor()) return;
    this.quizOpenFor.set(reel.id);
    try {
      const { MicroLearningQuizDialog } =
        await import('@features/offerings/micro-learning/dialogs/micro-learning-quiz-dialog/micro-learning-quiz-dialog');
      if (this.away) {
        this.quizOpenFor.set(null);
        return;
      }
      const ref = this.dialogs.open<MicroLearningQuizDialogData>(MicroLearningQuizDialog, {
        injector: this.injector,
        data: { chapterId: reel.chapter.id },
      });
      this.quizRef = ref;
      // However it closes (Watch again, on to the exam, ×, Esc), the reel's next step moved.
      ref.afterClosed.subscribe(() => {
        if (this.quizRef === ref) this.quizRef = null;
        this.quizOpenFor.set(null);
        void this.refreshReel(reel);
      });
    } catch (error) {
      this.logger.error('[MicroLearningCourse] quiz dialog failed to load', error);
      this.quizOpenFor.set(null);
      const { title, body } = REEL_STEP_COPY.unavailable;
      this.notification.error(title, body);
    }
  }

  /** The feed's certificate link, in a new tab inside the click so no popup blocker stops it. */
  private downloadCertificate(reel: Reel): void {
    const url = reel.user_state.certificate_url;
    if (url) {
      this.document.defaultView?.open(url, '_blank', 'noopener');
      return;
    }
    const { title, body } = CERTIFICATE_COPY.notReady;
    this.notification.info(title, body);
    void this.refreshReel(reel);
  }

  // ─── CPE / Preview ────────────────────────────────────────────────────────

  /** The reel whose mode switch is in flight; its button waits. */
  readonly modePending = signal<string | null>(null);

  /**
   * "Watch in CPE mode": one click, no picker. The server resets the reel's
   * progress, so it starts again from the beginning, as CPE mode requires.
   */
  private async switchToCpe(reel: Reel): Promise<void> {
    if (this.modePending()) return;
    if (!(await this.setMode(reel, 'cpe'))) return;
    const { title, body } = REEL_MODE_COPY.cpe;
    this.notification.success(title, body);
    this.restart(reel);
  }

  /**
   * `course-mode/`. Resolves whether the mode is now in force. A refusal
   * (`caira_enrollment_required` for CPE outside CAIRA, `course_mode_locked`)
   * shows the server's message, unless `silent`.
   */
  private async setMode(reel: Reel, mode: CourseMode, silent = false): Promise<boolean> {
    this.modePending.set(reel.id);
    const route = REEL_COURSE_MODE_ROUTE;
    try {
      const raw = await firstValueFrom(
        this.api.call(
          { ...route, path: route.path.replace(':id', reel.id) },
          { mode },
          silent ? { context: this.quiet() } : undefined,
        ),
      );
      const result = parseCourseModeResult(raw);
      this.patchState(reel.id, {
        course_mode: result.course_mode,
        ...(result.progress_reset ? REEL_PROGRESS_CLEARED : {}),
      });
      if (result.progress_reset) this.forgetProgress(reel.id);
      return true;
    } catch (error) {
      this.logger.error('[MicroLearningCourse] course-mode failed', error);
      if (!silent && !this.away) {
        const refusal = readCourseStepRefusal(error);
        const { title, body } = CHAPTER_COPY.modeNotChanged;
        this.notification.error(title, refusal.message ?? body);
      }
      return false;
    } finally {
      this.modePending.set(null);
    }
  }

  // ─── Progress ─────────────────────────────────────────────────────────────
  // The chapter page's rules (`CourseChapterFacade`): the playhead is the resume
  // point, the furthest point only grows while the video plays forward, and a
  // save goes every 15 s of play, on pause, at the end and on leaving.

  /** Reels whose `chapter-start/` answered in this visit: only their saves may go. */
  private readonly started = new Set<string>();

  /** `chapter-start/` in flight, per reel. */
  private readonly starting = new Set<string>();

  /** The playing reel's playhead and furthest point. */
  private tracker: (ChapterProgressTracker & { reelId: string }) | null = null;

  /** Saves waiting to go, per reel; a failed one waits for the next save. */
  private readonly unsent = new Map<string, CourseProgressUpdate>();
  private readonly failed = new Map<string, CourseProgressUpdate>();

  /** The positions last sent, per reel, so a repeat isn't sent twice. */
  private readonly lastSaved = new Map<string, string>();

  /** Reels already warned about, so a failing save warns once. */
  private readonly warned = new Set<string>();

  private draining: Promise<void> | null = null;

  /** The page has gone: saves still go, but no toast shows on whatever page is next. */
  private away = false;

  /**
   * The page is leaving: save where the learner stopped. Called from the page's
   * destroy, because this facade's route injector outlives the page, and the
   * player is torn down without a pause.
   */
  leave(): void {
    this.queueSave();
    this.tracker = null;
    this.away = true;
    // Dialogs don't close on navigation in this app; the quiz belongs to the player.
    this.quizRef?.close();
  }

  /** The player's clock. Only a reel the learner may watch is tracked; its first play starts it. */
  videoTime(reel: Reel, currentTime: number, duration: number): void {
    if (duration <= 0 || this.access(reel) !== 'open') return;
    void this.start(reel);
    const tracker = this.trackerFor(reel);
    const from = tracker.lastTime ?? currentTime;
    const step = currentTime - from;
    // A forward step under `SEEK_JUMP_SECONDS` is play; anything else is a seek,
    // which moves the resume point and nothing more.
    if (step > 0 && step < SEEK_JUMP_SECONDS) {
      if (from <= tracker.furthest + SEEK_JUMP_SECONDS) {
        tracker.furthest = Math.max(tracker.furthest, currentTime);
      }
      tracker.sincePlayedSave += step;
    }
    tracker.lastTime = currentTime;
    tracker.position = currentTime;
    if (tracker.sincePlayedSave >= PROGRESS_SAVE_INTERVAL_SECONDS) this.queueSave();
  }

  /** A pause, including the one when the reel leaves the screen. */
  videoPaused(reel: Reel): void {
    if (this.tracker?.reelId === reel.id) this.queueSave();
  }

  /**
   * The reel played to its end (CPE mode; Preview loops). The save goes first,
   * then the reel is re-read, so its button moves on to the server's next step.
   * When that step is the quiz and the reel is still on screen, the quiz opens,
   * as it does at the end of a chapter.
   */
  async videoEnded(reel: Reel): Promise<void> {
    if (this.tracker?.reelId !== reel.id) return;
    this.queueSave();
    await this.drain();
    await this.refreshReel(reel);
    const now = this.current(reel.id);
    if (!this.away && now && this.isActive(now) && now.user_state.action_status === 'TAKE_QUIZ') {
      this.askStep(now, 'quiz');
    }
  }

  /** Where the reel resumes: the saved playhead, unless it was watched to the end. */
  resumeAt(reel: Reel): number {
    const { last_watched_position_seconds, is_video_completed } = reel.user_state;
    return this.access(reel) === 'open' && !is_video_completed
      ? (last_watched_position_seconds ?? 0)
      : 0;
  }

  /**
   * The reel's first play in this visit: `chapter-start/` creates the
   * enrolment; a reel with no mode then starts in Preview, without a toast, as
   * reels always have. Saves wait for it.
   */
  private async start(reel: Reel): Promise<void> {
    if (this.started.has(reel.id) || this.starting.has(reel.id)) return;
    this.starting.add(reel.id);
    const route = COURSE_DETAIL_API.reels.chapterStart;
    try {
      const raw = await firstValueFrom(
        this.api.call({ ...route, path: route.path.replace(':id', reel.chapter.id) }, undefined, {
          context: this.quiet(),
        }),
      );
      if (parseChapterStart(raw).reset_required && !this.away) {
        const { title, body } = CHAPTER_COPY.enrolmentReset;
        this.notification.info(title, body);
        await this.refreshReel(reel);
      }
      this.started.add(reel.id);
      if (this.current(reel.id)?.user_state.course_mode === null) {
        await this.setMode(reel, 'preview', true);
      }
      void this.drain();
    } catch (error) {
      this.logger.error('[MicroLearningCourse] chapter-start failed', error);
      if (!this.away && !this.warned.has(reel.id)) {
        this.warned.add(reel.id);
        const refusal = readCourseStepRefusal(error);
        const { title, body } = CHAPTER_COPY.cannotStart;
        this.notification.error(title, refusal.message ?? body);
      }
    } finally {
      this.starting.delete(reel.id);
    }
  }

  /** The tracker for `reel`, from what the server has; switching reels saves the last one first. */
  private trackerFor(reel: Reel): ChapterProgressTracker & { reelId: string } {
    if (this.tracker?.reelId !== reel.id) {
      this.queueSave();
      const saved = this.current(reel.id)?.user_state ?? reel.user_state;
      this.tracker = {
        reelId: reel.id,
        chapterId: reel.chapter.id,
        position: saved.last_watched_position_seconds ?? 0,
        furthest: saved.max_watched_duration_seconds ?? 0,
        lastTime: null,
        sincePlayedSave: 0,
      };
    }
    return this.tracker;
  }

  /** A mode switch erased the reel's progress: start its tracker and saves over. */
  private forgetProgress(id: string): void {
    if (this.tracker?.reelId === id) this.tracker = null;
    this.unsent.delete(id);
    this.failed.delete(id);
    this.lastSaved.delete(id);
  }

  /** Queue the playing reel's positions, with any failed saves, then send what's queued. */
  private queueSave(): void {
    for (const [id, update] of this.failed) {
      if (!this.unsent.has(id)) this.unsent.set(id, update);
    }
    this.failed.clear();

    const tracker = this.tracker;
    if (tracker && tracker.position > 0) {
      // Whole seconds: the server's fields are integers.
      const update: CourseProgressUpdate = {
        chapter_id: tracker.chapterId,
        last_watched_position_seconds: Math.floor(tracker.position),
        max_watched_duration_seconds: Math.floor(tracker.furthest),
      };
      if (this.lastSaved.get(tracker.reelId) !== saveKey(update)) {
        this.unsent.set(tracker.reelId, update);
      }
      tracker.sincePlayedSave = 0;
    }
    void this.drain();
  }

  /** Send the queue one request at a time; resolves once it's empty. */
  private drain(): Promise<void> {
    this.draining ??= this.sendQueued().finally(() => {
      this.draining = null;
      // A save queued in the gap between the last send and this line.
      if (this.nextUnsent()) void this.drain();
    });
    return this.draining;
  }

  private async sendQueued(): Promise<void> {
    for (let next = this.nextUnsent(); next; next = this.nextUnsent()) {
      const [id, update] = next;
      this.unsent.delete(id);
      // Counted as saved while in flight, so a pause then the end don't send twice.
      this.lastSaved.set(id, saveKey(update));
      const route = COURSE_DETAIL_API.reels.courseProgressUpdate;
      try {
        const raw = await firstValueFrom(
          this.api.call({ ...route, path: route.path.replace(':id', id) }, update, {
            context: this.quiet(),
          }),
        );
        const progress = parseCourseProgress(raw);
        if (progress.reset_required) {
          if (!this.away) {
            const { title, body } = CHAPTER_COPY.enrolmentReset;
            this.notification.info(title, body);
          }
          this.forgetProgress(id);
          const reel = this.current(id);
          if (reel) await this.refreshReel(reel);
          continue;
        }
        const saved = progress.chapters.find((chapter) => chapter.chapter_id === update.chapter_id);
        if (saved) {
          const { is_video_completed, is_chapter_completed } = saved.progress;
          this.patchState(id, {
            last_watched_position_seconds: saved.progress.last_watched_position_seconds,
            max_watched_duration_seconds: saved.progress.max_watched_duration_seconds,
            ...(is_video_completed !== null ? { is_video_completed } : {}),
            ...(is_chapter_completed !== null ? { is_chapter_completed } : {}),
          });
        }
      } catch (error) {
        this.logger.error('[MicroLearningCourse] course-progress-update failed', error);
        this.lastSaved.delete(id);
        this.saveFailed(error, id, update);
      }
    }
  }

  private nextUnsent(): [string, CourseProgressUpdate] | null {
    return [...this.unsent.entries()].find(([id]) => this.started.has(id)) ?? null;
  }

  /**
   * A failed save. A 403 or 409 is the server closing the reel to the learner
   * (entitlement, an AI Lab lock): its message shows, and the reel is re-read.
   * Anything else warns once per reel and is held for the next save.
   */
  private saveFailed(error: unknown, id: string, update: CourseProgressUpdate): void {
    const refusal = readCourseStepRefusal(error);
    if (refusal.status === 403 || refusal.status === 409) {
      if (!this.away) {
        const { title, body } = CHAPTER_COPY.progressNotSaved;
        this.notification.error(title, refusal.message ?? body);
      }
      const reel = this.current(id);
      if (reel) void this.refreshReel(reel);
      return;
    }
    this.failed.set(id, update);
    if (this.away || this.warned.has(id)) return;
    this.warned.add(id);
    const { title, body } = CHAPTER_COPY.progressNotSaved;
    this.notification.error(title, body);
  }

  /**
   * Re-read one reel's state (`reels-feed/<uuid>/?page_size=1`, its anchor),
   * after the save that finishes it or a reset, so its button follows the
   * server's next step.
   */
  private async refreshReel(reel: Reel): Promise<void> {
    try {
      const raw = await firstValueFrom(
        this.api.get<unknown>(`${REELS_FEED_URL}${reel.id}/`, {
          params: { ...this.feedParams(), page_size: 1 },
          context: this.quiet(),
        }),
      );
      this.patchState(reel.id, parseReelAnchor(raw).anchor.user_state);
    } catch (error) {
      this.logger.error('[MicroLearningCourse] reel re-read failed', error);
    }
  }

  /** Sent on the player's own clock or in the background: no page-wide loading bar. */
  private quiet(): HttpContext {
    return new HttpContext().set(SKIP_LOADING, true);
  }

  // ─── Bookmark and share ───────────────────────────────────────────────────

  isBookmarked(reel: Reel): boolean {
    return this.bookmarks.isBookmarked(reel);
  }

  /** `bookmark/<uuid>/`, through the root service, so the landing page's My List follows. */
  toggleBookmark(reel: Reel): void {
    this.bookmarks.toggle(reel);
  }

  /** The reel's own URL: the address bar can lag a swipe behind. */
  share(reel: Reel): void {
    void this.utils.openShareDialog({
      url: `${this.document.location.origin}${this.reelPath(reel)}`,
    });
  }

  // ─── About, Transcript, Glossary ──────────────────────────────────────────

  onOption(reel: Reel, option: MicroLearningOptionId): void {
    if (option === 'about') void this.openAbout(reel);
    else if (option === 'transcript') void this.openTranscript(reel);
    else void this.openGlossary(reel);
  }

  /** The side panel reads the reel's `course-detail/` through its own `CourseDetailFacade`. */
  private async openAbout(reel: Reel): Promise<void> {
    const { MicroLearningAboutPanel } =
      await import('@features/offerings/micro-learning/components/micro-learning-about-panel/micro-learning-about-panel');
    this.dialogs.open<ReelRouteParams>(MicroLearningAboutPanel, {
      data: { courseId: reel.id, slug: reel.slug },
    });
  }

  private async openTranscript(reel: Reel): Promise<void> {
    const detail = await this.reelDetail(reel);
    if (!detail) return;
    const chapter =
      detail.chapters.find((item) => item.id === reel.chapter.id) ?? detail.chapters[0];
    const html = chapter?.transcript_text;
    if (!html) {
      const { title, body } = REEL_PLAYER_COPY.noTranscript;
      this.notification.info(title, body);
      return;
    }
    await this.showHtml(`Transcript - ${reel.title}`, html);
  }

  private async openGlossary(reel: Reel): Promise<void> {
    const detail = await this.reelDetail(reel);
    if (!detail) return;
    const html = detail.miscellaneous_data.glossary;
    if (!html) {
      const { title, body } = REEL_PLAYER_COPY.noGlossary;
      this.notification.info(title, body);
      return;
    }
    await this.showHtml(`${reel.title} - Glossary`, html);
  }

  /** `course-detail/` per reel, read when the learner first asks, kept for the visit. */
  private readonly details = new Map<string, Promise<MasterclassCourseDetail>>();

  /**
   * The reel's `course-detail/`, for its transcript and glossary, which the
   * feed doesn't carry. On demand: a learner swipes through many reels and
   * opens these on few. `null` (and a toast) when the read fails.
   */
  private async reelDetail(reel: Reel): Promise<MasterclassCourseDetail | null> {
    const key = `${reel.id}|${this.loginType()}`;
    let pending = this.details.get(key);
    if (!pending) {
      pending = firstValueFrom(
        this.api.get<unknown>(`${COURSE_DETAIL_API.reels.courseDetail}${reel.id}/`, {
          params: {
            login_type: this.loginType(),
            'chapters.page_size': COURSE_DETAIL_CHAPTERS_PAGE_SIZE,
          },
          context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
        }),
      ).then(parseCourseDetail);
      this.details.set(key, pending);
    }
    try {
      return await pending;
    } catch (error) {
      this.details.delete(key);
      this.logger.error('[MicroLearningCourse] course-detail read failed', error);
      const { title, body } = REEL_PLAYER_COPY.readFailed;
      this.notification.error(title, body);
      return null;
    }
  }

  private async showHtml(title: string, htmlContent: string): Promise<void> {
    const { HtmlContentDialog } =
      await import('@features/offerings/dialogs/html-content-dialog/html-content-dialog');
    this.dialogs.open<HtmlContentDialogData>(HtmlContentDialog, { data: { title, htmlContent } });
  }

  // A contract drift is a backend conversation, so it must reach the logs and
  // not only the learner's screen.
  private readonly loadErrorLog = effect(() => {
    const error = this.loadError();
    if (error) this.logger.error('[MicroLearningCourse] reels-feed load failed', error);
  });

  private readonly pageErrorLog = effect(() => {
    const error = this.pageResource.error();
    if (error) this.logger.error('[MicroLearningCourse] next feed page failed', error);
  });
}
