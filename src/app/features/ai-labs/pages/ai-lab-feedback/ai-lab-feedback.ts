import { Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowDownTray, heroBookOpen, heroCheck } from '@ng-icons/heroicons/outline';
import { RatingStar } from '@shared/components/rating-star/rating-star';
import { Button } from '@shared/ui/button/button';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { Field } from '@shared/ui/field/field';
import { PageLoading } from '@shared/ui/page-loading/page-loading';
import { Textarea } from '@shared/ui/textarea/textarea';
import {
  AiLabFeedbackQuestion,
  AiLabFeedbackResponse,
} from '@features/ai-labs/models/ai-labs.model';
import {
  AiLabFeedbackFacade,
  LAB_FEEDBACK_COPY,
} from '@features/ai-labs/services/ai-lab-feedback-facade';

/**
 * The lab's feedback, which closes it: CPE, the lab certificate, and the parent course if this was
 * its last lab. The masterclass `CourseEvaluation` page, copied rather than shared (a feature may
 * not import another).
 *
 * One difference in the form: a lab may ask `text` questions as well as `rating` ones. Ratings
 * keep the star grid; a text question gets its own box under it. Every rating is required, as on
 * the masterclass form; text answers and the closing comments are optional.
 */
@Component({
  selector: 'app-ai-lab-feedback',
  imports: [NgIcon, RatingStar, Button, ErrorState, Field, PageLoading, Textarea],
  templateUrl: './ai-lab-feedback.html',
  viewProviders: [provideIcons({ heroArrowDownTray, heroBookOpen, heroCheck })],
})
export class AiLabFeedback {
  /** The `:courseId` route param, bound by `withComponentInputBinding`. */
  readonly courseId = input.required<string>();

  protected readonly facade = inject(AiLabFeedbackFacade);
  private readonly router = inject(Router);

  protected readonly copy = LAB_FEEDBACK_COPY;

  /** The lab page: this page's own URL without `/feedback`. */
  private readonly labPath = this.router.url.split(/[?#]/)[0].replace(/\/feedback$/, '');

  protected readonly ratingQuestions = computed(() =>
    this.facade.questions().filter((q) => q.feedback_question_type === 'rating'),
  );
  protected readonly textQuestions = computed(() =>
    this.facade.questions().filter((q) => q.feedback_question_type !== 'rating'),
  );

  protected readonly ratings = linkedSignal<AiLabFeedbackQuestion[], Record<string, number>>({
    source: this.facade.questions,
    computation: () => ({}),
  });
  protected readonly texts = linkedSignal<AiLabFeedbackQuestion[], Record<string, string>>({
    source: this.facade.questions,
    computation: () => ({}),
  });
  protected readonly comments = signal('');

  protected readonly isComplete = computed(() => {
    const ratings = this.ratings();
    return (
      this.facade.questions().length > 0 &&
      this.ratingQuestions().every((question) => (ratings[question.id] ?? 0) > 0)
    );
  });

  protected readonly instructorNames = computed(
    () => this.facade.lab()?.instructors.join(', ') ?? '',
  );

  constructor() {
    effect(() => this.facade.open(this.courseId()));
  }

  protected rate(questionId: string, value: number): void {
    this.ratings.update((ratings) => ({ ...ratings, [questionId]: value }));
  }

  protected typedAnswer(questionId: string, event: Event): void {
    if (event.target instanceof HTMLTextAreaElement) {
      const value = event.target.value;
      this.texts.update((texts) => ({ ...texts, [questionId]: value }));
    }
  }

  protected typed(event: Event): void {
    if (event.target instanceof HTMLTextAreaElement) this.comments.set(event.target.value);
  }

  /** Ratings as `rating`, text answers as `text_response` — an empty text answer is left out. */
  protected submit(): void {
    if (!this.isComplete()) return;
    const ratings = this.ratings();
    const texts = this.texts();
    const responses: AiLabFeedbackResponse[] = [
      ...this.ratingQuestions().map((q) => ({ question_id: q.id, rating: ratings[q.id] })),
      ...this.textQuestions()
        .filter((q) => texts[q.id]?.trim())
        .map((q) => ({ question_id: q.id, text_response: texts[q.id].trim() })),
    ];
    void this.facade.submit({ responses, optional_feedback_text: this.comments().trim() });
  }

  protected backToLab(): void {
    void this.router.navigateByUrl(this.labPath);
  }
}
