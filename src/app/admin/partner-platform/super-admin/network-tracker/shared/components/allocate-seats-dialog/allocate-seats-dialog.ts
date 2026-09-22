import { Component, computed, inject, signal } from '@angular/core';
import { FormField as AngularFormField, form, required, validate } from '@angular/forms/signals';
import { AriaInput } from '@shared/components/ui/aria/aria-input/aria-input';
import { AriaSelect } from '@shared/components/ui/aria/aria-select/aria-select';
import { Button } from '@shared/components/ui/button/button';
import { Forms } from '@shared/components/ui/forms/forms';
import { AriaSelectOption } from '@core/models/aria.model';
import { DialogRef } from '@core/services/dialog/dialog';
import { Firm } from '../../../../../shared/models/partner-platform.model';
import { PartnerSuperAdminFacade } from '../../../../../shared/services/partner-superadmin-facade';

export interface AllocateSeatsDialogData {
  firm: Firm;
}

/** `count` surfaces as a string from the native number input — model it as such. */
interface AllocateFormModel {
  partner_code: number | null;
  count: string;
  expiry_date: string;
}

const EMPTY: AllocateFormModel = { partner_code: null, count: '', expiry_date: '' };

/**
 * Top up an existing firm's seats — `POST /superadmin/firms/<id>/allocate/`.
 *
 * Before this endpoint existed, a firm created without allocations could never
 * receive seats: minting only happened at creation time.
 */
@Component({
  selector: 'app-allocate-seats-dialog',
  imports: [AngularFormField, Forms, AriaInput, AriaSelect, Button],
  templateUrl: './allocate-seats-dialog.html',
})
export class AllocateSeatsDialog {
  /** Resolves with the number of seats minted, or undefined on cancel. */
  dialogRef!: DialogRef<AllocateSeatsDialog, number | undefined>;
  data!: AllocateSeatsDialogData;

  private readonly facade = inject(PartnerSuperAdminFacade);

  protected readonly submitting = signal(false);

  /**
   * Plans this firm can be minted from: its own firm-scoped codes, its
   * network's codes, and globals. A code scoped to a *different* firm or
   * network would be rejected server-side.
   */
  protected readonly codeOptions = computed<AriaSelectOption<number | null>[]>(() => {
    const firm = this.data?.firm;
    const codes = this.facade.partnerCodes().filter((c) => {
      if (!c.is_active) return false;
      if (c.firm) return c.firm.id === firm?.id;
      if (c.network) return c.network.id === firm?.network?.id;
      return true;
    });
    return [
      { value: null, label: 'Select a partner code' },
      ...codes.map((c) => ({ value: c.id, label: `${c.code} — $${c.discounted_price}` })),
    ];
  });

  private readonly model = signal<AllocateFormModel>({ ...EMPTY });

  protected readonly form = form<AllocateFormModel>(this.model, (s) => {
    required(s.partner_code, { message: 'Pick a partner code' });
    validate(s.count, ({ value }) => {
      const n = Number(value());
      return Number.isInteger(n) && n >= 1
        ? null
        : { kind: 'min', message: 'Mint at least 1 seat' };
    });
  });

  protected close(): void {
    this.dialogRef.close();
  }

  protected async submit(): Promise<void> {
    if (this.form().invalid() || this.submitting()) return;
    const v = this.model();
    if (v.partner_code == null) return;

    this.submitting.set(true);
    const minted = await this.facade.allocateSeats(this.data.firm.id, {
      partner_code: v.partner_code,
      count: Number(v.count),
      ...(v.expiry_date ? { expiry_date: v.expiry_date } : {}),
    });
    this.submitting.set(false);
    if (minted != null) this.dialogRef.close(minted);
  }
}
