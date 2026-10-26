import { Component } from '@angular/core';
import { AiLabQuiz } from '@features/ai-labs/components/ai-lab-quiz/ai-lab-quiz';
import { Dialog } from '@shared/ui/dialog/dialog';

/**
 * The lab's quiz as a pop-up — how the v3 lab page and micro-learning show the chapter quiz
 * (`MicroLearningQuizDialog`). A frame only: `AiLabQuiz` reads `AiLabQuizFacade`, which opens this
 * with the page's injector so the route-scoped facades resolve, and closes it on "Watch again" or
 * on to the final assessment. A backdrop click or Esc closes it the same way.
 */
@Component({
  selector: 'app-ai-lab-quiz-dialog',
  imports: [AiLabQuiz, Dialog],
  template: `
    <app-dialog ariaLabel="Lab quiz" [closable]="true" panelClass="w-[min(92vw,52rem)] p-0">
      <app-ai-lab-quiz class="min-h-96" />
    </app-dialog>
  `,
})
export class AiLabQuizDialog {}
