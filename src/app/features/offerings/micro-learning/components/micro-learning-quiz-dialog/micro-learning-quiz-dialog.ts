import { Component, inject } from '@angular/core';
import { injectDialogRef } from 'ng-primitives/dialog';
import { DialogShell } from '@shared/ui/dialog-shell/dialog-shell';
import { ChapterQuiz } from '../../../components/chapter-quiz/chapter-quiz';
import {
  ActionStatus,
  MicroLearningReel,
} from '@features/offerings/models/micro-learning-course.model';
import { CourseChapter } from '@core/models/course.model';
import { Button } from '@shared/ui/button/button';
import { MicroLearningCourseFacade } from '../../../services/micro-learning-course-facade';

export interface MicroLearningQuizDialogData {
  reel: MicroLearningReel;
}

/**
 * Thin wrapper that hosts the shared `ChapterQuiz` component in a dialog.
 * `ChapterQuiz` takes signal-based required inputs, which a dialog opened by
 * `NgpDialogManager.open()` can't be handed directly; this wrapper reads the
 * reel from `injectDialogRef().data` and adapts it into the `CourseChapter`
 * shape `ChapterQuiz` expects.
 */
@Component({
  selector: 'app-micro-learning-quiz-dialog',
  imports: [ChapterQuiz, Button, DialogShell],
  template: `
    <app-dialog-shell maxWidth="100%" ariaLabel="Chapter quiz">
      <div class="w-[min(92vw,52rem)] min-h-[24rem]">
        @if (reelRef.quiz_details?.questions?.length) {
          <app-chapter-quiz
            [questions]="reelRef.quiz_details!.questions"
            [chapterId]="reelRef.chapter_id"
            [current]="chapterLike"
            [isLastChapter]="true"
            (lastAnswerSubmitted)="onLastAnswerSubmitted()"
            (navigateNext)="onNavigateNext()"
            (togglePreviewMode)="close()"
          />
        } @else {
          <div class="flex flex-col items-center gap-4 text-center py-12">
            <h2 class="text-lg font-semibold">Chapter Quiz</h2>
            <p class="text-sm text-muted-foreground">
              No quiz questions are available for this reel yet.
            </p>
            <app-button variant="default" (clicked)="close()">Close</app-button>
          </div>
        }
      </div>
    </app-dialog-shell>
  `,
})
export class MicroLearningQuizDialog {
  private readonly dialogRef = injectDialogRef<MicroLearningQuizDialogData>();
  protected readonly data = this.dialogRef.data;

  private readonly facade = inject(MicroLearningCourseFacade);

  get reelRef(): MicroLearningReel {
    return this.data.reel;
  }

  /** Adapt reel → minimal `CourseChapter` shape for `ChapterQuiz`. */
  get chapterLike(): CourseChapter {
    const r = this.reelRef;
    return {
      id: r.chapter_id,
      chapter_name: r.title,
      chapter_thumbnail: r.thumbnail,
      description: r.course_short_overview,
      video_url: r.video_url,
      quiz_details: r.quiz_details,
    } as unknown as CourseChapter;
  }

  /**
   * Fires the moment the submit-answer API for the **last** question resolves —
   * before the 10s auto-nav timer and before the user clicks "Start Final
   * Assessment". Flip the reel's `action_status` to `TAKE_EXAM` here so the
   * reel-card CTA reads "Take Final Assessment" the instant the answer lands,
   * even if the user dismisses the dialog mid-timer.
   */
  onLastAnswerSubmitted(): void {
    this.facade.markActiveReelActionStatus(ActionStatus.TAKE_EXAM);
  }

  /**
   * Fires when the user clicks "Start Final Assessment" (last question, last
   * chapter) OR the 10s auto-nav timer completes in `ChapterQuiz`. Matches
   * video-chapter's `handleQuizNext → startFinalAssessment.emit()` behaviour.
   *
   * Also flips action_status here as a fallback for the pre-loaded scenario:
   * if the user re-opens the quiz with answers already submitted server-side,
   * `submitAnswer` early-returns (isSubmitted=true) and `lastAnswerSubmitted`
   * never fires. Calling `markActiveReelActionStatus` here is idempotent with
   * the fresh-submit path.
   */
  onNavigateNext(): void {
    this.facade.markActiveReelActionStatus(ActionStatus.TAKE_EXAM);
    this.dialogRef.close();
    this.facade.startFinalAssessment();
  }

  close(): void {
    this.dialogRef.close();
  }
}
