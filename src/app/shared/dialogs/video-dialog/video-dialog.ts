import { Component } from '@angular/core';
import { injectDialogRef } from 'ng-primitives/dialog';

import { VideoJs, VideoSource, VideoConfig } from '@shared/components/video-js/video-js';
import { Button } from '@shared/ui/button/button';
import { Dialog } from '@shared/ui/dialog/dialog';

export interface VideoDialogData {
  title?: string;
  videoSource: VideoSource | VideoSource[];
  videoConfig?: VideoConfig;
}

@Component({
  selector: 'app-video-dialog',
  imports: [VideoJs, Button, Dialog],
  template: `
    <!-- The panel shrinks to the 50vw player and centres; max-w-none lifts its 32rem cap. -->
    <app-dialog [ariaLabel]="data.title || 'Video'" panelClass="p-0 max-w-none">
      <div class="h-full w-[50vw] flex flex-col bg-background text-foreground overflow-hidden">
        <!-- Header -->
        <div
          class="flex items-center justify-between p-4 border-b border-border z-10 bg-background relative shrink-0"
        >
          @if (data.title) {
            <h2 class="text-lg font-semibold truncate pe-4">{{ data.title }}</h2>
          } @else {
            <!-- Spacer to ensure close button alignment if needed -->
            <span></span>
          }

          <button
            app-button
            type="button"
            aria-label="Close dialog"
            variant="close"
            size="icon"
            (click)="close()"
          ></button>
        </div>

        <!-- Video Content -->
        <div class="flex-1 relative bg-black w-full aspect-video rounded-b-lg overflow-hidden">
          <app-video-js
            class="w-full h-full block"
            [videoSource]="data.videoSource"
            [config]="data.videoConfig"
          />
        </div>
      </div>
    </app-dialog>
  `,
  host: { class: 'block h-full w-full max-h-[inherit]' },
})
export class VideoDialog {
  private readonly dialogRef = injectDialogRef<VideoDialogData>();
  protected readonly data = this.dialogRef.data;

  close(): void {
    this.dialogRef.close();
  }
}
