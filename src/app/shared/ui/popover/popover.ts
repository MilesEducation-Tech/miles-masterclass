import { ChangeDetectionStrategy, Component } from '@angular/core';
import { injectPopoverContext, NgpPopover } from 'ng-primitives/popover';

/** The panel `[appPopoverTrigger]` opens; it renders the trigger's string content. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-popover',
  hostDirectives: [NgpPopover],
  host: {
    class:
      'absolute z-1001 max-w-xs origin-(--ngp-popover-transform-origin) rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg outline-none data-enter:animate-in data-enter:fade-in-0 data-enter:zoom-in-95 data-exit:animate-out data-exit:fade-out-0 data-exit:zoom-out-95 motion-reduce:animate-none',
  },
  template: ` {{ content() }} `,
})
export class Popover {
  readonly content = injectPopoverContext();
}
