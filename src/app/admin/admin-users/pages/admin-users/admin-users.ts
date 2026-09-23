import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { take } from 'rxjs';
import { AriaInput } from '@shared/ui/aria/aria-input/aria-input';
import { AriaSelect } from '@shared/ui/aria/aria-select/aria-select';
import { Button } from '@shared/ui/button/button';
import { CheckboxList, CheckboxListOption } from '@shared/ui/checkbox-list/checkbox-list';
import { Spinner } from '@shared/ui/spinner/spinner';
import {
  EditAdminRolesDialog,
  EditAdminRolesDialogData,
} from '@admin/admin-users/dialogs/edit-admin-roles-dialog/edit-admin-roles-dialog';
import { Dialog } from '@core/services/dialog/dialog';
import { NotificationService } from '@core/services/notification/notification';
import { AdminAuth } from '@admin/core/services/admin-auth';
import { AriaSelectOption } from '@core/models/aria.model';
import { toggleRoleSlug } from '@admin/core/models/admin-rbac.model';
import {
  AdminUsersFacade,
  AdminPermissionRow,
  AdminUserListRow,
} from '@admin/admin-users/services/admin-users-facade';
import { partnerRoleOf } from '@admin/admin-users/utils/role-selection';
import { PartnerSuperAdminFacade } from '@admin/core/services/partner-superadmin-facade';
import { AdminProvisioning, INITIAL_ADMIN_PASSWORD } from '@admin/core/services/admin-provisioning';
import {
  CAPABILITY_DEFAULTS,
  CAPABILITY_LABELS,
  PARTNER_CAPABILITIES,
  PartnerCapability,
  PartnerRole,
} from '@admin/core/models/partner-platform.model';

