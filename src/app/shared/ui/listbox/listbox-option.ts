import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroCheck } from '@ng-icons/heroicons/outline';
import { NgpListboxOption } from 'ng-primitives/listbox';

/**
 * One option inside an `app-listbox`; its content is the visible label. The primitive reflects
 * selection as `data-selected` only, so `aria-selected` is added here for assistive technology.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-listbox-option',
  hostDirectives: [
    {
      directive: NgpListboxOption,
      inputs: ['id', 'ngpListboxOptionValue:value', 'ngpListboxOptionDisabled:disabled'],
    },
  ],
  imports: [NgIcon],
  providers: [provideIcons({ heroCheck })],
  host: {
    class:
      'group flex h-9 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-foreground outline-none data-hover:bg-muted data-active:bg-muted data-selected:font-medium data-disabled:cursor-not-allowed data-disabled:text-muted-foreground',
    '[attr.aria-selected]': 'option.selected()',
  },
  template: `
    <ng-icon
      name="heroCheck"
      class="shrink-0 opacity-0 group-data-selected:opacity-100"
      aria-hidden="true"
    />
    <ng-content />
  `,
})
export class ListboxOption {
  /** The host directive instance; the option primitive provides no state token of its own. */
  protected readonly option = inject(NgpListboxOption);
}
