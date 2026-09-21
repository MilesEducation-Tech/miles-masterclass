import { Component } from '@angular/core';
import { Tabs } from '@angular/aria/tabs';

/**
 * Container for a tabbed interface — host directive: `[ngTabs]`.
 * Project an `<app-aria-tab-list>` followed by `<app-aria-tab-panel>` children.
 */
@Component({
  selector: 'app-aria-tabs',
  exportAs: 'appAriaTabs',
  templateUrl: './aria-tabs.html',
  styleUrl: './aria-tabs.css',
  hostDirectives: [Tabs],
  host: { class: 'block' },
})
export class AriaTabs {}
