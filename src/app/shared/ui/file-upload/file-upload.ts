import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgpFileUpload } from 'ng-primitives/file-upload';

/**
 * `<button app-file-upload>`: a drop zone that also opens the file dialog on click, Enter or
 * Space; `(selected)` gives the files. The primitive only listens for click and drop, so the
 * native button supplies focus, keyboard activation and the disabled semantics. Project your own
 * prompt, or keep the default text.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'button[app-file-upload]',
  hostDirectives: [
    {
      directive: NgpFileUpload,
      inputs: [
        'ngpFileUploadFileTypes:types',
        'ngpFileUploadMultiple:multiple',
        'ngpFileUploadDirectory:directory',
        'ngpFileUploadDragDrop:dragDrop',
        'ngpFileUploadDisabled:disabled',
      ],
      outputs: ['ngpFileUploadSelected:selected', 'ngpFileUploadCanceled:canceled'],
    },
  ],
  host: {
    type: 'button',
    class:
      'flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-background px-6 py-8 text-center text-sm text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring data-dragover:border-primary data-dragover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50',
    '[attr.disabled]': 'upload.disabled() ? "" : null',
  },
  template: ` <ng-content>Drop files here or click to upload</ng-content> `,
})
export class FileUpload {
  /** The host directive instance; its state object does not expose `disabled`. */
  protected readonly upload = inject(NgpFileUpload);
}
