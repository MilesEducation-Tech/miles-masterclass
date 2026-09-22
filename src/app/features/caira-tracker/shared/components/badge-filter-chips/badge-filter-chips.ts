import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { cn } from '@shared/utils/cn';

export interface BadgeChipOption {
  /** `null` is a valid value (the "All" course-type chip), so keys are stringified. */
  value: string | null;
  label: string;
}

/**
 * Filter chips for the badge listings — separated pills, one selected at a time.
 *
 * Deliberately not `app-tab-strip`: these are filters, not tabs. There are no
 * tabpanels for `ngTabs` to own, and the tab strip paints one joined pill group
 * on a shared background rather than the separated, individually-bordered chips
 * the design calls for.
 */
@Component({
  selector: 'app-badge-filter-chips',
  templateUrl: './badge-filter-chips.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'group' },
})
export class BadgeFilterChips {
  readonly options = input.required<readonly BadgeChipOption[]>();
  readonly value = input.required<string | null>();
  readonly ariaLabel = input('Filter badges');
  readonly valueChange = output<string | null>();

  protected chipClass(selected: boolean): string {
    return cn(
      'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer',
      'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      selected
        ? 'border-accent bg-accent text-white'
        : 'border-border bg-transparent text-muted-foreground hover:text-foreground hover:border-white/30',
    );
  }

  protected onSelect(option: BadgeChipOption): void {
    if (option.value !== this.value()) this.valueChange.emit(option.value);
  }
}
