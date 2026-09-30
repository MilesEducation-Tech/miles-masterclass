import { ChangeDetectionStrategy, Component } from '@angular/core';
import { injectTooltipContext, NgpTooltip } from 'ng-primitives/tooltip';

/** The bubble `[appTooltipTrigger]` shows on hover and focus; ng-primitives sets `role="tooltip"`. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-tooltip',
  hostDirectives: [NgpTooltip],
  host: {
    class:
      'absolute z-1001 max-w-xs origin-(--ngp-tooltip-transform-origin) rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-md data-enter:animate-in data-enter:fade-in-0 data-enter:zoom-in-95 data-exit:animate-out data-exit:fade-out-0 data-exit:zoom-out-95 motion-reduce:animate-none',
  },
  template: ` {{ content() }} `,
})
export class Tooltip {
  /** Access the tooltip context where the content is stored. */
  protected readonly content = injectTooltipContext<string>();
}
