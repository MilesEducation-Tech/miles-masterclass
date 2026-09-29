import { Directive, input } from '@angular/core';
import { injectPopoverTriggerState, NgpPopoverTrigger } from 'ng-primitives/popover';
import { Popover } from './popover';

/**
 * `<button appPopoverTrigger="Some text">` opens an `app-popover` with that text on click. Every
 * ng-primitives trigger option is exposed with the `appPopoverTrigger` prefix.
 */
@Directive({
  selector: '[appPopoverTrigger]',
  hostDirectives: [
    {
      directive: NgpPopoverTrigger,
      inputs: [
        'ngpPopoverTriggerDisabled:appPopoverTriggerDisabled',
        'ngpPopoverTriggerPlacement:appPopoverTriggerPlacement',
        'ngpPopoverTriggerOffset:appPopoverTriggerOffset',
        'ngpPopoverTriggerShowDelay:appPopoverTriggerShowDelay',
        'ngpPopoverTriggerHideDelay:appPopoverTriggerHideDelay',
        'ngpPopoverTriggerFlip:appPopoverTriggerFlip',
        'ngpPopoverTriggerContainer:appPopoverTriggerContainer',
        'ngpPopoverTriggerCloseOnOutsideClick:appPopoverTriggerCloseOnOutsideClick',
        'ngpPopoverTriggerCloseOnEscape:appPopoverTriggerCloseOnEscape',
        'ngpPopoverTriggerScrollBehavior:appPopoverTriggerScrollBehavior',
        'ngpPopoverTriggerContext:appPopoverTrigger',
      ],
    },
  ],
})
export class PopoverTrigger {
  /** Access the popover trigger */
  private readonly popoverTrigger = injectPopoverTriggerState();

  /** Define the content of the popover */
  readonly content = input.required<string>({
    alias: 'appPopoverTrigger',
  });

  constructor() {
    this.popoverTrigger().setPopover(Popover);
  }
}
