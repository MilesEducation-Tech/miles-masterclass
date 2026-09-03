import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormField as AngularFormField, form, required, validate } from '@angular/forms/signals';
import { AriaInput } from '../../../../../../shared/components/ui/aria/aria-input/aria-input';
import { AriaSelect } from '../../../../../../shared/components/ui/aria/aria-select/aria-select';
import { Button } from '../../../../../../shared/components/ui/button/button';
import { Forms } from '../../../../../../shared/components/ui/forms/forms';
import { AriaSelectOption } from '../../../../../../shared/core/models/aria.model';
import { DialogRef } from '../../../../../../shared/core/services/dialog/dialog';
import {
  CreateFirmAdmin,
  CreateFirmRequest,
  CreateFirmResponse,
  PartnerCapability,
} from '../../../../../partner-platform/shared/models/partner-platform.model';
import { AdminProvisioning } from '../../../../../partner-platform/shared/services/admin-provisioning';
import { PartnerSuperAdminFacade } from '../../../../../partner-platform/shared/services/partner-superadmin-facade';

/** Mirrors `PARTNER_ROLE_MAP.partner_subcompany_admin` in admin-users.ts. */
const FIRM_ADMIN_ROLE_SLUG = 'partner_subcompany_admin';
const FIRM_ADMIN_CAPABILITIES: PartnerCapability[] = ['report:firm:read', 'user:block'];

/** Numeric inputs surface as strings from the native input — model them as such. */
interface CreateFirmFormModel {
  name: string;
  network_id: number | null;
  email_domain: string;
  partner_code_id: number | null;
  count: string;
  create_admin: boolean;
  admin_name: string;
  admin_email: string;
}

const EMPTY_MODEL: CreateFirmFormModel = {
  name: '',
  network_id: null,
  email_domain: '',
  partner_code_id: null,
  count: '',
  create_admin: false,
  admin_name: '',
  admin_email: '',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Create a firm — `POST /superadmin/firms/` — optionally minting its first
 * seats AND creating its admin login in the same atomic call: the Supabase
 * login is provisioned first (`provision_admin_user` RPC), then its uid rides
 * along as the `admin` sub-object so the backend creates the firm-role
 * `PartnerAdmin` with the firm, instead of a second request that can leave a
 * firm admin-less when it fails.
 *
 * Resolves with the `CreateFirmResponse` on success, `undefined` on cancel.
 */
@Component({
  selector: 'app-create-firm-dialog',
  imports: [AngularFormField, Forms, AriaInput, AriaSelect, Button],
  templateUrl: './create-firm-dialog.html',
})
export class CreateFirmDialog implements OnInit {
  dialogRef!: DialogRef<CreateFirmDialog, CreateFirmResponse | undefined>;

  protected readonly facade = inject(PartnerSuperAdminFacade);
  private readonly provisioning = inject(AdminProvisioning);

  protected readonly submitting = signal(false);

  private readonly model = signal<CreateFirmFormModel>(EMPTY_MODEL);

  protected readonly form = form<CreateFirmFormModel>(this.model, (s) => {
    required(s.name, { message: 'Firm name is required' });
    required(s.email_domain, { message: 'Email domain is required' });
    // Optional mint: partner code + count must be provided together.
    validate(s.count, ({ value }) => {
      const hasCode = this.model().partner_code_id != null;
      if (!value().trim()) {
        return hasCode ? { kind: 'required', message: 'Enter how many seats to mint' } : null;
      }
      const n = Number(value());
      return Number.isInteger(n) && n >= 1
        ? null
        : { kind: 'min', message: 'Mint at least 1 seat' };
    });
    // Optional admin: name + a valid email, only when the section is on.
    validate(s.admin_name, ({ value }) =>
      this.model().create_admin && !value().trim()
        ? { kind: 'required', message: 'Full name is required' }
        : null,
    );
    validate(s.admin_email, ({ value }) => {
      if (!this.model().create_admin) return null;
      return EMAIL_PATTERN.test(value().trim())
        ? null
        : { kind: 'email', message: 'Enter a valid email' };
    });
  });

  protected readonly createAdmin = computed(() => this.model().create_admin);

  protected readonly networkOptions = computed<AriaSelectOption<number | null>[]>(() => [
    { value: null, label: 'None — standalone firm' },
    ...this.facade.activeNetworks().map((n) => ({ value: n.id as number | null, label: n.name })),
  ]);

  /**
   * Plans this firm's first seats can be minted from: the selected network's
   * own codes, or global codes for a standalone firm. Firm-scoped codes never
   * qualify — the firm doesn't exist yet.
   */
  protected readonly partnerCodeOptions = computed<AriaSelectOption<number | null>[]>(() => {
    const id = this.model().network_id;
    const codes = this.facade
      .partnerCodes()
      .filter((c) => c.is_active && !c.firm && (id == null ? !c.network : c.network?.id === id));
    return [
      { value: null, label: 'None — create without minting' },
      ...codes.map((c) => ({ value: c.id, label: `${c.code} — $${c.discounted_price}` })),
    ];
  });

  ngOnInit(): void {
    this.facade.reloadPartnerCodes();
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected async submit(): Promise<void> {
    if (this.form().invalid() || this.submitting()) return;
    this.submitting.set(true);
    try {
      const v = this.model();

      let admin: CreateFirmAdmin | undefined;
      if (v.create_admin) {
        // Supabase login first — its uid is what the atomic `admin` object needs.
        const uid = await this.provisioning.provisionAdminUser({
          email: v.admin_email.trim(),
          fullName: v.admin_name.trim(),
          roleSlug: FIRM_ADMIN_ROLE_SLUG,
          domains: [v.email_domain.trim()],
        });
        if (!uid) return; // provisioning already surfaced the error
        admin = {
          supabase_uid: uid,
          email: v.admin_email.trim(),
          capabilities: FIRM_ADMIN_CAPABILITIES,
        };
      }

      const body: CreateFirmRequest = {
        name: v.name.trim(),
        // Standalone firm: omit `network` entirely.
        ...(v.network_id != null ? { network: v.network_id } : {}),
        email_domain: v.email_domain.trim(),
        ...(admin ? { admin } : {}),
        ...(v.partner_code_id != null && v.count.trim()
          ? { allocations: [{ partner_code: v.partner_code_id, count: Number(v.count) }] }
          : {}),
      };
      const created = await this.facade.createFirm(body);
      if (created) this.dialogRef.close(created);
    } finally {
      this.submitting.set(false);
    }
  }
}
