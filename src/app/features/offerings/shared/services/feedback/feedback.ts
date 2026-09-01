import { DestroyRef, Service, computed, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiClient } from '../../../../../shared/core/services/api-client/api-client';
import { Logger } from '../../../../../shared/core/services/logger/logger';
import { CAIRA } from '../../../../../shared/core/http/caira.endpoints';
import { cairaError } from '../../../../../shared/core/http/caira-error';
import { CairaUuid } from '../../../../../shared/core/models/caira/envelope.model';
import {
  FeedbackQuestion,
  FeedbackQuestionsResponse,
  FeedbackSubmitResponse,
  toFeedbackQuestions,
  toFeedbackSubmitBody,
} from '../../../../../shared/core/models/caira/feedback.model';
import { CourseDetail } from '../course-detail/course-detail';

/**
 * Course feedback — #12 (questions) and #13 (submit).
 *
 * **Route-scoped**, provided on the `feedback` route in the masterclass, podcast
 * and micro-learning trees. `CourseDetail` is provided one level up on
 * `:courseId/:courseTitle`, so injecting it here reaches the *same* instance the
 * course already loaded — the course id, title and instructor come from there
 * rather than from a second read of #4. Same arrangement as `ChapterProgress`.
 *
 * The read is an `httpResource` keyed on that course id; the submit is a command
 * through `ApiClient`. Submitting is what triggers the credential pipeline, so
 * afterwards `CourseDetail` is reloaded rather than trusted — the certificate
 * URL lands on #4, not on #13's response.
 */
@Service({ autoProvided: false })
export class Feedback {
  private readonly api = inject(ApiClient);
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);
  private readonly courseDetail = inject(CourseDetail);

  /** The reactive root. Reading it from the parent avoids a second #4. */
  readonly courseId = this.courseDetail.courseId;
  readonly course = this.courseDetail.courseDetails;

  private readonly questionsResource = httpResource<FeedbackQuestionsResponse | undefined>(
    () => {
      const id = this.courseId();
      return id ? this.api.absoluteUrl(CAIRA.feedbackQuestions(id)) : undefined;
    },
    { defaultValue: undefined },
  );

  /**
   * `error()` before `value()` — an errored `httpResource` throws
   * `ResourceValueError` from `value()`, which would turn a 403 into a blank
   * page instead of an empty form.
   */
  readonly questions = computed<FeedbackQuestion[]>(() =>
    this.questionsResource.error() ? [] : toFeedbackQuestions(this.questionsResource.value()),
  );

  readonly isLoading = this.questionsResource.isLoading;

  readonly loadError = computed(() => {
    const err = this.questionsResource.error();
    return err ? cairaError(err) : null;
  });

  /** Already-submitted feedback is read-only; #4 owns that flag. */
  readonly isReadOnly = computed(
    () => this.course()?.user_feedback_details?.user_feedback_submitted === true,
  );

  private readonly _ratings = signal<Record<CairaUuid, number>>({});
  private readonly _comments = signal('');
  private readonly _submitting = signal(false);
  private readonly _submitted = signal(false);

  readonly ratings = this._ratings.asReadonly();
  readonly comments = this._comments.asReadonly();
  readonly isSubmitting = this._submitting.asReadonly();
  readonly submitted = this._submitted.asReadonly();

  /** Every question needs a star before #13 will accept the set. */
  readonly canSubmit = computed(() => {
    const rated = this._ratings();
    const questions = this.questions();
    return (
      questions.length > 0 &&
      !this._submitting() &&
      !this.isReadOnly() &&
      questions.every((q) => (rated[q.id] ?? 0) > 0)
    );
  });

  readonly certificateUrl = computed(() => this.course()?.certificate_url ?? null);

  rate(questionId: CairaUuid, rating: number): void {
    this._ratings.update((r) => ({ ...r, [questionId]: rating }));
  }

  setComments(text: string): void {
    this._comments.set(text);
  }

  /**
   * #13 · `POST <courseId>/feedback/submit/`.
   *
   * Answers are keyed `question_id` — the webinar twin's `feedback_id` is a
   * silent 400 here. On success the CPE credit, badge and certificate are all
   * triggered server-side, so #4 is reloaded to pick up whichever landed.
   */
  submit(): void {
    const courseId = this.courseId();
    if (!courseId || !this.canSubmit()) return;

    this._submitting.set(true);
    this.api
      .post<FeedbackSubmitResponse>(
        CAIRA.feedbackSubmit(courseId),
        toFeedbackSubmitBody(this._ratings(), this._comments()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this._submitting.set(false);
          this._submitted.set(true);
          // Four independent flags, not one success boolean — log what actually
          // fired so a half-run pipeline is diagnosable from the console.
          this.logger.log('Feedback submitted', response);
          this.courseDetail.reload();
        },
        error: (error: unknown) => {
          this._submitting.set(false);
          this.logger.error('Feedback submit failed', cairaError(error));
        },
      });
  }
}
