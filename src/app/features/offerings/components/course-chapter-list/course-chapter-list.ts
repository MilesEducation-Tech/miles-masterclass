import { Component, computed, inject, input } from '@angular/core';
import { MasterclassFacade } from '../../services/masterclass-facade';
import { NgOptimizedImage } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matAccessTimeRound,
  matDownloadDoneRound,
  matLockRound,
  matPlayArrowRound,
  matTimelapseRound,
} from '@ng-icons/material-icons/round';
import { DurationPipe } from '@shared/pipes/duration/duration-pipe';
import { Progress } from '@shared/ui/progress/progress';
import { RecordDisk } from '@shared/components/record-disk/record-disk';
import { Utils } from '@shared/services/utils';

@Component({
  selector: 'app-course-chapter-list',
  imports: [NgOptimizedImage, NgIcon, DurationPipe, Progress, RecordDisk],
  templateUrl: './course-chapter-list.html',
  styleUrl: './course-chapter-list.css',
  providers: [
    provideIcons({
      matPlayArrowRound,
      matAccessTimeRound,
      matDownloadDoneRound,
      matTimelapseRound,
      matLockRound,
    }),
  ],
})
export class CourseChapterList {
  courseType = input<'masterclass' | 'podcast'>('masterclass');

  readonly masterclass = inject(MasterclassFacade);
  private readonly utils = inject(Utils);

  /**
   * Paid course the user can't access. Course-level, not per-chapter — the
   * subscription covers the whole course, so every row locks together.
   *
   * Clicking a locked row already opens the upsell via the gate in
   * `navigateToChapter`; this is the visible half of that so the rows don't
   * look freely playable.
   */
  readonly locked = computed(() => {
    const course = this.masterclass.courseDetails();
    return !!course && !this.utils.canAccessCpeMode(course);
  });

  /**
   * Box the lock scrim onto the actual artwork. Masterclass fills the whole
   * 16:9 thumbnail, but the podcast record disk sits in a nested `h-full
   * aspect-square` box inside it — `inset-0` there would scrim a wide strip of
   * empty background instead of the cover art.
   *
   * Built as one string rather than static `class` + `[class]` so there's no
   * question of how the two merge.
   */
  readonly lockOverlayClass = computed(
    () =>
      'absolute z-30 flex flex-col items-center justify-center gap-2 bg-black/75 px-4 text-center backdrop-blur-[2px] ' +
      (this.courseType() === 'podcast' ? 'inset-y-0 left-0 aspect-square' : 'inset-0'),
  );

  /**
   * Keyboard equivalent of the click on the thumbnail and title, which are
   * `role="button"` divs rather than real buttons — the thumbnail wraps
   * images and overlays that can't live inside a `<button>`.
   */
  protected onChapterKeydown(event: KeyboardEvent, chapterId: number): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.masterclass.navigateToChapter(chapterId);
  }

  getChapterCompletedStatus(chapterId: number) {
    return (
      (this.masterclass.courseDetails()?.cpe_mode_details?.cpe_mode === true &&
        this.masterclass
          .courseDetails()
          ?.chapter_wise_details?.find((chapter) => chapter.chapter_id === chapterId)?.status) ||
      (this.masterclass.courseDetails()?.cpe_mode_details?.cpe_mode === false &&
        this.masterclass.courseChapters()?.find((chapter) => chapter.id === chapterId)?.play_history
          ?.is_completed)
    );
  }
}
