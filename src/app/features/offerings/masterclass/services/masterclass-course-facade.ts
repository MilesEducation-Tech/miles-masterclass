import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse, httpResource } from '@angular/common/http';
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
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { Analytics } from '@core/services/analytics/analytics';
import { ApiClient, apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { Logger } from '@core/services/logger/logger';
import { withPreviousValue } from '@core/utils/with-previous-value';
import { Utils } from '@shared/services/utils';
import {
  COURSE_DETAIL_CHAPTERS_PAGE_SIZE,
  MASTERCLASS_COURSE_ID_PATTERN,
  MASTERCLASS_COURSE_ROUTES,
  MASTERCLASS_ENDPOINTS,
} from '@features/offerings/masterclass/constants/masterclass';
import {
  MasterclassChapterLink,
  MasterclassCourseDetail,
  MasterclassCourseLoginType,
  MasterclassCourseRouteParams,
  MasterclassRelatedCourse,
  MasterclassRelatedRail,
  parseAboutCourseId,
  parseCourseDetail,
} from '@features/offerings/masterclass/models/masterclass-course.model';
// Type-only: the dialog loads with `import()` when opened (AGENTS.md §4.4).
import type { HtmlContentDialogData } from '@features/offerings/dialogs/html-content-dialog/html-content-dialog';

/** A 404 for an unknown course, or a 400 for a malformed id or slug. */
const isMissing = (error: unknown): boolean =>
  error instanceof HttpErrorResponse && (error.status === 404 || error.status === 400);

/**
 * State and actions for one masterclass course page (`:courseId/:courseTitle`).
 *
 * Route-scoped: listed in the course route's `providers`, so only the course
 * pages share it, and `connect()` points it at the course the router lands on.
 * The page and its components read these signals and call these methods; none
 * of them calls the API. It replaces the shared, legacy
 * `MasterclassFacade` for this page only — podcast and the chapter player still
 * use that one until their own APIs move.
 */
@Service({ autoProvided: false })
export class MasterclassCourseFacade {
  private readonly router = inject(Router);
  private readonly utils = inject(Utils);
  private readonly analytics = inject(Analytics);
  private readonly logger = inject(Logger);
  private readonly auth = inject(AuthSession);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly api = inject(ApiClient);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** The page's route params, as a signal; `null` until `connect()`. */
  private readonly params = signal<Signal<MasterclassCourseRouteParams> | null>(null);

  /**
   * Derived from the inputs rather than set from an effect: an effect writes
   * one change-detection pass late, so the browser's first render had no course
   * while the server's did, and hydration misplaced the nodes it reused.
   */
  private readonly routeId = computed(() => {
    const id = this.params()?.().courseId;
    return id && MASTERCLASS_COURSE_ID_PATTERN.test(id) ? id : null;
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
      const slug = this.legacySlug();
      return slug
        ? { url: apiUrl(MASTERCLASS_ENDPOINTS.aboutCourse), params: { slug } }
        : undefined;
    },
    { parse: parseAboutCourseId },
  );

  private readonly courseId = computed(
    () =>
      this.routeId() ?? (this.legacyIdResource.hasValue() ? this.legacyIdResource.value() : null),
  );

  /** From the session's boolean, never the token, so a token rotation doesn't refetch. */
  private readonly loginType = computed<MasterclassCourseLoginType>(() =>
    this.auth.isAuthenticated() ? 'post_login' : 'pre_login',
  );

  private readonly detailResource = httpResource<MasterclassCourseDetail>(
    () => {
      const id = this.courseId();
      if (!id) return undefined;
      const loginType = this.loginType();

      // `pre_login` is public, so the SERVER fetches it: the course is in the SSR
      // HTML for crawlers, and the browser reuses it from the transfer cache.
      // `post_login` needs the learner's token, which lives in the browser.
      if (!this.isBrowser && loginType === 'post_login') return undefined;

      return {
        url: apiUrl(`${MASTERCLASS_ENDPOINTS.courseDetail}${id}/`),
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

  readonly isBookmarked = computed(
    () => this.bookmarkOverride() ?? this.course()?.is_bookmarked ?? false,
  );

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
      if (error) this.logger.error('[MasterclassCourse] course-detail load failed', error);
    });

    // Once per loaded course, as the old facade did.
    effect(() => {
      const id = this.course()?.id;
      if (!id) return;
      untracked(() =>
        this.analytics.trackEvent('view_item', {
          course_id: id,
          course_name: this.course()?.name,
          course_type: 'masterclass',
        }),
      );
    });
  }

  /** Follow the page's route params; called once, from the page's constructor. */
  connect(params: Signal<MasterclassCourseRouteParams>): void {
    this.params.set(params);
  }

  reload(): void {
    if (this.legacyIdResource.error()) this.legacyIdResource.reload();
    else this.detailResource.reload();
  }

  /** The shared video dialog; it toasts "Trailer Not Found" for a course with none. */
  openTrailer(): void {
    const course = this.course();
    if (course) void this.utils.openVideoDialog(course.trailer_video_url, course.name);
  }

  openSample(): void {
    const course = this.course();
    if (course) void this.utils.openVideoDialog(course.sample_video_url, course.name);
  }

  share(): void {
    void this.utils.openShareDialog();
  }

  /**
   * Open the course's first chapter (the API returns them in `order`). Resuming
   * where the learner left off comes with the signed-in state. Chapters carry no
   * slug, so the URL's is made from the name, as the legacy flow did.
   */
  watch(): void {
    const course = this.course();
    const chapter = this.chapters()[0];
    if (!course || !chapter) return;

    this.analytics.trackEvent('start_course', { course_id: course.id, course_type: 'masterclass' });
    const courseUrl = this.router.url.split(/[?#]/)[0];
    void this.router.navigate([courseUrl, 'chapter', chapter.id, chapter.slug]);
  }

  /**
   * Toggle the learner's bookmark. Signed out, it goes to sign-in and comes back
   * here, as the auth guard does. Signed in, it flips at once, POSTs, then
   * re-reads `course-detail/` for the server's answer; a failure flips it back
   * (the interceptor shows the error).
   */
  toggleBookmark(): void {
    const course = this.course();
    if (!course || this.bookmarkPending()) return;

    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(['/auth/login'], { queryParams: { redirect: this.router.url } });
      return;
    }

    const route = MASTERCLASS_COURSE_ROUTES.bookmark;
    this.bookmarkOverride.set(!this.isBookmarked());
    this.bookmarkPending.set(true);
    this.api.call({ ...route, path: route.path.replace(':id', course.id) }).subscribe({
      next: () => {
        this.bookmarkPending.set(false);
        this.detailResource.reload();
      },
      error: () => {
        this.bookmarkPending.set(false);
        this.bookmarkOverride.set(null);
      },
    });
  }

  /** The learner's certificate, once the API has generated it. */
  downloadCertificate(): void {
    const url = this.course()?.masterclass_certificate_url;
    if (url) this.document.defaultView?.open(url, '_blank', 'noopener');
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

  /** Rail cards, without the course on screen, each with a URL slug made from its name. */
  private toCards(courses: MasterclassRelatedCourse[], currentId: string) {
    return courses
      .filter((card) => card.id !== currentId)
      .map((card) => ({ ...card, slug: this.utils.slugify(card.name) }));
  }
}
