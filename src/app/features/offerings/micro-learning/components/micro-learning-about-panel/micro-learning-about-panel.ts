import { Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matInfoRound } from '@ng-icons/material-icons/round';
import { injectDialogRef } from 'ng-primitives/dialog';

import { Button } from '@shared/ui/button/button';
import { CourseAbout } from '@shared/components/course-about/course-about';
import { ContentAbout } from '@core/models/course.model';
import { Dialog } from '@shared/ui/dialog/dialog';
import { heroXMark } from '@ng-icons/heroicons/outline';

@Component({
  selector: 'app-micro-learning-about-panel',
  imports: [NgIcon, Button, CourseAbout, Dialog],
  templateUrl: './micro-learning-about-panel.html',
  host: { class: 'block h-full' },
  viewProviders: [provideIcons({ matInfoRound, heroXMark })],
})
export class MicroLearningAboutPanel {
  private readonly dialogRef = injectDialogRef<ContentAbout>();
  protected readonly data = this.dialogRef.data;

  close(): void {
    this.dialogRef.close();
  }
}
