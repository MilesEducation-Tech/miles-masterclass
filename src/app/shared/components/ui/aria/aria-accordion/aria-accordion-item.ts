import { Component } from '@angular/core';

/**
 * Styling slot for a single accordion item — contains a trigger + panel.
 * No ARIA directive is attached here; `ngAccordion*` directives bind directly
 * to the trigger/panel children.
 */
@Component({
  selector: 'app-aria-accordion-item',
  template: '<ng-content />',
  host: { class: 'block py-2' },
})
export class AriaAccordionItem {}
