import { HttpContext, HttpErrorResponse, httpResource } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CommonResponse, SKIP_ERROR_NOTIFICATION, SKIP_LOADING } from '@core/models/http.model';
import { displayNameOf } from '@core/models/account.model';
import { AccountApi } from '@core/services/account-api/account-api';
import { ApiClient, apiUrl } from '@core/services/api-client/api-client';
import { NotificationService } from '@core/services/notification/notification';
import { AI_LABS_API } from '@features/ai-labs/constants/ai-labs-api';
import {
  AiLabCourseDetail,
  AiLabFeedbackAnswers,
  AiLabFeedbackBody,
  AiLabFeedbackGate,
  AiLabFeedbackQuestion,
  AiLabFeedbackResult,
} from '@features/ai-labs/models/ai-labs.model';

/** The masterclass evaluation's copy, for the lab's. */
export const LAB_FEEDBACK_COPY = {
  title: 'AI Lab Evaluation Feedback',
  name: 'Name-',
  formTitle: 'AI Lab Evaluation Form',
  formIntro:
    'Thank you for completing this AI Lab. Please take a moment to offer your feedback. Please rank each item below, with 1 being the lowest and 5 being the highest score.',
  ratingsHeading: '1. Presenters and Lab Content',
  scale: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
  commentsHeading: 'Other Comments',
  commentsPlaceholder: 'Type here',
  submit: 'Submit',
  submitting: 'Submitting...',
  loading: 'Loading feedback form...',
  thanks: { title: 'Thank You!', body: 'Your feedback has been submitted successfully.' },
  certificate: 'Download Certificate',
  /** v3's label. It returns to the lab page, as v3's `redirect` does. */
  returnHome: 'Return to Course',
  submitted: {
    title: 'Thanks, your feedback is in',
    body: 'You have already submitted feedback for this AI Lab.',
  },
  notYet: { title: 'Feedback opens once you pass the final assessment' },
  backToLab: 'Back to the Lab',
  loadFailed: { title: "Couldn't load the feedback form", body: 'Please try again in a moment.' },
  submitFailed: {
    title: 'Feedback not submitted',
    body: "We couldn't submit your feedback. Please try again.",
  },
} as const;

const QUIET = () => new HttpContext().set(SKIP_LOADING, true).set(SKIP_ERROR_NOTIFICATION, true);

const unwrap =
  <T>() =>
  (raw: unknown): T | null =>
    (raw as CommonResponse<T> | null)?.data ?? null;

/**
 * The lab's feedback: the gate, the form, and the submit that closes the lab — the masterclass
 * `CourseEvaluationFacade` on the lab routes.
 *
 * Route-scoped (`autoProvided: false`, on the `…/feedback` route). The gate is read first; the form
 * only once it allows. Feedback opens on a passed final assessment (the practical left the CPE flow
 * on 2026-10-27), so a gate refusal is shown in the gate's own words (`remark`). The lab detail is
 * read too, for the page header.
 *
 * A 409 `nasba_conditions_unmet` on submit means the feedback WAS recorded but the lab couldn't
 * close — so it ends on the thank-you view, carrying the server's explanation.
 */
@Service({ autoProvided: false })
export class AiLabFeedbackFacade {
  private readonly api = inject(ApiClient);
  private readonly notification = inject(NotificationService);
  private readonly account = inject(AccountApi);

  private readonly courseId = signal<string | null>(null);

  private readonly detailRes = httpResource<AiLabCourseDetail | null>(
    () => this.labRequest(AI_LABS_API.courseDetail),
    { defaultValue: null, parse: unwrap<AiLabCourseDetail>() },
  );

  private readonly gateRes = httpResource<AiLabFeedbackGate | null>(
    () => this.labRequest(AI_LABS_API.feedbackGate),
    { defaultValue: null, parse: unwrap<AiLabFeedbackGate>() },
  );

  private readonly questionsRes = httpResource<AiLabFeedbackQuestion[]>(
    () => (this.gate()?.allowed ? this.labRequest(AI_LABS_API.feedbackQuestions) : undefined),
    {
      defaultValue: [],
      parse: (raw) =>
        (raw as CommonResponse<{ questions: AiLabFeedbackQuestion[] }> | null)?.data?.questions ??
        [],
    },
  );

  readonly lab = computed(() => (this.detailRes.hasValue() ? this.detailRes.value() : null));

