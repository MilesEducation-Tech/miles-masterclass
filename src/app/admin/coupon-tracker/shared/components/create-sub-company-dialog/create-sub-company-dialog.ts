import { CurrencyPipe } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormField as AngularFormField, form, required, validate } from '@angular/forms/signals';
import { DialogRef } from '../../../../../shared/core/services/dialog/dialog';
import { Button } from '../../../../../shared/components/ui/button/button';
import { Forms } from '../../../../../shared/components/ui/forms/forms';
import { AriaInput } from '../../../../../shared/components/ui/aria/aria-input/aria-input';

export interface CreateSubCompanyDialogData {
  /** Coupons still free to allocate — shown as a hint. */
  availablePool: number;
}

/**
 * Dialog result — the parent runs the merged onboarding: create the firm, the
 * Supabase login, then the Django partner admin bound to that firm.
 */
export interface CreateSubCompanyResult {
  name: string;
  email_domain: string;
  admin_email: string;
  admin_name: string;
  /** One allocation per selected partner code, with the seat count typed in. */
  allocations: any[];
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SubCompanyFormModel {
  name: string;
  email_domain: string;
  admin_email: string;
  admin_name: string;
}

/**
 * "Create Sub-company" dialog. Collects the firm details + its admin login, and
 * a multi-select of partner codes with a seat count each — `count` coupons are
 * minted per selected code. Resolves with a `CreateSubCompanyResult` on submit,
 * or `undefined` on cancel. Partner codes come from the network-scoped
 * `/partner-admin/partner-codes/`.
 */
@Component({
  selector: 'app-create-sub-company-dialog',
  imports: [AngularFormField, Forms, AriaInput, Button, CurrencyPipe],
  templateUrl: './create-sub-company-dialog.html',
  styleUrl: './create-sub-company-dialog.css',
})
export class CreateSubCompanyDialog {
  dialogRef!: DialogRef<CreateSubCompanyDialog, CreateSubCompanyResult | undefined>;
  data!: CreateSubCompanyDialogData;

  // ponytail: PartnerNetworkFacade was deleted with the Django strip. This placeholder

  // keeps the template bindings compiling and renders the empty state.

  // Swap in the new backend's service — the template needs no changes.

  private readonly facade: any = {
    partnerCodes: null as any,
  };

  /** Available partner codes for the network — the multi-select options. */
  protected readonly partnerCodes = this.facade.partnerCodes;

  /** Seat count per selected partner code, keyed by code id. */
  private readonly seatCounts = signal<Readonly<Record<number, number>>>({});
  protected readonly selectedCount = computed(() => Object.keys(this.seatCounts()).length);
  /** Total coupons that will be minted across all selected codes. */
  protected readonly totalSeats = computed(() =>
    Object.values(this.seatCounts()).reduce((sum, n) => sum + n, 0),
  );

  /** Coupons still free to allocate in the network pool (hint only). */
  protected availablePool(): number {
    return this.data?.availablePool ?? 0;
  }

  private readonly model = signal<SubCompanyFormModel>({
    name: '',
    email_domain: '',
    admin_email: '',
    admin_name: '',
  });

  protected readonly form = form<SubCompanyFormModel>(this.model, (s) => {
    required(s.name, { message: 'Company name is required' });
    required(s.email_domain, { message: 'Email domain is required' });
    required(s.admin_email, { message: 'Admin email is required' });
    validate(s.admin_email, ({ value }) =>
      !value() || EMAIL_PATTERN.test(value().trim())
        ? null
        : { kind: 'email', message: 'Enter a valid email' },
    );
  });

  protected isSelected(id: number): boolean {
    return id in this.seatCounts();
  }

  protected seatCount(id: number): number {
    return this.seatCounts()[id] ?? 1;
  }

  protected toggleCode(id: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.seatCounts.update((counts) => {
      const next = { ...counts };
      if (checked) next[id] = next[id] ?? 1;
      else delete next[id];
      return next;
    });
  }

  protected onSeatCountInput(id: number, event: Event): void {
    const raw = parseInt((event.target as HTMLInputElement).value, 10);
    const count = Number.isFinite(raw) && raw > 0 ? raw : 1;
    this.seatCounts.update((counts) => ({ ...counts, [id]: count }));
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected submit(): void {
    if (this.form().invalid() || this.selectedCount() === 0) return;
    const v = this.model();
    const payload: CreateSubCompanyResult = {
      name: v.name.trim(),
      email_domain: v.email_domain.trim(),
      admin_email: v.admin_email.trim(),
      admin_name: v.admin_name.trim(),
      allocations: Object.entries(this.seatCounts()).map(([partner_code_id, count]) => ({
        partner_code_id: Number(partner_code_id),
        count,
      })),
    };
    this.dialogRef.close(payload);
  }
}
