import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';
import { matPlayArrowRound } from '@ng-icons/material-icons/round';
import { phosphorShareFatFill } from '@ng-icons/phosphor-icons/fill';
import { injectDialogRef } from 'ng-primitives/dialog';
import { MasterclassCourseInfoDialogData } from '@core/models/masterclass-home.model';
import { MilesSlug } from '@shared/components/miles-slug/miles-slug';
import { Button } from '@shared/ui/button/button';
import { Dialog } from '@shared/ui/dialog/dialog';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';
import { MasterclassCourseAbout } from '@features/offerings/masterclass/components/masterclass-course-about/masterclass-course-about';

/**
 * The landing page's "i" dialog: a course's header and its About section, in
 * the shared `CourseInfo` design class for class. That one stays on the legacy
 * `ContentAbout` for the other pages that open it.
 *
 * The header paints at once from the card the learner clicked; the About body
 * and the instructor line follow from `course-detail/`, read through the
 * dialog's own `CourseDetailFacade`, which the About section injects too.
 * Bookmark is held back until its web route is bound.
 */
@Component({
  selector: 'app-masterclass-course-info-dialog',
  imports: [NgOptimizedImage, NgIcon, Button, Dialog, MilesSlug, MasterclassCourseAbout],
  templateUrl: './masterclass-course-info-dialog.html',
  providers: [
    CourseDetailFacade,
    provideIcons({ heroXMark, matPlayArrowRound, phosphorShareFatFill }),
  ],
})
export class MasterclassCourseInfoDialog {
  private readonly dialogRef = injectDialogRef<MasterclassCourseInfoDialogData>();
  protected readonly card = this.dialogRef.data.course;
  protected readonly facade = inject(CourseDetailFacade);

  protected readonly instructorNames = computed(
    () =>
      this.facade
        .course()
        ?.instructors.map((instructor) => instructor.name)
        .join(', ') ?? '',
  );

  constructor() {
    this.facade.connect('masterclass', signal({ courseId: this.card.id, slug: this.card.slug }));
  }

  close(): void {
    this.dialogRef.close();
  }

  /** Watch Now opens the course page, as the shared dialog does. */
  watchNow(): void {
    this.dialogRef.close();
    this.facade.openCoursePage();
  }
}
