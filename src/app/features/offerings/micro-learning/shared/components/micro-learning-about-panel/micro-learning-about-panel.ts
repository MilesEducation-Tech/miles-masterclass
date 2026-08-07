import { Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matInfoRound } from '@ng-icons/material-icons/round';
import { DialogRef } from '../../../../../../shared/core/services/dialog/dialog';
import { Button } from '../../../../../../shared/components/ui/button/button';
import { CourseAbout } from '../../../../../../shared/components/course-about/course-about';

@Component({
  selector: 'app-micro-learning-about-panel',
  imports: [NgIcon, Button, CourseAbout],
  templateUrl: './micro-learning-about-panel.html',
  styleUrl: './micro-learning-about-panel.css',
  viewProviders: [provideIcons({ matInfoRound })],
})
export class MicroLearningAboutPanel {
  dialogRef!: DialogRef<MicroLearningAboutPanel>;
  data!: any;

  close(): void {
    this.dialogRef.close();
  }
}
