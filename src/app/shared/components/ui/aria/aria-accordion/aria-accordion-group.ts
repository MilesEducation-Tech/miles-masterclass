import { Component } from '@angular/core';
import { AccordionGroup } from '@angular/aria/accordion';

/**
 * Group container for a set of `<app-aria-accordion-item>` children — host
 * directive: `[ngAccordionGroup]`. Set `[multiExpandable]="true"` to allow more
 * than one panel open at a time.
 */
@Component({
  selector: 'app-aria-accordion-group',
  exportAs: 'appAriaAccordionGroup',
  template: '<ng-content />',
  hostDirectives: [
    {
      directive: AccordionGroup,
      inputs: ['disabled', 'multiExpandable', 'softDisabled', 'wrap'],
    },
  ],
  host: { class: 'flex flex-col divide-y divide-border/40' },
})
export class AriaAccordionGroup {}
