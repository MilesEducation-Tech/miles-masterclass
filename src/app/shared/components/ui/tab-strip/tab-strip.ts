import { Component, computed, input, output } from '@angular/core';
import { Tab, TabList, Tabs } from '@angular/aria/tabs';
import { cn } from '../../../utils/cn';

@Component({
  selector: 'app-tab-strip',
  imports: [Tabs, TabList, Tab],
  templateUrl: './tab-strip.html',
  styleUrl: './tab-strip.css',
})
export class TabStrip {
  readonly options = input.required<readonly string[]>();
  readonly selected = input.required<string | null>();
  readonly selectionChange = output<string>();

  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly userClass = input('', { alias: 'class' });
  /** Extra utility classes applied to each tab (`<li>`), e.g. wider padding. */
  readonly tabClass = input('');

  readonly rootClasses = computed(() => cn('inline-flex', this.userClass()));
  readonly tabClasses = computed(() =>
    cn(
      'px-4 py-1.5 rounded-full text-sm font-medium cursor-pointer select-none transition-colors capitalize outline-none focus-visible:ring-2 focus-visible:ring-accent',
      this.tabClass(),
    ),
  );

  onSelectedChange(value: string | undefined) {
    if (value && value !== this.selected()) {
      this.selectionChange.emit(value);
    }
  }
}
