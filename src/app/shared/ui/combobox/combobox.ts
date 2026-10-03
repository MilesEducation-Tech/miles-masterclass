import { BooleanInput } from '@angular/cdk/coercion';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  model,
  output,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroCheck, heroChevronDown } from '@ng-icons/heroicons/outline';
import {
  NgpCombobox,
  NgpComboboxButton,
  NgpComboboxDropdown,
  NgpComboboxInput,
  NgpComboboxOption,
  NgpComboboxPortal,
} from 'ng-primitives/combobox';
import { SelectOption } from '../select/select';

let nextId = 0;

const DROPDOWN =
  'absolute z-1001 mt-1 max-h-60 w-(--ngp-combobox-width) origin-(--ngp-combobox-transform-origin) overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none data-enter:animate-in data-enter:fade-in-0 data-enter:zoom-in-95 data-exit:animate-out data-exit:fade-out-0 data-exit:zoom-out-95 motion-reduce:animate-none';

const OPTION =
  'group flex h-9 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-foreground outline-none data-hover:bg-muted data-active:bg-muted data-press:bg-secondary data-selected:font-medium data-disabled:cursor-not-allowed data-disabled:text-muted-foreground';

/**
 * A type-to-filter select bound to signal forms through its own `value` model (one option value
 * or `null`; start the model at `null`, never `undefined`). Options are `{ value, label }`
 * objects; the input shows the selected label and filters on labels. With `serverFiltered` the
 * options are shown as given and `queryChange` reports what to search for. Name it with a
 * `ngpLabel` in an `app-field`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-combobox',
  imports: [
    NgpCombobox,
    NgpComboboxDropdown,
    NgpComboboxOption,
    NgpComboboxInput,
    NgpComboboxPortal,
    NgpComboboxButton,
    NgIcon,
  ],
  providers: [provideIcons({ heroChevronDown, heroCheck })],
  host: { class: 'block w-full' },
  template: `
    <div
      ngpCombobox
      class="flex h-10 w-full items-center rounded-lg border border-input bg-background pe-1 ps-3 text-sm text-foreground data-focus:border-ring data-disabled:cursor-not-allowed data-disabled:opacity-50 data-invalid:data-touched:border-destructive"
      [(ngpComboboxValue)]="value"
      [ngpComboboxDisabled]="disabled()"
      (ngpComboboxOpenChange)="resetOnClose($event)"
    >
      <input
        ngpComboboxInput
        class="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        [id]="id() || fallbackId"
        [value]="filter()"
        [placeholder]="placeholder()"
        (input)="onFilterChange($event)"
        (blur)="touch.emit()"
      />

      <button
        ngpComboboxButton
        type="button"
        class="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none data-hover:bg-muted data-hover:text-foreground data-focus-visible:outline-2 data-focus-visible:outline-ring"
        aria-label="Toggle options"
      >
        <ng-icon name="heroChevronDown" aria-hidden="true" />
      </button>

      <div *ngpComboboxPortal ngpComboboxDropdown [class]="dropdownClass">
        @for (option of filteredOptions(); track option.value) {
          <div
            ngpComboboxOption
            [ngpComboboxOptionValue]="option.value"
            [ngpComboboxOptionDisabled]="option.disabled ?? false"
            [class]="optionClass"
          >
            <span class="flex-1 truncate">{{ option.label }}</span>
            <ng-icon
              name="heroCheck"
              class="shrink-0 opacity-0 group-data-selected:opacity-100"
              aria-hidden="true"
            />
          </div>
        } @empty {
          <div class="px-3 py-2 text-center text-sm text-muted-foreground">
            {{ emptyMessage() }}
          </div>
        }
      </div>
    </div>
  `,
})
export class Combobox<V = unknown> {
  /** The options for the combobox. */
  readonly options = input<readonly SelectOption<V>[]>([]);

  /** The selected value. */
  readonly value = model<V | null>(null);

  /** The id of the text input, so a `<label for>` can name it. */
  readonly id = input('');

  /** The placeholder for the input. */
  readonly placeholder = input<string>('');

  /** Shown when no option matches the filter. */
  readonly emptyMessage = input('No options found');

  /** The disabled state; `[formField]` writes it too. */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: booleanAttribute,
  });

  /** The parent filters (a server search): show the options as given, only report the query. */
  readonly serverFiltered = input(false);

  /** What the user typed, whenever it changes. */
  readonly queryChange = output<string>();

  /** Signal forms mark the field touched on this. */
  readonly touch = output<void>();

  private readonly selectedLabel = computed(
    () => this.options().find((option) => option.value === this.value())?.label ?? '',
  );

  /** What the user has typed; resets to the selected label whenever the value changes. */
  protected readonly filter = linkedSignal(() => this.selectedLabel());

  protected readonly filteredOptions = computed(() => {
    if (this.serverFiltered()) {
      return this.options();
    }
    const query = this.filter().toLowerCase();
    return this.options().filter((option) => option.label.toLowerCase().includes(query));
  });

  protected readonly dropdownClass = DROPDOWN;
  protected readonly optionClass = OPTION;
  protected readonly fallbackId = `app-combobox-${nextId++}`;

  protected onFilterChange(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.filter.set(query);
    this.queryChange.emit(query);
  }

  protected resetOnClose(open: boolean): void {
    if (open) {
      return;
    }

    // Closing with an emptied input clears the value; `null` rather than `undefined`, because
    // signal forms drops a model key whose value is `undefined`. Otherwise the input snaps
    // back to the selected label.
    if (this.filter() === '') {
      if (this.value() !== null) {
        this.value.set(null);
      }
    } else {
      this.filter.set(this.selectedLabel());
    }
  }
}
