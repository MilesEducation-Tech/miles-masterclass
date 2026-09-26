import { Component, OnInit, computed, inject, resource, signal } from '@angular/core';
import {
  FormField as AngularFormField,
  disabled,
  form,
  required,
  validate,
} from '@angular/forms/signals';
import { AriaInput } from '@shared/ui/aria/aria-input/aria-input';
import { AriaSelect } from '@shared/ui/aria/aria-select/aria-select';
import { Button } from '@shared/ui/button/button';
import { CheckboxList, CheckboxListOption } from '@shared/ui/checkbox-list/checkbox-list';
import { Forms } from '@shared/ui/forms/forms';
import { AriaSelectOption } from '@core/models/aria.model';
import { AllocationPicker } from '@admin/partner-platform-v2/components/allocation-picker/allocation-picker';
import { injectDialogRef } from 'ng-primitives/dialog';
import { DialogShell } from '@shared/ui/dialog-shell/dialog-shell';
import {
  CAPABILITY_DEFAULTS,
  CAPABILITY_LABELS,
  CreateFirmAdmin,
  CreateFirmRequest,
  CreateFirmResponse,
  Firm,
  PARTNER_CAPABILITIES,
  PartnerCapability,
  PartnerCode,
  SeatAllocation,
} from '@admin/core/models/partner-platform.model';
import { AdminProvisioning } from '@admin/core/services/admin-provisioning';
import { PartnerSuperAdminFacade } from '@admin/core/services/partner-superadmin-facade';

/** Mirrors `PARTNER_ROLE_MAP.partner_subcompany_admin` in admin-users/utils/role-selection.ts. */
const FIRM_ADMIN_ROLE_SLUG = 'partner_subcompany_admin';

export interface FirmFormDialogData {
  /** Pre-select the network (the network hub's "Create firm" CTA). */
  networkId?: number;
  /** Present = edit mode: network locked, no first mint, no atomic admin. */
  firm?: Firm;
}

interface FirmFormModel {
  name: string;
  network_id: number | null;
  /** Comma-separated in the input; split into `email_domains` on submit. */
  email_domains: string;
  is_active: boolean;
  create_admin: boolean;
  /** 'new' provisions a Supabase login; 'existing' reuses one that already exists. */
  admin_source: AdminSource;
  /** 'existing' only — `admin_users.user_id` of the login to assign. */
  admin_user_id: string;
  admin_name: string;
  admin_email: string;
}

type AdminSource = 'new' | 'existing';

const ADMIN_SOURCE_OPTIONS: AriaSelectOption<AdminSource>[] = [
  { value: 'new', label: 'Create a new login' },
  { value: 'existing', label: 'Assign an existing login' },
];

