import { Component } from '@angular/core';
import { DialogRef } from '@core/services/dialog/dialog';
import { VideoJs, VideoSource, VideoConfig } from '../../components/video-js/video-js';
import { Button } from '../../ui/button/button';

export interface VideoDialogData {
  title?: string;
  videoSource: VideoSource | VideoSource[];
  videoConfig?: VideoConfig;
}

@Component({
  selector: 'app-video-dialog',
  imports: [VideoJs, Button],
  template: `
    <div class="h-full w-[50vw] flex flex-col bg-background text-foreground overflow-hidden">
      <!-- Header -->
      <div
        class="flex items-center justify-between p-4 border-b border-border z-10 bg-background relative shrink-0"
      >
        @if (data.title) {
          <h2 class="text-lg font-semibold truncate pr-4">{{ data.title }}</h2>
        } @else {
          <!-- Spacer to ensure close button alignment if needed -->
          <span></span>
        }

        <app-button variant="close" (clicked)="close()" aria-label="Close dialog" />
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
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        max-height: inherit;
      }
    `,
  ],
})
export class VideoDialog {
  dialogRef!: DialogRef<VideoDialog>;
  data!: VideoDialogData;

  close(): void {
    this.dialogRef.close();
  }
}