@Component({
  selector: 'app-admin-admin-users',
  imports: [AriaInput, AriaSelect, Button, CheckboxList, Spinner, DatePipe],
  providers: [AdminUsersFacade],
  templateUrl: './admin-users.html',
  host: { class: 'block w-full' },
})
export class AdminUsers {
  protected readonly facade = inject(AdminUsersFacade);
  private readonly notification = inject(NotificationService);
  protected readonly auth = inject(AdminAuth);
  private readonly partnerFacade = inject(PartnerSuperAdminFacade);
  private readonly provisioning = inject(AdminProvisioning);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Deep-link from network / standalone-firm creation: open the form with the
    // new scope pre-selected so the operator only has to pick a partner role.
    const qp = this.route.snapshot.queryParamMap;
    if (qp.get('provision') === '1') {
      this.showForm.set(true);
      const n = Number(qp.get('network'));
      if (Number.isInteger(n) && n > 0) {
        this.partnerScope.set(`network:${n}`);
        this.prefilledNetworkId.set(n);
      }
      const f = Number(qp.get('firm'));
      if (Number.isInteger(f) && f > 0) {
        this.partnerScope.set(`firm:${f}`);
        this.partnerFirmId.set(f);
        this.prefilledFirmId.set(f);
      }
    }
  }

  /** Network id carried in from the network-creation deep-link, if any. */
  private readonly prefilledNetworkId = signal<number | null>(null);
  protected readonly prefilledNetworkName = computed(() => {
    const id = this.prefilledNetworkId();
    if (id == null) return null;
    return this.partnerFacade.networks().find((net) => net.id === id)?.name ?? `#${id}`;
  });

  /** Firm id carried in from the standalone-firm-creation deep-link, if any. */
  private readonly prefilledFirmId = signal<number | null>(null);
  protected readonly prefilledFirmName = computed(() => {
    const id = this.prefilledFirmId();
    if (id == null) return null;
    return this.partnerFacade.firms().find((f) => f.id === id)?.name ?? `#${id}`;
  });

  /** The signed-in admin can't disable their own account (would lock themselves out). */
  protected readonly currentUserId = computed(() => this.auth.adminUser()?.user_id ?? null);

  protected toggleActive(admin: AdminUserListRow): void {
    void this.facade.setActive(admin.user_id, !admin.is_active);
  }

  // ponytail: native confirm() over a bespoke dialog — one destructive action
  // on an internal admin page; build a confirm dialog if a second caller shows up.
  protected deleteUser(admin: AdminUserListRow): void {
    if (
      !confirm(`Permanently delete ${admin.email}? This removes their login and cannot be undone.`)
    )
      return;
    void this.facade.deleteUser(admin.user_id, admin.email);
  }

  /** Replace an existing admin's role set (the `set_admin_user_roles` RPC). */
  protected editRoles(admin: AdminUserListRow): void {
    const ref = this.dialog.open<EditAdminRolesDialog, string[] | undefined>(EditAdminRolesDialog, {
      data: {
        email: admin.email,
        roles: this.facade.roles(),
        selected: admin.roles.map((r) => r.slug),
        isSelf: admin.user_id === this.currentUserId(),
        callerIsSuper: this.auth.isSuperAdmin(),
      } satisfies EditAdminRolesDialogData,
      maxWidth: '480px',
      ariaLabel: `Edit roles for ${admin.email}`,
    });
    ref.afterClosed$.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((slugs) => {
      if (slugs) void this.facade.setRoles(admin.user_id, slugs);
    });
  }

  // ---- form state ----
  /** The onboarding form is hidden until the admin clicks "New admin user". */
  readonly showForm = signal(false);
  /**
   * Register-only mode: an EXISTING login (e.g. today's super admin) that has
   * a partner role but no Django PartnerAdmin row yet. Skips the Supabase
   * provisioning and only posts `/superadmin/partner-admins/`.
   */
  readonly registerFor = signal<AdminUserListRow | null>(null);
  readonly email = signal('');
  readonly fullName = signal('');
  /** Selected Supabase role slugs — partner roles are radios (see toggleRoleSlug). */
  readonly roleSlugs = signal<ReadonlySet<string>>(new Set());
  /** Comma/space/newline-separated email domains this admin will manage. */
  readonly domains = signal('');
  /** Optional report scope stored on admin_users.report_type (vendor admin API filter). */
  readonly reportType = signal('');
  /** Combined scope for a partner network admin: `network:<id>` or `firm:<id>`. */
  readonly partnerScope = signal<string | null>(null);
  /** Firm for a firm (sub-company) admin (Django PartnerAdmin scope). */
  readonly partnerFirmId = signal<number | null>(null);
  /** A super_admin login only needs a Django row if it will use the partner console. */
  readonly registerPartnerSuper = signal(true);

  readonly isSubmitting = signal(false);

  protected openForm(): void {
    this.showForm.set(true);
  }

  /** Open the form in register-only mode for a login that already exists. */
  protected openRegister(admin: AdminUserListRow): void {
    if (!partnerRoleOf(admin.roles.map((r) => r.slug))) {
      this.notification.error(
        'No partner role',
        'Assign a partner role (Roles) before registering a Django partner admin.',
      );
      return;
    }
    this.closeForm();
    this.registerFor.set(admin);
    this.email.set(admin.email);
    this.fullName.set(admin.full_name ?? '');
    this.roleSlugs.set(new Set(admin.roles.map((r) => r.slug)));
    this.showForm.set(true);
  }

  protected closeForm(): void {
    this.showForm.set(false);
    this.registerFor.set(null);
    this.email.set('');
    this.fullName.set('');
    this.roleSlugs.set(new Set());
    this.domains.set('');
    this.reportType.set('');
    this.partnerScope.set(null);
    this.partnerFirmId.set(null);
    this.registerPartnerSuper.set(true);
    this.prefilledNetworkId.set(null);
    this.prefilledFirmId.set(null);
  }

  // ---- Roles ---------------------------------------------------------------

  protected isRoleChecked(slug: string): boolean {
    return this.roleSlugs().has(slug);
  }

  /** Only a super admin may hand out super_admin (the RPC refuses too). */
  protected isRoleLocked(slug: string): boolean {
    return slug === 'super_admin' && !this.auth.isSuperAdmin();
  }

  protected toggleRole(slug: string, checked: boolean): void {
    this.roleSlugs.update((set) => toggleRoleSlug(set, slug, checked));
  }

  private readonly selectedRoles = computed(() =>
    this.facade.roles().filter((r) => this.roleSlugs().has(r.slug)),
  );

  // ---- Partner Platform provisioning --------------------------------------

  /** The one Django-mapped role among the selection, or null for internal-only sets. */
  protected readonly partnerMapping = computed(
    () => partnerRoleOf(this.roleSlugs())?.mapping ?? null,
  );

  protected readonly isPartnerRole = computed(() => this.partnerMapping() !== null);
  protected readonly isSuperSelected = computed(() => this.roleSlugs().has('super_admin'));

  /** Django role actually posted: binding an 'either' role to a firm downgrades it to `firm`. */
  protected readonly effectiveRole = computed<PartnerRole | null>(() => {
    const mapping = this.partnerMapping();
    if (!mapping) return null;
    if (mapping.scope === 'either' && this.partnerScope()?.startsWith('firm:')) return 'firm';
    return mapping.role;
  });

  /**
   * Capabilities posted with the Django row. Seeded from the role's defaults
   * whenever the effective role changes (linkedSignal resets), then editable.
   */
  readonly partnerCapabilities = linkedSignal<ReadonlySet<PartnerCapability>>(
    () => new Set(CAPABILITY_DEFAULTS[this.effectiveRole() ?? 'super']),
  );

  protected readonly capabilityOptions: CheckboxListOption[] = PARTNER_CAPABILITIES.map((c) => ({
    value: c,
    label: CAPABILITY_LABELS[c],
  }));

  protected readonly selectedCapabilities = computed(() => [...this.partnerCapabilities()]);

  protected onCapabilitiesChange(values: readonly (string | number)[]): void {
    this.partnerCapabilities.set(new Set(values as PartnerCapability[]));
  }

  /** Whether submitting registers a Django PartnerAdmin row. */
  private readonly registersPartnerAdmin = computed(() => {
    if (!this.partnerMapping()) return false;
    return this.isSuperSelected() ? this.registerPartnerSuper() : true;
  });

  /** Firms a firm-admin login can be bound to (member + standalone), labelled with their network. */
  protected readonly firmOptions = computed<AriaSelectOption<number>[]>(() =>
    this.partnerFacade.firms().map((f) => ({
      value: f.id,
      // The firm embeds its network, so no id → name lookup is needed.
      label: f.is_standalone ? `${f.name} (standalone)` : `${f.name} — ${f.network?.name ?? '—'}`,
    })),
  );

  /**
   * Networks + standalone firms in one list for the network-admin role
   * (`network:<id>` / `firm:<id>`). Sub-companies (member firms) are not
   * listed — their admins are provisioned via the sub-company role.
   */
  protected readonly scopeOptions = computed<AriaSelectOption<string>[]>(() => [
    ...this.partnerFacade
      .activeNetworks()
      .map((n) => ({ value: `network:${n.id}`, label: `${n.name} (network)` })),
    ...this.partnerFacade
      .standaloneFirms()
      .map((f) => ({ value: `firm:${f.id}`, label: `${f.name} (standalone firm)` })),
  ]);

  /** Permissions grouped by category for the checklist. */
  protected readonly permissionGroups = computed(() => {
    const groups = new Map<string, AdminPermissionRow[]>();
    for (const p of this.facade.permissions()) {
      const arr = groups.get(p.category) ?? [];
      arr.push(p);
      groups.set(p.category, arr);
    }
    return [...groups.entries()].map(([category, perms]) => ({ category, perms }));
  });

  /** Permission keys the selected roles grant by default — the union. */
  private readonly roleDefaults = computed<Set<string>>(() => {
    const set = new Set<string>();
    const byRole = this.facade.rolePermissions();
    for (const role of this.selectedRoles()) for (const key of byRole[role.id] ?? []) set.add(key);
    return set;
  });

  /**
   * Effective permission set. Seeded from the roles' defaults whenever the
   * selection changes (linkedSignal resets), then freely editable by the super-admin.
   */
  readonly selected = linkedSignal<Set<string>>(() => new Set(this.roleDefaults()));

  protected isChecked(key: string): boolean {
    return this.selected().has(key);
  }

  protected toggle(key: string, checked: boolean): void {
    this.selected.update((set) => {
      const next = new Set(set);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  readonly emailInvalid = computed(() => {
    const v = this.email().trim();
    if (!v) return false;
    return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  });

  /** Submit is allowed once email + roles are valid, plus the right scope for partner roles. */
  readonly canSubmit = computed(() => {
    if (!this.registerFor()) {
      if (!this.email().trim() || this.emailInvalid() || this.roleSlugs().size === 0) return false;
    }
    const mapping = this.partnerMapping();
    if (mapping?.scope === 'either' && this.partnerScope() == null) return false;
    if (mapping?.scope === 'firm' && this.partnerFirmId() == null) return false;
    return true;
  });

  /** Resolves the selected scope to Django ids: at most one of network_id / firm_id. */
  private scopeIds(): { network_id: number | null; firm_id: number | null } {
    const scope = this.partnerMapping()?.scope;
    if (!scope || scope === 'none') return { network_id: null, firm_id: null };
    if (scope === 'firm') return { network_id: null, firm_id: this.partnerFirmId() };
    const raw = this.partnerScope();
    if (!raw) return { network_id: null, firm_id: null };
    const [kind, id] = raw.split(':');
    return kind === 'network'
      ? { network_id: Number(id), firm_id: null }
      : { network_id: null, firm_id: Number(id) };
  }

  /**
   * One-click provisioning: create the Supabase login (+ RBAC rows) via the
   * `provision_admin_user` RPC, then — for partner roles — register the Django
   * PartnerAdmin (super, or bound to a network / firm) with the picked
   * capabilities. Register-only mode skips the first step.
   */
  protected async provision(): Promise<void> {
    if (!this.canSubmit() || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    try {
      const existing = this.registerFor();
      const email = this.email().trim().toLowerCase();
      let uid = existing?.user_id ?? null;

      if (!existing) {
        const defaults = this.roleDefaults();
        const selected = this.selected();
        // grants = selected beyond the roles' defaults; denies = defaults turned off.
        const grants = [...selected].filter((k) => !defaults.has(k));
        const denies = [...defaults].filter((k) => !selected.has(k));

        uid = await this.provisioning.provisionAdminUser({
          email,
          fullName: this.fullName().trim(),
          roleSlugs: [...this.roleSlugs()],
          domains: this.parseDomains(),
          grants,
          denies,
          reportType: this.reportType().trim(),
        });
        if (!uid) return;
        this.facade.reload();
      }

      if (this.registersPartnerAdmin() && uid) {
        const { network_id, firm_id } = this.scopeIds();
        const admin = await this.partnerFacade.createPartnerAdmin({
          supabase_uid: uid,
          email,
          role: this.effectiveRole() ?? 'super',
          ...(network_id != null ? { network: network_id } : {}),
          ...(firm_id != null ? { firm: firm_id } : {}),
          capabilities: [...this.partnerCapabilities()],
        });
        if (existing && !admin) return; // register-only: the facade already toasted
      }

      if (!existing) {
        this.notification.success(
          'Admin provisioned',
          `${email} created. Initial password: ${INITIAL_ADMIN_PASSWORD} — ask them to change it after signing in.`,
        );
      }
      this.closeForm();
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /** Split a free-text domains field on commas/whitespace into a clean list. */
  private parseDomains(raw = this.domains()): string[] {
    return [
      ...new Set(
        raw
          .split(/[\s,]+/)
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
  }

  // ponytail: native prompt(), same call as the confirm() above — remapping a
  // domain is rare and internal; build a dialog if this grows a second field.
  protected editDomains(admin: AdminUserListRow): void {
    const raw = prompt(
      `Email domains for ${admin.email} (comma or space separated, blank to clear):`,
      admin.domains.join(', '),
    );
    if (raw === null) return;
    void this.facade.setDomains(admin.user_id, this.parseDomains(raw));
  }
}
