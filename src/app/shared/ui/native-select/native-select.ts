import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgpNativeSelect } from 'ng-primitives/select';

/**
 * A native `<select>` with the platform's own dropdown; bind it with `[formField]` directly.
 * `color-scheme: dark` keeps the option list on the site's dark palette.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'select[app-select]',
  hostDirectives: [
    { directive: NgpNativeSelect, inputs: ['id', 'ngpNativeSelectDisabled:disabled'] },
  ],
  host: {
    class:
      'h-10 w-full cursor-pointer rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none [color-scheme:dark] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 data-invalid:data-touched:border-destructive',
  },
  template: ` <ng-content /> `,
})
export class NativeSelect {}
