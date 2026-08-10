import { httpResource } from '@angular/common/http';
import { DestroyRef, Service, computed, inject, linkedSignal, signal } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { ApiClient } from '../../../../../shared/core/services/api-client/api-client';
import { Logger } from '../../../../../shared/core/services/logger/logger';
import { Utils } from '../../../../../shared/core/services/utils/utils';
import { CAIRA } from '../../../../../shared/core/http/caira.endpoints';
import { cairaError } from '../../../../../shared/core/http/caira-error';
import { CairaUuid } from '../../../../../shared/core/models/caira/envelope.model';
import { CourseCard } from '../../../../../shared/core/models/caira/masterclass.model';
import {
  ChapterView,
  CourseDetailCard,
  CourseDetailResponse,
  EnrollmentResponse,
  InstructorCarousel,
  courseProgressPercent,
  relatedToCard,
  toChapterViews,
  toCourseDetailCard,
  toInstructorCarousels,
} from '../../../../../shared/core/models/caira/course-detail.model';

/**
 * The masterclass / podcast course detail page — endpoints #4, #14 and #15.
 *
 * **Route-scoped, not a singleton.** Provided on `:courseId/:courseTitle` in
 * both `masterclassRoutes` and `podcastRoutes`, so every component under a
 * course route — hero, chapter list, resources, related rails — injects the
 * same instance, and leaving the course disposes it. A second course opened in
 * another tab gets its own.
 *
 * Structured like `Auth` (AGENTS.md §3):
 *
 * - `courseId` is the **reactive root**. Both reads are `httpResource`s keyed
 *   on it and return `undefined` for the URL when there is nothing to fetch, so
 *   navigating away or signing out aborts whatever is in flight.
 * - Everything derived is a `computed()`. No `effect()` copies resource data
 *   into a signal.
 *
 * The one writable exception is `courseDetails`, a `linkedSignal`: the hero
 * patches `added_bookmark` in place after a toggle so the icon flips without a
 * refetch, and the link resets that patch whenever #4 answers again.
 *
 * Podcast shares this service. A podcast is structurally a masterclass with an
 * audio player, and CAIRA serves both from `Masterclass_Course_Detail` — there
 * is no separate podcast endpoint.
 */
@Service({ autoProvided: false })
export class CourseDetail {
  private readonly api = inject(ApiClient);
  private readonly utils = inject(Utils);
  private readonly logger = inject(Logger);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * The reactive root — read straight off the route this service is provided
   * on, not pushed in by the page.
   *
   * The page used to run `effect(() => detail.courseId.set(this.courseId()))`,
   * which is a state-propagating effect: the id already lives in the router, so
   * copying it into a second signal added a write for no new information. Doing
   * it here also deletes the page's `clear()` on destroy — leaving the course
   * route disposes the whole route injector, and with it this service.
   *
   * `Utils` reads country and profession from navigation the same way. The
   * snapshot read is not reactive on its own, hence the `url()` dependency
   * above it.
   */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly courseId = computed<CairaUuid | null>(() => {
    this.url();
    return routeParam(this.router.routerState.snapshot.root, 'courseId');
  });

  /**
   * #4 · `GET Masterclass_Course_Detail/<uuid>/`.
   *
   * Keyed on the id alone. An earlier version also gated on
   * `Auth.isAuthenticated()` to avoid a "guaranteed 403" while signed out —
   * that was wrong twice over. It made the page silently do nothing whenever
   * the flag was false for any reason, with no request to look at and no error
   * to render, and it bypassed the interceptor chain that exists to handle this
   * exact case: `authInterceptor` refreshes an expired token and replays, and
   * `errorInterceptor` deliberately does **not** toast `kind: 'auth'`. A 403 is
   * diagnosable; a request that never fires is not.
   *
   * Cached server-side per user over a global base key, so a content edit can
   * lag by the whole TTL. That is a documented QA surprise, not a bug here —
   * do not add a client-side cache-buster.
   */
  private readonly detail = httpResource<CourseDetailResponse | undefined>(
    () => this.detailUrl(CAIRA.courseDetail),
    { defaultValue: undefined },
  );

  /**
   * #14 · `GET <uuid>/enrollment/` — the read-through view of the same window
   * #4 embeds. It is not cached, so after a chapter start creates the 365-day
   * enrollment this reports the truth while #4 is still serving the old body.
   * `toCourseDetailCard` prefers it wherever the two disagree.
   */
  private readonly enrollment = httpResource<EnrollmentResponse | undefined>(
    () => this.detailUrl(CAIRA.enrollment),
    { defaultValue: undefined },
  );

  /**
   * ⚠️ `error()` is checked **before** `value()`, and that order is load-bearing:
   * an errored `httpResource` *throws* `ResourceValueError` from `value()`
   * rather than returning `undefined`. Read it unguarded and a 403 stops being
   * an empty state and becomes a render failure in every computed downstream.
   */
  private readonly payload = computed(() =>
    this.detail.error() ? null : (this.detail.value()?.course_details ?? null),
  );

  /** Same guard — #14 failing must not take the page down with it. */
  private readonly enrollmentValue = computed(() =>
    this.enrollment.error() ? undefined : this.enrollment.value(),
  );

  /**
   * The course as every template reads it, or `null` while it loads —
   * `masterclass-course.html` swaps in the hero skeleton on `null`.
   *
   * Writable so the bookmark toggle can patch one field; recomputed from
   * scratch the moment #4 or #14 answers again.
   */
  readonly courseDetails = linkedSignal<CourseDetailCard | null>(() => {
    const payload = this.payload();
    return payload ? toCourseDetailCard(payload, this.enrollmentValue()) : null;
  });

