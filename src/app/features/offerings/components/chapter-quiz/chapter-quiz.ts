import { NgOptimizedImage } from '@angular/common';
import { Component, ElementRef, inject, linkedSignal, viewChild } from '@angular/core';
import { Button } from '@shared/ui/button/button';
import { Checkbox } from '@shared/ui/checkbox/checkbox';
import {
  ASSESSMENT_COPY,
  QUIZ_AUTO_ADVANCE_SECONDS,
  QUIZ_COPY,
} from '@features/offerings/constants/course-detail';
import { CourseChapterFacade } from '@features/offerings/services/course-chapter-facade';
import { CourseChapterQuizFacade } from '@features/offerings/services/course-chapter-quiz-facade';

/** How an option shows: untouched, ticked before Submit, or graded. */
type OptionState = 'idle' | 'picked' | 'correct' | 'wrong';

/**
 * The chapter quiz panel, in place of the video while the quiz is open. It
 * reads and calls `CourseChapterQuizFacade`, which reads `quiz-questions/` and
 * sends each answer to `quiz-submit/`; the server grades, and this shows the
 * verdict and every option's explanation.
 *
 * A `single` question answers on one click, as the old quiz did. Any other
 * type is a set of checkboxes with a Submit button.
 */
@Component({
  selector: 'app-chapter-quiz',
  imports: [NgOptimizedImage, Button, Checkbox],
  templateUrl: './chapter-quiz.html',
  host: { class: 'block h-full w-full' },
})
export class ChapterQuiz {
  protected readonly quiz = inject(CourseChapterQuizFacade);
  protected readonly chapter = inject(CourseChapterFacade).current;
  protected readonly copy = QUIZ_COPY;
  protected readonly takeAssessment = ASSESSMENT_COPY.take;
  protected readonly autoAdvanceSeconds = QUIZ_AUTO_ADVANCE_SECONDS;

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
