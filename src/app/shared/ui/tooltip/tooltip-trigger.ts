import { Directive, input } from '@angular/core';
import { injectTooltipTriggerState, NgpTooltipTrigger } from 'ng-primitives/tooltip';
import { Tooltip } from './tooltip';

/**
 * `<button appTooltipTrigger="Some text">` shows an `app-tooltip` with that text on hover and
 * focus. Every ng-primitives trigger option is exposed with the `appTooltipTrigger` prefix.
 */
@Directive({
  selector: '[appTooltipTrigger]',
  hostDirectives: [
    {
      directive: NgpTooltipTrigger,
      inputs: [
        'ngpTooltipTriggerPlacement:appTooltipTriggerPlacement',
        'ngpTooltipTriggerDisabled:appTooltipTriggerDisabled',
        'ngpTooltipTriggerOffset:appTooltipTriggerOffset',
        'ngpTooltipTriggerShowDelay:appTooltipTriggerShowDelay',
        'ngpTooltipTriggerHideDelay:appTooltipTriggerHideDelay',
        'ngpTooltipTriggerFlip:appTooltipTriggerFlip',
        'ngpTooltipTriggerContainer:appTooltipTriggerContainer',
        'ngpTooltipTriggerShowOnOverflow:appTooltipTriggerShowOnOverflow',
        'ngpTooltipTriggerHoverableContent:appTooltipTriggerHoverableContent',
        'ngpTooltipTriggerContext:appTooltipTrigger',
      ],
    },
  ],
})
export class TooltipTrigger {
  /** Access the tooltip trigger */
  private readonly tooltipTrigger = injectTooltipTriggerState();

  /** Define the content of the tooltip */
  readonly content = input.required<string>({
    alias: 'appTooltipTrigger',
  });

  constructor() {
    this.tooltipTrigger().setTooltip(Tooltip);
  }
}
