import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgpSeparator } from 'ng-primitives/separator';

/** `<div app-separator>` or `<div app-separator orientation="vertical">`; ngpSeparator sets the role. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: '[app-separator]',
  hostDirectives: [{ directive: NgpSeparator, inputs: ['ngpSeparatorOrientation:orientation'] }],
  host: {
    class:
      'block shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
  },
  template: ``,
})
export class Separator {}
