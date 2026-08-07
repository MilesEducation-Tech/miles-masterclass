import { Component } from '@angular/core';
import { TabContent, TabPanel } from '@angular/aria/tabs';

/**
 * Panel that holds the content for a single tab. Bind `[value]` to match the
 * corresponding `<app-aria-tab [value]="…">`. Content is lazily rendered via
 * `ngTabContent` so it only mounts the first time the tab is opened.
 */
@Component({
  selector: 'app-aria-tab-panel',
  templateUrl: './aria-tab-panel.html',
  imports: [TabContent],
  hostDirectives: [
    {
      directive: TabPanel,
      inputs: ['id', 'value'],
    },
  ],
  host: {
    class: 'block p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring',
  },
})
export class AriaTabPanel {}
