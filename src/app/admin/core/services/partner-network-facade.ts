import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import {
  computed,
  effect,
  inject,
  Service,
  linkedSignal,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient, apiUrl } from '@core/services/api-client/api-client';
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
@Service({ autoProvided: false })
export class PartnerNetworkFacade {
  private readonly api = inject(ApiClient);
  private readonly notification = inject(NotificationService);
  private readonly logger = inject(Logger);
  private readonly me = inject(PartnerAdminMe);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Rows per page — the table reads this to render the "showing x–y" window. */
  readonly pageSize = PAGE_SIZE;

  // ---- Dashboard -----------------------------------------------------------

  private readonly dashboardResource = httpResource<DashboardStats>(() =>
    // The endpoint requires report:network:read / report:firm:read — don't
    // fire a doomed 403 for an admin without either.
    this.isBrowser && !this.me.isLoading() && this.me.canReadReports()
      ? { url: apiUrl(PANEL_DASHBOARD), context: adminContext() }
      : undefined,
  );

  /** Guarded, like every read below: `value()` throws on an errored resource. */
  readonly dashboard = computed<DashboardStats | undefined>(() =>
    this.dashboardResource.hasValue() ? this.dashboardResource.value() : undefined,
  );
  readonly dashboardLoading = computed(() => this.dashboardResource.isLoading());
  /** Backend `message` when the load failed, else null — the banner renders it verbatim. */
  readonly dashboardError = computed(() =>
    partnerLoadError(this.dashboardResource.error(), 'Failed to load the dashboard.'),
  );

  // ---- Member firms — network admins only ----------------------------------

  private readonly firmsResource = httpResource<FirmsResponse>(
    // Always empty for a firm admin (no sibling firms to see).
    () =>
      this.isBrowser && !this.me.isLoading() && this.me.isNetworkAdmin()
        ? { url: apiUrl(PANEL_FIRMS), context: adminContext() }
        : undefined,
    { defaultValue: { firms: [] } as FirmsResponse },
  );

  readonly firms = computed<Firm[]>(() =>
    this.firmsResource.hasValue() ? (this.firmsResource.value()?.firms ?? []) : [],
  );
  readonly firmsLoading = computed(() => this.firmsResource.isLoading());

  // ---- Panel partner codes — the plans this admin can mint seats from ------

  private readonly panelCodesResource = httpResource<PartnerCodesResponse>(
    // Same report:*:read gate the endpoint enforces server-side.
    () =>
      this.isBrowser && !this.me.isLoading() && this.me.canReadReports()
        ? { url: apiUrl(PANEL_PARTNER_CODES), context: adminContext() }
        : undefined,
    { defaultValue: { partner_codes: [] } as PartnerCodesResponse },
  );

  readonly panelPartnerCodes = computed<PartnerCode[]>(() =>
    this.panelCodesResource.hasValue()
      ? (this.panelCodesResource.value()?.partner_codes ?? [])
      : [],
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

  private readonly seatsResource = httpResource<SeatsResponse>(
    () => {
      if (!this.isBrowser || this.me.isLoading()) return undefined;
      // This facade serves network + firm admins; supers use the superadmin path.
      if (!this.me.isNetworkAdmin() && !this.me.isFirmAdmin()) return undefined;
      // The endpoint requires this capability — don't fire a doomed 403.
      if (!this.me.can('seat:usage:read')) return undefined;
      const params: Record<string, string | number> = {
        page: this.pageNumber(),
        page_size: PAGE_SIZE,
      };
      // Firm admins are pinned server-side — never send firm_id.
      const firmId = this.me.isFirmAdmin() ? null : this.selectedFirmId();
      if (firmId != null) params['firm_id'] = firmId;
      const status = this.statusFilter();
      if (status !== 'all') params['status'] = status;
      const search = this.searchTerm().trim();
      if (search) params['search'] = search;
      return { url: apiUrl(PANEL_SEATS), params, context: adminContext() };
    },
    { defaultValue: { seats: [], pagination_data: EMPTY_PAGINATION } as SeatsResponse },
  );

  /** The loaded page, or `undefined`: guarded, since `value()` throws on an errored resource. */
  private readonly seatsPage = computed(() =>
    this.seatsResource.hasValue() ? this.seatsResource.value() : undefined,
  );

  /** Local mirror of the current page so optimistic send patches survive a re-render. */
  private readonly pageSeats = linkedSignal<Seat[]>(() => this.seatsPage()?.seats ?? []);

  private readonly pagination = computed<PartnerPagination>(
    () => this.seatsPage()?.pagination_data ?? EMPTY_PAGINATION,
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
