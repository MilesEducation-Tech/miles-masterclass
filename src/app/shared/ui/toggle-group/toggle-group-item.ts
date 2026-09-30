import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgpButton } from 'ng-primitives/button';
import { NgpToggleGroupItem } from 'ng-primitives/toggle-group';

/** One option inside an `app-toggle-group`. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'button[app-toggle-group-item]',
  hostDirectives: [
    {
      directive: NgpToggleGroupItem,
      inputs: ['ngpToggleGroupItemValue:value', 'ngpToggleGroupItemDisabled:disabled'],
    },
    {
      directive: NgpButton,
      inputs: ['disabled'],
    },
  ],
  host: {
    class:
      'inline-flex h-8 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors data-hover:bg-muted data-hover:text-foreground data-press:bg-secondary data-selected:bg-primary data-selected:text-primary-foreground data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50',
  },
  template: ` <ng-content /> `,
})
export class ToggleGroupItem {}
