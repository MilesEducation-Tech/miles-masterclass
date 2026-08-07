import { isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, PLATFORM_ID, resource, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';
import { StatCard } from '../../shared/components/stat-card/stat-card';
import { PartnerSuperAdminFacade } from '../../shared/services/partner-superadmin-facade';
import {
  Coupon,
  CouponPagination,
  CouponsResponse,
  CouponStatusFilter,
  Firm,
  NetworkTrackerResponse,
  partnerLoadError,
} from '../../shared/models/partner-platform.model';
import { CouponTrackerTable } from '../../../coupon-tracker/shared/components/coupon-tracker-table/coupon-tracker-table';

const PAGE_SIZE = 20;
const STATUS_TABS: { value: CouponStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'shared', label: 'Shared' },
  { value: 'applied', label: 'Applied' },
  { value: 'expired', label: 'Expired' },
];

const EMPTY_PAGINATION: CouponPagination = {
  total_count: 0,
  current_page_number: 1,
  next_page: null,
  previous_page: null,
};

/**
 * Super-admin per-network tracker (`/admin/partner/networks/:id/tracker`).
 * Reads `GET /superadmin/networks/<id>/` for the stat-card summary + sub-companies
 * and `GET /superadmin/coupons/?network_id=|firm_id=` for the coupon list
 * (read-only — sending is a partner-admin action). Reuses `StatCard` and
 * `CouponTrackerTable`.
 */
@Component({
  selector: 'app-network-tracker',
  imports: [Spinner, StatCard, CouponTrackerTable],
  templateUrl: './network-tracker.html',
  host: { class: 'block w-full' },
})
export class NetworkTracker {
  private readonly superFacade = inject(PartnerSuperAdminFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly statusTabs = STATUS_TABS;
  protected readonly pageSize = PAGE_SIZE;

  protected readonly networkId = signal<number>(Number(this.route.snapshot.paramMap.get('id')));
  /** null = all firms in the network. */
  protected readonly selectedFirmId = signal<number | null>(null);
  protected readonly statusFilter = signal<CouponStatusFilter>('all');
  protected readonly pageNumber = signal(1);

  // ---- Header (summary + sub-companies) ------------------------------------

  private readonly headerResource = resource({
    params: () => (this.isBrowser && this.networkId() > 0 ? { id: this.networkId() } : undefined),
    loader: ({ params, abortSignal }) =>
      firstValueFrom(
        this.superFacade.networkTracker(params.id).pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
      ),
  });

  private readonly header = computed<NetworkTrackerResponse | undefined>(() =>
    this.headerResource.value(),
  );
  protected readonly headerLoading = computed(() => this.headerResource.isLoading());
  protected readonly networkName = computed(() => this.header()?.summary.network.name ?? 'Network');
  protected readonly subCompanies = computed<Firm[]>(() => this.header()?.sub_companies ?? []);

  protected readonly cards = computed(() => {
    const s = this.header()?.summary;
    if (!s) return [];
    return [
      { label: 'Total seats', value: s.total_seats, accent: 'var(--mm-fg-3)' },
      { label: 'Allocated', value: s.allocated, accent: 'var(--chart-1)' },
      { label: 'Unallocated', value: s.unallocated, accent: 'var(--chart-5)' },
      { label: 'Used', value: s.used, accent: 'var(--chart-3)' },
      { label: 'Available', value: s.available, accent: 'var(--mm-info)' },
      { label: 'Shared', value: s.shared, accent: 'var(--mm-warn)' },
      { label: 'Applied', value: s.applied, accent: 'var(--mm-success)' },
      { label: 'Expired', value: s.expired, accent: 'var(--mm-danger)' },
    ];
  });

  // ---- Coupons -------------------------------------------------------------

  private readonly couponsResource = resource({
    params: () => {
      if (!this.isBrowser || this.networkId() <= 0) return undefined;
      return {
        networkId: this.networkId(),
        firmId: this.selectedFirmId(),
        status: this.statusFilter(),
        page: this.pageNumber(),
      };
    },
    loader: ({ params, abortSignal }) =>
      firstValueFrom(
        this.superFacade
          .superCoupons({
            // Filter to one firm, else the whole network.
            ...(params.firmId != null
              ? { firm_id: params.firmId }
              : { network_id: params.networkId }),
            status: params.status,
            page: params.page,
            page_size: PAGE_SIZE,
          })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: { coupons: [], pagination_data: EMPTY_PAGINATION } as CouponsResponse },
      ),
  });

  protected readonly coupons = computed<Coupon[]>(
    () => this.couponsResource.value()?.coupons ?? [],
  );
  protected readonly couponsLoading = computed(() => this.couponsResource.isLoading());
  protected readonly couponsError = computed(() =>
    partnerLoadError(this.couponsResource.error(), 'Failed to load coupons.'),
  );

  private readonly pagination = computed<CouponPagination>(
    () => this.couponsResource.value()?.pagination_data ?? EMPTY_PAGINATION,
  );
  protected readonly currentPage = computed(() => this.pageNumber());
  protected readonly totalCount = computed(() => this.pagination().total_count);
  protected readonly hasPrev = computed(() => this.pagination().previous_page != null);
  protected readonly hasNext = computed(() => this.pagination().next_page != null);

  protected isActiveTab(value: CouponStatusFilter): boolean {
    return this.statusFilter() === value;
  }

  protected selectStatus(value: CouponStatusFilter): void {
    this.statusFilter.set(value);
    this.pageNumber.set(1);
  }

  protected onSelectFirm(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    this.selectedFirmId.set(raw === '' ? null : Number(raw));
    this.pageNumber.set(1);
  }

  protected goPrev(): void {
    this.pageNumber.update((p) => Math.max(1, p - 1));
  }

  protected goNext(): void {
    this.pageNumber.update((p) => p + 1);
  }
}
