import { NgOptimizedImage } from '@angular/common';
import { Component, ElementRef, inject, linkedSignal, viewChild } from '@angular/core';
import { Button } from '@shared/ui/button/button';
import { Checkbox } from '@shared/ui/checkbox/checkbox';
import { AiLabCourseFacade } from '@features/ai-labs/services/ai-lab-course-facade';
import {
  AiLabQuizFacade,
  LAB_QUIZ_AUTO_ADVANCE_SECONDS,
  LAB_QUIZ_COPY,
} from '@features/ai-labs/services/ai-lab-quiz-facade';

/** How an option shows: untouched, ticked before Submit, or graded. */
type OptionState = 'idle' | 'picked' | 'correct' | 'wrong';

/**
 * The lab quiz panel, in the lab page's video frame while the quiz is open. The masterclass
 * chapter quiz (`offerings/components/chapter-quiz`), copied rather than shared — a feature may
 * not import another, and the two screens are kept in step by hand.
 *
 * It reads and calls `AiLabQuizFacade`; the server grades each answer, and this shows the verdict
 * and every option's explanation. A `single` question answers on one click; any other type is a
 * set of checkboxes with a Submit button.
 */
@Component({
  selector: 'app-ai-lab-quiz',
  imports: [NgOptimizedImage, Button, Checkbox],
  templateUrl: './ai-lab-quiz.html',
  host: { class: 'block h-full w-full' },
})
export class AiLabQuiz {
  protected readonly quiz = inject(AiLabQuizFacade);
  protected readonly lab = inject(AiLabCourseFacade).lab;
  protected readonly copy = LAB_QUIZ_COPY;
  protected readonly autoAdvanceSeconds = LAB_QUIZ_AUTO_ADVANCE_SECONDS;

  /** The options chosen before the grade arrives (ticks, or a single click); cleared per question. */
  protected readonly picked = linkedSignal<string | null, string[]>({
    source: () => this.quiz.question()?.id ?? null,
    computation: () => [],
  });

  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  protected optionState(optionId: string): OptionState {
    const grade = this.quiz.grade();
    if (!grade) return this.picked().includes(optionId) ? 'picked' : 'idle';
    if (grade.options[optionId]?.is_correct) return 'correct';
    return grade.selected.includes(optionId) ? 'wrong' : 'idle';
  }

  protected explanationOf(optionId: string): string | null {
    return this.quiz.grade()?.options[optionId]?.explanation ?? null;
  }

  protected answerSingle(optionId: string): void {
    this.picked.set([optionId]);
    void this.quiz.answer([optionId]);
  }

  protected toggle(optionId: string, checked: boolean): void {
    this.picked.update((ids) =>
      checked ? [...ids, optionId] : ids.filter((id) => id !== optionId),
    );
  }

  protected next(): void {
    this.quiz.next();
    this.heading()?.nativeElement.focus();
  }

  protected previous(): void {
    this.quiz.previous();
    this.heading()?.nativeElement.focus();
  }
}
