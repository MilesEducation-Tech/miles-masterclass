import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgpMenu } from 'ng-primitives/menu';

/**
 * A menu panel of `button[app-menu-item]`s. Open it from ng-primitives' own trigger:
 * `<button [ngpMenuTrigger]="menu">` with `<ng-template #menu><app-menu>…</app-menu></ng-template>`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-menu',
  hostDirectives: [NgpMenu],
  host: {
    class:
      'fixed z-1001 flex min-w-40 origin-(--ngp-menu-transform-origin) flex-col gap-0.5 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none data-enter:animate-in data-enter:fade-in-0 data-enter:zoom-in-95 data-exit:animate-out data-exit:fade-out-0 data-exit:zoom-out-95 motion-reduce:animate-none',
  },
  template: ` <ng-content /> `,
})
export class Menu {}
