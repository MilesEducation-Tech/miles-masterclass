import { inject, Injectable } from '@angular/core';
import { ApiClient } from '@core/services/api-client/api-client';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { FEEDBACK_ROUTES, FeedbackCategory, UserFeedbackData } from '@core/models/feedback-model';
import { ContentDetails } from '@core/models/course.model';
import { RouteParams, RouteRequest, RouteResponse } from '@core/models/http.model';
import { Utils } from '@core/services/utils/utils';
import { Analytics } from '@core/services/analytics/analytics';

// Type aliases for cleaner usage
type FeedbackListResponse = RouteResponse<typeof FEEDBACK_ROUTES.getFeedbackCategory>;

type FeedbackSubmitRequest = RouteRequest<typeof FEEDBACK_ROUTES.submitFeedback>;
type FeedbackSubmitResponse = RouteResponse<typeof FEEDBACK_ROUTES.submitFeedback>;

type CourseDetailsResponse = RouteResponse<typeof FEEDBACK_ROUTES.getCourseDetails>;
type CourseDetailsParams = RouteParams<typeof FEEDBACK_ROUTES.getCourseDetails>;

type UserFeedbackResponse = RouteResponse<typeof FEEDBACK_ROUTES.userFeedback>;
type UserFeedbackParams = RouteParams<typeof FEEDBACK_ROUTES.userFeedback>;

@Injectable()
export class FeedbackFacade {
  private readonly apiClient = inject(ApiClient);
  private readonly utils = inject(Utils);
  private readonly analytics = inject(Analytics);

  getFeedbackCategories(): Observable<FeedbackCategory[]> {
    return this.apiClient
      .get<FeedbackListResponse>(FEEDBACK_ROUTES.getFeedbackCategory.path)
      .pipe(map((res) => res.data));
  }

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

  getCourseDetails(courseId: number): Observable<ContentDetails> {
    const courseType = this.utils.getCourseType();
    const params: CourseDetailsParams = { id: courseId };
    // Temporary backend alignment: the webinar feedback page reuses the same
    // `webinar/details/` endpoint the webinar details page hits, instead of
    // the templated `v2/webinar/details/`. Will be swapped back to the
    // unified `v2/:course_type/details/` once both surfaces converge.
    if (courseType === 'webinar') {
      return this.apiClient
        .get<CourseDetailsResponse>('webinar/details/', { params })
        .pipe(map((res) => res.data));
    }
    return this.apiClient
      .get<CourseDetailsResponse>(
        FEEDBACK_ROUTES.getCourseDetails.path.replace(':course_type', courseType),
        {
          params,
        },
      )
      .pipe(map((res) => res.data));
  }

  getUserFeedback(masterclassId: number): Observable<UserFeedbackData[]> {
    const params: UserFeedbackParams = { master_class__id: masterclassId };
    return this.apiClient
      .get<UserFeedbackResponse>(FEEDBACK_ROUTES.userFeedback.path, {
        params,
      })
      .pipe(map((res) => res.data));
  }
}
