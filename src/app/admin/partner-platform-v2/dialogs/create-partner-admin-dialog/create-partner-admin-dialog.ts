import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { DialogRef } from '@core/services/dialog/dialog';
import { NotificationService } from '@core/services/notification/notification';
import { AriaSelectOption } from '@core/models/aria.model';
import { AriaInput } from '@shared/ui/aria/aria-input/aria-input';
import { AriaSelect } from '@shared/ui/aria/aria-select/aria-select';
import { Button } from '@shared/ui/button/button';
import { CheckboxList, CheckboxListOption } from '@shared/ui/checkbox-list/checkbox-list';
import {
  CAPABILITY_DEFAULTS,
  CAPABILITY_LABELS,
  PARTNER_CAPABILITIES,
  PartnerAdmin,
  PartnerCapability,
  PartnerRole,
} from '@admin/core/models/partner-platform.model';
import { AdminProvisioning, INITIAL_ADMIN_PASSWORD } from '@admin/core/services/admin-provisioning';
import { PartnerSuperAdminFacade } from '@admin/core/services/partner-superadmin-facade';

const ROLE_OPTIONS: AriaSelectOption<PartnerRole>[] = [
  { value: 'network', label: 'Network admin' },
  { value: 'firm', label: 'Firm admin' },
  { value: 'super', label: 'Super admin (Miles ops)' },
];

/** Provision a fresh Supabase login, or reuse one that already exists. */
type AdminSource = 'new' | 'existing';

