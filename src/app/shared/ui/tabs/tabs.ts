import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  input,
  model,
} from '@angular/core';
import { NgpTabButton, NgpTabList, NgpTabPanel, NgpTabset } from 'ng-primitives/tabs';
import { cn } from '../../utils/cn';
import { Tab } from './tab';

/**
 * How the tab list looks: `line` underlines the active tab; `pill` is a rounded
 * track with the active tab filled (the course library's tabs).
 */
export type TabsVariant = 'line' | 'pill';

const LIST: Record<TabsVariant, string> = {
  line: 'flex gap-1 border-b border-border',
  pill: 'inline-flex items-center gap-1 rounded-full border border-border/40 bg-secondary/40 p-1',
};

// `data-hover` / `data-active` / `data-focus-visible` come from ngpTabButton.
const BUTTON_BASE =
  'cursor-pointer text-sm font-medium text-muted-foreground outline-none data-hover:text-foreground data-focus-visible:outline-2 data-focus-visible:outline-solid data-focus-visible:outline-ring data-disabled:cursor-not-allowed data-disabled:opacity-50';

const BUTTON: Record<TabsVariant, string> = {
  line: 'relative -mb-px border-b-2 border-transparent px-4 py-2 data-active:border-primary data-active:text-foreground data-focus-visible:-outline-offset-2',
  pill: 'rounded-full px-4 py-1.5 transition-colors data-active:bg-primary data-active:text-primary-foreground data-active:data-hover:text-primary-foreground data-focus-visible:outline-offset-2',
};

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
      <div ngpTabList [class]="listClass()">
        @for (tab of tabs(); track tab.value()) {
          <button
            ngpTabButton
            type="button"
            [class]="buttonClass()"
            [ngpTabButtonValue]="tab.value()"
          >
            {{ tab.label() }}
          </button>
        }
      </div>

      @for (tab of tabs(); track tab.value()) {
        <div
          ngpTabPanel
          class="outline-none not-data-active:hidden data-focus-visible:outline-2 data-focus-visible:outline-solid data-focus-visible:outline-ring"
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

  /** How the tab list looks. */
  readonly variant = input<TabsVariant>('line');

  /** The tabs in the group. */
  readonly tabs = contentChildren(Tab);

  protected readonly listClass = computed(() => LIST[this.variant()]);
  protected readonly buttonClass = computed(() => cn(BUTTON_BASE, BUTTON[this.variant()]));
}
