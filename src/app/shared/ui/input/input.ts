import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgpInput } from 'ng-primitives/input';

/** A native `<input>`; bind it with `[formField]` directly. `id` is exposed so `<label for>` can name it. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'input[app-input]',
  hostDirectives: [{ directive: NgpInput, inputs: ['id', 'disabled'] }],
  host: {
    class:
      'h-10 w-full rounded-lg border border-input bg-background px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 data-invalid:data-touched:border-destructive',
  },
  template: '',
})
export class Input {}
