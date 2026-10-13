import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Backward } from '@shared/components/backward/backward';
import { Button } from '@shared/ui/button/button';
import { CourseChapterPlayer } from '@features/offerings/components/course-chapter-player/course-chapter-player';
import { CourseChapterFacade } from '@features/offerings/services/course-chapter-facade';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';

/**
 * The masterclass chapter page: `…/:courseId/:courseTitle/chapter/:chapterId/:chapterTitle`.
 *
 * It points the two facades at the URL and decides between the player and the
 * error states; the player does the rest through `CourseChapterFacade`. The
 * course comes from the `course-detail/` read the parent route's
 * `CourseDetailFacade` already holds when the learner came from the course page.
 */
@Component({
  selector: 'app-masterclass-chapter',
  imports: [Backward, Button, CourseChapterPlayer, RouterLink],
  templateUrl: './masterclass-chapter.html',
})
export class MasterclassChapter {
  // Route params, bound by `withComponentInputBinding`.
  readonly courseId = input<string>();
  readonly courseTitle = input<string>();
  readonly chapterId = input<string>();

  protected readonly facade = inject(CourseChapterFacade);

  constructor() {
    inject(CourseDetailFacade).connect(
      'masterclass',
      computed(() => ({ courseId: this.courseId(), slug: this.courseTitle() })),
    );
    this.facade.connect(this.chapterId);
  }
}