const SOURCE_OPTIONS: AriaSelectOption<AdminSource>[] = [
  { value: 'new', label: 'Create a new login' },
  { value: 'existing', label: 'Assign an existing login' },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Create a partner admin in two steps, exactly as the Partner Platform API contract
 * describes: (1) provision the Supabase login with the partner role that opens
 * the Partner v2 panel (`provision_admin_user` RPC), then (2) register the
 * Django `PartnerAdmin` with that `supabase_uid`, role, scope and capabilities
 * (`POST /superadmin/partner-admins/`). Resolves with the created admin, or
 * `undefined` on cancel. Needs the route-scoped `PartnerSuperAdminFacade`, so
 * open it with the page's `environmentInjector`.
 */
@Component({
  selector: 'app-create-partner-admin-dialog',
  imports: [AriaInput, AriaSelect, Button, CheckboxList],
  templateUrl: './create-partner-admin-dialog.html',
})
export class CreatePartnerAdminDialog {
  dialogRef!: DialogRef<CreatePartnerAdminDialog, PartnerAdmin | undefined>;

  private readonly facade = inject(PartnerSuperAdminFacade);
  private readonly provisioning = inject(AdminProvisioning);
  private readonly notification = inject(NotificationService);

  readonly source = signal<AdminSource>('new');
  readonly adminUserId = signal<string | null>(null);
  readonly email = signal('');
  readonly fullName = signal('');
  readonly role = signal<PartnerRole>('network');
  readonly networkId = signal<number | null>(null);
  readonly firmId = signal<number | null>(null);
  /**
   * A firm admin's Supabase role decides which panel pages exist for them:
   * `partner_subcompany_admin` = Users only; `partner_network_admin` = Seat
   * Tracker + Users (a standalone company's admin). Django scope is the firm either way.
   */
  readonly fullPanel = signal(false);
  readonly submitting = signal(false);

  protected readonly roleOptions = ROLE_OPTIONS;
  protected readonly sourceOptions = SOURCE_OPTIONS;
  protected readonly isExisting = computed(() => this.source() === 'existing');

  /**
   * Existing Supabase logins, loaded only when the operator asks for them.
   * Anyone already registered as a Django partner admin is listed but not
   * selectable — Django keeps ONE PartnerAdmin row per `supabase_uid`.
   */
  private readonly adminUsersResource = resource({
    params: () => (this.isExisting() ? true : undefined),
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
  protected readonly capabilityOptions: CheckboxListOption[] = PARTNER_CAPABILITIES.map((c) => ({
    value: c,
    label: CAPABILITY_LABELS[c],
  }));

  protected readonly networkOptions = computed<AriaSelectOption<number>[]>(() =>
    this.facade.activeNetworks().map((n) => ({ value: n.id, label: n.name })),
  );
  protected readonly firmOptions = computed<AriaSelectOption<number>[]>(() =>
    this.facade.firms().map((f) => ({
      value: f.id,
      label: f.is_standalone ? `${f.name} (standalone)` : `${f.name} — ${f.network?.name ?? '—'}`,
    })),
  );

  /** Seeded from the role's defaults whenever the role changes, then editable. */
  readonly capabilities = linkedSignal<ReadonlySet<PartnerCapability>>(
    () => new Set(CAPABILITY_DEFAULTS[this.role()]),
  );
  protected readonly selectedCapabilities = computed(() => [...this.capabilities()]);

  protected onCapabilitiesChange(values: readonly (string | number)[]): void {
    this.capabilities.set(new Set(values as PartnerCapability[]));
  }

  protected readonly emailInvalid = computed(() => {
    const v = this.email().trim();
    return !!v && !EMAIL_PATTERN.test(v);
  });

  protected readonly canSubmit = computed(() => {
    if (this.submitting()) return false;
    if (this.isExisting()) {
      if (!this.adminUserId()) return false;
    } else if (!this.email().trim() || this.emailInvalid()) {
      return false;
    }
    if (this.role() === 'network') return this.networkId() != null;
    if (this.role() === 'firm') return this.firmId() != null;
    return true;
  });

  /** Supabase role slug that unlocks the right Partner v2 pages for this Django role. */
  private supabaseRoleSlug(): string {
    switch (this.role()) {
      case 'super':
        return 'partner_platform_admin';
      case 'network':
        return 'partner_network_admin';
      default:
        return this.fullPanel() ? 'partner_network_admin' : 'partner_subcompany_admin';
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    try {
      const role = this.role();
      const firm = role === 'firm' ? this.facade.firms().find((f) => f.id === this.firmId()) : null;

      // 1. The Supabase login. A NEW one is provisioned with the role that opens
      //    the Partner v2 panel; an EXISTING one is reused as-is — re-running the
      //    RPC would REPLACE its roles and email domains (see provision_admin_user
      //    in 20260908000000_multi_role_admins.sql), so it stays untouched and
      //    only the Django PartnerAdmin below is created.
      const existing = this.isExisting()
        ? (this.adminUsersResource.value() ?? []).find((u) => u.user_id === this.adminUserId())
        : undefined;
      const email = existing?.email ?? this.email().trim().toLowerCase();
      const uid =
        existing?.user_id ??
        (await this.provisioning.provisionAdminUser({
          email,
          fullName: this.fullName().trim(),
          roleSlugs: [this.supabaseRoleSlug()],
          domains: firm?.email_domains ?? [],
        }));
      if (!uid) return; // provisioning already surfaced the error

      // 2. Django PartnerAdmin keyed on that uid — what scopes every partners/* call.
      const admin = await this.facade.createPartnerAdmin({
        supabase_uid: uid,
        email,
        role,
        ...(role === 'network' ? { network: this.networkId()! } : {}),
        ...(role === 'firm' ? { firm: this.firmId()! } : {}),
        capabilities: [...this.capabilities()],
      });
      if (!admin) return;

      this.notification.success(
        existing ? 'Partner admin assigned' : 'Login created',
        existing
          ? `${email} is now a ${role} admin. Their existing login and password are unchanged.`
          : `${email} — initial password: ${INITIAL_ADMIN_PASSWORD}. Ask them to change it after signing in.`,
      );
      this.dialogRef.close(admin);
    } finally {
      this.submitting.set(false);
    }
  }
}
