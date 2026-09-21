import { Component, inject } from '@angular/core';
import { AccordionContent, AccordionPanel } from '@angular/aria/accordion';

/**
 * Panel container — host directive: `[ngAccordionPanel]`. Wraps projected
 * content in `ng-template[ngAccordionContent]` for lazy rendering. Capture via
 * `#p="appAriaAccordionPanel"` and pass `p.panel` to the trigger.
 */
@Component({
  selector: 'app-aria-accordion-panel',
  exportAs: 'appAriaAccordionPanel',
  templateUrl: './aria-accordion-panel.html',
  imports: [AccordionContent],
  hostDirectives: [
    {
      directive: AccordionPanel,
      inputs: ['id'],
    },
  ],
  host: { class: 'block mt-1' },
})
export class AriaAccordionPanel {
  readonly panel = inject(AccordionPanel);
}
