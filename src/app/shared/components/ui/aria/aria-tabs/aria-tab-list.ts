import { Component } from '@angular/core';
import { TabList } from '@angular/aria/tabs';

/**
 * Tab strip container — host directive: `[ngTabList]`. Project `<app-aria-tab>`
 * children. Bind `[(selectedTab)]` to a writable signal of the active tab value.
 */
@Component({
  selector: 'app-aria-tab-list',
  exportAs: 'appAriaTabList',
  template: '<ng-content />',
  hostDirectives: [
    {
      directive: TabList,
      inputs: [
        'orientation',
        'wrap',
        'softDisabled',
        'focusMode',
        'selectionMode',
        'selectedTab',
        'disabled',
      ],
      outputs: ['selectedTabChange'],
    },
  ],
  host: {
    class:
      'inline-flex items-center gap-1 p-1 rounded-full bg-secondary/40 border border-border/40',
  },
})
export class AriaTabList {}
