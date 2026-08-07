import { Directive } from '@angular/core';
import { Tab } from '@angular/aria/tabs';

/**
 * Individual tab — apply as attribute on a `<button>`. Bind `[value]` to the
 * unique identifier that matches the corresponding `<app-aria-tab-panel value="…">`.
 */
@Directive({
  selector: '[appAriaTab]',
  hostDirectives: [
    {
      directive: Tab,
      inputs: ['id', 'disabled', 'value'],
    },
  ],
  host: {
    class:
      'px-4 py-1.5 rounded-full text-sm font-medium cursor-pointer select-none transition-colors capitalize outline-none focus-visible:ring-2 focus-visible:ring-ring text-muted-foreground hover:text-foreground aria-selected:bg-primary aria-selected:text-white aria-disabled:opacity-50 aria-disabled:cursor-not-allowed',
  },
})
export class AriaTab {}
