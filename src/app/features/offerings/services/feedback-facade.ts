import { httpResource } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { ApiClient, apiUrl } from '@core/services/api-client/api-client';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  FEEDBACK_ROUTES,
  FeedbackCategory,
  UserFeedbackData,
} from '@features/offerings/models/feedback-model';
import { ContentDetails } from '@core/models/course.model';
import { RouteRequest, RouteResponse } from '@core/models/http.model';
import { Utils } from '@shared/services/utils';
import { Analytics } from '@core/services/analytics/analytics';

// Type aliases for cleaner usage
type FeedbackListResponse = RouteResponse<typeof FEEDBACK_ROUTES.getFeedbackCategory>;

type FeedbackSubmitRequest = RouteRequest<typeof FEEDBACK_ROUTES.submitFeedback>;
type FeedbackSubmitResponse = RouteResponse<typeof FEEDBACK_ROUTES.submitFeedback>;

type CourseDetailsResponse = RouteResponse<typeof FEEDBACK_ROUTES.getCourseDetails>;

type UserFeedbackResponse = RouteResponse<typeof FEEDBACK_ROUTES.userFeedback>;

/**
 * Reads and submits course feedback for one course. Provided by the feedback
 * page, which tells it which course through `showCourse()`; every read idles
 * until then.
 */
@Service({ autoProvided: false })
export class FeedbackFacade {
  private readonly apiClient = inject(ApiClient);
  private readonly utils = inject(Utils);
  private readonly analytics = inject(Analytics);

  private readonly courseId = signal<number | null>(null);

  /** Point the reads at a course, or `null` to idle them. */
  showCourse(courseId: number | null): void {
    this.courseId.set(courseId);
  }

  private readonly categoriesResource = httpResource<FeedbackCategory[]>(
    // Not user- or course-scoped, but gated on the course so it loads with the
    // page's other reads, as it always did.
    () => (this.courseId() === null ? undefined : apiUrl(FEEDBACK_ROUTES.getFeedbackCategory.path)),
    { defaultValue: [], parse: (raw) => (raw as FeedbackListResponse).data },
  );

  /** The categories to rate; `[]` while loading and on failure. */
  readonly categories = computed<FeedbackCategory[]>(() =>
    this.categoriesResource.hasValue() ? this.categoriesResource.value() : [],
  );

  private readonly courseDetailsResource = httpResource<ContentDetails>(
    () => {
      const id = this.courseId();
      if (id === null) return undefined;
      const courseType = this.utils.getCourseType();
      // Temporary backend alignment: the webinar feedback page reuses the same
      // `webinar/details/` endpoint the webinar details page hits, instead of
      // the templated `v2/webinar/details/`. Will be swapped back to the
      // unified `v2/:course_type/details/` once both surfaces converge.
      const path =
        courseType === 'webinar'
          ? 'webinar/details/'
          : FEEDBACK_ROUTES.getCourseDetails.path.replace(':course_type', courseType);
      return { url: apiUrl(path), params: { id } };
    },
    { parse: (raw) => (raw as CourseDetailsResponse).data },
  );

  /** The course, or `null` while loading and on failure. */
  readonly courseDetails = computed<ContentDetails | null>(() =>
    this.courseDetailsResource.hasValue() ? (this.courseDetailsResource.value() ?? null) : null,
  );

  /** The learner has already submitted feedback for this course. */
  readonly feedbackSubmitted = computed(
    () => this.courseDetails()?.user_feedback_details?.user_feedback_submitted === true,
  );

  private readonly userFeedbackResource = httpResource<UserFeedbackData[]>(
    () => {
      const id = this.courseId();
      // Only a submitted course has feedback to read back.
      if (id === null || !this.feedbackSubmitted()) return undefined;
      return {
        url: apiUrl(FEEDBACK_ROUTES.userFeedback.path),
        params: { master_class__id: id },
      };
    },
    { defaultValue: [], parse: (raw) => (raw as UserFeedbackResponse).data },
  );

  /** The learner's submitted feedback, or `null` when there is none (yet). */
  readonly userFeedback = computed<UserFeedbackData | null>(() =>
    this.userFeedbackResource.hasValue() ? (this.userFeedbackResource.value()[0] ?? null) : null,
  );

  submitFeedback(body: FeedbackSubmitRequest): Observable<FeedbackSubmitResponse> {
    return this.apiClient
      .post<FeedbackSubmitResponse>(FEEDBACK_ROUTES.submitFeedback.path, body)
      .pipe(
        tap(() => {
          this.analytics.trackEvent('feedback_submit', {
            course_id: body.masterclass_id ?? body.podcast_id ?? body.nano_learning_id ?? '',
            course_type: this.utils.getCourseType(),
            feedback_count: body.feedbacks?.length ?? 0,
          });
        }),
      );
  }
}
