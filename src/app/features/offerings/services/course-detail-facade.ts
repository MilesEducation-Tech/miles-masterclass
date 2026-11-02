import { isPlatformBrowser } from '@angular/common';
import { HttpContext, HttpErrorResponse, httpResource } from '@angular/common/http';
import {
  computed,
  DOCUMENT,
  effect,
  inject,
  linkedSignal,
  PLATFORM_ID,
  Service,
  Signal,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { MASTERCLASS_BOOKMARK_TOASTS } from '@core/constants/masterclass';
import { SKIP_LOADING } from '@core/models/http.model';
import { parseBookmarkToggle } from '@core/models/masterclass-home.model';
import { ApiClient, apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { SUBSCRIPTION_DIALOG } from '@core/services/dialog/feature-dialog-tokens';
import { Logger } from '@core/services/logger/logger';
import { MasterclassBookmarks } from '@core/services/masterclass-bookmarks/masterclass-bookmarks';
import { NotificationService } from '@core/services/notification/notification';
import { withPreviousValue } from '@core/utils/with-previous-value';
import { Utils } from '@shared/services/utils';
import {
  CHAPTER_COPY,
  COURSE_DETAIL_API,
  COURSE_DETAIL_CHAPTERS_PAGE_SIZE,
  COURSE_ID_PATTERN,
} from '@features/offerings/constants/course-detail';
import {
  ChapterStartResult,
  CourseProgress,
  CourseProgressChapter,
  CourseProgressUpdate,
  CourseDetailParams,
  CourseLoginType,
  CourseMode,
  CourseOffering,
  isChapterDone,
  MasterclassChapterLink,
  MasterclassCourseDetail,
  MasterclassRelatedCourse,
  MasterclassRelatedRail,
  parseAboutCourseId,
  parseChapterStart,
  parseCourseDetail,
  parseCourseProgress,
  readCourseStepRefusal,
} from '@features/offerings/models/course-detail.model';
import {
  EvaluationOutcome,
  EvaluationSubmitBody,
  parseEvaluationSubmit,
} from '@features/offerings/models/course-evaluation.model';
import {
  AssessmentOutcome,
  AssessmentStart,
  AssessmentSubmitBody,
  parseAssessmentStart,
  parseAssessmentSubmit,
} from '@features/offerings/models/final-assessment.model';
import {
  parseQuizSubmit,
  QuizAnswer,
  QuizSubmitOutcome,
} from '@features/offerings/models/chapter-quiz.model';
// Type-only: the dialog loads with `import()` when opened (AGENTS.md §4.4).
import type { HtmlContentDialogData } from '@features/offerings/dialogs/html-content-dialog/html-content-dialog';

/** A 404 for an unknown course, or a 400 for a malformed id or slug. */
const isMissing = (error: unknown): boolean =>
  error instanceof HttpErrorResponse && (error.status === 404 || error.status === 400);

/**
 * State and actions for one course of an offering, read from its web
 * `course-detail/` route: today the masterclass course page and its chapter
 * pages (`:courseId/:courseTitle/…`), and the course-info dialog the landing
 * page's "i" button opens. Offering-wide on purpose: what differs per offering
 * (routes, URL segment) comes from `COURSE_DETAIL_API`, so
 * podcast and micro-learning plug in by adding their entry once their web
 * routes exist.
 *
 * Never a root service. The course route lists it in `providers` (on the
 * parent, so the course page and its chapters share one instance and one read),
 * and the dialog in its own `providers`, so each has an instance that
 * `connect()` points at its course. The page's sections inject it and read
 * these signals and call these methods themselves; none of them calls the API.
 * The chapter page reaches it through `CourseChapterFacade`. It replaces the
 * shared, legacy `MasterclassFacade` for these only — podcast still uses that
 * one until its own API moves.
 */
@Service({ autoProvided: false })
export class CourseDetailFacade {
  private readonly router = inject(Router);
  private readonly utils = inject(Utils);
  private readonly logger = inject(Logger);
  private readonly auth = inject(AuthSession);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly subscriptionDialog = inject(SUBSCRIPTION_DIALOG);
  private readonly api = inject(ApiClient);
  private readonly notification = inject(NotificationService);
  private readonly bookmarks = inject(MasterclassBookmarks);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Which offering's routes to call; `null` until `connect()`. */
  private readonly offering = signal<CourseOffering | null>(null);

  /** The offering's routes and names, from `COURSE_DETAIL_API`. */
  private readonly routes = computed(() => {
    const offering = this.offering();
    return offering ? COURSE_DETAIL_API[offering] : null;
  });

  /** The course's id and slug, as a signal; `null` until `connect()`. */
  private readonly params = signal<Signal<CourseDetailParams> | null>(null);

  /**
   * Derived from the inputs rather than set from an effect: an effect writes
   * one change-detection pass late, so the browser's first render had no course
   * while the server's did, and hydration misplaced the nodes it reused.
   */
  private readonly routeId = computed(() => {
    const id = this.params()?.().courseId;
    return id && COURSE_ID_PATTERN.test(id) ? id : null;
  });

  /** An old numeric link (still in search results and shared links) is looked up by slug. */
  private readonly legacySlug = computed(() =>
    this.routeId() ? null : (this.params()?.().slug ?? null),
  );

  private readonly unresolvable = computed(
    () => this.params() !== null && !this.routeId() && !this.legacySlug(),
  );

  /** `course-detail/` takes a UUID only, so a legacy slug asks `about-course/` for it first. */
  private readonly legacyIdResource = httpResource<string>(
    () => {
      const routes = this.routes();
      const slug = this.legacySlug();
      return routes && slug ? { url: apiUrl(routes.aboutCourse), params: { slug } } : undefined;
    },
    { parse: parseAboutCourseId },
  );

  private readonly courseId = computed(
    () =>
      this.routeId() ?? (this.legacyIdResource.hasValue() ? this.legacyIdResource.value() : null),
  );

  /** From the session's boolean, never the token, so a token rotation doesn't refetch. */
  private readonly loginType = computed<CourseLoginType>(() =>
    this.auth.isAuthenticated() ? 'post_login' : 'pre_login',
  );

  private readonly detailResource = httpResource<MasterclassCourseDetail>(
    () => {
      const routes = this.routes();
      const id = this.courseId();
      if (!routes || !id) return undefined;
      const loginType = this.loginType();

      // `pre_login` is public, so the SERVER fetches it: the course is in the SSR
      // HTML for crawlers, and the browser reuses it from the transfer cache.
      // `post_login` needs the learner's token, which lives in the browser.
      if (!this.isBrowser && loginType === 'post_login') return undefined;

      return {
        url: apiUrl(`${routes.courseDetail}${id}/`),
        params: { login_type: loginType, 'chapters.page_size': COURSE_DETAIL_CHAPTERS_PAGE_SIZE },
      };
    },
    // The trust boundary: a body that drifted from the contract lands in
    // `error()` here — and so in `loadError()` — instead of on screen.
    { parse: parseCourseDetail },
  );

  /** Holds the course through a refetch (sign-in), so the page doesn't flash its skeleton. */
  private readonly detail = withPreviousValue(this.detailResource);

  /**
   * The course, once loaded; `null` while the first load runs, on an error, or
   * before `connect()`. The id check stops the held value from showing the
   * previous course while the router moves to another one.
   */
  readonly course = computed(() => {
    const course = this.detail.hasValue() ? this.detail.value() : null;
    return course && course.id === this.courseId() ? course : null;
  });

  /** The chapters, in the API's `order`, each with the URL slug the API doesn't send. */
  readonly chapters = computed<MasterclassChapterLink[]>(() =>
    (this.course()?.chapters ?? []).map((chapter) => ({
      ...chapter,
      slug: this.utils.slugify(chapter.name),
    })),
  );

  /**
   * Where the learner picks up: the first chapter not yet done, so Watch Now
   * skips what's finished and a chapter whose quiz is still open comes before
   * the chapters it locks. With every chapter done, the first one.
   */
  readonly resumeChapter = computed<MasterclassChapterLink | null>(() => {
    const chapters = this.chapters();
    const cpe = this.course()?.course_mode === 'cpe';
    return chapters.find((chapter) => !isChapterDone(chapter, cpe)) ?? chapters[0] ?? null;
  });

  /**
   * The Related section: "Related Courses", then one "More by" rail per
   * instructor. The current course is dropped from every rail (the API lists
   * it under its own instructor), and so is any rail left empty.
   */
  readonly relatedRails = computed<MasterclassRelatedRail[]>(() => {
    const course = this.course();
    if (!course) return [];
    const rails = [
      { id: 'related', heading: 'Related Courses', courses: course.related_courses },
      ...course.instructor_related_courses.map((group) => ({
        id: `instructor-${group.instructor_id}`,
        heading: `More by ${group.instructor_name}`,
        courses: group.courses,
      })),
    ];
    return rails
      .map((rail) => ({ ...rail, courses: this.toCards(rail.courses, course.id) }))
      .filter((rail) => rail.courses.length > 0);
  });

  /** Whether the Resource section has anything to show. */
  readonly hasResources = computed(() => {
    const resources = this.course()?.miscellaneous_data;
    return (
      !!resources &&
      (!!resources.glossary ||
        !!resources.course_navigation_video_url ||
        !!resources.exercise_files?.length ||
        !!resources.ai_kit)
    );
  });

  /**
   * A bookmark toggled here but not yet read back. It resets to `null` (the
   * server's `is_bookmarked`) as soon as `course()` is a new object, which the
   * re-read after the POST produces.
   */
  private readonly bookmarkOverride = linkedSignal<MasterclassCourseDetail | null, boolean | null>({
    source: this.course,
    computation: () => null,
  });

  /** This page's toggle, then the visit's answer from a card, then the server's. */
  readonly isBookmarked = computed(() => {
    const course = this.course();
    return this.bookmarkOverride() ?? (course ? this.bookmarks.isBookmarked(course) : false);
  });

  /** True while the bookmark POST is in flight; the button is disabled meanwhile. */
  readonly bookmarkPending = signal(false);

  readonly isLoading = computed(
    () => this.legacyIdResource.isLoading() || this.detailResource.isLoading(),
  );

  /** No such course: a URL that names none, or a 404 / 400 for its id or slug. */
  readonly notFound = computed(
    () =>
      this.unresolvable() ||
      isMissing(this.legacyIdResource.error()) ||
      isMissing(this.detailResource.error()),
  );

  /** Any other failed load, a contract mismatch included; the page shows it with a retry. */
  readonly loadError = computed(() =>
    this.notFound() ? null : (this.legacyIdResource.error() ?? this.detailResource.error() ?? null),
  );

  constructor() {
    // A contract drift is a backend conversation, so it must reach the logs and
    // not only the learner's screen.
    effect(() => {
      const error = this.loadError();
      if (error) this.logger.error('[CourseDetail] course-detail load failed', error);
    });
  }

  /**
   * Follow one offering's course by its id and slug; called once, from the
   * host's constructor.
   */
  connect(offering: CourseOffering, params: Signal<CourseDetailParams>): void {
    this.offering.set(offering);
    this.params.set(params);
  }

  reload(): void {
    if (this.legacyIdResource.error()) this.legacyIdResource.reload();
    else this.detailResource.reload();
  }

  /** The shared video dialog; it toasts "Trailer Not Found" for a course with none. */
  openTrailer(): void {
    const course = this.course();
    if (course) void this.utils.openVideoDialog(course.horizontal_trailer_url, course.name);
  }

  openSample(): void {
    const course = this.course();
    if (course) void this.utils.openVideoDialog(course.sample_video_url, course.name);
  }

  /**
   * Share the course page. The URL is spelled out because the share dialog
   * otherwise shares the current page, which from the "i" dialog is the
   * landing page, not the course.
   */
  share(): void {
    const course = this.course();
    if (!course) return;
    const url = `${this.document.location.origin}${this.coursePagePath(course)}`;
    void this.utils.openShareDialog({ url });
  }

  /** The course page, from the "i" dialog. */
  openCoursePage(): void {
    const course = this.course();
    if (course) void this.router.navigateByUrl(this.coursePagePath(course));
  }

  /**
   * Open the course's first chapter (the API returns them in `order`). Resuming
   * where the learner left off comes with the signed-in state. Chapters carry no
   * slug, so the URL's is made from the name, as the legacy flow did.
   *
   * Gated here, as the legacy launch flow was, so the learner isn't sent to a
   * chapter only to be sent back: signed out, they sign in and return here; a
   * course locked to them (no entitlement, so every stream is stripped) opens
   * the subscription offer instead.
   */
  watch(): void {
    const course = this.course();
    const chapter = this.resumeChapter();
    if (!course || !chapter) return;

    if (!this.auth.isAuthenticated()) {
      this.signIn();
      return;
    }
    if (course.course_is_locked) {
      void this.openSubscription();
      return;
    }

    void this.router.navigateByUrl(this.chapterPath(chapter) ?? '/');
  }

  /** The course page's path, once the course has loaded. */
  coursePath(): string | null {
    const course = this.course();
    return course ? this.coursePagePath(course) : null;
  }

  /** A chapter's page: the course page's path plus `chapter/<uuid>/<slug>`. */
  chapterPath(chapter: MasterclassChapterLink): string | null {
    const course = this.coursePath();
    return course ? `${course}/chapter/${chapter.id}/${chapter.slug}` : null;
  }

  /**
   * Begin a chapter (`chapter-start/`), which creates the learner's enrolment on
   * the first one. Rejects with the `HttpErrorResponse` of a refusal, for the
   * caller to read with `readCourseStepRefusal`.
   */
  async startChapter(chapterId: string): Promise<ChapterStartResult> {
    const route = this.routes()?.chapterStart;
    if (!route) throw new Error('[CourseDetail] startChapter before connect()');
    const raw = await firstValueFrom(
      this.api.call({ ...route, path: route.path.replace(':id', chapterId) }),
    );
    return parseChapterStart(raw);
  }

  /**
   * Save one chapter's progress (`course-progress-update/`). Sent on the
   * player's own clock, so it never drives the loading bar. Resolves the whole
   * course's progress after the write; rejects with the `HttpErrorResponse` of
   * a refusal, for the caller to read with `readCourseStepRefusal`.
   */
  async saveProgress(update: CourseProgressUpdate): Promise<CourseProgress> {
    const route = this.routes()?.courseProgressUpdate;
    const id = this.courseId();
    if (!route || !id) throw new Error('[CourseDetail] saveProgress before the course loaded');
    const raw = await firstValueFrom(
      this.api.call({ ...route, path: route.path.replace(':id', id) }, update, {
        context: new HttpContext().set(SKIP_LOADING, true),
      }),
    );
    return parseCourseProgress(raw);
  }

  /** `quiz-questions/` for one chapter; `null` before `connect()`. */
  quizQuestionsUrl(chapterId: string): string | null {
    const base = this.routes()?.quizQuestions;
    return base ? `${base}${chapterId}/` : null;
  }

  /**
   * Grade one quiz answer (`quiz-submit/`). The quiz shows its own pending
   * state, so it skips the loading bar. Rejects with the `HttpErrorResponse` of
   * a refusal, for the caller to read with `readCourseStepRefusal`.
   */
  async submitQuizAnswer(chapterId: string, answer: QuizAnswer): Promise<QuizSubmitOutcome> {
    const route = this.routes()?.quizSubmit;
    if (!route) throw new Error('[CourseDetail] submitQuizAnswer before connect()');
    const raw = await firstValueFrom(
      this.api.call({ ...route, path: route.path.replace(':id', chapterId) }, answer, {
        context: new HttpContext().set(SKIP_LOADING, true),
      }),
    );
    return parseQuizSubmit(raw);
  }

  /** `assessment-questions/` for this course; `null` until its id is known. */
  assessmentQuestionsUrl(): string | null {
    const base = this.routes()?.assessmentQuestions;
    const id = this.courseId();
    return base && id ? `${base}${id}/` : null;
  }

  /** `assessment-report/` for this course; `null` until its id is known. */
  assessmentReportUrl(): string | null {
    const base = this.routes()?.assessmentReport;
    const id = this.courseId();
    return base && id ? `${base}${id}/` : null;
  }

  /** `assessment-result/` for this course; `null` until its id is known. */
  assessmentResultUrl(): string | null {
    const base = this.routes()?.assessmentResult;
    const id = this.courseId();
    return base && id ? `${base}${id}/` : null;
  }

  /** `course-progress/` for this course; `null` until its id is known. */
  courseProgressUrl(): string | null {
    const base = this.routes()?.courseProgress;
    const id = this.courseId();
    return base && id ? `${base}${id}/` : null;
  }

  /** `feedback-questions/` for this course; `null` until its id is known. */
  feedbackQuestionsUrl(): string | null {
    const base = this.routes()?.feedbackQuestions;
    const id = this.courseId();
    return base && id ? `${base}${id}/` : null;
  }

  /** `feedback-responses/?course_id=` for this course; `null` until its id is known. */
  feedbackResponsesRequest(): { url: string; params: { course_id: string } } | null {
    const url = this.routes()?.feedbackResponses;
    const id = this.courseId();
    return url && id ? { url, params: { course_id: id } } : null;
  }

  /**
   * Record the learner's evaluation (`feedback-submit/`), which closes the
   * course. Rejects with the `HttpErrorResponse` of a refusal, for the caller to
   * read with `readCourseStepRefusal`.
   */
  async submitFeedback(body: EvaluationSubmitBody): Promise<EvaluationOutcome> {
    const route = this.routes()?.feedbackSubmit;
    const id = this.courseId();
    if (!route || !id) throw new Error('[CourseDetail] submitFeedback before the course loaded');
    const raw = await firstValueFrom(
      this.api.call({ ...route, path: route.path.replace(':id', id) }, body),
    );
    return parseEvaluationSubmit(raw);
  }

  /**
   * Draw the final assessment's sitting, or resume the open one
   * (`assessment-start/`). Rejects with the `HttpErrorResponse` of a refusal,
   * for the caller to read with `readCourseStepRefusal`.
   */
  async startAssessment(): Promise<AssessmentStart> {
    const route = this.routes()?.assessmentStart;
    const id = this.courseId();
    if (!route || !id) throw new Error('[CourseDetail] startAssessment before the course loaded');
    const raw = await firstValueFrom(
      this.api.call({ ...route, path: route.path.replace(':id', id) }),
    );
    return parseAssessmentStart(raw);
  }

  /**
   * Score a sitting (`assessment-submit/`). Rejects with the `HttpErrorResponse`
   * of a refusal, for the caller to read with `readCourseStepRefusal`.
   */
  async submitAssessment(body: AssessmentSubmitBody): Promise<AssessmentOutcome> {
    const route = this.routes()?.assessmentSubmit;
    const id = this.courseId();
    if (!route || !id) throw new Error('[CourseDetail] submitAssessment before the course loaded');
    const raw = await firstValueFrom(
      this.api.call({ ...route, path: route.path.replace(':id', id) }, body),
    );
    return parseAssessmentSubmit(raw);
  }

  /**
   * Merge the server's per-chapter progress into the held course, so the lock
   * ladder, `show_quiz` and the progress move in place: the chapter page's next
   * card and the course page's list both read them from here.
   */
  applyProgress(chapters: CourseProgressChapter[]): void {
    const byId = new Map(chapters.map((chapter) => [chapter.chapter_id, chapter]));
    this.detailResource.update((course) =>
      course
        ? {
            ...course,
            chapters: course.chapters.map((chapter) => {
              const saved = byId.get(chapter.id);
              return saved
                ? {
                    ...chapter,
                    is_locked: saved.is_locked,
                    show_quiz: saved.show_quiz,
                    user_chapter_progress: saved.progress,
                  }
                : chapter;
            }),
          }
        : course,
    );
  }

  /**
   * Store the learner's mode on their enrolment: `course-detail/` re-read with
   * `mode=`, post-login only. The answer IS the course in its new mode, so it
   * replaces the held one with no second read. A refusal (`409
   * course_mode_locked` once the mode can no longer change) toasts the server's
   * message and keeps the mode as it was. Resolves `true` once the mode is set.
   */
  async setMode(mode: CourseMode): Promise<boolean> {
    const routes = this.routes();
    const id = this.courseId();
    if (!routes || !id || !this.auth.isAuthenticated()) return false;

    try {
      const raw = await firstValueFrom(
        this.api.get<unknown>(`${routes.courseDetail}${id}/`, {
          params: {
            login_type: 'post_login',
            'chapters.page_size': COURSE_DETAIL_CHAPTERS_PAGE_SIZE,
            mode,
          },
        }),
      );
      this.detailResource.set(parseCourseDetail(raw));
      return true;
    } catch (error) {
      this.logger.error('[CourseDetail] mode switch failed', error);
      const refusal = readCourseStepRefusal(error);
      this.notification.error(
        CHAPTER_COPY.modeNotChanged.title,
        refusal.message ?? CHAPTER_COPY.modeNotChanged.body,
      );
      return false;
    }
  }

  /**
   * The course page's path: the same URL the landing page's cards link to. The
   * payload carries no slug, so it comes from the connected params (the route's
   * or the card's), falling back to one made from the name.
   */
  private coursePagePath(course: MasterclassCourseDetail): string {
    const { country, profession } = this.utils.getRouteParams();
    const segment = this.routes()?.urlSegment;
    const slug = this.params()?.().slug || this.utils.slugify(course.name);
    return `/${country}/${profession}/${segment}/${course.id}/${slug}`;
  }

  /**
   * Toggle the learner's bookmark. Signed out, it goes to sign-in and comes back
   * here, as the auth guard does. Signed in, it flips at once, POSTs, then
   * re-reads `course-detail/` for the server's answer; a failure flips it back
   * and says so. The answer goes to `MasterclassBookmarks`, which toasts it, so
   * the cards and My List follow it.
   */
  toggleBookmark(): void {
    const course = this.course();
    const route = this.routes()?.bookmark;
    if (!course || !route || this.bookmarkPending()) return;

    if (!this.auth.isAuthenticated()) {
      this.signIn();
      return;
    }

    this.bookmarkOverride.set(!this.isBookmarked());
    this.bookmarkPending.set(true);
    this.api
      .call({ ...route, path: route.path.replace(':id', course.id) })
      .pipe(map(parseBookmarkToggle))
      .subscribe({
        next: (bookmarked) => {
          this.bookmarkPending.set(false);
          this.bookmarks.record(course.id, bookmarked, course.name);
          this.detailResource.reload();
        },
        error: (error: unknown) => {
          this.bookmarkPending.set(false);
          this.bookmarkOverride.set(null);
          this.logger.error('[CourseDetailFacade] bookmark failed', error);
          const { failed } = MASTERCLASS_BOOKMARK_TOASTS;
          this.notification.error(failed.title, failed.message);
        },
      });
  }

  /** The course's glossary, authored as HTML in the admin. */
  async openGlossary(): Promise<void> {
    const course = this.course();
    const glossary = course?.miscellaneous_data.glossary;
    if (!course || !glossary) return;

    const { HtmlContentDialog } =
      await import('@features/offerings/dialogs/html-content-dialog/html-content-dialog');
    this.dialogs.open<HtmlContentDialogData>(HtmlContentDialog, {
      data: { title: `${course.name} - Glossary`, htmlContent: glossary },
    });
  }

  openNavigationVideo(): void {
    const course = this.course();
    const url = course?.miscellaneous_data.course_navigation_video_url;
    if (course && url) void this.utils.openVideoDialog(url, `${course.name} - Course Navigation`);
  }

  /** To sign-in and back to this page, as the auth guard does. */
  private signIn(): void {
    void this.router.navigate(['/auth/login'], { queryParams: { redirect: this.router.url } });
  }

  /**
   * The subscription offer, the same dialog the rest of the app's paywall opens.
   * It lives in `features/payment`, so it arrives through `SUBSCRIPTION_DIALOG`.
   */
  private async openSubscription(): Promise<void> {
    const SubscriptionDialog = await this.subscriptionDialog();
    this.dialogs.open(SubscriptionDialog);
  }

  /** Rail cards, without the course on screen, each with a URL slug made from its name. */
  private toCards(courses: MasterclassRelatedCourse[], currentId: string) {
    return courses
      .filter((card) => card.id !== currentId)
      .map((card) => ({ ...card, slug: this.utils.slugify(card.name) }));
  }
}
