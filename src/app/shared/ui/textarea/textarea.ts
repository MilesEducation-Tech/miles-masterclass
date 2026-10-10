import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgpTextarea } from 'ng-primitives/textarea';

/** A native `<textarea>`; bind it with `[formField]` directly. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'textarea[app-textarea]',
  hostDirectives: [{ directive: NgpTextarea, inputs: ['id', 'disabled'] }],
  host: {
    class:
      'min-h-24 w-full resize-y rounded-lg border border-input bg-background px-4 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 data-invalid:data-touched:border-destructive',
  },
  template: ` <ng-content /> `,
})
export class Textarea {}
