import { Listbox, Option } from '@angular/aria/listbox';
import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
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
import { AriaSelectOption, dedupeAriaOptions } from '../../../../core/models/aria.model';
import { cn } from '../../../../utils/cn';

/**
 * ARIA-style autocomplete: text input + listbox popover via `CdkConnectedOverlay`.
 * Internal client-side substring filter against `options`. For server-side
 * filtering use `<app-aria-combobox>` (consumer provides filtered options).
 */
@Component({
  selector: 'app-aria-autocomplete',
  imports: [Listbox, Option, CdkConnectedOverlay, CdkOverlayOrigin, NgIcon],
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
  private readonly listboxEl = viewChild<ElementRef<HTMLUListElement>>('listboxEl');
  protected readonly listbox = viewChild(Listbox);

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
    if (this.disabled() || this.readonly()) return;
    this.isOpen.set(true);
  }

  /** Reopen the list when the already-focused input is clicked again. */
  onInputClick() {
    if (this.disabled() || this.readonly()) return;
    this.isOpen.set(true);
  }

  onInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    this.query.set(v);
    this.isOpen.set(true);
  }

  close() {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.touched.set(true);
  }

  onOverlayAttached() {
    // Keep focus on the input — user is still typing/navigating.
  }

  /** Forward list navigation from the input to the listbox (combobox pattern). */
  onKeydown(event: KeyboardEvent) {
    if (this.disabled() || this.readonly()) return;
    const isArrow = event.key === 'ArrowDown' || event.key === 'ArrowUp';
    if (!isArrow && !(event.key === 'Enter' && this.isOpen())) return;
    event.preventDefault();
    if (!this.isOpen()) {
      this.isOpen.set(true);
      return;
    }
    this.listboxEl()?.nativeElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: event.key, bubbles: false }),
    );
  }

  onListboxValuesChange(values: unknown[]) {
    const next = (values[0] ?? null) as V | null;
    // Empty emissions are not user commits: the listbox prunes values missing
    // from the rendered (filtered) options and explicit mode re-toggles emit
    // []. Keep the current value and stay open.
    if (next == null) return;
    this.value.set(next);
    const selected = this.options().find((o) => o.value === next);
    if (selected) this.query.set(selected.label);
    this.close();
    queueMicrotask(() => this.inputEl()?.nativeElement.focus());
  }

  handleBlur() {
    // Option clicks preventDefault on mousedown, so the input only blurs on a
    // genuine focus-out — safe to close immediately.
    this.inputFocused.set(false);
    this.touched.set(true);
    this.close();
  }

  clear(event: Event) {
    event.stopPropagation();
    this.value.set(null);
    this.query.set('');
    queueMicrotask(() => this.inputEl()?.nativeElement.focus());
  }
}
