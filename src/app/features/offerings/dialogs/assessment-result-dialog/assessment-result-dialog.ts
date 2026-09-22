import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroCheckCircle,
  heroXCircle,
  heroArrowRight,
  heroArrowPath,
} from '@ng-icons/heroicons/outline';
import confetti from 'canvas-confetti';
import { Button } from '@shared/ui/button/button';
import { DialogRef } from '@core/services/dialog/dialog';

export interface AssessmentResultData {
  isPassed: boolean;
  score: number;
  message: string;
  passingScore?: number;
}

export type AssessmentResultAction = 'report' | 'course' | 'retake';

@Component({
  selector: 'app-assessment-result-dialog',
  standalone: true,
  imports: [CommonModule, NgIconComponent, Button],
  templateUrl: './assessment-result-dialog.html',
  viewProviders: [provideIcons({ heroCheckCircle, heroXCircle, heroArrowRight, heroArrowPath })],
})
export class AssessmentResultDialog implements OnInit {
  dialogRef!: DialogRef<AssessmentResultDialog, AssessmentResultAction>;
  data!: AssessmentResultData;

  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  ngOnInit() {
    if (this.data.isPassed && isPlatformBrowser(this.platformId)) {
      this.fireConfetti();
    }
  }

  fireConfetti() {
    const duration = 3000;
    const end = Date.now() + duration;

    (function frame() {
      // launch a few confetti from the left edge
      confetti({
        particleCount: 7,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
      });
      // and a few from the right edge
      confetti({
        particleCount: 7,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }

  onAction(action: AssessmentResultAction) {
    this.dialogRef.close(action);
  }
}