  readonly courseChapters = computed<ChapterView[]>(() => {
    const payload = this.payload();
    return payload ? toChapterViews(payload) : [];
  });

  /** Percentage complete, for the hero's progress bar. */
  readonly currentProgress = computed(() => courseProgressPercent(this.courseChapters()));

  readonly relatedCards = computed<CourseCard[]>(() =>
    (this.payload()?.related_courses ?? []).map(relatedToCard),
  );

  readonly instructorCarousels = computed<InstructorCarousel[]>(() => {
    const payload = this.payload();
    return payload ? toInstructorCarousels(payload, payload.id) : [];
  });

  readonly loading = this.detail.isLoading;
  readonly isLoading = this.detail.isLoading;

  readonly error = computed(() => {
    const err = this.detail.error();
    return err ? cairaError(err) : null;
  });

  /** ponytail: no async download step — the files open straight from their URLs. */
  readonly downloadingExerciseFiles = signal(false);

  /** `undefined` skips the request entirely — the only reason to skip is "no id yet". */
  private detailUrl(path: (id: CairaUuid) => string): string | undefined {
    const id = this.courseId();
    return id ? this.api.absoluteUrl(path(id)) : undefined;
  }

  /**
   * #15 · `POST <uuid>/bookmark/` — a pure toggle, no body.
   *
   * Patches `added_bookmark` from the server's answer rather than from a local
   * flip, so a rejected toggle cannot desync the icon. `Utils` owns the login
   * gate and the toast.
   */
  toggleBookmark(): void {
    const id = this.courseId();
    if (!id) return;
    this.utils
      .toggleBookmarkCourse(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        if (!response.status) return;
        this.courseDetails.update((course) =>
          course ? { ...course, added_bookmark: response.is_bookmarked } : course,
        );
      });
  }

  /** Open the first chapter the learner can actually watch. */
  launchCourse(): void {
    const chapters = this.courseChapters();
    const next =
      chapters.find((c) => !c.is_locked && !c.play_history?.is_completed) ??
      chapters.find((c) => !c.is_locked) ??
      chapters[0];
    if (!next) {
      this.logger.warn('launchCourse: course has no chapters', { courseId: this.courseId() });
      return;
    }
    this.navigateToChapter(next.id);
  }

  navigateToChapter(chapterId: CairaUuid): void {
    const course = this.courseDetails();
    const id = this.courseId();
    if (!course || !id) return;
    const chapter = this.courseChapters().find((c) => c.id === chapterId);
    const { country, profession } = this.utils.getRouteParams();
    this.router.navigate([
      `/${country}/${profession}/${this.utils.getCourseType()}/${id}/${this.utils.slugify(course.title)}/chapter/${chapterId}/${this.utils.slugify(chapter?.chapter_name ?? '')}`,
    ]);
  }

  openShareDialog(): void {
    const course = this.courseDetails();
    if (!course) return;
    this.utils.openShareDialog({
      url: this.utils.buildCourseUrl(this.utils.getCourseType(), course.id, course.title),
    });
  }

  openCertificateDownloadDialog(): void {
    const course = this.courseDetails();
    if (course) this.utils.openCertificateDownloadDialog(course);
  }

  submitFeedback(): void {
    const course = this.courseDetails();
    if (course) {
      this.utils.navigateToCourseFeedback(this.utils.getCourseType(), course.id, course.title);
    }
  }

  startFinalAssessment(courseId: string, courseTitle: string, courseType: string): void {
    this.utils.startFinalAssessment(
      courseId,
      courseTitle,
      courseType,
      this.courseDetails()?.exam_rules ?? '',
    );
  }

  /**
   * ponytail: CAIRA has no preview/CPE mode — chapter access is decided
   * server-side (`is_locked` / `show_quiz`), so there is nothing to toggle. The
   * hero's mode pill sits behind `@if (cpe_mode_details)`, which the mapper
   * pins to `null`, so this is unreachable from the UI; it exists because the
   * template binding still has to resolve.
   */
  toggleCpeMode(_mode: boolean): void {
    this.logger.warn('toggleCpeMode: CAIRA has no CPE/preview mode');
  }

  /** #4's `exercise_file_url` list, opened through the shared links dialog. */
  downloadExerciseFiles(): void {
    const files = this.courseDetails()?.exercise_files ?? [];
    this.utils.openResourceLinks(
      files.map((f) => ({ title: f.name ?? 'Exercise file', resource_link: f.url })),
    );
  }

  /** #4's `ai_kit`, in the same dialog. */
  openAdditionalResources(): void {
    const kit = this.courseDetails()?.ai_kit;
    this.utils.openResourceLinks(
      kit
        ? [{ title: kit.name ?? 'AI Kit', description: kit.description, resource_link: kit.url }]
        : [],
    );
  }

  /** Force a re-read after a write that changes the course without changing its id. */
  reload(): void {
    this.detail.reload();
    this.enrollment.reload();
  }
}

/**
 * First value of `name` found walking down the activated-route tree.
 *
 * Tree traversal rather than URL index arithmetic: `:courseId` sits at a
 * different segment depth in the masterclass and podcast trees, and it has to
 * keep resolving from the chapter, feedback and final-assessment child routes
 * that live under the same parent.
 */
function routeParam(root: ActivatedRouteSnapshot, name: string): string | null {
  for (let node: ActivatedRouteSnapshot | null = root; node; node = node.firstChild) {
    const value = node.params[name];
    if (value) return value;
  }
  return null;
}
