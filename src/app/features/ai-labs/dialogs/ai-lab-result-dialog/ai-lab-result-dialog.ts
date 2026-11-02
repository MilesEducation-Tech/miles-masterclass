import { afterNextRender, Component } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowPath, heroCheckCircle, heroXCircle } from '@ng-icons/heroicons/outline';
import { injectDialogRef } from 'ng-primitives/dialog';
import { Button } from '@shared/ui/button/button';
import { Dialog } from '@shared/ui/dialog/dialog';

export interface AiLabResultData {
  isPassed: boolean;
  score: number;
  message: string;
  passingScore?: number;
  /** A failed attempt's cool-off end, as a time of day — the retake is shut until then. */
  retakeAfter?: string | null;
}

/** Back to the lab page, a fresh paper, or the review below the dialog. */
export type AiLabResultAction = 'lab' | 'retake' | 'report';

/**
 * The final assessment's result, for the lab. The masterclass `AssessmentResultDialog`, copied
 * rather than shared (a feature may not import another): the same score card, confetti on a pass,
 * and three ways on. Opened from code with a dynamic `import()`.
 */
@Component({
  selector: 'app-ai-lab-result-dialog',
  imports: [NgIconComponent, Button, Dialog],
  templateUrl: './ai-lab-result-dialog.html',
  viewProviders: [provideIcons({ heroCheckCircle, heroXCircle, heroArrowPath })],
})
export class AiLabResultDialog {
  private readonly dialogRef = injectDialogRef<AiLabResultData, AiLabResultAction>();
  protected readonly data = this.dialogRef.data;

  constructor() {
    // Browser only, and only for a pass — canvas-confetti loads on demand (AGENTS.md §4.5).
    afterNextRender(() => {
      if (this.data.isPassed) void this.fireConfetti();
    });
  }

  private async fireConfetti(): Promise<void> {
    const { default: confetti } = await import('canvas-confetti');
    const end = Date.now() + 3000;
    (function frame() {
      confetti({ particleCount: 7, angle: 60, spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 7, angle: 120, spread: 55, origin: { x: 1 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }

  protected onAction(action: AiLabResultAction): void {
    this.dialogRef.close(action);
  }
}
