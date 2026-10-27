import { formatDate } from '@angular/common';
import { HttpContext, HttpErrorResponse, httpResource } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CommonResponse, SKIP_ERROR_NOTIFICATION, SKIP_LOADING } from '@core/models/http.model';
import { ApiClient, apiUrl } from '@core/services/api-client/api-client';
import { NotificationService } from '@core/services/notification/notification';
import { AI_LABS_API } from '@features/ai-labs/constants/ai-labs-api';
import {
  AiLabExamAnswer,
  AiLabExamPaper,
  AiLabExamResult,
} from '@features/ai-labs/models/ai-labs.model';

/** The masterclass assessment's copy, for the lab's. */
export const LAB_EXAM_COPY = {
  loading: 'Loading assessment...',
  backToLab: 'Back to the Lab',
  passed: (score: number) =>
    `You have successfully passed the assessment with a score of ${score}%.`,
  failed: (score: number, passMark: number) =>
    `You scored ${score}%. Don't give up! Review the material and try again to achieve the passing score of ${passMark}%.`,
  incomplete: {
    title: 'Assessment Incomplete',
    body: 'Please answer the following questions before submitting:',
  },
  exit: {
    title: 'Exit Assessment?',
    body: 'Are you sure you want to leave the assessment? Your answers will be lost if you leave without submitting.',
  },
  loadFailed: { title: "Couldn't load the assessment", body: 'Please try again in a moment.' },
  submitFailed: {
    title: 'Assessment not submitted',
    body: "We couldn't submit your answers. Please try again.",
  },
  coolOff: (time: string) => `You can retake the assessment after ${time}.`,
} as const;

/**
 * The lab's final assessment: the paper, the submit, and its result.
 *
 * Route-scoped (`autoProvided: false`, on the `…/final-assessment` route). The page hands it the
 * lab id from the URL. There are no sittings on this API: one read gives the paper, one submit
 * grades every answer and returns the review with the score — so the review is shown from the
 * submit's answer, not read back.
 *
 * A refusal on the read (`cool_off_active`, `quiz_not_complete`, `video_not_complete`,
 * `already_passed`, `no_assessment_config`) becomes `loadError`, in the server's own words — the
 * cool-off with its end time.
 */
@Service({ autoProvided: false })
export class AiLabAssessmentFacade {
  private readonly api = inject(ApiClient);
  private readonly notification = inject(NotificationService);

  private readonly courseId = signal<string | null>(null);

  private readonly paperRes = httpResource<AiLabExamPaper | null>(
    () => {
      const id = this.courseId();
      return id
        ? {
            url: apiUrl(`${AI_LABS_API.assessmentQuestions}${id}/`),
            context: new HttpContext().set(SKIP_LOADING, true).set(SKIP_ERROR_NOTIFICATION, true),
          }
        : undefined;
    },
    {
      defaultValue: null,
      parse: (raw) => (raw as CommonResponse<AiLabExamPaper> | null)?.data ?? null,
    },
  );

  readonly paper = computed(() => (this.paperRes.hasValue() ? this.paperRes.value() : null));
  readonly isLoading = computed(() => this.paperRes.isLoading());

  /** Why there is no paper, in the server's words — or `null`. */
  readonly loadError = computed(() => {
    const error = this.paperRes.error();
    if (!error) return null;
    const body =
      error instanceof HttpErrorResponse ? (error.error as CommonResponse<unknown>) : null;
    const data = body?.data as { reason?: string; cool_off_ends_at?: string } | null | undefined;
    if (data?.reason === 'cool_off_active' && data.cool_off_ends_at) {
      // The cool-off is 30 minutes, so the time of day is enough to say when.
      return LAB_EXAM_COPY.coolOff(formatDate(data.cool_off_ends_at, 'shortTime', 'en-US'));
    }
    return body?.message || LAB_EXAM_COPY.loadFailed.body;
  });

  /** The last submit's answer, until a retake clears it. */
  readonly result = signal<AiLabExamResult | null>(null);

  /**
   * After a failed submit with a wait configured (`final_assessment_status: cool_off`): when the
   * retake opens, as a time of day. `null` when a retake is open now.
   */
  readonly retakeAfter = computed(() => {
    const status = this.result()?.final_assessment_status;
    const ends = status?.final_assessment_cool_off_ends_at;
    return status?.final_assessment_enum_values === 'cool_off' && ends
      ? formatDate(ends, 'shortTime', 'en-US')
      : null;
  });
  /** What that submit sent, by question — the review's "your answer". */
  readonly sent = signal<Record<string, string[]>>({});

  /** The lab the URL names. */
  open(courseId: string): void {
    // The route's injector outlives the page: a second visit gets a fresh paper, not the last result.
    if (this.courseId() === courseId) {
      this.retake();
      return;
    }
    this.result.set(null);
    this.courseId.set(courseId);
  }

  /** A fresh paper — after a failed attempt, or after a read error. */
  retake(): void {
    this.result.set(null);
    this.sent.set({});
    this.paperRes.reload();
  }

  /**
   * `POST course-assessment-submit/<uuid>/`. Resolves to the result, or `null` after telling the
   * learner why it wasn't accepted (the server's sentence for a refusal).
   */
  async submit(answers: AiLabExamAnswer[]): Promise<AiLabExamResult | null> {
    const id = this.courseId();
    if (!id) return null;
    const route = AI_LABS_API.assessmentSubmit;
    try {
      const res = await firstValueFrom(
        this.api.call(
          { ...route, path: route.path.replace(':id', id) },
          { answers },
          { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) },
        ),
      );
      const result = res.data as AiLabExamResult;
      this.sent.set(Object.fromEntries(answers.map((a) => [a.question_id, a.selected_option_ids])));
      this.result.set(result);
      return result;
    } catch (error) {
      const body =
        error instanceof HttpErrorResponse ? (error.error as CommonResponse<unknown>) : null;
      this.notification.error(
        LAB_EXAM_COPY.submitFailed.title,
        body?.message || LAB_EXAM_COPY.submitFailed.body,
      );
      return null;
    }
  }
}
