import { Component, effect, inject, signal, untracked } from '@angular/core';
import { injectDialogRef } from 'ng-primitives/dialog';
import { Dialog } from '@shared/ui/dialog/dialog';
import { ChapterQuiz } from '@features/offerings/components/chapter-quiz/chapter-quiz';
import { MicroLearningQuizDialogData } from '@features/offerings/models/reel.model';
import { CourseChapterFacade } from '@features/offerings/services/course-chapter-facade';
import { CourseChapterQuizFacade } from '@features/offerings/services/course-chapter-quiz-facade';

/**
 * A reel's chapter quiz, in a pop-up over the player: the chapter page's quiz
 * panel, on the chapter page's facades.
 *
 * Those two are provided here, so they live exactly as long as the pop-up; the
 * course read (`CourseDetailFacade`) and `FinalAssessmentFacade` come from the
 * reel's route, through the injector the player opens this with, already
 * connected to the reel and loaded. The quiz runs as on a chapter page: each
 * answer graded, then on to the final assessment when the server offers it.
 *
 * The pop-up follows the quiz: it closes when the quiz does ("Watch again", on
 * to the final assessment, a refusal), and when there turns out to be nothing
 * to take. Closed from outside (×, Esc, the backdrop), it takes the quiz with it.
 */
@Component({
  selector: 'app-micro-learning-quiz-dialog',
  imports: [ChapterQuiz, Dialog],
  template: `
    <app-dialog ariaLabel="Reel quiz" [closable]="true" panelClass="w-[min(92vw,52rem)] p-0">
      <app-chapter-quiz class="min-h-96" />
    </app-dialog>
  `,
  providers: [CourseChapterFacade, CourseChapterQuizFacade],
})
export class MicroLearningQuizDialog {
  private readonly dialogRef = injectDialogRef<MicroLearningQuizDialogData>();
  private readonly quiz = inject(CourseChapterQuizFacade);

  constructor() {
    inject(CourseChapterFacade).connect(signal(this.dialogRef.data.chapterId));
    // The course is loaded, so the reel's chapter is known: its quiz opens now
    // rather than waiting for the chapter page's "video done" rule.
    this.quiz.open();

    effect(() => {
      if (!this.quiz.isOpen()) untracked(() => this.dialogRef.close());
    });
  }
}
