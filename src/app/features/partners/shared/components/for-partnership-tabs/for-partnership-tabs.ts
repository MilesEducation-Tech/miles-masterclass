import { NgComponentOutlet } from '@angular/common';
import { Component, input, model, Type } from '@angular/core';
import { Tab, TabContent, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { cn } from '../../../../../shared/utils/cn';

export interface PartnershipTab {
  id: string;
  heading: string;
  headingClass?: string;
  content: Type<unknown> | string;
  contentInputs?: Record<string, unknown>;
  contentClass?: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-for-partnership-tabs',
  imports: [Tabs, TabList, Tab, TabPanel, TabContent, NgComponentOutlet],
  templateUrl: './for-partnership-tabs.html',
  styleUrl: './for-partnership-tabs.css',
})
export class ForPartnershipTabs {
  tabs = input<PartnershipTab[]>([]);
  selectedTab = model<string | undefined>(undefined);

  containerClass = input<string>('');
  tabListClass = input<string>('');
  tabClass = input<string>('');
  panelClass = input<string>('');

  orientation = input<'horizontal' | 'vertical'>('horizontal');
  selectionMode = input<'follow' | 'explicit'>('follow');

  protected readonly cn = cn;

  protected asComponent(content: PartnershipTab['content']): Type<unknown> | null {
    return typeof content === 'function' ? content : null;
  }

  protected asHtml(content: PartnershipTab['content']): string {
    return typeof content === 'string' ? content : '';
  }
}
