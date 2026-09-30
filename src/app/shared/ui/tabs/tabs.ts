import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, contentChildren, model } from '@angular/core';
import { NgpTabButton, NgpTabList, NgpTabPanel, NgpTabset } from 'ng-primitives/tabs';
import { Tab } from './tab';

/**
 * A tab list driven by `[(value)]`; each `app-tab` child supplies a button and a panel. The
 * primitive only marks inactive panels (`aria-hidden`, no `data-active`); hiding them is ours.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-tabs',
  imports: [NgpTabset, NgpTabButton, NgpTabList, NgpTabPanel, NgTemplateOutlet],
  host: { class: 'block' },
  template: `
    <div ngpTabset [(ngpTabsetValue)]="value">
      <div ngpTabList class="flex gap-1 border-b border-border">
        @for (tab of tabs(); track tab.value()) {
          <button
            ngpTabButton
            type="button"
            class="relative -mb-px cursor-pointer border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground outline-none data-hover:text-foreground data-active:border-primary data-active:text-foreground data-focus-visible:outline-2 data-focus-visible:-outline-offset-2 data-focus-visible:outline-ring data-disabled:cursor-not-allowed data-disabled:opacity-50"
            [ngpTabButtonValue]="tab.value()"
          >
            {{ tab.label() }}
          </button>
        }
      </div>

      @for (tab of tabs(); track tab.value()) {
        <div
          ngpTabPanel
          class="outline-none not-data-active:hidden data-focus-visible:outline-2 data-focus-visible:outline-ring"
          [ngpTabPanelValue]="tab.value()"
        >
          <ng-container [ngTemplateOutlet]="tab.content()" />
        </div>
      }
    </div>
  `,
})
export class Tabs {
  /** The value of the selected tab. */
  readonly value = model<string>('');

  /** The tabs in the group. */
  readonly tabs = contentChildren(Tab);
}
