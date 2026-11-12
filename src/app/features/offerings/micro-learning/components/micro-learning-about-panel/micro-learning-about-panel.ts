import { Component, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matInfoRound } from '@ng-icons/material-icons/round';
import { injectDialogRef } from 'ng-primitives/dialog';
import { Button } from '@shared/ui/button/button';
import { Dialog } from '@shared/ui/dialog/dialog';
import { MasterclassCourseAbout } from '@features/offerings/components/masterclass-course-about/masterclass-course-about';
import { ReelRouteParams } from '@features/offerings/models/reel.model';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';

/**
 * A reel's About, in a side panel. It has its own `CourseDetailFacade`,
 * connected to the reel it was opened for, and renders the course page's About
 * section from it, the way the masterclass course-info dialog does.
 */
@Component({
  selector: 'app-micro-learning-about-panel',
  imports: [NgIcon, Button, Dialog, MasterclassCourseAbout],
  templateUrl: './micro-learning-about-panel.html',
  host: { class: 'block h-full' },
  providers: [CourseDetailFacade],
  viewProviders: [provideIcons({ matInfoRound })],
})
export class MicroLearningAboutPanel {
  private readonly dialogRef = injectDialogRef<ReelRouteParams>();
  protected readonly facade = inject(CourseDetailFacade);

  constructor() {
    this.facade.connect('reels', signal(this.dialogRef.data));
  }

  close(): void {
    this.dialogRef.close();
  }
}
