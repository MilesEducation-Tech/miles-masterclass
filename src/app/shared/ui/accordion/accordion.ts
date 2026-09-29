import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgpAccordion } from 'ng-primitives/accordion';

/** A stack of `app-accordion-item`s; `type="multiple"` lets several stay open. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-accordion',
  hostDirectives: [
    {
      directive: NgpAccordion,
      inputs: [
        'ngpAccordionValue:value',
        'ngpAccordionType:type',
        'ngpAccordionCollapsible:collapsible',
        'ngpAccordionDisabled:disabled',
        'ngpAccordionOrientation:orientation',
      ],
    },
  ],
  host: {
    class:
      'flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-background',
  },
  template: ` <ng-content /> `,
})
export class Accordion {}
