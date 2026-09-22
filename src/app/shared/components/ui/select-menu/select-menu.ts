import { Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroChevronDown } from '@ng-icons/heroicons/outline';
import {
  injectSelectState,
  NgpSelect,
  NgpSelectDropdown,
  NgpSelectOption,
  NgpSelectPortal,
} from 'ng-primitives/select';

export interface SelectMenuOption<V extends string = string> {
  value: V;
  label: string;
}

/**
 * Single-select dropdown built on `ngpSelect`.
 *
 * The primitive replaces the whole CDK overlay setup this used to carry — the
 * `cdkConnectedOverlay` template, the `isOpen` signal, the focus-restore and
 * focus-into-listbox `queueMicrotask` calls, the escape handling and the
 * hand-written `aria-haspopup` / `aria-expanded` / `aria-controls` trio. It
 * positions the dropdown itself (floating-ui, portalled to the body) and
 * exposes the full combobox ARIA pattern including `aria-selected` per option.
 *
 * `value` / `valueChange` are aliases onto the host directive, so the consumer
 * API is unchanged and no manual state syncing is needed.
 */
@Component({
  selector: 'app-select-menu',
  imports: [NgpSelectDropdown, NgpSelectOption, NgpSelectPortal, NgIcon],
  hostDirectives: [
    {
      directive: NgpSelect,
      inputs: ['ngpSelectValue:value', 'ngpSelectDisabled:disabled'],
      outputs: ['ngpSelectValueChange:valueChange'],
    },
  ],
  templateUrl: './select-menu.html',
  styleUrl: './select-menu.css',
  providers: [provideIcons({ heroChevronDown })],
  host: {
    class:
      'inline-flex items-center justify-between gap-2 h-10 min-w-[180px] px-4 rounded-full bg-secondary/60 border border-border/40 backdrop-blur-sm text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-accent',
  },
})
export class SelectMenu<V extends string = string> {
  readonly options = input.required<readonly SelectMenuOption<V>[]>();
  readonly placeholder = input<string>('');

  /** The selected value lives on the host directive; read it back from state. */
  private readonly state = injectSelectState<V>();

  readonly currentLabel = computed(() => {
    const v = this.state().value();
    return this.options().find((o) => o.value === v)?.label ?? this.placeholder();
  });
}
