import { Component, OnInit, computed, signal } from '@angular/core';
import { FormField as AngularFormField, form, required, validate } from '@angular/forms/signals';
import { DialogRef } from '../../../../../../../shared/core/services/dialog/dialog';
import { Button } from '../../../../../../../shared/components/ui/button/button';
import { Forms } from '../../../../../../../shared/components/ui/forms/forms';
import { AriaInput } from '../../../../../../../shared/components/ui/aria/aria-input/aria-input';
import { AriaSelect } from '../../../../../../../shared/components/ui/aria/aria-select/aria-select';
import { AriaSelectOption } from '../../../../../../../shared/core/models/aria.model';

export interface NetworkFirmsDialogData {
  /** Present = member firms under a network; absent = standalone companies (no network). */
  network?: any;
}

/** Numeric `count` surfaces as a string from the native input — model it as such. */
interface FirmFormModel {
  name: string;
  email_domain: string;
  partner_code_id: number | null;
  count: string;
}

const EMPTY_FIRM: FirmFormModel = { name: '', email_domain: '', partner_code_id: null, count: '' };

/**
 * Manage firms directly (`POST /superadmin/firms/`), optionally minting seats.
 * Two modes: member firms under a given network (`data.network` set), or
 * standalone companies with no network (`data.network` absent) — the single-
 * company onboarding path (its admin is a `role=firm` login, no `code:create:firm`).
 */
@Component({
  selector: 'app-network-firms-dialog',
  imports: [AngularFormField, Forms, AriaInput, AriaSelect, Button],
  templateUrl: './network-firms-dialog.html',
})
export class NetworkFirmsDialog implements OnInit {
  /** Resolves with the created firm's id, so the caller can deep-link to admin provisioning. */
  dialogRef!: DialogRef<NetworkFirmsDialog, number | undefined>;
  data!: NetworkFirmsDialogData;

  // ponytail: PartnerSuperAdminFacade was deleted with the Django strip. This placeholder

  // keeps the template bindings compiling and renders the empty state.

  // Swap in the new backend's service — the template needs no changes.

  protected readonly facade: any = {
    createFirm: (..._args: any[]): any => null,

    firmsForNetwork: (..._args: any[]): any => null,

    firmsLoading: signal<any>(null),

    reloadFirms: signal<any[]>([]),

    reloadPartnerCodes: signal<any[]>([]),

    standaloneFirms: signal<any[]>([]),
  };

  /** null = standalone mode (no network). */
  private readonly networkId = signal<number | null>(null);
  protected readonly networkName = signal<string>('');
  protected readonly isStandalone = computed(() => this.networkId() == null);

  protected readonly firms = computed<any[]>(() => {
    const id = this.networkId();
    return id == null ? this.facade.standaloneFirms() : this.facade.firmsForNetwork(id);
  });

  /**
   * Partner codes selectable for this dialog's scope: a member firm draws from
   * its network's own code, a standalone firm from a network-agnostic (global)
   * code — per the onboarding sequences in docs/PARTNER_PLATFORM_API.md.
   */
  protected readonly partnerCodeOptions = computed<AriaSelectOption<number | null>[]>(() => {
    const id = this.networkId();
    // Firm-scoped codes are rejected when creating a firm (the firm doesn't
    // exist yet) — only this network's codes or globals qualify.
    const codes = this.facade
      .partnerCodes()
      .filter(
        (c: any) =>
          c.is_active &&
          c.partner_firm == null &&
          (id == null ? c.partner_network == null : c.partner_network === id),
      );
    return [
      { value: null, label: 'None — create without minting' },
      ...codes.map((c: any) => ({ value: c.id, label: `${c.code} — $${c.discounted_price}` })),
    ];
  });

  private readonly model = signal<FirmFormModel>(EMPTY_FIRM);

  protected readonly form = form<FirmFormModel>(this.model, (s) => {
    required(s.name, { message: 'Firm name is required' });
    required(s.email_domain, { message: 'Email domain is required' });
    // Optional mint: partner code + count must be provided together.
    validate(s.count, ({ value }) => {
      const hasCode = this.model().partner_code_id != null;
      if (!value().trim()) {
        return hasCode ? { kind: 'required', message: 'Enter how many coupons to mint' } : null;
      }
      const n = Number(value());
      return Number.isInteger(n) && n >= 1
        ? null
        : { kind: 'min', message: 'Mint at least 1 coupon' };
    });
  });

  ngOnInit(): void {
    this.networkId.set(this.data.network?.id ?? null);
    this.networkName.set(this.data.network?.name ?? 'Standalone companies');
    this.facade.reloadFirms();
    this.facade.reloadPartnerCodes();
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected async submit(): Promise<void> {
    if (this.form().invalid()) return;
    const v = this.model();
    const id = this.networkId();
    const body: any = {
      // Standalone firm: omit network_id entirely (member firm draws from its network).
      ...(id != null ? { network_id: id } : {}),
      name: v.name.trim(),
      email_domain: v.email_domain.trim(),
      ...(v.partner_code_id != null && v.count.trim()
        ? { allocations: [{ partner_code_id: v.partner_code_id, count: Number(v.count) }] }
        : {}),
    };
    const created = await this.facade.createFirm(body);
    // One firm per dialog open, matching the "Create Network" flow: close and
    // let the caller deep-link into admin provisioning for the new firm.
    if (created) this.dialogRef.close(created.id);
  }
}
