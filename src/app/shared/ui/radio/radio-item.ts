import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgpRadioIndicator, NgpRadioItem } from 'ng-primitives/radio';

/** One choice inside an `app-radio-group`; its content is the visible label. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-radio-item',
  hostDirectives: [
    {
      directive: NgpRadioItem,
      inputs: ['ngpRadioItemValue:value', 'ngpRadioItemDisabled:disabled'],
    },
  ],
  imports: [NgpRadioIndicator],
  host: {
    class:
      'group flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 text-sm text-foreground outline-none transition-colors data-hover:bg-muted data-press:bg-secondary data-checked:border-primary data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-ring data-disabled:cursor-not-allowed data-disabled:text-muted-foreground',
  },
  template: `
    <span
      ngpRadioIndicator
      class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-background data-checked:border-primary"
    >
      <span
        class="size-2 rounded-full bg-primary opacity-0 transition-opacity group-data-checked:opacity-100"
      ></span>
    </span>
    <span class="leading-5"><ng-content /></span>
  `,
})
export class RadioItem {}