  /** The header's "Name- …" line, as the masterclass evaluation shows it. */
  readonly learnerName = computed(() =>
    displayNameOf(this.account.user.hasValue() ? this.account.user.value() : null),
  );
  readonly gate = computed(() => (this.gateRes.hasValue() ? this.gateRes.value() : null));

  /** The form, in the backend's order. */
  readonly questions = computed(() =>
    [...(this.questionsRes.hasValue() ? this.questionsRes.value() : [])].sort(
      (a, b) => a.feedback_question_order - b.feedback_question_order,
    ),
  );

  readonly alreadySubmitted = computed(() => !!this.gate()?.already_submitted);

  /**
   * What the learner answered, read back once the gate says they already submitted (2026-10-28) —
   * upstream shows the form read-only there. Before the deploy the route 404s and the plain "your
   * feedback is in" panel stays.
   */
  private readonly answersRes = httpResource<AiLabFeedbackAnswers | null>(
    () => (this.alreadySubmitted() ? this.labRequest(AI_LABS_API.feedbackResponses) : undefined),
    { defaultValue: null, parse: unwrap<AiLabFeedbackAnswers>() },
  );

  /** The stored answers in form order; empty when none came back. */
  readonly submittedAnswers = computed(() => {
    const answers = this.answersRes.hasValue() ? this.answersRes.value() : null;
    return [...(answers?.responses ?? [])].sort((a, b) => a.question_order - b.question_order);
  });

  readonly submittedAt = computed(() =>
    this.answersRes.hasValue() ? (this.answersRes.value()?.submitted_at ?? null) : null,
  );

  /** Not open yet — the gate's `remark` says why. `null` while open, or before the gate answers. */
  readonly notYet = computed(() => {
    const gate = this.gate();
    if (!gate || gate.allowed || gate.already_submitted) return null;
    return gate.remark || 'Pass the final assessment first — feedback opens once you do.';
  });

  readonly isLoading = computed(() => this.gateRes.isLoading() || this.questionsRes.isLoading());

  readonly loadError = computed(() => {
    const error = this.gateRes.error() ?? this.questionsRes.error();
    if (!error) return null;
    const body =
      error instanceof HttpErrorResponse ? (error.error as CommonResponse<unknown>) : null;
    return body?.message || LAB_FEEDBACK_COPY.loadFailed.body;
  });

  readonly submitting = signal(false);

  /** What the submit answered — the thank-you view. `notice` is a 409's explanation. */
  readonly done = signal<{ result: AiLabFeedbackResult | null; notice: string | null } | null>(
    null,
  );

  /** The lab the URL names. */
  open(courseId: string): void {
    this.done.set(null);
    // The route's injector outlives the page: a second visit re-reads rather than replay the first.
    if (this.courseId() === courseId) this.reload();
    else this.courseId.set(courseId);
  }

  reload(): void {
    this.gateRes.reload();
    this.questionsRes.reload();
    this.answersRes.reload();
  }

  /** `POST course-feedback-submit/<uuid>/`. Resolves once the thank-you view (or a toast) is set. */
  async submit(body: AiLabFeedbackBody): Promise<void> {
    const id = this.courseId();
    if (!id || this.submitting()) return;
    this.submitting.set(true);
    const route = AI_LABS_API.feedbackSubmit;
    try {
      const res = await firstValueFrom(
        this.api.call({ ...route, path: route.path.replace(':id', id) }, body, {
          context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
        }),
      );
      this.done.set({ result: res.data as AiLabFeedbackResult, notice: null });
    } catch (error) {
      const http = error instanceof HttpErrorResponse ? error : null;
      const env = http ? (http.error as CommonResponse<unknown>) : null;
      if (http?.status === 409) {
        // Recorded, but the lab couldn't close (NASBA conditions): say so on the thank-you view.
        this.done.set({ result: null, notice: env?.message ?? null });
      } else {
        this.notification.error(
          LAB_FEEDBACK_COPY.submitFailed.title,
          env?.message || LAB_FEEDBACK_COPY.submitFailed.body,
        );
        this.gateRes.reload();
      }
    } finally {
      this.submitting.set(false);
    }
  }

  private labRequest(base: string) {
    const id = this.courseId();
    return id ? { url: apiUrl(`${base}${id}/`), context: QUIET() } : undefined;
  }
}
