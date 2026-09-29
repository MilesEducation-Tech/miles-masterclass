import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroCheck, heroChevronDown } from '@ng-icons/heroicons/outline';
import {
  injectSelectState,
  NgpSelect,
  NgpSelectDropdown,
  NgpSelectOption,
  NgpSelectPortal,
} from 'ng-primitives/select';

/** One choice of an `app-select`, `app-combobox` or `app-listbox`. */
export interface SelectOption<V = unknown> {
  value: V;
  label: string;
  disabled?: boolean;
}

const DROPDOWN =
  'absolute z-1001 mt-1 max-h-60 w-(--ngp-select-width) origin-(--ngp-select-transform-origin) overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none data-enter:animate-in data-enter:fade-in-0 data-enter:zoom-in-95 data-exit:animate-out data-exit:fade-out-0 data-exit:zoom-out-95 motion-reduce:animate-none';

const OPTION =
  'group flex h-9 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-foreground outline-none data-hover:bg-muted data-active:bg-muted data-press:bg-secondary data-selected:font-medium data-disabled:cursor-not-allowed data-disabled:text-muted-foreground';

/**
 * A custom select bound to signal forms through `value` / `valueChange` (one option value, or a
 * `V[]` with `multiple`; start the model at `null` / `[]`). Options are `{ value, label }`
 * objects, so the trigger shows labels. The dropdown is portalled to the body. Name it with a
 * `ngpLabel` in an `app-field`, or pass `ariaLabel`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-select',
  hostDirectives: [
    {
      directive: NgpSelect,
      inputs: [
        'id',
        'ngpSelectValue:value',
        'ngpSelectMultiple:multiple',
        'ngpSelectDisabled:disabled',
        'ngpSelectCompareWith:compareWith',
      ],
      outputs: ['ngpSelectValueChange:valueChange'],
    },
  ],
  providers: [provideIcons({ heroChevronDown, heroCheck })],
  imports: [NgpSelectDropdown, NgpSelectOption, NgpSelectPortal, NgIcon],
  host: {
    class:
      'flex h-10 w-full cursor-pointer items-center justify-between rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-ring data-open:border-ring data-disabled:cursor-not-allowed data-disabled:opacity-50 data-invalid:data-touched:border-destructive',
    '[attr.aria-label]': 'ariaLabel() || null',
    // The primitive reflects disabled as `data-disabled` only; assistive technology needs this.
    '[attr.aria-disabled]': 'state().disabled() || null',
    '(focusout)': 'touch.emit()',
  },
  template: `
    @if (display(); as value) {
      <span class="truncate">{{ value }}</span>
    } @else {
      <span class="truncate text-muted-foreground">{{ placeholder() }}</span>
    }

    <ng-icon
      name="heroChevronDown"
      class="ml-2 shrink-0 text-muted-foreground"
      aria-hidden="true"
    />

    <div *ngpSelectPortal ngpSelectDropdown [class]="dropdownClass">
      @for (option of options(); track option.value) {
        <div
          ngpSelectOption
          [ngpSelectOptionValue]="option.value"
          [ngpSelectOptionDisabled]="option.disabled ?? false"
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
        <div class="px-3 py-2 text-center text-sm text-muted-foreground">No options found</div>
      }
    </div>
  `,
})
export class Select<V = unknown> {
  /** Access the underlying select primitive state. */
  protected readonly state = injectSelectState<V | V[]>();

  /** The options for the select. */
  readonly options = input<readonly SelectOption<V>[]>([]);

  /** Shown while nothing is selected. */
  readonly placeholder = input<string>('');

  /** The accessible name of the trigger when it is not inside an `app-field`. */
  readonly ariaLabel = input<string>('');

  /** Signal forms mark the field touched on this. */
  readonly touch = output<void>();

  protected readonly dropdownClass = DROPDOWN;
  protected readonly optionClass = OPTION;

  /** The selected option labels, in option order. */
  protected readonly display = computed(() => {
    const value = this.state().value();
    const selected = Array.isArray(value) ? value : value == null ? [] : [value];
    return this.options()
      .filter((option) => selected.includes(option.value))
      .map((option) => option.label)
      .join(', ');
  });
}
