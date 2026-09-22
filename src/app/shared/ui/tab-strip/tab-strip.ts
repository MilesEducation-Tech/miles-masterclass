import { Component, computed, input, output } from '@angular/core';
import { NgpTabButton, NgpTabList, NgpTabset } from 'ng-primitives/tabs';
import { cn } from '../../utils/cn';

@Component({
  selector: 'app-tab-strip',
  imports: [NgpTabset, NgpTabList, NgpTabButton],
  templateUrl: './tab-strip.html',
  styleUrl: './tab-strip.css',
})
export class TabStrip {
  readonly options = input.required<readonly string[]>();
  readonly selected = input.required<string | null>();
  readonly selectionChange = output<string>();

  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly userClass = input('', { alias: 'class' });
  /** Extra utility classes applied to each tab button, e.g. wider padding. */
  readonly tabClass = input('');

  readonly rootClasses = computed(() => cn('inline-flex', this.userClass()));
  /**
   * Selected/unselected styling comes from the primitive's `data-active`
   * attribute rather than `[class.x]="selected() === opt"` bindings — the
   * tabset already owns that state.
   */
  readonly tabClasses = computed(() =>
    cn(
      'px-4 py-1.5 rounded-full text-sm font-medium cursor-pointer select-none transition-colors capitalize outline-none bg-transparent border-0',
      'text-muted-foreground data-[hover]:text-foreground',
      'data-[active]:bg-primary data-[active]:text-white',
      'data-[focus-visible]:ring-2 data-[focus-visible]:ring-accent',
      this.tabClass(),
    ),
  );

  onSelectedChange(value: string | undefined) {
    if (value && value !== this.selected()) {
      this.selectionChange.emit(value);
    }
  }
}
