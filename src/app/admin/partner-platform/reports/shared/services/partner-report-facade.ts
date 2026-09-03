import { isPlatformBrowser } from '@angular/common';
import { HttpResponse } from '@angular/common/http';
import {
  computed,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  resource,
  signal,
  untracked,
} from '@angular/core';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import { ApiClient } from '../../../../../shared/core/services/api-client/api-client';
import { Logger } from '../../../../../shared/core/services/logger/logger';
import { NotificationService } from '../../../../../shared/core/services/notification/notification';
import {
  fileNameFromContentDisposition,
  saveBlob,
} from '../../../../../shared/utils/blob-download';
import {
  adminContext,
  EMPTY_PAGINATION,
  PartnerPagination,
  partnerErrorMessage,
  partnerLoadError,
} from '../../../shared/models/partner-platform.model';
import { PartnerAdminMe } from '../../../shared/services/partner-admin-me';
import {
  ReportBase,
  ReportExportView,
  ReportFilters,
  ReportItemRow,
  ReportItemsResponse,
  ReportSubject,
  ReportSummary,
  ReportUserRow,
  ReportUsersResponse,
  reportUrl,
} from '../models/partner-report.model';

/** API default for the users list (max 200). */
const PAGE_SIZE = 30;

/** The shared base + scope + filter set every report call carries. */
interface ReportParams {
  base: ReportBase;
  subject: ReportSubject;
  dateFrom: string;
  dateTo: string;
  networkId: number | null;
  firmId: number | null;
}

/**
 * Partner Platform reports, both audiences:
 *
 *   - Django `super` admins call `partners/superadmin/report/…`, which requires
 *     exactly one of `network_id`/`firm_id` — nothing fetches until a scope is
 *     picked, so an unscoped admin never fires a 400.
 *   - Django `network`/`firm` admins call `partners/panel/report/…`, which is
 *     auto-scoped server-side and gated on `report:network:read` /
 *     `report:firm:read` — we never send a scope param there, and we don't
 *     fetch without the capability.
 *
 * Either way `PartnerAdminMe` is the fail-closed check: a Supabase admin with
 * the console perm but no Django row fetches nothing.
 */
@Injectable({ providedIn: 'root' })
export class PartnerReportFacade {
  private readonly api = inject(ApiClient);
  private readonly me = inject(PartnerAdminMe);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly pageSize = PAGE_SIZE;

  // ---- Filters -------------------------------------------------------------

  readonly subject = signal<ReportSubject>('courses');
  /** ISO `YYYY-MM-DD`, empty = unbounded. */
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly pageNumber = signal(1);

  /** Super-admin scope picker — exactly one of these, ignored for panel admins. */
  readonly scopeNetworkId = signal<number | null>(null);
  readonly scopeFirmId = signal<number | null>(null);

  /** Supers use the superadmin base + explicit scope; everyone else the panel base. */
  readonly isSuper = computed(() => this.me.role() === 'super');
  private readonly base = computed<ReportBase>(() => (this.isSuper() ? 'superadmin' : 'panel'));
  /** Supers must pick a target before anything can be fetched; panel admins are pre-scoped. */
  readonly needsScope = computed(
    () => this.isSuper() && this.scopeNetworkId() == null && this.scopeFirmId() == null,
  );

  selectNetwork(id: number | null): void {
    this.scopeNetworkId.set(id);
    this.scopeFirmId.set(null);
  }

  selectFirm(id: number | null): void {
    this.scopeFirmId.set(id);
    this.scopeNetworkId.set(null);
  }

  setSubject(value: ReportSubject): void {
    this.subject.set(value);
  }

  setPage(page: number): void {
    if (page < 1) return;
    this.pageNumber.set(page);
  }

  /** null while the report can't (or mustn't) be fetched — every resource keys off this. */
  private readonly reportParams = computed<ReportParams | null>(() => {
    if (!this.isBrowser || this.me.isLoading()) return null;
    if (this.isSuper()) {
      if (this.needsScope()) return null;
    } else {
      // Panel base: needs a partner-admin row with a report-read capability.
      if (!this.me.canReadReports()) return null;
    }
    return {
      base: this.base(),
      subject: this.subject(),
      dateFrom: this.dateFrom(),
      dateTo: this.dateTo(),
      // Scope params are a superadmin-only concept — the panel base is
      // auto-scoped and must never receive one.
      networkId: this.isSuper() ? this.scopeNetworkId() : null,
      firmId: this.isSuper() ? this.scopeFirmId() : null,
    };
  });

  /** Only the params the backend actually accepts, and only when set. */
  private buildHttpParams(p: ReportParams): Record<string, string | number> {
    const params: Record<string, string | number> = { subject: p.subject };
    if (p.dateFrom) params['date_from'] = p.dateFrom;
    if (p.dateTo) params['date_to'] = p.dateTo;
    if (p.networkId != null) params['network_id'] = p.networkId;
    if (p.firmId != null) params['firm_id'] = p.firmId;
    return params;
  }

  constructor() {
    // Any filter change invalidates the page cursor — a row on page 3 of the
    // old filter set is meaningless under the new one.
    effect(() => {
      this.subject();
      this.dateFrom();
      this.dateTo();
      this.scopeNetworkId();
      this.scopeFirmId();
      untracked(() => {
        if (this.pageNumber() !== 1) this.pageNumber.set(1);
      });
    });
  }

