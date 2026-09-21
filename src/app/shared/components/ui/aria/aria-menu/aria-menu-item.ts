import { Directive } from '@angular/core';
import { MenuItem } from '@angular/aria/menu';

/**
 * Item inside an `<app-aria-menu>` or `<app-aria-menubar>`. Apply to any
 * element (typically a button or anchor). `value` is required and used as the
 * default `aria-label`.
 */
@Directive({
  selector: '[appAriaMenuItem]',
  hostDirectives: [
    {
      directive: MenuItem,
      inputs: ['id', 'value', 'disabled', 'searchTerm', 'submenu'],
      outputs: ['searchTermChange'],
    },
  ],
  host: {
    class:
      'flex w-full items-center gap-2 px-3 py-2 text-sm rounded outline-none cursor-pointer transition-colors text-popover-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground aria-disabled:opacity-50 aria-disabled:cursor-not-allowed',
  },
})
export class AriaMenuItem {}
