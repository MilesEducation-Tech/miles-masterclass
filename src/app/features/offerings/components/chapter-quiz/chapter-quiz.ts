import { Component } from '@angular/core';

/**
 * The chapter quiz panel, unbound for now. Its legacy binding is gone: the
 * answer route `user-quiz-details/` and the podcast and micro-learning reads
 * around it answer 404 on UAT, and the client-side grading against
 * `option_a…d` went with them. The web API's `quiz-questions` / `quiz-submit`
 * bind it next; until then nothing renders it.
 */
@Component({
  selector: 'app-chapter-quiz',
  templateUrl: './chapter-quiz.html',
  host: { class: 'block h-full w-full' },
})
export class ChapterQuiz {}
