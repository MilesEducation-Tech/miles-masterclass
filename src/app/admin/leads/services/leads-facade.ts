import { isPlatformBrowser } from '@angular/common';
import { HttpResponse } from '@angular/common/http';
import {
  computed,
  inject,
  Service,
  linkedSignal,
  PLATFORM_ID,
  resource,
  signal,
} from '@angular/core';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import { ApiClient } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import { fileNameFromContentDisposition, saveBlob } from '@shared/utils/blob-download';
import { drfErrorMessage } from '@core/utils/drf-error-message';
import { withPreviousValue } from '@shared/utils/with-previous-value';
import {
  adminContext,
  EMPTY_PAGINATION,
  partnerBlobErrorMessage,
  PartnerPagination,
} from '@admin/core/models/partner-platform.model';
import {
  FirmInquiry,
  LeadPatch,
  LeadsResponse,
  LeadStatusFilter,
} from '@admin/leads/models/firm-inquiry.model';

const LEADS = 'partners/superadmin/leads/';
const LEADS_EXPORT = `${LEADS}export-csv/`;
const leadUrl = (id: number) => `${LEADS}${id}/`;
/** API default. The page-size param on this backend is `page_count`, not `page_size` (see cpe-tracker.ts). */
const PAGE_SIZE = 30;

/**
 * `/admin/leads` — Django `partners/superadmin/leads/` with
 * the Supabase admin token via `adminContext()`. The API answers 403 to any
 * token that is not a super-admin, regardless of the Supabase `leads:*`
 * permissions gating the route; the page banner renders the server's reason.
 */
// Route-scoped (see admin.routes.ts): the injector dies on navigation, which
// aborts in-flight resource() loads and stops this page's calls firing elsewhere.
@Service({ autoProvided: false })
export class LeadsFacade {
  private readonly api = inject(ApiClient);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // ---- Filter state --------------------------------------------------------

  readonly searchTerm = signal('');
  readonly statusFilter = signal<LeadStatusFilter>('all');
  /** Back to page 1 whenever a filter changes; still writable for `setPage()`. */
  readonly pageNumber = linkedSignal({
    source: () => `${this.searchTerm()}|${this.statusFilter()}`,
    computation: () => 1,
  });
  readonly pageSize = PAGE_SIZE;
  readonly isExporting = signal(false);

  /** Only what the endpoint accepts: no `status` for 'all', no `search` when blank. */
  private filterParams(): Record<string, string> {
    const params: Record<string, string> = {};
    const search = this.searchTerm();
    if (search) params['search'] = search;
    if (this.statusFilter() !== 'all') params['status'] = this.statusFilter();
    return params;
  }

  // ---- Listing resource ----------------------------------------------------

  private readonly rawResource = resource({
    params: () => {
      if (!this.isBrowser) return undefined;
      return {
        page: this.pageNumber(),
        search: this.searchTerm(),
        status: this.statusFilter(),
      };
    },
    loader: ({ params, abortSignal }) =>
      firstValueFrom(
        this.api
          .get<LeadsResponse>(LEADS, {
            params: { ...this.filterParams(), page: params.page, page_count: PAGE_SIZE },
            context: adminContext(),
          })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: { data: [], pagination_data: EMPTY_PAGINATION } as LeadsResponse },
      ),
  });

  private readonly leadsResource = withPreviousValue(this.rawResource);

  /** Local mirror so PATCH results survive stale-while-revalidate. */
  readonly rows = linkedSignal({
    source: this.leadsResource.snapshot,
    computation: (snap, previous): FirmInquiry[] => {
      if (snap.status !== 'resolved') return previous?.value ?? [];
      return snap.value?.data ?? [];
    },
  });

  readonly pagination = computed<PartnerPagination>(
    () => this.leadsResource.value()?.pagination_data ?? EMPTY_PAGINATION,
  );
  readonly totalCount = computed(() => this.pagination().total_count);
  readonly currentPage = computed(() => this.pageNumber());
  readonly hasPrev = computed(() => this.pagination().previous_page != null);
  readonly hasNext = computed(() => this.pagination().next_page != null);
  readonly isLoading = computed(() => this.leadsResource.isLoading());
  /** DRF `detail` on 401/403, else generic — the banner renders it verbatim. */
  readonly error = computed(() => {
    const err = this.leadsResource.error();
    return err ? drfErrorMessage(err, 'Failed to load leads.') : null;
  });

  // ---- Filter setters ------------------------------------------------------

  setSearch(value: string): void {
    this.searchTerm.set(value.trim());
  }

  setStatusFilter(value: LeadStatusFilter): void {
    this.statusFilter.set(value);
  }

  setPage(page: number): void {
    if (page < 1) return;
    this.pageNumber.set(page);
  }

  reload(): void {
    this.rawResource.reload();
  }

  // ---- Mutation (leads:write) ----------------------------------------------

  /**
   * `PATCH /<id>/` with status and/or notes. The API returns the updated lead,
   * which replaces the row in place — no refetch.
   */
  async updateLead(id: number, patch: LeadPatch): Promise<boolean> {
    try {
      const lead = await firstValueFrom(
        this.api.patch<FirmInquiry>(leadUrl(id), patch, { context: adminContext() }),
      );
      this.rows.update((rows) => rows.map((r) => (r.id === id ? lead : r)));
      this.notification.success(
        'Lead updated',
        patch.status ? `Lead marked as ${lead.status}.` : 'Notes saved.',
      );
      return true;
    } catch (err) {
      this.logger.error('[LeadsFacade] updateLead failed', err);
      this.notification.error('Update failed', drfErrorMessage(err));
      return false;
    }
  }

  // ---- CSV export (leads:export) -------------------------------------------

  /** Server-rendered CSV with the current filters, no pagination. */
  async exportCsv(): Promise<void> {
    if (!this.isBrowser || this.isExporting()) return;
    this.isExporting.set(true);
    try {
      const res = await firstValueFrom(
        this.api.get<HttpResponse<Blob>>(LEADS_EXPORT, {
          params: this.filterParams(),
          responseType: 'blob',
          observe: 'response',
          context: adminContext(),
        }),
      );
      const blob = res.body;
      if (!blob) throw new Error('Empty CSV response.');
      saveBlob(
        blob,
        fileNameFromContentDisposition(res.headers.get('content-disposition'), 'Leads.csv'),
      );
      this.notification.success('Export ready', 'Your leads CSV has been downloaded.');
    } catch (err) {
      this.logger.error('[LeadsFacade] exportCsv failed', err);
      this.notification.error('Export failed', await partnerBlobErrorMessage(err));
    } finally {
      this.isExporting.set(false);
    }
  }
}