  // ---- Summary (stat cards) ------------------------------------------------

  private readonly summaryResource = resource({
    params: () => this.reportParams() ?? undefined,
    loader: ({ params, abortSignal }) =>
      firstValueFrom(
        this.api
          .get<ReportSummary>(reportUrl(params.base, 'summary/'), {
            params: this.buildHttpParams(params),
            context: adminContext(),
          })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
      ),
  });

  readonly summary = computed<ReportSummary | undefined>(() => this.summaryResource.value());
  readonly summaryLoading = computed(() => this.summaryResource.isLoading());
  readonly summaryError = computed(() =>
    partnerLoadError(this.summaryResource.error(), 'Failed to load the report summary.'),
  );

  // ---- Per-user roll-up ----------------------------------------------------

  private readonly usersResource = resource({
    params: () => {
      const p = this.reportParams();
      return p ? { ...p, page: this.pageNumber() } : undefined;
    },
    loader: ({ params, abortSignal }) =>
      firstValueFrom(
        this.api
          .get<ReportUsersResponse>(reportUrl(params.base, 'users/'), {
            params: {
              ...this.buildHttpParams(params),
              page: params.page,
              page_size: PAGE_SIZE,
            },
            context: adminContext(),
          })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        {
          defaultValue: {
            users: [],
            pagination_data: EMPTY_PAGINATION,
          } as ReportUsersResponse,
        },
      ),
  });

  readonly users = computed<ReportUserRow[]>(() => this.usersResource.value()?.users ?? []);
  readonly usersLoading = computed(() => this.usersResource.isLoading());
  readonly usersError = computed(() =>
    partnerLoadError(this.usersResource.error(), 'Failed to load the user report.'),
  );

  private readonly pagination = computed<PartnerPagination>(
    () => this.usersResource.value()?.pagination_data ?? EMPTY_PAGINATION,
  );
  readonly totalCount = computed(() => this.pagination().total_count);
  readonly hasPrevPage = computed(() => this.pagination().previous_page != null);
  readonly hasNextPage = computed(() => this.pagination().next_page != null);

  reload(): void {
    this.summaryResource.reload();
    this.usersResource.reload();
  }

  // ---- Drill-down ----------------------------------------------------------

  /**
   * One row per course/webinar for a single user. Fetched on demand by the
   * drill-down dialog (once, in `ngOnInit`) rather than through a `resource()`.
   * Throws so the dialog can render its own error state.
   */
  async userItems(userId: number): Promise<ReportItemRow[]> {
    const p = this.reportParams();
    if (!p) return [];
    const res = await firstValueFrom(
      this.api.get<ReportItemsResponse>(reportUrl(p.base, 'user-items/'), {
        params: { ...this.buildHttpParams(p), user_id: userId },
        context: adminContext(),
      }),
    );
    return res?.items ?? [];
  }

  // ---- Filters (static reference data) -------------------------------------

  private readonly filtersResource = resource({
    // No subject/scope params — only fetch once the caller may read reports.
    params: () => (this.reportParams() ? { base: this.reportParams()!.base } : undefined),
    loader: ({ params, abortSignal }) =>
      firstValueFrom(
        this.api
          .get<ReportFilters>(reportUrl(params.base, 'filters/'), { context: adminContext() })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: { delivery_types: [], fields_of_study: [] } as ReportFilters },
      ),
  });

  /**
   * Delivery types (`masterclass`, `nano_learning`, `webinar`) — powers the
   * client-side `course_type` filter chips on the drill-down. No list endpoint
   * accepts these as query params, so filtering stays client-side.
   */
  readonly deliveryTypes = computed<string[]>(
    () => this.filtersResource.value()?.delivery_types ?? [],
  );

  // ---- CSV export ----------------------------------------------------------

  readonly isExporting = signal(false);

  /** `view=user-items` needs the user it drills into; `user-summary` exports the whole scope. */
  async exportCsv(view: ReportExportView, userId?: number): Promise<void> {
    const p = this.reportParams();
    if (!p || this.isExporting()) return;

    this.isExporting.set(true);
    try {
      const res = await firstValueFrom(
        this.api.get<HttpResponse<Blob>>(reportUrl(p.base, 'export-csv/'), {
          params: {
            ...this.buildHttpParams(p),
            view,
            ...(userId != null ? { user_id: userId } : {}),
          },
          responseType: 'blob',
          observe: 'response',
          context: adminContext(),
        }),
      );

      const blob = res.body;
      if (!blob) throw new Error('Empty CSV response.');

      saveBlob(
        blob,
        fileNameFromContentDisposition(
          res.headers.get('content-disposition'),
          `partner-report-${p.subject}-${view}.csv`,
        ),
      );
      this.notification.success('Export ready', 'Your report CSV has been downloaded.');
    } catch (err) {
      this.logger.error('[PartnerReportFacade] exportCsv failed', err);
      this.notification.error('Export failed', partnerErrorMessage(err));
    } finally {
      this.isExporting.set(false);
    }
  }
}
