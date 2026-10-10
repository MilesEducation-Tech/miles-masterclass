import { ChangeDetectionStrategy, Component } from '@angular/core';
import { injectToolbarState, NgpToolbar } from 'ng-primitives/toolbar';

/** A row of `button[app-toolbar-button]`s with one tab stop and arrow-key movement. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-toolbar',
  hostDirectives: [{ directive: NgpToolbar, inputs: ['ngpToolbarOrientation:orientation'] }],
  host: {
    class:
      'inline-flex items-center gap-1 rounded-lg border border-border bg-background p-1 data-[orientation=vertical]:flex-col',
  },
  template: ` <ng-content /> `,
})
export class Toolbar {
  /** Access the toolbar state */
  private readonly toolbar = injectToolbarState();

  constructor() {
    // default to horizontal orientation
    this.toolbar().setOrientation('horizontal');
  }
}
