import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { computed, effect, inject, Service, Signal, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Analytics } from '@core/services/analytics/analytics';
import { apiUrl } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { Utils } from '@shared/services/utils';
import {
  MASTERCLASS_COURSE_ID_PATTERN,
  MASTERCLASS_ENDPOINTS,
} from '@features/offerings/masterclass/constants/masterclass';
import {
  MasterclassAboutCourse,
  MasterclassCourseLookup,
  MasterclassCourseRouteParams,
  parseAboutCourse,
} from '@features/offerings/masterclass/models/masterclass-course.model';

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

  /** The page's route params, as a signal; `null` until `connect()`. */
  private readonly params = signal<Signal<MasterclassCourseRouteParams> | null>(null);

  /**
   * What `about-course/` is asked for. A UUID is looked up by id; an old
   * numeric link (still in search results and shared links) by its slug, which
   * both APIs share. `null` before `connect()` or when the URL names no course.
   *
   * Derived from the inputs rather than set from an effect: an effect writes
   * one change-detection pass late, so the browser's first render had no course
   * while the server's did, and hydration misplaced the nodes it reused.
   */
  private readonly lookup = computed<MasterclassCourseLookup | null>(() => {
    const params = this.params()?.();
    if (params?.courseId && MASTERCLASS_COURSE_ID_PATTERN.test(params.courseId)) {
      return { course_id: params.courseId };
    }
    return params?.slug ? { slug: params.slug } : null;
  });

  private readonly unresolvable = computed(() => this.params() !== null && this.lookup() === null);

  private readonly aboutResource = httpResource<MasterclassAboutCourse>(
    () => {
      const lookup = this.lookup();
      if (!lookup) return undefined;

      // `AllowAny`, so the SERVER fetches it too: the course content is in the
      // SSR HTML for crawlers, and the browser reuses the response from the
      // HTTP transfer cache instead of asking again.
      return { url: apiUrl(MASTERCLASS_ENDPOINTS.aboutCourse), params: lookup };
    },
    // The trust boundary: a body that drifted from the contract lands in
    // `error()` here — and so in `loadError()` — instead of on screen.
    { parse: parseAboutCourse },
  );

  /** The course, once loaded; `null` while loading, on an error, or before `connect()`. */
  readonly course = computed(() =>
    this.aboutResource.hasValue() ? this.aboutResource.value() : null,
  );

  readonly isLoading = computed(() => this.aboutResource.isLoading());

  /**
   * No such course: a URL that names none, or the API's answer for one — 404
   * for an unknown id or slug, 400 `invalid_query` for a malformed one.
   */
  readonly notFound = computed(() => {
    if (this.unresolvable()) return true;
    const error = this.aboutResource.error();
    return error instanceof HttpErrorResponse && (error.status === 404 || error.status === 400);
  });

  /** Any other failed load, a contract mismatch included; the page shows it with a retry. */
  readonly loadError = computed(() =>
    this.notFound() ? null : (this.aboutResource.error() ?? null),
  );

  constructor() {
    // A contract drift is a backend conversation, so it must reach the logs and
    // not only the learner's screen.
    effect(() => {
      const error = this.loadError();
      if (error) this.logger.error('[MasterclassCourse] about-course load failed', error);
    });

    // Once per loaded course, as the old facade did.
    effect(() => {
      const course = this.course();
      if (!course) return;
      untracked(() =>
        this.analytics.trackEvent('view_item', {
          course_id: course.id,
          course_name: course.title,
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
    this.aboutResource.reload();
  }

  /** The shared video dialog; it toasts "Trailer Not Found" for a course with none. */
  openTrailer(): void {
    const course = this.course();
    if (course) void this.utils.openVideoDialog(course.trailer_url, course.title);
  }

  openSample(): void {
    const course = this.course();
    if (course) void this.utils.openVideoDialog(course.sample_video_url, course.title);
  }

  share(): void {
    void this.utils.openShareDialog();
  }

  /**
   * Open the course's first chapter. Resuming where the learner left off needs
   * the signed-in `course-detail/` read, which this page doesn't bind yet.
   */
  watch(): void {
    const course = this.course();
    const chapter = course?.first_chapter;
    if (!course || !chapter) return;

    this.analytics.trackEvent('start_course', { course_id: course.id, course_type: 'masterclass' });
    const courseUrl = this.router.url.split(/[?#]/)[0];
    void this.router.navigate([courseUrl, 'chapter', chapter.id, chapter.slug]);
  }
}
