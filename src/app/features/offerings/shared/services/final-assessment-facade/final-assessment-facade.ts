import { inject, Injectable, signal } from '@angular/core';
import { Storage } from '@core/services/storage/storage';
import { QuizQuestion, ContentDetails } from '@core/models/course.model';
import { Observable, of } from 'rxjs';
import { map, tap, switchMap } from 'rxjs/operators';
import { ApiClient } from '@core/services/api-client/api-client';
import { Utils } from '@core/services/utils/utils';
import { Analytics } from '@core/services/analytics/analytics';
import { ASSESSMENT_ROUTES } from '@core/models/assessment.model';
import { RouteParams, RouteRequest, RouteResponse } from '@core/models/http.model';

type CourseDetailsResponse = RouteResponse<typeof ASSESSMENT_ROUTES.getCourseDetails>;
type CourseDetailsParams = RouteParams<typeof ASSESSMENT_ROUTES.getCourseDetails>;

type FinalAssessmentQuestionsResponse = RouteResponse<
  typeof ASSESSMENT_ROUTES.getFinalAssessmentQuestions
>;
type FinalAssessmentQuestionsParams = RouteParams<
  typeof ASSESSMENT_ROUTES.getFinalAssessmentQuestions
>;

type SubmitFinalAssessmentResponse = RouteResponse<typeof ASSESSMENT_ROUTES.submitFinalAssessment>;
type SubmitFinalAssessmentRequest = RouteRequest<typeof ASSESSMENT_ROUTES.submitFinalAssessment>;

type AssessmentReportResponse = RouteResponse<typeof ASSESSMENT_ROUTES.finalAssessmentReport>;
type AssessmentReportRequest = RouteRequest<typeof ASSESSMENT_ROUTES.finalAssessmentReport>;

@Injectable()
export class FinalAssessmentFacade {
  private readonly storage = inject(Storage);
  private readonly apiClient = inject(ApiClient);
  private readonly utils = inject(Utils);
  private readonly analytics = inject(Analytics);
  readonly sessionId = signal<string>('');
  readonly courseId = signal<string>('');
  readonly isAssessmentPassed = signal<boolean>(false);

  loadAssessmentData(): Observable<{ questions: QuizQuestion[]; details: ContentDetails }> {
    const courseId = +this.courseId();
    const sessionId = +this.sessionId();

    const courseDetailsParams: CourseDetailsParams = { id: courseId };
    return this.apiClient
      .get<CourseDetailsResponse>(
        ASSESSMENT_ROUTES.getCourseDetails.path.replace(
          ':course_type',
          this.utils.getCourseDetailsSegment(),
        ),
        {
          params: courseDetailsParams,
        },
      )
      .pipe(
        map((res) => res.data),
        switchMap((details) => {
          if (details.user_assessment_details?.status === 'Exam_Passed') {
            this.isAssessmentPassed.set(true);
            return of({ questions: [], details });
          }

          this.isAssessmentPassed.set(false);
          this.analytics.trackEvent('assessment_start', {
            course_id: courseId,
            session_id: sessionId,
            course_type: details.course_type,
          });

          let innerQuestions$: Observable<QuizQuestion[]>;
          const localQuestions = this.storage.getLocal<QuizQuestion[]>(
            `final_assessment_questions_${courseId}`,
          );

          if (localQuestions && localQuestions.length > 0) {
            innerQuestions$ = of(localQuestions);
          } else {
            const params: FinalAssessmentQuestionsParams = {
              session_id: sessionId,
            };
            if (details.course_type === 'masterclass') params.masterclass_id = +courseId;
            else if (details.course_type === 'podcast') params.podcast_id = +courseId;
            // Response-driven: AI Lab courses are nano-learning rows, so they
            // share the id key with both spellings of micro-learning.
            else if (
              details.course_type === 'nano_learning' ||
              details.course_type === 'micro_learning' ||
              details.course_type === 'ai_lab'
            )
              params.nano_learning_id = +courseId;
            innerQuestions$ = this.apiClient
              .get<FinalAssessmentQuestionsResponse>(
                ASSESSMENT_ROUTES.getFinalAssessmentQuestions.path,
                { params },
              )
              .pipe(
                map((res) => res.data),
                tap((questions) => {
                  this.storage.setLocal(`final_assessment_questions_${courseId}`, questions);
                }),
              );
          }

          return innerQuestions$.pipe(map((questions) => ({ questions, details })));
        }),
      );
  }

  getQuestions(): QuizQuestion[] {
    const questions: QuizQuestion[] =
      this.storage.getLocal(`final_assessment_questions_${this.courseId()}`) ?? [];
    return questions.length ? questions : [];
  }

  updateQuestion(questionId: number, selectedOption: string): void {
    const questions = this.getQuestions();
    const index = questions.findIndex((q) => q.id === questionId);
    if (index !== -1) {
      questions[index] = { ...questions[index], user_selected_option: selectedOption };
      this.storage.setLocal(`final_assessment_questions_${this.courseId()}`, questions);
    }
  }

  submitAssessment(answers: Record<number, string>): Observable<SubmitFinalAssessmentResponse> {
    const courseId = +this.courseId();
    const sessionId = +this.sessionId();

    const answersList = Object.keys(answers).map((key) => ({
      question_id: +key,
      answer: answers[+key],
    }));

    const courseType = this.utils.getCourseType();
    // One mapping point (`Utils.getCourseIdKey`) rather than a second copy of
    // the type → id-key table — that copy is what missed `ai_lab`.
    const courseIdKey = this.utils.getCourseIdKey();

    const body: SubmitFinalAssessmentRequest = {
      [courseIdKey]: courseId,
      session_id: sessionId,
      answers_list: answersList,
    };

    return this.apiClient
      .post<SubmitFinalAssessmentResponse>(ASSESSMENT_ROUTES.submitFinalAssessment.path, body)
      .pipe(
        tap((res) => {
          this.analytics.trackEvent('assessment_submit', {
            course_id: courseId,
            session_id: sessionId,
            course_type: courseType,
            passed: res?.data?.is_passed ?? false,
            score: res?.data?.result_details?.my_percentage,
          });
        }),
      );
  }

  getAssessmentReport(userAssessmentId: number): Observable<SubmitFinalAssessmentResponse['data']> {
    const body: AssessmentReportRequest = { userassessment_id: userAssessmentId };
    return this.apiClient
      .post<AssessmentReportResponse>(ASSESSMENT_ROUTES.finalAssessmentReport.path, body)
      .pipe(map((res) => res.data));
  }

  getCourseDetails(courseId: number): Observable<ContentDetails> {
    const params: CourseDetailsParams = { id: courseId };
    return this.apiClient
      .get<CourseDetailsResponse>(
        ASSESSMENT_ROUTES.getCourseDetails.path.replace(
          ':course_type',
          this.utils.getCourseDetailsSegment(),
        ),
        {
          params,
        },
      )
      .pipe(map((res) => res.data));
  }

  clearAssessmentData(): void {
    if (this.courseId()) {
      this.storage.removeLocal(`final_assessment_questions_${this.courseId()}`);
      this.storage.removeLocal(`session_id`);
    }
  }
}
