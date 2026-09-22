import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroChevronDown, heroXMark } from '@ng-icons/heroicons/outline';
import {
  NgpCombobox,
  NgpComboboxDropdown,
  NgpComboboxInput,
  NgpComboboxOption,
  NgpComboboxPortal,
} from 'ng-primitives/combobox';
import { AriaSelectOption, dedupeAriaOptions } from '@core/models/aria.model';
import { cn } from '../../../utils/cn';

/**
 * Autocomplete built on `ngpCombobox`.
 *
 * The primitive owns the dropdown (positioning, portal, open state), keyboard
 * navigation and `aria-activedescendant` — replacing the `CdkConnectedOverlay`
 * template, the manual `isOpen` juggling, the hand-written combobox ARIA
 * attributes and the keydown-forwarding hack that re-dispatched arrow keys at
 * the listbox element.
 *
 * Filtering, the query mirror and the clear button stay here: they are this
 * component's own behaviour, not the primitive's.
 */
@Component({
  selector: 'app-aria-autocomplete',
  imports: [
    NgpCombobox,
    NgpComboboxDropdown,
    NgpComboboxInput,
    NgpComboboxOption,
    NgpComboboxPortal,
    NgIcon,
  ],
  templateUrl: './aria-autocomplete.html',
  styleUrl: './aria-autocomplete.css',
  providers: [provideIcons({ heroChevronDown, heroXMark })],
})
export class AriaAutocomplete<V = unknown> implements FormValueControl<V | null> {
  readonly id = input.required<string>();
  readonly options = input<readonly AriaSelectOption<unknown>[]>([]);
  readonly placeholder = input('');
  readonly label = input('');
  readonly hint = input('');
  readonly required = input(false);
  readonly emptyMessage = input('No results found');
  readonly searchMinLength = input(0);
  /**
   * Skip the built-in substring filter — `options` are already filtered by the
   * server. Needed when the server matches on more than the literal text
   * (Google Places answers "bangalore" with "Bengaluru", which a substring
   * filter would then hide).
   */
  readonly serverFiltered = input(false);
  readonly showClear = input(true);
  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly userClass = input('', { alias: 'class' });

  // FormValueControl
  readonly value = model<V | null>(null);
  readonly touched = model<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly disabledReasons = input<readonly any[]>([]);
  readonly readonly = input<boolean>(false);
  readonly hidden = input<boolean>(false);
  readonly invalid = input<boolean>(false);
  readonly errors = input<readonly any[]>([]);

  readonly queryChange = output<string>();

  readonly icons = signal({ chevronDown: heroChevronDown, xMark: heroXMark });

  readonly query = signal('');
  readonly isOpen = signal(false);

  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  private readonly inputFocused = signal(false);

  readonly inputId = computed(() => `${this.id()}-input`);
  readonly listboxId = computed(() => `${this.id()}-listbox`);
  readonly hintId = computed(() => `${this.id()}-hint`);
  readonly errorId = computed(() => `${this.id()}-error`);

  readonly displayError = computed(() => this.invalid() && this.errors().length > 0);

  readonly describedBy = computed(() => {
    const parts: string[] = [];
    if (this.hint() && !this.displayError()) parts.push(this.hintId());
    if (this.displayError() && this.touched()) parts.push(this.errorId());
    return parts.length ? parts.join(' ') : null;
  });

  private readonly dedupedOptions = computed(() => dedupeAriaOptions(this.options()));

  readonly filteredOptions = computed(() => {
    const opts = this.dedupedOptions();
    if (this.serverFiltered()) return opts;
    const q = this.query().toLowerCase();
    if (!q || q.length < this.searchMinLength()) return opts;
    // When the query is just the mirrored label of the committed selection (the
    // field was opened without searching), show the full list instead of
    // narrowing to the one selected entry.
    const selectedLabel = opts.find((o) => o.value === this.value())?.label.toLowerCase();
    if (q === selectedLabel) return opts;
    return opts.filter((o) => o.label.toLowerCase().includes(q));
  });

  readonly listboxValues = computed<unknown[]>(() => {
    const v = this.value();
    return v == null ? [] : [v];
  });

  readonly hasValue = computed(() => this.value() != null);

  readonly wrapperClasses = computed(() => cn('space-y-2', this.userClass()));

  readonly inputClasses = computed(() =>
    cn(
      'peer floating-input h-14',
      this.showClear() && this.hasValue() ? 'pr-16' : 'pr-10',
      this.displayError() && 'border-destructive focus:ring-destructive',
    ),
  );

  constructor() {
    let last = '';
    const destroyRef = inject(DestroyRef);
    const stop = effect(() => {
      const q = this.query();
      if (q !== last) {
        last = q;
        this.queryChange.emit(q);
      }
    });
    destroyRef.onDestroy(() => stop.destroy());

    // Mirror selected option's label into the input when the value changes
    // programmatically (e.g., seeded via [formField]).
    effect(() => {
      const v = this.value();
      const opts = this.options();
      untracked(() => {
        if (v == null) return;
        // Never overwrite the text while the user is typing (options() also
        // changes on server-driven refetches triggered by queryChange).
        if (this.inputFocused()) return;
        const match = opts.find((o) => o.value === v);
        if (match && this.query() !== match.label) this.query.set(match.label);
      });
    });
  }

  onFocus() {
    this.inputFocused.set(true);
  }

  onInput(event: Event) {
    this.query.set((event.target as HTMLInputElement).value);
  }

  /** Mirrors the primitive's dropdown state for the chevron rotation. */
  protected onOpenChange(open: boolean): void {
    this.isOpen.set(open);
    if (!open) this.touched.set(true);
  }

  protected onValueChange(next: V | null): void {
    // Empty emissions are not user commits: the combobox prunes values missing
    // from the rendered (filtered) options.
    if (next == null) return;
    this.value.set(next);
    const selected = this.options().find((o) => o.value === next);
    if (selected) this.query.set(selected.label);
  }

  handleBlur() {
    this.inputFocused.set(false);
    this.touched.set(true);
  }

  clear(event: Event) {
    event.stopPropagation();
    this.value.set(null);
    this.query.set('');
    queueMicrotask(() => this.inputEl()?.nativeElement.focus());
  }
}
