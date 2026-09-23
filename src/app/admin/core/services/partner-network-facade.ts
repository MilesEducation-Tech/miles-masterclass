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
import { ApiClient } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import {
  adminContext,
  DashboardStats,
  EMPTY_PAGINATION,
  Firm,
  FirmsResponse,
  PartnerCode,
  PartnerCodesResponse,
  partnerErrorMessage,
  partnerLoadError,
  PartnerPagination,
  Seat,
  SeatsResponse,
  SeatStatusFilter,
} from '@admin/core/models/partner-platform.model';
import { PartnerAdminMe } from './partner-admin-me';

const PANEL_DASHBOARD = 'partners/panel/dashboard/';
const PANEL_FIRMS = 'partners/panel/firms/';
const PANEL_SEATS = 'partners/panel/seats/';
const PANEL_PARTNER_CODES = 'partners/panel/partner-codes/';
const sendSeatUrl = (seatId: number) => `${PANEL_SEATS}${seatId}/send/`;

const PAGE_SIZE = 20;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Network-admin AND firm-admin panel state: the dashboard stat cards, the
 * network's member firms (network admins only), and the seat tracker.
 *
 * Seats come from `GET /panel/seats/`, scoped server-side by the caller's
 * token: a network admin sees the whole network (optionally drilled into one
 * firm via `firm_id`); a firm admin is pinned to their own firm, so we never
 * send `firm_id` for them — a caller-supplied scope must not be able to widen
 * what they see.
 */
