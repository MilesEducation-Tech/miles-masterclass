import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  effect,
  inject,
  Injectable,
  linkedSignal,
  PLATFORM_ID,
  resource,
  signal,
  untracked,
} from '@angular/core';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import { ApiClient } from '../../../../shared/core/services/api-client/api-client';
import { Logger } from '../../../../shared/core/services/logger/logger';
import { NotificationService } from '../../../../shared/core/services/notification/notification';
import {
  adminContext,
  Coupon,
  CouponPagination,
  CouponsResponse,
  CouponStatusFilter,
  CreateFirmResponse,
  CreateSubCompanyRequest,
  DashboardStats,
  Firm,
  PartnerCode,
  PartnerCodesResponse,
  partnerErrorMessage,
  partnerLoadError,
  SendCouponResponse,
  SubCompaniesResponse,
} from '../models/partner-platform.model';
import { PartnerAdminMe } from './partner-admin-me';

const PARTNER_DASHBOARD = 'reports/partner-admin/dashboard/';
const PARTNER_SUB_COMPANIES = 'reports/partner-admin/sub-companies/';
const PARTNER_PARTNER_CODES = 'reports/partner-admin/partner-codes/';
const PARTNER_COUPONS = 'reports/partner-admin/coupons/';
const sendCouponUrl = (couponId: number) => `reports/partner-admin/coupons/${couponId}/send/`;

const PAGE_SIZE = 20;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const EMPTY_PAGINATION: CouponPagination = {
  total_count: 0,
  current_page_number: 1,
  next_page: null,
  previous_page: null,
};

/**
 * Network-admin AND firm-admin panel state: the dashboard stat cards, the
 * network's sub-companies (network admins only), and the coupon tracker.
 *
 * Coupons come from the single `GET /partner-admin/coupons/` endpoint, scoped
 * server-side by the caller's token: a network admin sees the whole network
 * (optionally filtered to one firm via `firm_id`); a firm admin is pinned to
 * their own firm (no `firm_id` sent). Status/pagination are server-side; the
 * free-text search box filters the current page client-side.
 */
@Injectable({ providedIn: 'root' })
export class PartnerNetworkFacade {
  private readonly api = inject(ApiClient);
  private readonly notification = inject(NotificationService);
  private readonly logger = inject(Logger);
  private readonly me = inject(PartnerAdminMe);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Rows per page — the table reads this to render the "showing x–y" window. */
  readonly pageSize = PAGE_SIZE;

  // ---- Dashboard -----------------------------------------------------------

  private readonly dashboardResource = resource({
    params: () => (this.isBrowser ? {} : undefined),
    loader: ({ abortSignal }) =>
      firstValueFrom(
        this.api
          .get<DashboardStats>(PARTNER_DASHBOARD, { context: adminContext() })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
      ),
  });

  readonly dashboard = computed<DashboardStats | undefined>(() => this.dashboardResource.value());
  readonly dashboardLoading = computed(() => this.dashboardResource.isLoading());
  /** Backend `message` when the load failed, else null — the banner renders it verbatim. */
  readonly dashboardError = computed(() =>
    partnerLoadError(this.dashboardResource.error(), 'Failed to load the dashboard.'),
  );

  // ---- Sub-companies (firms) — network admins only -------------------------

