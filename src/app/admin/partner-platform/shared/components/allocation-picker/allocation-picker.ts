import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, model, signal } from '@angular/core';
import { AriaInput } from '@shared/components/ui/aria/aria-input/aria-input';
import { PartnerCode, SeatAllocation } from '../../models/partner-platform.model';

interface AllocationRow {
  count: number;
  /** `YYYY-MM-DD` from the native date input; omitted from the payload when blank. */
  expiry_date: string;
}

/**
 * Pick partner codes + seat counts (+ optional expiry) to mint — the
 * `allocations[]` array shared by `PATCH /superadmin/networks/<id>/` and
 * `POST /superadmin/firms/`. Emits through the `allocations` model on every
 * change; the parent decides where the mint goes.
 */
@Component({
  selector: 'app-allocation-picker',
  imports: [CurrencyPipe, AriaInput],
  templateUrl: './allocation-picker.html',
})
export class AllocationPicker {
  /** Codes eligible for this mint — the parent applies the scope rules. */
  readonly codes = input.required<PartnerCode[]>();
  readonly allocations = model<SeatAllocation[]>([]);

  private readonly rows = signal<Readonly<Record<number, AllocationRow>>>({});

  protected readonly selectedCount = computed(() => Object.keys(this.rows()).length);
  protected readonly totalSeats = computed(() =>
    Object.values(this.rows()).reduce((sum, r) => sum + r.count, 0),
  );

  protected isSelected(id: number): boolean {
    return id in this.rows();
  }

  protected count(id: number): number {
    return this.rows()[id]?.count ?? 1;
  }

  protected expiry(id: number): string {
    return this.rows()[id]?.expiry_date ?? '';
  }

  protected toggleCode(id: number, checked: boolean): void {
    this.update((rows) => {
      if (checked) rows[id] = rows[id] ?? { count: 1, expiry_date: '' };
      else delete rows[id];
    });
  }

  protected onCountChange(id: number, value: unknown): void {
    const raw = parseInt(String(value ?? ''), 10);
    this.update((rows) => {
      rows[id] = { ...rows[id], count: Number.isFinite(raw) && raw > 0 ? raw : 1 };
    });
  }

  protected onExpiryChange(id: number, value: unknown): void {
    this.update((rows) => {
      rows[id] = { ...rows[id], expiry_date: typeof value === 'string' ? value : '' };
    });
  }

  private update(mutate: (rows: Record<number, AllocationRow>) => void): void {
    const next = { ...this.rows() };
    mutate(next);
    this.rows.set(next);
    this.allocations.set(
      Object.entries(next).map(([partnerCode, row]) => ({
        partner_code: Number(partnerCode),
        count: row.count,
        ...(row.expiry_date ? { expiry_date: row.expiry_date } : {}),
      })),
    );
  }
}
