import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  FormField as AngularFormField,
  disabled,
  form,
  required,
  validate,
} from '@angular/forms/signals';
import { DialogRef } from '../../../../../../../shared/core/services/dialog/dialog';
import { Button } from '../../../../../../../shared/components/ui/button/button';
import { Forms } from '../../../../../../../shared/components/ui/forms/forms';
import { AriaInput } from '../../../../../../../shared/components/ui/aria/aria-input/aria-input';
import {
  Network,
  PartnerCode,
  SubCompanyAllocation,
} from '../../../../../shared/models/partner-platform.model';
import { PartnerSuperAdminFacade } from '../../../../../shared/services/partner-superadmin-facade';

/** Result emitted on submit — the parent maps it to create vs update. */
export interface NetworkFormResult {
  name: string;
  slug: string;
  total_seats: number;
  is_active: boolean;
  /**
   * Edit mode only — stock the network's own pool (§4.4). Mints coupons with no
   * sub-company. Empty when the operator didn't pick any code.
   */
  allocations: SubCompanyAllocation[];
}

export interface NetworkFormDialogData {
  /** Present = edit mode (slug locked, is_active editable); absent = create. */
  network?: Network;
}

/** Numeric input surfaces as a string from the native input — model it as such. */
interface NetworkFormModel {
  name: string;
  slug: string;
  total_seats: string;
  is_active: boolean;
}

/**
 * Create / edit a partner network (always an alliance of member firms — a single
 * company with no members is a standalone firm, not a network). Resolves with a
 * `NetworkFormResult` on submit, or `undefined` on cancel. `data`/`dialogRef`
 * are property-injected by the Dialog service.
 */
@Component({
  selector: 'app-network-form-dialog',
  imports: [AngularFormField, Forms, AriaInput, Button, CurrencyPipe],
  templateUrl: './network-form-dialog.html',
})
export class NetworkFormDialog implements OnInit {
  dialogRef!: DialogRef<NetworkFormDialog, NetworkFormResult | undefined>;
  data!: NetworkFormDialogData;

  private readonly facade = inject(PartnerSuperAdminFacade);

  private readonly editing = signal(false);
  protected readonly isEdit = computed(() => this.editing());
  protected readonly title = computed(() => (this.isEdit() ? 'Edit network' : 'Create network'));

  // ---- Pool allocation (edit mode, §4.4) -----------------------------------

  /**
   * Codes usable for a network allocation: this network's own codes plus global
   * ones. A code scoped to a *firm* can't stock a network pool.
   */
  protected readonly eligibleCodes = computed<PartnerCode[]>(() => {
    const networkId = this.data?.network?.id;
    return this.facade
      .partnerCodes()
      .filter(
        (c) =>
          c.is_active &&
          c.partner_firm == null &&
          (c.partner_network == null || c.partner_network === networkId),
      );
  });

  /** Seats to mint per selected code, keyed by code id. */
  private readonly seatCounts = signal<Readonly<Record<number, number>>>({});
  protected readonly selectedCount = computed(() => Object.keys(this.seatCounts()).length);
  protected readonly totalSeats = computed(() =>
    Object.values(this.seatCounts()).reduce((sum, n) => sum + n, 0),
  );

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
    this.seatCounts.update((counts) => ({
      ...counts,
      [id]: Number.isFinite(raw) && raw > 0 ? raw : 1,
    }));
  }

  private readonly model = signal<NetworkFormModel>({
    name: '',
    slug: '',
    total_seats: '0',
    is_active: true,
  });

  protected readonly form = form<NetworkFormModel>(this.model, (s) => {
    required(s.name, { message: 'Network name is required' });
    required(s.slug, { message: 'Slug is required' });
    validate(s.slug, ({ value }) =>
      !value() || /^[a-z0-9-]+$/.test(value())
        ? null
        : { kind: 'pattern', message: 'Lowercase letters, numbers and hyphens only' },
    );
    validate(s.total_seats, ({ value }) => {
      const n = Number(value());
      return value().trim() !== '' && Number.isInteger(n) && n >= 0
        ? null
        : { kind: 'min', message: 'Enter 0 or more seats' };
    });
    // slug is immutable after creation
    disabled(s.slug, { when: () => this.editing() });
  });

  ngOnInit(): void {
    const network = this.data?.network;
    if (network) {
      this.editing.set(true);
      this.model.set({
        name: network.name,
        slug: network.slug,
        total_seats: String(network.total_seats),
        is_active: network.is_active,
      });
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected submit(): void {
    if (this.form().invalid()) return;
    const v = this.model();
    this.dialogRef.close({
      name: v.name.trim(),
      slug: v.slug.trim(),
      total_seats: Number(v.total_seats),
      is_active: v.is_active,
      allocations: Object.entries(this.seatCounts()).map(([partner_code_id, count]) => ({
        partner_code_id: Number(partner_code_id),
        count,
      })),
    });
  }
}
