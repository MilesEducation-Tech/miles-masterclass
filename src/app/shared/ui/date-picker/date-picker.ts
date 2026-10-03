import { ChangeDetectionStrategy, Component, computed, effect, model, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroChevronLeft, heroChevronRight } from '@ng-icons/heroicons/outline';
import {
  injectDatePickerState,
  NgpDatePicker,
  NgpDatePickerCell,
  NgpDatePickerCellRender,
  NgpDatePickerDateButton,
  NgpDatePickerGrid,
  NgpDatePickerLabel,
  NgpDatePickerNextMonth,
  NgpDatePickerPreviousMonth,
  NgpDatePickerRowRender,
} from 'ng-primitives/date-picker';
import { NgpFormControl } from 'ng-primitives/form-field';

const NAV =
  'inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none data-hover:bg-muted data-hover:text-foreground data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-ring data-disabled:cursor-not-allowed data-disabled:opacity-50';

const DAY =
  'inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-sm text-foreground outline-none data-hover:bg-muted data-press:bg-secondary data-selected:bg-primary data-selected:text-primary-foreground data-today:font-semibold data-today:underline data-today:decoration-accent data-today:decoration-2 data-today:underline-offset-4 data-outside-month:text-muted-foreground data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-ring data-disabled:cursor-not-allowed data-disabled:text-muted-foreground data-disabled:line-through';

/**
 * A month calendar bound to signal forms through its own `value` model (`Date | null`; start the
 * model at `null`). The primitive's `date` is kept in sync here rather than aliased, because the
 * field holds `null` for "nothing chosen" and the primitive's input does not. `min` / `max`
 * (`Date`s) come from `minDate()` / `maxDate()` rules through `[formField]`. `NgpFormControl` adds
 * the field's `aria-*` / `data-*` state.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-date-picker',
  hostDirectives: [
    {
      directive: NgpDatePicker,
      inputs: ['ngpDatePickerMin:min', 'ngpDatePickerMax:max', 'ngpDatePickerDisabled:disabled'],
    },
    NgpFormControl,
  ],
  imports: [
    NgIcon,
    NgpDatePickerLabel,
    NgpDatePickerNextMonth,
    NgpDatePickerPreviousMonth,
    NgpDatePickerGrid,
    NgpDatePickerCell,
    NgpDatePickerRowRender,
    NgpDatePickerCellRender,
    NgpDatePickerDateButton,
  ],
  providers: [provideIcons({ heroChevronRight, heroChevronLeft })],
  host: {
    class:
      'inline-block rounded-xl border border-border bg-popover p-3 text-popover-foreground data-disabled:opacity-50 data-invalid:data-touched:border-destructive',
    '(focusout)': 'touch.emit()',
  },
  template: `
    <div class="flex items-center justify-between gap-2 pb-2">
      <button
        ngpDatePickerPreviousMonth
        type="button"
        [class]="navClass"
        aria-label="Previous month"
      >
        <ng-icon name="heroChevronLeft" class="rtl:-scale-x-100" aria-hidden="true" />
      </button>
      <h2 ngpDatePickerLabel class="text-sm font-semibold">{{ label() }}</h2>
      <button ngpDatePickerNextMonth type="button" [class]="navClass" aria-label="Next month">
        <ng-icon name="heroChevronRight" class="rtl:-scale-x-100" aria-hidden="true" />
      </button>
    </div>
    <table ngpDatePickerGrid class="w-full border-collapse">
      <thead>
        <tr>
          <th scope="col" abbr="Sunday" [class]="headClass">S</th>
          <th scope="col" abbr="Monday" [class]="headClass">M</th>
          <th scope="col" abbr="Tuesday" [class]="headClass">T</th>
          <th scope="col" abbr="Wednesday" [class]="headClass">W</th>
          <th scope="col" abbr="Thursday" [class]="headClass">T</th>
          <th scope="col" abbr="Friday" [class]="headClass">F</th>
          <th scope="col" abbr="Saturday" [class]="headClass">S</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngpDatePickerRowRender>
          <td *ngpDatePickerCellRender="let date" ngpDatePickerCell class="p-0 text-center">
            <button ngpDatePickerDateButton type="button" [class]="dayClass">
              {{ date.getDate() }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  `,
})
export class DatePicker {
  private readonly state = injectDatePickerState<Date>();

  /** The selected date. */
  readonly value = model<Date | null>(null);

  /** Signal forms mark the field touched on this. */
  readonly touch = output<void>();

  /** The focused month, e.g. "February 2026". */
  protected readonly label = computed(
    () =>
      `${this.state().focusedDate().toLocaleString('default', { month: 'long' })} ${this.state().focusedDate().getFullYear()}`,
  );

  protected readonly navClass = NAV;
  protected readonly dayClass = DAY;
  protected readonly headClass = 'size-9 text-center text-xs font-medium text-muted-foreground';

  constructor() {
    // Model → primitive, without bouncing back through dateChange. `select` is typed for a date
    // only, but the primitive clears on `null` (`isSelected` guards it) and has no clear method,
    // and `null` is what the field holds for "nothing chosen".
    effect(() => {
      const value = this.value();
      this.state().select(value as Date, false, { emit: false });
      // Show the month of the date the form supplied; otherwise a preset value sits off-screen.
      if (value) {
        this.state().setFocusedDate(value, 'program', 'forward');
      }
    });
    // Primitive → model, on a user selection.
    this.state()
      .dateChange.pipe(takeUntilDestroyed())
      .subscribe((date) => this.value.set(date ?? null));
  }
}
