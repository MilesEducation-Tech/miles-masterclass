import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
  effect,
} from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Button } from '../../../../../shared/components/ui/button/button';
import { Logger } from '../../../../../shared/core/services/logger/logger';

@Component({
  selector: 'app-chapter-quiz',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgOptimizedImage, Button],
  templateUrl: './chapter-quiz.html',
  styleUrl: './chapter-quiz.css',
})
export class ChapterQuiz {
  readonly questions = input.required<any[]>();
  readonly current = input.required<any>();
  readonly chapterId = input.required<number>();
  readonly isLastChapter = input(false);
  readonly navigateNext = output<void>();
  readonly togglePreviewMode = output<'video' | 'quiz'>();
  /**
   * Fires once the submit-answer API call for the **last** question resolves
   * successfully. Lets parents flip post-quiz state (e.g. action_status →
   * TAKE_EXAM) the moment the answer lands, ahead of the auto-nav timer or
   * the user clicking "Start Final Assessment".
   */
  readonly lastAnswerSubmitted = output<void>();

  private readonly logger = inject(Logger);

  readonly currentQuestionIndex = signal(0);
  readonly selectedOption = signal<string | null>(null);
  readonly isSubmitted = signal(false);
  readonly isLoading = signal(false);
  readonly autoNavTimer = signal<number | null>(null);

  private timerInterval: any;

  constructor() {
    effect(() => {
      const question = this.currentQuestion();
      if (question && question.user_selected_option) {
        this.selectedOption.set(question.user_selected_option);
        this.isSubmitted.set(true);
      } else {
        this.selectedOption.set(null);
        this.isSubmitted.set(false);
      }
    });

    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }

  readonly currentQuestion = computed(() => {
    const questions = this.questions();
    const index = this.currentQuestionIndex();
    return questions[index];
  });

  readonly isLastQuestion = computed(() => {
    return this.currentQuestionIndex() === this.questions().length - 1;
  });

  readonly progressText = computed(() => {
    return `Question ${this.currentQuestionIndex() + 1} of ${this.questions().length}`;
  });

  readonly isCorrect = computed(() => {
    if (!this.isSubmitted()) return null;
    return this.selectedOption() === this.currentQuestion().correct_option;
  });

  selectOption(optionKey: string) {
    if (this.isSubmitted() || this.isLoading()) return;
    this.selectedOption.set(optionKey);
    this.submitAnswer();
  }

  submitAnswer() {
    if (!this.selectedOption() || this.isSubmitted()) return;

    // ponytail: #8 `POST quiz/{chapterId}/submit/` goes here — one question per
    // request, returning that question's feedback immediately, which is exactly
    // the shape this component already drives.
    //
    // It is deliberately NOT bound yet. G-01 leaves
    // `CAIRAMasterclassQuizQuestionSerializer` uncaptured, and unlike the
    // feedback questions there is no sibling endpoint that reveals it: #7 nests
    // options under `options_feedback`, while this component still reads the
    // Django-era `option_a` / `description_option_a` pair. Guessing the option
    // shape here would submit wrong answers to a scored, CPE-bearing quiz — a
    // worse failure than not submitting at all. Capture #7 first.
    //
    // When it lands, note that `correct_option_ids` comes from a Python `set`:
    // compare as sets, never index positionally.
    this.isLoading.set(false);
    this.logger.warn('Quiz submit is not bound — see G-01', {
      chapterId: this.chapterId(),
      questionId: this.currentQuestion()?.id,
    });
  }

  prevQuestion() {
    if (this.currentQuestionIndex() > 0) {
      this.currentQuestionIndex.update((i) => i - 1);
    }
  }

  nextQuestion() {
    if (this.isLastQuestion()) {
      this.navigateNext.emit();
    } else {
      this.currentQuestionIndex.update((i) => i + 1);
    }
  }

  resetState() {
    this.selectedOption.set(null);
    this.isSubmitted.set(false);
    this.isLoading.set(false);
  }

  getOptionText(question: any, option: string): string {
    return (question as any)[`option_${option}`] || '';
  }

  getDescription(question: any, option: string | null): string {
    if (!option) return '';
    return (question as any)[`description_option_${option}`] || '';
  }

  private startAutoNavTimer() {
    this.autoNavTimer.set(10);
    this.timerInterval = setInterval(() => {
      const current = this.autoNavTimer();
      if (current !== null && current > 0) {
        this.autoNavTimer.set(current - 1);
      } else {
        this.stopTimer();
        this.navigateNext.emit();
      }
    }, 1000);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
}
