import { Directive } from '@angular/core';
import { MenuTrigger } from '@angular/aria/menu';

/**
 * Attribute-style trigger for `<app-aria-menu>`. Apply `appAriaMenuTrigger` to
 * any interactive element (typically a button) and bind `[menu]` to the menu
 * reference.
 */
@Directive({
  selector: '[appAriaMenuTrigger]',
  hostDirectives: [
    {
      directive: MenuTrigger,
      inputs: ['menu', 'disabled', 'softDisabled'],
    },
  ],
  host: {
    class:
      'inline-flex items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md transition-colors cursor-pointer',
  },
})
export class AriaMenuTrigger {}