// Route-scoped (see admin.routes.ts): the injector dies on navigation, which
// aborts in-flight resource() loads and stops this page's calls firing elsewhere.
@Injectable()
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
    // The endpoint requires report:network:read / report:firm:read — don't
    // fire a doomed 403 for an admin without either.
    params: () =>
      this.isBrowser && !this.me.isLoading() && this.me.canReadReports() ? true : undefined,
    loader: ({ abortSignal }) =>
      firstValueFrom(
        this.api
          .get<DashboardStats>(PANEL_DASHBOARD, { context: adminContext() })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
      ),
  });

  readonly dashboard = computed<DashboardStats | undefined>(() => this.dashboardResource.value());
  readonly dashboardLoading = computed(() => this.dashboardResource.isLoading());
  /** Backend `message` when the load failed, else null — the banner renders it verbatim. */
  readonly dashboardError = computed(() =>
    partnerLoadError(this.dashboardResource.error(), 'Failed to load the dashboard.'),
  );

  // ---- Member firms — network admins only ----------------------------------

  private readonly firmsResource = resource({
    // Always empty for a firm admin (no sibling firms to see).
    params: () =>
      this.isBrowser && !this.me.isLoading() && this.me.isNetworkAdmin() ? true : undefined,
    loader: ({ abortSignal }) =>
      firstValueFrom(
        this.api
          .get<FirmsResponse>(PANEL_FIRMS, { context: adminContext() })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: { firms: [] } as FirmsResponse },
      ),
  });

  readonly firms = computed<Firm[]>(() => this.firmsResource.value()?.firms ?? []);
  readonly firmsLoading = computed(() => this.firmsResource.isLoading());

  // ---- Panel partner codes — the plans this admin can mint seats from ------

  private readonly panelCodesResource = resource({
    // Same report:*:read gate the endpoint enforces server-side.
    params: () =>
      this.isBrowser && !this.me.isLoading() && this.me.canReadReports() ? true : undefined,
    loader: ({ abortSignal }) =>
      firstValueFrom(
        this.api
          .get<PartnerCodesResponse>(PANEL_PARTNER_CODES, { context: adminContext() })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: { partner_codes: [] } as PartnerCodesResponse },
      ),
  });

  readonly panelPartnerCodes = computed<PartnerCode[]>(
    () => this.panelCodesResource.value()?.partner_codes ?? [],
  );
  readonly panelCodesLoading = computed(() => this.panelCodesResource.isLoading());
  readonly panelCodesError = computed(() =>
    partnerLoadError(this.panelCodesResource.error(), 'Failed to load partner codes.'),
  );

  /**
   * The firm the tracker is drilled into. `null` = all firms (network-wide) for
   * a network admin. Ignored for a firm admin (the backend pins them).
   */
  readonly selectedFirmId = signal<number | null>(null);

  selectFirm(firmId: number | null): void {
    this.selectedFirmId.set(firmId);
    this.pageNumber.set(1);
  }

  // ---- Seats ---------------------------------------------------------------

  readonly searchTerm = signal('');
  readonly statusFilter = signal<SeatStatusFilter>('all');
  readonly pageNumber = signal(1);

  private readonly seatsResource = resource({
    params: () => {
      if (!this.isBrowser || this.me.isLoading()) return undefined;
      // This facade serves network + firm admins; supers use the superadmin path.
      if (!this.me.isNetworkAdmin() && !this.me.isFirmAdmin()) return undefined;
      // The endpoint requires this capability — don't fire a doomed 403.
      if (!this.me.can('seat:usage:read')) return undefined;
      return {
        // Firm admins are pinned server-side — never send firm_id.
        firmId: this.me.isFirmAdmin() ? null : this.selectedFirmId(),
        status: this.statusFilter(),
        search: this.searchTerm().trim(),
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
      if (params.search) httpParams['search'] = params.search;
      return firstValueFrom(
        this.api
          .get<SeatsResponse>(PANEL_SEATS, { params: httpParams, context: adminContext() })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: { seats: [], pagination_data: EMPTY_PAGINATION } as SeatsResponse },
      );
    },
  });

  /** Local mirror of the current page so optimistic send patches survive a re-render. */
  private readonly pageSeats = linkedSignal<Seat[]>(() => this.seatsResource.value()?.seats ?? []);

  private readonly pagination = computed<PartnerPagination>(
    () => this.seatsResource.value()?.pagination_data ?? EMPTY_PAGINATION,
  );

  readonly isLoading = computed(() => this.seatsResource.isLoading());
  readonly error = computed(() =>
    partnerLoadError(this.seatsResource.error(), 'Failed to load seats.'),
  );

  /** Search is server-side now — the endpoint matches on seat code and email. */
  readonly seats = computed(() => this.pageSeats());

  readonly totalCount = computed(() => this.pagination().total_count);
  readonly hasPrevPage = computed(() => this.pagination().previous_page != null);
  readonly hasNextPage = computed(() => this.pagination().next_page != null);

  setSearch(value: string): void {
    this.searchTerm.set(value);
    this.pageNumber.set(1);
  }

  setStatusFilter(value: SeatStatusFilter): void {
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
    // A firm drill-down that no longer exists (e.g. after switching admins)
    // would pin the tracker to an empty result — reset it when the list changes.
    effect(() => {
      const firms = this.firms();
      untracked(() => {
        const selected = this.selectedFirmId();
        if (selected != null && !firms.some((f) => f.id === selected)) {
          this.selectedFirmId.set(null);
        }
      });
    });
  }

  // ---- Mutations -----------------------------------------------------------

  /** Send / resend a seat's code to `email`; optimistic patch to `shared`. */
  async sendSeat(seat: Seat, email: string): Promise<boolean> {
    const target = email.trim();
    if (!this.isValidEmail(target)) {
      this.notification.error('Invalid email', 'Enter a valid email address to send the seat.');
      return false;
    }
    try {
      const updated = await firstValueFrom(
        this.api.post<Seat>(sendSeatUrl(seat.id), { email: target }, { context: adminContext() }),
      );
      this.pageSeats.update((rows) => rows.map((r) => (r.id === seat.id ? updated : r)));
      this.notification.success('Seat sent', `Code emailed to ${target}.`);
      return true;
    } catch (err) {
      this.logger.error('[PartnerNetworkFacade] sendSeat failed', err);
      this.notification.error('Send failed', partnerErrorMessage(err));
      return false;
    }
  }

  reload(): void {
    this.seatsResource.reload();
    this.firmsResource.reload();
    this.dashboardResource.reload();
  }
}
