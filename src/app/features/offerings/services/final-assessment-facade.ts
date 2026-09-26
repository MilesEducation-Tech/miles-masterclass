import { httpResource } from '@angular/common/http';
import { computed, effect, inject, Service, signal, untracked } from '@angular/core';
import { Storage } from '@core/services/storage/storage';
import { QuizQuestion, ContentDetails } from '@core/models/course.model';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ApiClient, apiUrl } from '@core/services/api-client/api-client';
import { Utils } from '@shared/services/utils';
import { Analytics } from '@core/services/analytics/analytics';
import { ASSESSMENT_ROUTES } from '@features/offerings/models/assessment.model';
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

/**
 * The final assessment for one course and session. Provided per route (exam and
 * report); the pages set `courseId`/`sessionId` and every read follows them.
 */
@Service({ autoProvided: false })
export class FinalAssessmentFacade {
  private readonly storage = inject(Storage);
  private readonly apiClient = inject(ApiClient);
  private readonly utils = inject(Utils);
  private readonly analytics = inject(Analytics);
  readonly sessionId = signal<string>('');
  readonly courseId = signal<string>('');

  private readonly detailsResource = httpResource<ContentDetails>(
    () => {
      const id = +this.courseId();
      if (!id) return undefined;
      const params: CourseDetailsParams = { id };
      return {
        url: apiUrl(
          ASSESSMENT_ROUTES.getCourseDetails.path.replace(
            ':course_type',
            this.utils.getCourseDetailsSegment(),
          ),
        ),
        params,
      };
    },
    { parse: (raw) => (raw as CourseDetailsResponse).data },
  );

  /** The course, or `null` while loading and on failure. */
  readonly courseDetails = computed<ContentDetails | null>(() =>
    this.detailsResource.hasValue() ? (this.detailsResource.value() ?? null) : null,
  );

  readonly isAssessmentPassed = computed(
    () => this.courseDetails()?.user_assessment_details?.status === 'Exam_Passed',
  );

  private readonly questionsKey = computed(() => `final_assessment_questions_${this.courseId()}`);

  /**
   * Questions answered so far are cached in localStorage, so a reload resumes the
   * attempt. Not reactive — it is read when the course's details land, which is
   * when the old chain read it too.
   */
  private cachedQuestions(): QuizQuestion[] | null {
    const local = this.storage.getLocal<QuizQuestion[]>(this.questionsKey());
    return local && local.length > 0 ? local : null;
  }

  private readonly questionsResource = httpResource<QuizQuestion[]>(
    () => {
      const details = this.courseDetails();
      // No exam to fetch for a passed course, or when the attempt is cached.
      if (!details || this.isAssessmentPassed() || untracked(() => this.cachedQuestions())) {
        return undefined;
      }
      const courseId = +this.courseId();
      const params: FinalAssessmentQuestionsParams = { session_id: +this.sessionId() };
      if (details.course_type === 'masterclass') params.masterclass_id = courseId;
      else if (details.course_type === 'podcast') params.podcast_id = courseId;
      // Response-driven: AI Lab courses are nano-learning rows, so they
      // share the id key with both spellings of micro-learning.
      else if (
        details.course_type === 'nano_learning' ||
        details.course_type === 'micro_learning' ||
        details.course_type === 'ai_lab'
      )
        params.nano_learning_id = courseId;
      return { url: apiUrl(ASSESSMENT_ROUTES.getFinalAssessmentQuestions.path), params };
    },
    {
      defaultValue: [],
      parse: (raw) => {
        const questions = (raw as FinalAssessmentQuestionsResponse).data;
        // Cache the fresh attempt, as the old `tap` did.
        this.storage.setLocal(untracked(this.questionsKey), questions);
        return questions;
      },
    },
  );

  /** The exam's questions: none once passed, else the cached attempt or a fresh one. */
  readonly questions = computed<QuizQuestion[]>(() => {
    if (!this.courseDetails() || this.isAssessmentPassed()) return [];
    const fetched = this.questionsResource.hasValue() ? this.questionsResource.value() : [];
    return fetched.length ? fetched : (untracked(() => this.cachedQuestions()) ?? []);
  });

  readonly isLoading = computed(
    () => this.detailsResource.isLoading() || this.questionsResource.isLoading(),
  );

  constructor() {
    // Once per course the learner is about to sit (the old chain fired it per load).
    effect(() => {
      const details = this.courseDetails();
      if (!details || this.isAssessmentPassed()) return;
      untracked(() =>
        this.analytics.trackEvent('assessment_start', {
          course_id: +this.courseId(),
          session_id: +this.sessionId(),
          course_type: details.course_type,
        }),
      );
    });
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

  clearAssessmentData(): void {
    if (this.courseId()) {
      this.storage.removeLocal(`final_assessment_questions_${this.courseId()}`);
      this.storage.removeLocal(`session_id`);
    }
  }
}
