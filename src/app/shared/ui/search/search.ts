import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroMagnifyingGlass, heroXMark } from '@ng-icons/heroicons/outline';
import { NgpButton } from 'ng-primitives/button';
import { NgpInput } from 'ng-primitives/input';
import { NgpSearch, NgpSearchClear } from 'ng-primitives/search';

/**
 * A search input with a clear button, bound to signal forms through its own `value` model
 * (start the model at `''`). The inner `ngpInput` carries the field's label and validity state.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-search',
  hostDirectives: [NgpSearch],
  imports: [NgIcon, NgpSearchClear, NgpInput, NgpButton],
  providers: [provideIcons({ heroMagnifyingGlass, heroXMark })],
  host: { class: 'group relative block w-full' },
  template: `
    <ng-icon
      name="heroMagnifyingGlass"
      class="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 text-muted-foreground"
      aria-hidden="true"
    />
    <input
      ngpInput
      type="search"
      class="h-10 w-full rounded-lg border border-input bg-background pe-10 ps-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 data-invalid:data-touched:border-destructive [&::-webkit-search-cancel-button]:hidden"
      [value]="value()"
      [placeholder]="placeholder()"
      [disabled]="disabled()"
      (input)="onInput($event)"
      (blur)="touch.emit()"
    />
    <button
      ngpSearchClear
      ngpButton
      type="button"
      class="absolute top-1/2 end-1 inline-flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none data-hover:bg-muted data-hover:text-foreground data-focus-visible:outline-2 data-focus-visible:outline-ring group-data-empty:hidden"
      aria-label="Clear search"
    >
      <ng-icon name="heroXMark" aria-hidden="true" />
    </button>
  `,
})
export class Search {
  /** The search query. */
  readonly value = model<string>('');

  /** The placeholder text. */
  readonly placeholder = input<string>('');

  /** The disabled state; `[formField]` writes it too. */
  readonly disabled = input(false);

  /** Signal forms mark the field touched on this. */
  readonly touch = output<void>();

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }
}
