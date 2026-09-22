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
import { CourseChapter, QuizQuestion } from '@core/models/course.model';
import { ChapterFacade } from '../../services/chapter-facade/chapter-facade';
import { Button } from '@shared/components/ui/button/button';

@Component({
  selector: 'app-chapter-quiz',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgOptimizedImage, Button],
  templateUrl: './chapter-quiz.html',
  styleUrl: './chapter-quiz.css',
})
export class ChapterQuiz {
  readonly questions = input.required<QuizQuestion[]>();
  readonly current = input.required<CourseChapter>();
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

  private readonly facade = inject(ChapterFacade);

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

    this.isLoading.set(true);
    const question = this.currentQuestion();

    this.facade.submitQuizAnswer(this.selectedOption()!, question.id).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.isSubmitted.set(true);

        this.facade.updateUserSelectedOption(this.chapterId(), question.id, this.selectedOption()!);

        if (this.isLastQuestion()) {
          // Emit before `updateChapterStatus` so a future throw in the
          // facade method can't suppress the post-quiz action_status flip.
          this.lastAnswerSubmitted.emit();
          this.facade.updateChapterStatus(this.chapterId());
          this.startAutoNavTimer();
        }
      },
      error: () => {
        this.isLoading.set(false);
        // Handle error if needed
      },
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

  getOptionText(question: QuizQuestion, option: string): string {
    return (question as any)[`option_${option}`] || '';
  }

  getDescription(question: QuizQuestion, option: string | null): string {
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
