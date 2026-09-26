import { Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matInfoRound } from '@ng-icons/material-icons/round';
import { injectDialogRef } from 'ng-primitives/dialog';
import { DialogShell } from '@shared/ui/dialog-shell/dialog-shell';
import { Button } from '@shared/ui/button/button';
import { CourseAbout } from '@shared/components/course-about/course-about';
import { ContentAbout } from '@core/models/course.model';

@Component({
  selector: 'app-micro-learning-about-panel',
  imports: [NgIcon, Button, CourseAbout, DialogShell],
  templateUrl: './micro-learning-about-panel.html',
  styleUrl: './micro-learning-about-panel.css',
  viewProviders: [provideIcons({ matInfoRound })],
})
export class MicroLearningAboutPanel {
  private readonly dialogRef = injectDialogRef<ContentAbout>();
  protected readonly data = this.dialogRef.data;

  close(): void {
    this.dialogRef.close();
  }
}