const EMPTY_MODEL: FirmFormModel = {
  name: '',
  network_id: null,
  email_domains: '',
  is_active: true,
  create_admin: false,
  admin_source: 'new',
  admin_user_id: '',
  admin_name: '',
  admin_email: '',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** "acme.com, foo.co.uk" → ["acme.com", "foo.co.uk"], deduped, lowercased. */
export function parseDomains(input: string): string[] {
  return [
    ...new Set(
      input
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

/**
 * Create or edit a firm.
 *
 * Create — `POST /superadmin/firms/` — optionally mints its first seats AND
 * creates its admin login in the same atomic call: the Supabase login is
 * provisioned first (`provision_admin_user` RPC), then its uid rides along as
 * the `admin` sub-object so the backend creates the firm-role `PartnerAdmin`
 * with the firm, instead of a second request that can leave a firm admin-less
 * when it fails.
 *
 * Edit — `PATCH /superadmin/firms/<id>/`, super-admin only — name, email
 * domains and the active flag. Seats and admins keep their own actions, and the
 * network is locked (moving a firm between pools is not a form field).
 *
 * Resolves with the created/updated firm on success, `undefined` on cancel.
 */
@Component({
  selector: 'app-firm-form-dialog',
  imports: [
    AngularFormField,
    Forms,
    AriaInput,
    AriaSelect,
    Button,
    CheckboxList,
    AllocationPicker,
    DialogShell,
  ],
  templateUrl: './firm-form-dialog.html',
})
export class FirmFormDialog implements OnInit {
  private readonly dialogRef = injectDialogRef<
    FirmFormDialogData | undefined,
    CreateFirmResponse | Firm | undefined
  >();
  protected readonly data = this.dialogRef.data;

  protected readonly facade = inject(PartnerSuperAdminFacade);
  private readonly provisioning = inject(AdminProvisioning);

  protected readonly submitting = signal(false);

  /** Non-null = edit mode. */
  private readonly editingFirm = signal<Firm | null>(null);
  private readonly editing = computed(() => this.editingFirm() != null);
  protected readonly isEdit = this.editing;
  protected readonly title = computed(() => (this.isEdit() ? 'Edit firm' : 'Create firm'));

  private readonly model = signal<FirmFormModel>(EMPTY_MODEL);

  /** First mint — any number of codes, each with a count and optional expiry. */
  protected readonly allocations = signal<SeatAllocation[]>([]);

  protected readonly form = form<FirmFormModel>(this.model, (s) => {
    required(s.name, { message: 'Firm name is required' });
    // email_domains is optional: without it, nothing gates who redeems the seats.
    // A firm can't be moved between networks here — its seat pool follows it.
    disabled(s.network_id, { when: () => this.editing() });
    // Optional admin: a new login needs name + a valid email; an existing one
    // needs a pick. Only when the section is on.
    validate(s.admin_name, ({ value }) =>
      this.newAdmin() && !value().trim()
        ? { kind: 'required', message: 'Full name is required' }
        : null,
    );
    validate(s.admin_email, ({ value }) => {
      if (!this.newAdmin()) return null;
      return EMAIL_PATTERN.test(value().trim())
        ? null
        : { kind: 'email', message: 'Enter a valid email' };
    });
    validate(s.admin_user_id, ({ value }) =>
      this.existingAdmin() && !value()
        ? { kind: 'required', message: 'Pick the login to assign' }
        : null,
    );
  });

  protected readonly createAdmin = computed(() => this.model().create_admin);
  protected readonly newAdmin = computed(
    () => this.createAdmin() && this.model().admin_source === 'new',
  );
  protected readonly existingAdmin = computed(
    () => this.createAdmin() && this.model().admin_source === 'existing',
  );
  protected readonly adminSourceOptions = ADMIN_SOURCE_OPTIONS;

  /**
   * Existing Supabase logins, loaded only once the operator asks for them.
   * Anyone already registered as a Django partner admin is listed but not
   * selectable — Django keeps ONE PartnerAdmin row per `supabase_uid`.
   */
  private readonly adminUsersResource = resource({
    params: () => (this.existingAdmin() ? true : undefined),
    loader: () => this.provisioning.listAdminUsers(),
  });

  protected readonly adminUsersLoading = computed(() => this.adminUsersResource.isLoading());
  protected readonly adminUsersError = computed(() =>
    this.adminUsersResource.error()
      ? 'Could not list existing logins — you may not have permission to read them.'
      : null,
  );

  protected readonly adminUserOptions = computed<AriaSelectOption<string>[]>(() => {
    const taken = new Set(this.facade.partnerAdmins().map((a) => a.supabase_uid));
    return (this.adminUsersResource.value() ?? []).map((u) => ({
      value: u.user_id,
      label: [u.email, u.full_name, u.roles.join(', ')].filter(Boolean).join(' — '),
      disabled: taken.has(u.user_id),
    }));
  });

  /** Capabilities for the atomic firm admin — seeded from the firm defaults, editable. */
  protected readonly adminCapabilities = signal<PartnerCapability[]>([...CAPABILITY_DEFAULTS.firm]);
  protected readonly capabilityOptions: CheckboxListOption[] = PARTNER_CAPABILITIES.map((c) => ({
    value: c,
    label: CAPABILITY_LABELS[c],
  }));

  protected onCapabilitiesChange(values: readonly (string | number)[]): void {
    this.adminCapabilities.set(values as PartnerCapability[]);
  }

  protected readonly networkOptions = computed<AriaSelectOption<number | null>[]>(() => [
    { value: null, label: 'None — standalone firm' },
    ...this.facade.activeNetworks().map((n) => ({ value: n.id as number | null, label: n.name })),
  ]);

  /**
   * Plans this firm's first seats can be minted from: the selected network's
   * own codes, or global codes for a standalone firm. Firm-scoped codes never
   * qualify — the firm doesn't exist yet.
   */
  protected readonly eligibleCodes = computed<PartnerCode[]>(() => {
    const id = this.model().network_id;
    return this.facade
      .partnerCodes()
      .filter((c) => c.is_active && !c.firm && (id == null ? !c.network : c.network?.id === id));
  });

  ngOnInit(): void {
    const firm = this.data?.firm;
    if (firm) {
      this.editingFirm.set(firm);
      this.model.set({
        ...EMPTY_MODEL,
        name: firm.name,
        network_id: firm.network?.id ?? null,
        email_domains: firm.email_domains.join(', '),
        is_active: firm.is_active,
      });
      return;
    }
    this.facade.reloadPartnerCodes();
    const networkId = this.data?.networkId;
    if (networkId != null) this.model.update((m) => ({ ...m, network_id: networkId }));
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected async submit(): Promise<void> {
    if (this.form().invalid() || this.submitting()) return;
    this.submitting.set(true);
    try {
      const v = this.model();
      const domains = parseDomains(v.email_domains);

      const editing = this.editingFirm();
      if (editing) {
        const updated = await this.facade.updateFirm(editing.id, {
          name: v.name.trim(),
          email_domains: domains,
          is_active: v.is_active,
        });
        if (updated) this.dialogRef.close(updated);
        return;
      }

      let admin: CreateFirmAdmin | undefined;
      if (v.create_admin) {
        // Either way the atomic `admin` object needs a Supabase uid; only a NEW
        // login has to be provisioned first. An existing one is passed through
        // untouched — re-running the RPC would REPLACE its roles and email
        // domains (see provision_admin_user in 20260908000000_multi_role_admins).
        const existing = this.existingAdmin()
          ? (this.adminUsersResource.value() ?? []).find((u) => u.user_id === v.admin_user_id)
          : undefined;
        const uid = existing
          ? existing.user_id
          : await this.provisioning.provisionAdminUser({
              email: v.admin_email.trim(),
              fullName: v.admin_name.trim(),
              roleSlugs: [FIRM_ADMIN_ROLE_SLUG],
              domains,
            });
        if (!uid) return; // provisioning already surfaced the error
        admin = {
          supabase_uid: uid,
          email: existing?.email ?? v.admin_email.trim(),
          capabilities: this.adminCapabilities(),
        };
      }

      const body: CreateFirmRequest = {
        name: v.name.trim(),
        // Standalone firm: omit `network` entirely.
        ...(v.network_id != null ? { network: v.network_id } : {}),
        ...(domains.length ? { email_domains: domains } : {}),
        ...(admin ? { admin } : {}),
        ...(this.allocations().length ? { allocations: this.allocations() } : {}),
      };
      const created = await this.facade.createFirm(body);
      if (created) this.dialogRef.close(created);
    } finally {
      this.submitting.set(false);
    }
  }
}
