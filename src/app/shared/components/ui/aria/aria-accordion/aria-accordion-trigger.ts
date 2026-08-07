import { Directive } from '@angular/core';
import { AccordionTrigger } from '@angular/aria/accordion';

/**
 * Trigger that toggles a sibling `<app-aria-accordion-panel>`. Apply
 * `appAriaAccordionTrigger` to a button and bind `[panel]` to the panel
 * reference's `.panel` getter, e.g. `[panel]="p.panel"` with
 * `#p="appAriaAccordionPanel"`.
 */
@Directive({
  selector: '[appAriaAccordionTrigger]',
  hostDirectives: [
    {
      directive: AccordionTrigger,
      inputs: ['panel', 'id', 'disabled', 'expanded'],
      outputs: ['expandedChange'],
    },
  ],
  host: {
    class:
      'w-full flex items-center justify-between gap-2 py-2 px-1 text-left text-sm font-medium text-foreground rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring',
  },
})
export class AriaAccordionTrigger {}
