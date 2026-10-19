import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroCheckCircle, heroXCircle, heroArrowPath } from '@ng-icons/heroicons/outline';
import { Button } from '@shared/ui/button/button';
import { injectDialogRef } from 'ng-primitives/dialog';

import { Dialog } from '@shared/ui/dialog/dialog';

export interface AssessmentResultData {
  isPassed: boolean;
  score: number;
  message: string;
  passingScore?: number;
}

/** A pass opens the report or goes back to the course; a fail retakes or goes back. */
export type AssessmentResultAction = 'course' | 'retake' | 'report';

@Component({
  selector: 'app-assessment-result-dialog',
  standalone: true,
  imports: [CommonModule, NgIconComponent, Button, Dialog],
  templateUrl: './assessment-result-dialog.html',
  viewProviders: [provideIcons({ heroCheckCircle, heroXCircle, heroArrowPath })],
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
