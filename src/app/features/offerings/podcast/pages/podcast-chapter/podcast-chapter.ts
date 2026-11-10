import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Backward } from '@shared/components/backward/backward';
import { Button } from '@shared/ui/button/button';
import { CourseChapterPlayer } from '@features/offerings/components/course-chapter-player/course-chapter-player';
import { CourseChapterFacade } from '@features/offerings/services/course-chapter-facade';
import { CourseChapterQuizFacade } from '@features/offerings/services/course-chapter-quiz-facade';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';

/**
 * The podcast chapter page: `…/podcast/:courseId/:courseTitle/chapter/:chapterId/:chapterTitle`.
 * The masterclass chapter page with podcast copy: it points the two facades at
 * the URL and decides between the player and the error states; the player does
 * the rest through `CourseChapterFacade`.
 *
 * Every chapter plays in the shared video player: `course-detail/` sends a podcast
 * chapter's `hls_video_url` and nothing says whether it is audio (asked of the
 * backend on 2026-11-06). The record-disk audio player returns here when it does.
 */
@Component({
  selector: 'app-podcast-chapter',
  imports: [Backward, Button, CourseChapterPlayer, RouterLink],
  templateUrl: './podcast-chapter.html',
  // On the page, not the route, for the reason `MasterclassChapter` gives: a route
  // injector outlives the page, and the last progress save goes out on destroy.
  providers: [CourseChapterFacade, CourseChapterQuizFacade],
})
export class PodcastChapter {
  // Route params, bound by `withComponentInputBinding`.
  readonly courseId = input<string>();
  readonly courseTitle = input<string>();
  readonly chapterId = input<string>();

  protected readonly facade = inject(CourseChapterFacade);

  constructor() {
    inject(CourseDetailFacade).connect(
      'podcast',
      computed(() => ({ courseId: this.courseId(), slug: this.courseTitle() })),
    );
    this.facade.connect(this.chapterId);
  }
}
