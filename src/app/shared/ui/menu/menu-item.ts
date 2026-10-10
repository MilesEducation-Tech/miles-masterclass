import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgpMenuItem } from 'ng-primitives/menu';

/** One action inside an `app-menu`. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'button[app-menu-item]',
  hostDirectives: [NgpMenuItem],
  host: {
    type: 'button',
    class:
      'flex h-9 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-start text-sm text-foreground outline-none data-hover:bg-muted data-focus-visible:bg-muted data-press:bg-secondary data-disabled:cursor-not-allowed data-disabled:text-muted-foreground',
  },
  template: ` <ng-content /> `,
})
export class MenuItem {}
