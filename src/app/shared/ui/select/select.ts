import { Component, booleanAttribute, computed, input, model } from '@angular/core';
import type { FormValueControl, ValidationError } from '@angular/forms/signals';
import { injectFormFieldState } from 'ng-primitives/form-field';
import {
  NgpSelect,
  NgpSelectDropdown,
  NgpSelectOption,
  NgpSelectPortal,
} from 'ng-primitives/select';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * A select, built on `ngpSelect`, that binds straight to a signal form.
 *
 * The primitive owns the dropdown, positioning, keyboard navigation and ARIA;
 * this adds the value contract and the label wiring — no floating label, no
 * chips, no icon set. Style it from the call site if a screen needs more.
 *
 * **Why the label wiring is here:** `ngpInput`, `ngpTextarea` and `ngpCheckbox`
 * all call `ngpFormControl` internally, so inside an `ngpFormField` they pick
 * up `aria-labelledby` / `aria-describedby` for free. `ngpSelect` is the one
 * that does NOT — checked in the installed source — so a select dropped into a
 * form field would announce with no name at all. It reads the field state here
 * instead. The trigger is a `div`, so a `<label for>` could never have done it:
 * only a labelable element answers to `for`.
 *
 * **The value is ALWAYS a list**, single-select included (0 or 1 entries).
 * That is not a quirk of this component: `questions/` gives every option's
 * value as a list and `profile/` stores it back the same way, so a scalar here
 * would mean converting at every call site instead of none. `multiple` only
 * decides whether the primitive lets the learner pick more than one.
 *
 * ```html
 * <app-select [options]="countries()" [formField]="form.country" />
 * <app-select multiple [options]="topics()" [formField]="form.topics" />
 * ```
 */
@Component({
  selector: 'app-select',
  imports: [NgpSelect, NgpSelectDropdown, NgpSelectOption, NgpSelectPortal],
  templateUrl: './select.html',
})
export class Select implements FormValueControl<string[]> {
  readonly options = input<readonly SelectOption[]>([]);
  readonly placeholder = input('Select an option');
  readonly multiple = input(false, { transform: booleanAttribute });
  readonly emptyMessage = input('No options available');
  /** Required, like every other control in this repo: the id is what the
   *  label and the ARIA wiring hang off, and an auto-generated one would
   *  differ between the server and client renders. */
  readonly id = input.required<string>();

  // FormValueControl — what `[formField]` reads and writes.
  readonly value = model<string[]>([]);
  readonly touched = model<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly readonly = input<boolean>(false);
  readonly required = input<boolean>(false);
  readonly invalid = input<boolean>(false);
  readonly hidden = input<boolean>(false);
  readonly errors = input<readonly ValidationError[]>([]);

  /**
   * The surrounding `ngpFormField`, when there is one. Optional by design: this
   * control is just as usable on its own, and then it is the caller's job to
   * name it.
   */
  private readonly formField = injectFormFieldState({ optional: true });

  /** Ids of the field's `ngpLabel` elements — the select's accessible name. */
  protected readonly labelledBy = computed(() => {
    const labels = this.formField?.()?.labels() ?? [];
    return labels.length ? labels.join(' ') : null;
  });

  /** Ids of the field's `ngpDescription` elements. */
  protected readonly describedBy = computed(() => {
    const descriptions = this.formField?.()?.descriptions() ?? [];
    return descriptions.length ? descriptions.join(' ') : null;
  });

  /**
   * Options with duplicate values dropped, first occurrence winning.
   *
   * Not defensive padding: `@for (… track option.value)` THROWS NG0955 on a
   * repeated key, so one duplicated value from the server takes the whole
   * dropdown down. A server-driven list is exactly where that happens.
   */
  protected readonly renderOptions = computed(() => {
    const seen = new Set<string>();
    return this.options().filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
  });

  /** What the trigger shows: the chosen options' labels, in option order. */
  protected readonly display = computed(() => {
    const chosen = new Set(this.value() ?? []);
    return this.options()
      .filter((o) => chosen.has(o.value))
      .map((o) => o.label)
      .join(', ');
  });

  /** `ngpSelect` holds a list in multiple mode and a bare value otherwise. */
  protected readonly selection = computed<string | string[] | null>(() =>
    this.multiple() ? (this.value() ?? []) : ((this.value() ?? [])[0] ?? null),
  );

  /**
   * `ngpSelect` PRUNES any value it cannot find among the rendered options and
   * emits the pruned result — so a seeded answer whose options have not arrived
   * yet (here they come from a different resource than the answers) emits back
   * as `null` / `[]` and would silently wipe itself. A pruned value was never
   * user-toggled, so it is carried over rather than lost.
   *
   * Deselecting still works: that value IS rendered, so it is not carried.
   */
  protected onValueChange(next: string | string[] | null): void {
    const incoming = next == null ? [] : Array.isArray(next) ? next : [next];
    const rendered = new Set(this.options().map((o) => o.value));
    const carried = (this.value() ?? []).filter((v) => !rendered.has(v) && !incoming.includes(v));
    this.value.set([...incoming, ...carried]);
  }

  /** Closing the dropdown is this control's "blur" — it is what makes a
   *  required error appear after the learner has actually been here. */
  protected onOpenChange(open: boolean): void {
    if (!open) this.touched.set(true);
  }
}
