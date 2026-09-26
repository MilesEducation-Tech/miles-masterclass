import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroCheckCircle,
  heroXCircle,
  heroArrowRight,
  heroArrowPath,
} from '@ng-icons/heroicons/outline';
import { Button } from '@shared/ui/button/button';
import { injectDialogRef } from 'ng-primitives/dialog';
import { DialogShell } from '@shared/ui/dialog-shell/dialog-shell';

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
  imports: [CommonModule, NgIconComponent, Button, DialogShell],
  templateUrl: './assessment-result-dialog.html',
  viewProviders: [provideIcons({ heroCheckCircle, heroXCircle, heroArrowRight, heroArrowPath })],
})
export class AssessmentResultDialog implements OnInit {
  private readonly dialogRef = injectDialogRef<AssessmentResultData, AssessmentResultAction>();
  protected readonly data = this.dialogRef.data;
  private readonly platformId = inject(PLATFORM_ID);

  ngOnInit() {
    if (this.data.isPassed && isPlatformBrowser(this.platformId)) {
      void this.fireConfetti();
    }
  }

  async fireConfetti(): Promise<void> {
    // canvas-confetti loads only for a pass (PROMPT.md §1 heavy-library list).
    const { default: confetti } = await import('canvas-confetti');
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
