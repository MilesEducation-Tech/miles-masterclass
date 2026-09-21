import { Component, inject } from '@angular/core';
import { MenuBar } from '@angular/aria/menu';

/**
 * Horizontal menubar — host directive: `[ngMenuBar]`. Project
 * `appAriaMenuTrigger` buttons inside that point at sibling
 * `<app-aria-menu>` popovers.
 */
@Component({
  selector: 'app-aria-menubar',
  exportAs: 'appAriaMenubar',
  templateUrl: './aria-menubar.html',
  styleUrl: './aria-menubar.css',
  hostDirectives: [
    {
      directive: MenuBar,
      inputs: ['disabled', 'softDisabled', 'wrap', 'typeaheadDelay', 'value'],
      outputs: ['valueChange', 'itemSelected'],
    },
  ],
  host: {
    class:
      'inline-flex items-center gap-1 p-1 rounded-md bg-secondary/40 border border-border/40 outline-none focus-visible:ring-2 focus-visible:ring-ring',
  },
})
export class AriaMenubar<V = unknown> {
  readonly menubar = inject(MenuBar) as MenuBar<V>;
}
