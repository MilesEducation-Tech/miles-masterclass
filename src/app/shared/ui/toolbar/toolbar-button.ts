import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgpButton } from 'ng-primitives/button';
import { NgpRovingFocusItem } from 'ng-primitives/roving-focus';

/** One action inside an `app-toolbar`. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'button[app-toolbar-button]',
  hostDirectives: [
    { directive: NgpButton, inputs: ['disabled'] },
    {
      directive: NgpRovingFocusItem,
      inputs: ['ngpRovingFocusItemDisabled:disabled'],
    },
  ],
  host: {
    type: 'button',
    class:
      'inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground outline-none data-hover:bg-muted data-hover:text-foreground data-press:bg-secondary data-focus-visible:outline-2 data-focus-visible:outline-solid data-focus-visible:outline-offset-2 data-focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50',
  },
  template: ` <ng-content /> `,
})
export class ToolbarButton {}
