import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, take } from 'rxjs';
import { AriaInput } from '../../shared/components/ui/aria/aria-input/aria-input';
import { Button } from '../../shared/components/ui/button/button';
import { Dialog } from '../../shared/core/services/dialog/dialog';
import { NotificationService } from '../../shared/core/services/notification/notification';
import { PartnerNetworkFacade } from '../partner-platform/shared/services/partner-network-facade';
import { PartnerSuperAdminFacade } from '../partner-platform/shared/services/partner-superadmin-facade';
import { PartnerAdminMe } from '../partner-platform/shared/services/partner-admin-me';
import {
  AdminProvisioning,
  INITIAL_ADMIN_PASSWORD,
} from '../partner-platform/shared/services/admin-provisioning';
import {
  Coupon,
  CouponStatusFilter,
} from '../partner-platform/shared/models/partner-platform.model';
import { CouponTrackerTable } from './shared/components/coupon-tracker-table/coupon-tracker-table';
import {
  CreateSubCompanyDialog,
  CreateSubCompanyDialogData,
  CreateSubCompanyResult,
} from './shared/components/create-sub-company-dialog/create-sub-company-dialog';

const STATUS_TABS: { value: CouponStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'shared', label: 'Shared' },
  { value: 'applied', label: 'Applied' },
  { value: 'expired', label: 'Expired' },
];

/**
 * Partner Code Tracker (`/admin/partner-code-tracker`) for network + firm admins.
 * Lists coupons from `GET /partner-admin/coupons/`: a network admin sees the
 * whole network (optionally filtered to one firm), a firm admin only their own
 * firm. Gating from `/me/` capabilities: `code:create:firm` → Create Sub-company;
 * `coupon:send` → send/resend. Anyone else sees the tracker read-only.
 * (Super admins use the per-network tracker on the Networks page instead.)
 */
@Component({
  selector: 'app-coupon-tracker',
  imports: [AriaInput, Button, CouponTrackerTable],
  templateUrl: './coupon-tracker.html',
  styleUrl: './coupon-tracker.css',
  host: { class: 'block w-full' },
})
export class CouponTracker {
  protected readonly facade = inject(PartnerNetworkFacade);
  protected readonly me = inject(PartnerAdminMe);
  private readonly superFacade = inject(PartnerSuperAdminFacade);
  private readonly provisioning = inject(AdminProvisioning);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(Dialog);

  protected readonly statusTabs = STATUS_TABS;
  protected readonly searchInput = signal('');

  protected readonly currentPage = computed(() => this.facade.pageNumber());
  protected readonly totalCount = computed(() => this.facade.totalCount());

  /** Panel title: network name for a network admin, firm name for a firm admin. */
  protected readonly title = computed(
    () => this.me.network()?.name ?? this.me.firm()?.name ?? 'Partner network',
  );

  /**
   * Create Sub-company needs the `code:create:firm` capability AND role=network —
   * a firm admin (`/me/` returns a firm) gets 403 on sub-company create
   * regardless of capabilities, so never show them the button.
   */
  protected readonly canCreateFirm = computed(
    () => this.me.isNetworkAdmin() && this.me.can('code:create:firm'),
  );
  /** Send / resend is gated on the coupon:send capability. */
  protected readonly canSend = computed(() => this.me.can('coupon:send'));
  /** Show the per-row firm column only when not pinned to a single firm. */
  protected readonly showFirmColumn = computed(
    () => this.me.isNetworkAdmin() && this.facade.selectedFirmId() == null,
  );

  constructor() {
    toObservable(this.searchInput)
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.facade.setSearch(value));
  }

  protected isActiveTab(value: CouponStatusFilter): boolean {
    return this.facade.statusFilter() === value;
  }

  protected selectStatus(value: CouponStatusFilter): void {
    this.facade.setStatusFilter(value);
  }

  protected onSelectFirm(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    if (raw === '') {
      this.facade.selectFirm(null);
      return;
    }
    const id = Number(raw);
    if (!Number.isNaN(id)) this.facade.selectFirm(id);
  }

  protected goPrev(): void {
    this.facade.setPage(this.currentPage() - 1);
  }

  protected goNext(): void {
    this.facade.setPage(this.currentPage() + 1);
  }

  protected onShare(event: { coupon: Coupon; email: string }): void {
    void this.facade.sendCoupon(event.coupon, event.email);
  }

  protected onResend(coupon: Coupon): void {
    if (coupon.sent_to_email) void this.facade.sendCoupon(coupon, coupon.sent_to_email);
  }

  protected openCreateSubCompany(): void {
    const ref = this.dialog.open<CreateSubCompanyDialog, CreateSubCompanyResult | undefined>(
      CreateSubCompanyDialog,
      {
        data: {
          availablePool: this.facade.dashboard()?.available ?? 0,
        } satisfies CreateSubCompanyDialogData,
        maxWidth: '560px',
        ariaLabel: 'Create sub-company',
      },
    );
    ref.afterClosed$.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (result) void this.onboardSubCompany(result);
    });
  }

  /**
   * Merged sub-company onboarding — three creations, sequential, stop on first
   * failure (each call raises its own error toast):
   *   1. The firm + minted coupons via `POST /partner-admin/sub-companies/`.
   *   2. The Supabase login for the sub-company admin (`provision_admin_user` RPC).
   *   3. The Django partner admin (role=firm) bound to the new firm.
   * The partner-admin can also be (re)created later from Admin Users.
   */
  private async onboardSubCompany(result: CreateSubCompanyResult): Promise<void> {
    // 1. Sub-company (firm) + coupons.
    const created = await this.facade.createSubCompany({
      name: result.name,
      email_domain: result.email_domain,
      allocations: result.allocations,
    });
    if (!created?.firm) return;

    // 2. Supabase login for the sub-company admin.
    const uid = await this.provisioning.provisionAdminUser({
      email: result.admin_email,
      fullName: result.admin_name,
      roleSlug: 'partner_subcompany_admin',
      domains: [result.email_domain],
    });
    if (!uid) return;

    // 3. Django partner admin (role=firm), pinned to the new firm.
    const registered = await this.superFacade.createPartnerAdmin({
      supabase_uid: uid,
      email: result.admin_email.trim().toLowerCase(),
      role: 'firm',
      firm_id: created.firm.id,
      capabilities: ['report:firm:read', 'user:block'],
    });
    if (!registered) return;

    this.facade.reload();
    this.notification.success(
      'Sub-company onboarded',
      `${result.admin_email} can sign in with the initial password ${INITIAL_ADMIN_PASSWORD} — ask them to change it.`,
    );
  }
}
