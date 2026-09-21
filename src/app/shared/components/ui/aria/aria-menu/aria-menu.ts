import { Component, inject } from '@angular/core';
import { Menu } from '@angular/aria/menu';

/**
 * Popover menu container — host directive: `[ngMenu]`.
 * Project `<button appAriaMenuItem value="...">` children inside.
 * Capture the menu via `#m="appAriaMenu"` and pass `m.menu` to triggers.
 */
@Component({
  selector: 'app-aria-menu',
  exportAs: 'appAriaMenu',
  templateUrl: './aria-menu.html',
  styleUrl: './aria-menu.css',
  hostDirectives: [
    {
      directive: Menu,
      inputs: ['id', 'wrap', 'typeaheadDelay', 'disabled', 'expansionDelay'],
      outputs: ['itemSelected'],
    },
  ],
  host: {
    role: 'menu',
    class:
      'block bg-popover text-popover-foreground border border-border rounded-md shadow-lg p-1 min-w-[12rem] outline-none focus-visible:ring-2 focus-visible:ring-ring',
    '[hidden]': '!menu.visible()',
  },
})
export class AriaMenu<V = unknown> {
  readonly menu = inject(Menu) as Menu<V>;
}
