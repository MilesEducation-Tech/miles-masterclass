import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroChevronDown } from '@ng-icons/heroicons/outline';
import {
  NgpAccordionContent,
  NgpAccordionItem,
  NgpAccordionTrigger,
} from 'ng-primitives/accordion';
import { NgpButton } from 'ng-primitives/button';

/**
 * One section of an `app-accordion`: a heading button and the projected content. Closed content
 * is hidden by the global `[ngpAccordionContent][data-closed]` rule in styles.css.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-accordion-item',
  hostDirectives: [
    {
      directive: NgpAccordionItem,
      inputs: ['ngpAccordionItemValue:value', 'ngpAccordionItemDisabled:disabled'],
    },
  ],
  imports: [NgpAccordionContent, NgpAccordionTrigger, NgpButton, NgIcon],
  providers: [provideIcons({ heroChevronDown })],
  host: { class: 'block' },
  template: `
    <button
      ngpAccordionTrigger
      ngpButton
      type="button"
      class="group flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-start text-sm font-medium text-foreground outline-none data-hover:bg-muted data-focus-visible:outline-2 data-focus-visible:-outline-offset-2 data-focus-visible:outline-ring data-disabled:cursor-not-allowed data-disabled:opacity-50"
    >
      {{ heading() }}
      <ng-icon
        name="heroChevronDown"
        class="shrink-0 text-muted-foreground transition-transform group-data-open:rotate-180 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </button>
    <div ngpAccordionContent class="px-4 pb-4 text-sm text-muted-foreground">
      <ng-content />
    </div>
  `,
})
export class AccordionItem {
  /** The accordion item heading */
  readonly heading = input.required<string>();
}