  private readonly subCompaniesResource = resource({
    // Only network admins have a sub-companies list; firm admins get 403.
    params: () =>
      this.isBrowser && !this.me.isLoading() && this.me.isNetworkAdmin() ? {} : undefined,
    loader: ({ abortSignal }) =>
      firstValueFrom(
        this.api
          .get<SubCompaniesResponse>(PARTNER_SUB_COMPANIES, { context: adminContext() })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: { sub_companies: [] } as SubCompaniesResponse },
      ),
  });

  readonly subCompanies = computed<Firm[]>(
    () => this.subCompaniesResource.value()?.sub_companies ?? [],
  );
  readonly subCompaniesLoading = computed(() => this.subCompaniesResource.isLoading());

  // ---- Partner codes (for the Create Sub-company plan picker) ---------------

  private readonly partnerCodesResource = resource({
    // Network-scoped list of plans a network admin can mint coupons from.
    params: () =>
      this.isBrowser && !this.me.isLoading() && this.me.isNetworkAdmin() ? {} : undefined,
    loader: ({ abortSignal }) =>
      firstValueFrom(
        this.api
          .get<PartnerCodesResponse>(PARTNER_PARTNER_CODES, { context: adminContext() })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: { partner_codes: [] } as PartnerCodesResponse },
      ),
  });

  /** Active partner codes the network can allocate from. */
  readonly partnerCodes = computed<PartnerCode[]>(() =>
    (this.partnerCodesResource.value()?.partner_codes ?? []).filter((c) => c.is_active),
  );

  /**
   * The firm the tracker is filtered to. `null` = all firms (network-wide) for a
   * network admin. Ignored for a firm admin (the backend pins them to their firm).
   */
  readonly selectedFirmId = signal<number | null>(null);

  selectFirm(firmId: number | null): void {
    this.selectedFirmId.set(firmId);
    this.pageNumber.set(1);
  }

  // ---- Coupons -------------------------------------------------------------

  readonly searchTerm = signal('');
  readonly statusFilter = signal<CouponStatusFilter>('all');
  readonly pageNumber = signal(1);

  private readonly couponsResource = resource({
    params: () => {
      if (!this.isBrowser || this.me.isLoading()) return undefined;
      // This facade serves network + firm admins; supers use the superadmin path.
      if (!this.me.isNetworkAdmin() && !this.me.isFirmAdmin()) return undefined;
      return {
        // Firm admins are pinned server-side — never send firm_id.
        firmId: this.me.isFirmAdmin() ? null : this.selectedFirmId(),
        status: this.statusFilter(),
        page: this.pageNumber(),
      };
    },
    loader: ({ params, abortSignal }) => {
      const httpParams: Record<string, string | number> = {
        page: params.page,
        page_size: PAGE_SIZE,
      };
      if (params.firmId != null) httpParams['firm_id'] = params.firmId;
      if (params.status !== 'all') httpParams['status'] = params.status;
      return firstValueFrom(
        this.api
          .get<CouponsResponse>(PARTNER_COUPONS, { params: httpParams, context: adminContext() })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: { coupons: [], pagination_data: EMPTY_PAGINATION } as CouponsResponse },
      );
    },
  });

  /** Local mirror of the current page so optimistic send patches survive a re-render. */
  private readonly pageCoupons = linkedSignal<Coupon[]>(
    () => this.couponsResource.value()?.coupons ?? [],
  );

  private readonly pagination = computed<CouponPagination>(
    () => this.couponsResource.value()?.pagination_data ?? EMPTY_PAGINATION,
  );

  readonly isLoading = computed(() => this.couponsResource.isLoading());
  readonly error = computed(() =>
    partnerLoadError(this.couponsResource.error(), 'Failed to load coupons.'),
  );

  // ponytail: the endpoint has no `search` param, so the search box filters only
  // the current server page. Upgrade to a server `search` param if it ships.
  readonly coupons = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    if (!search) return this.pageCoupons();
    return this.pageCoupons().filter((c) => {
      const haystack = [c.code, c.sent_to_email ?? '', c.applied_by ?? '', c.firm?.name ?? '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  });

  readonly totalCount = computed(() => this.pagination().total_count);
  readonly hasPrevPage = computed(() => this.pagination().previous_page != null);
  readonly hasNextPage = computed(() => this.pagination().next_page != null);

  setSearch(value: string): void {
    this.searchTerm.set(value);
  }

  setStatusFilter(value: CouponStatusFilter): void {
    this.statusFilter.set(value);
    this.pageNumber.set(1);
  }

  setPage(page: number): void {
    this.pageNumber.set(Math.max(1, page));
  }

  isValidEmail(value: string): boolean {
    return EMAIL_PATTERN.test(value.trim());
  }

  constructor() {
    // A firm-filter that no longer exists (e.g. after switching admins) would
    // pin the tracker to an empty result — reset it when the firm list changes.
    effect(() => {
      const firms = this.subCompanies();
      untracked(() => {
        const selected = this.selectedFirmId();
        if (selected != null && !firms.some((f) => f.id === selected)) {
          this.selectedFirmId.set(null);
        }
      });
    });
  }

  // ---- Mutations -----------------------------------------------------------

  /**
   * Step 1 of sub-company onboarding: create the firm + mint its coupons via
   * `POST /partner-admin/sub-companies/` (cap `code:create:firm`). Returns the
   * response (with the new firm id) so the caller can chain the Supabase login
   * + partner-admin creation; null on failure. The caller reports final success.
   */
  async createSubCompany(body: CreateSubCompanyRequest): Promise<CreateFirmResponse | null> {
    try {
      const res = await firstValueFrom(
        this.api.post<CreateFirmResponse>(PARTNER_SUB_COMPANIES, body, {
          context: adminContext(),
        }),
      );
      if (!res?.status || !res.firm) {
        this.notification.error(
          'Could not create sub-company',
          res?.message ?? 'The backend rejected the request.',
        );
        return null;
      }
      this.subCompaniesResource.reload();
      this.dashboardResource.reload();
      return res;
    } catch (err) {
      this.logger.error('[PartnerNetworkFacade] createSubCompany failed', err);
      this.notification.error('Could not create sub-company', partnerErrorMessage(err));
      return null;
    }
  }

  /** Send / resend the coupon code to `email`; optimistic patch to `shared`. */
  async sendCoupon(coupon: Coupon, email: string): Promise<boolean> {
    const target = email.trim();
    if (!this.isValidEmail(target)) {
      this.notification.error('Invalid email', 'Enter a valid email address to send the coupon.');
      return false;
    }
    try {
      const res = await firstValueFrom(
        this.api.post<SendCouponResponse>(
          sendCouponUrl(coupon.id),
          { email: target },
          { context: adminContext() },
        ),
      );
      if (!res?.status) {
        this.notification.error('Send failed', res?.message ?? 'The coupon could not be sent.');
        return false;
      }
      this.pageCoupons.update((rows) =>
        rows.map((r) =>
          r.id === coupon.id
            ? {
                ...r,
                status: res.coupon?.status ?? 'shared',
                sent_to_email: res.coupon?.sent_to_email ?? target,
              }
            : r,
        ),
      );
      this.notification.success('Coupon sent', `Code emailed to ${target}.`);
      return true;
    } catch (err) {
      this.logger.error('[PartnerNetworkFacade] sendCoupon failed', err);
      this.notification.error('Send failed', partnerErrorMessage(err));
      return false;
    }
  }

  reload(): void {
    this.couponsResource.reload();
    this.subCompaniesResource.reload();
    this.dashboardResource.reload();
  }
}
