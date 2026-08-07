import { DatePipe } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AriaInput } from '../../shared/components/ui/aria/aria-input/aria-input';
import { AriaSelect } from '../../shared/components/ui/aria/aria-select/aria-select';
import { Button } from '../../shared/components/ui/button/button';
import { Spinner } from '../../shared/components/ui/spinner/spinner';
import { NotificationService } from '../../shared/core/services/notification/notification';
import { AdminAuth } from '../../shared/core/services/admin-auth/admin-auth';
import { AriaSelectOption } from '../../shared/core/models/aria.model';
import {
  AdminUsersFacade,
  AdminPermissionRow,
  AdminUserListRow,
} from './shared/services/admin-users-facade';
import { PartnerSuperAdminFacade } from '../partner-platform/shared/services/partner-superadmin-facade';
import {
  AdminProvisioning,
  INITIAL_ADMIN_PASSWORD,
} from '../partner-platform/shared/services/admin-provisioning';
import { PartnerRole } from '../partner-platform/shared/models/partner-platform.model';

/** Django PartnerAdmin mapping derived from a Supabase partner role slug. */
interface PartnerMapping {
  role: PartnerRole;
  capabilities: string[];
  /** 'either' = bind to a network or a firm; 'firm' = firms only. */
  scope: 'either' | 'firm';
}

/** Firm-scoped Django login (role=firm): own-firm tracker + Users; no code:create:firm. */
const FIRM_CAPABILITIES = ['report:firm:read', 'user:block'];

const PARTNER_ROLE_MAP: Record<string, PartnerMapping> = {
  // Network admin is the role picked after creating a network OR a firm, so its
  // scope selector lists both. Binding to a firm downgrades the Django side to
  // role=firm with FIRM_CAPABILITIES (a standalone company's admin).
  partner_network_admin: {
    role: 'network',
    capabilities: ['report:network:read', 'code:create:firm', 'coupon:send', 'user:block'],
    scope: 'either',
  },
  partner_subcompany_admin: {
    role: 'firm',
    capabilities: FIRM_CAPABILITIES,
    scope: 'firm',
  },
};

@Component({
  selector: 'app-admin-admin-users',
  imports: [AriaInput, AriaSelect, Button, Spinner, DatePipe],
  providers: [AdminUsersFacade],
  templateUrl: './admin-users.html',
  host: { class: 'block w-full' },
})
export class AdminUsers {
  protected readonly facade = inject(AdminUsersFacade);
  private readonly notification = inject(NotificationService);
  private readonly auth = inject(AdminAuth);
  private readonly partnerFacade = inject(PartnerSuperAdminFacade);
  private readonly provisioning = inject(AdminProvisioning);
  private readonly route = inject(ActivatedRoute);

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

  // ---- form state ----
  /** The onboarding form is hidden until the admin clicks "New admin user". */
  readonly showForm = signal(false);
  readonly email = signal('');
  readonly fullName = signal('');
  readonly roleId = signal<string | null>(null);
  /** Comma/space/newline-separated email domains this admin will manage. */
  readonly domains = signal('');
  /** Optional report scope stored on admin_users.report_type (vendor admin API filter). */
  readonly reportType = signal('');
  /** Combined scope for a partner network admin: `network:<id>` or `firm:<id>`. */
  readonly partnerScope = signal<string | null>(null);
  /** Firm for a firm (sub-company) admin (Django PartnerAdmin scope). */
  readonly partnerFirmId = signal<number | null>(null);

  readonly isSubmitting = signal(false);

  protected openForm(): void {
    this.showForm.set(true);
  }

  protected closeForm(): void {
    this.showForm.set(false);
    this.email.set('');
    this.fullName.set('');
    this.roleId.set(null);
    this.domains.set('');
    this.reportType.set('');
    this.partnerScope.set(null);
    this.partnerFirmId.set(null);
    this.prefilledNetworkId.set(null);
    this.prefilledFirmId.set(null);
  }

  protected readonly roleOptions = computed<AriaSelectOption<string>[]>(() =>
    this.facade.roles().map((r) => ({ value: r.id, label: r.name })),
  );

  // ---- Partner Platform provisioning --------------------------------------

  /** Slug of the currently-selected Supabase role. */
  private readonly selectedRoleSlug = computed(
    () => this.facade.roles().find((r) => r.id === this.roleId())?.slug ?? null,
  );

  /** Django PartnerAdmin mapping for the selected role, or null for non-partner roles. */
  protected readonly partnerMapping = computed<PartnerMapping | null>(
    () => PARTNER_ROLE_MAP[this.selectedRoleSlug() ?? ''] ?? null,
  );

  protected readonly isPartnerRole = computed(() => this.partnerMapping() !== null);

  /** Firms a firm-admin login can be bound to (member + standalone), labelled with their network. */
  protected readonly firmOptions = computed<AriaSelectOption<number>[]>(() => {
    const networks = new Map(this.partnerFacade.networks().map((n) => [n.id, n.name]));
    return this.partnerFacade.firms().map((f) => ({
      value: f.id,
      label:
        f.network == null
          ? `${f.name} (standalone)`
          : `${f.name} — ${networks.get(f.network) ?? `network #${f.network}`}`,
    }));
  });

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

  /** Permission keys the selected role grants by default. */
  private readonly roleDefaults = computed<Set<string>>(() => {
    const id = this.roleId();
    if (!id) return new Set();
    return new Set(this.facade.rolePermissions()[id] ?? []);
  });

  /**
   * Effective permission set. Seeded from the role's defaults whenever the role
   * changes (linkedSignal resets), then freely editable by the super-admin.
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

  /** Submit is allowed once email + role are valid, plus the right scope for partner roles. */
  readonly canSubmit = computed(() => {
    if (!this.email().trim() || this.emailInvalid() || !this.roleId()) return false;
    const mapping = this.partnerMapping();
    if (mapping?.scope === 'either' && this.partnerScope() == null) return false;
    if (mapping?.scope === 'firm' && this.partnerFirmId() == null) return false;
    return true;
  });

  /** Resolves the selected scope to Django ids: exactly one of network_id / firm_id. */
  private scopeIds(): { network_id: number | null; firm_id: number | null } {
    if (this.partnerMapping()?.scope === 'firm') {
      return { network_id: null, firm_id: this.partnerFirmId() };
    }
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
   * PartnerAdmin, bound to a network (role=network) or a firm (role=firm).
   */
  protected async provision(): Promise<void> {
    if (!this.canSubmit() || this.isSubmitting()) return;
    const role = this.facade.roles().find((r) => r.id === this.roleId());
    if (!role) return;

    this.isSubmitting.set(true);
    try {
      const defaults = this.roleDefaults();
      const selected = this.selected();
      // grants = selected beyond the role's defaults; denies = role defaults turned off.
      const grants = [...selected].filter((k) => !defaults.has(k));
      const denies = [...defaults].filter((k) => !selected.has(k));

      const uid = await this.provisioning.provisionAdminUser({
        email: this.email().trim(),
        fullName: this.fullName().trim(),
        roleSlug: role.slug,
        domains: this.parseDomains(),
        grants,
        denies,
        reportType: this.reportType().trim(),
      });
      if (!uid) return;
      this.facade.reload();

      const mapping = this.partnerMapping();
      if (mapping) {
        // The Django role follows the scope (network vs firm); the capabilities
        // are the same either way — a standalone firm's admin gets the full
        // network-admin capability set, just bound via firm_id.
        const { network_id, firm_id } = this.scopeIds();
        await this.partnerFacade.createPartnerAdmin({
          supabase_uid: uid,
          email: this.email().trim().toLowerCase(),
          role: firm_id != null ? 'firm' : mapping.role,
          network_id,
          firm_id,
          capabilities: mapping.capabilities,
        });
      }

      this.notification.success(
        'Admin provisioned',
        `${this.email().trim()} created. Initial password: ${INITIAL_ADMIN_PASSWORD} — ask them to change it after signing in.`,
      );
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
