import { isPlatformBrowser } from '@angular/common';
import { HttpResponse } from '@angular/common/http';
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
import { fileNameFromContentDisposition, saveBlob } from '@shared/utils/blob-download';
import { withPreviousValue } from '@shared/utils/with-previous-value';
import {
  adminContext,
  BlockedStatusFilter,
  BlockStatusRequest,
  BlockStatusResponse,
  EMPTY_PAGINATION,
  partnerBlobErrorMessage,
  partnerErrorMessage,
  partnerLoadError,
  PartnerPagination,
  PartnerPanelUser,
  PartnerPanelUsersResponse,
} from '@admin/core/models/partner-platform.model';
import { PartnerAdminMe } from '@admin/core/services/partner-admin-me';

const PANEL_USERS = 'partners/panel/users/';
const PANEL_USERS_EXPORT = `${PANEL_USERS}export-csv/`;
const blockStatusUrl = (userId: number) => `${PANEL_USERS}${userId}/block-status/`;

/** API default for this list. */
const PAGE_SIZE = 30;

/**
 * Vendor Users (`/admin/domain-users`) — the learners who redeemed a seat under
 * the calling admin's network or firm.
 *
 * Scope is server-side, derived from the Supabase token's `PartnerAdmin` row.
 * The previous binding sent NO Authorization header and scoped by an
 * `email_domain` query param the client supplied, which meant the endpoint
 * answered to anyone who guessed a domain. Nothing here may send a scope again.
 */
// Route-scoped (see admin.routes.ts): the injector dies on navigation, which
// aborts in-flight resource() loads and stops this page's calls firing elsewhere.
@Injectable()
export class PartnerUsersFacade {
  private readonly api = inject(ApiClient);
  private readonly me = inject(PartnerAdminMe);
  private readonly notification = inject(NotificationService);
  private readonly logger = inject(Logger);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // ---- Filter state --------------------------------------------------------

  readonly searchTerm = signal('');
  readonly blockedStatus = signal<BlockedStatusFilter>('all');
  readonly pageNumber = signal(1);
  readonly pageSize = PAGE_SIZE;
  readonly isExporting = signal(false);

  /** Only the params the endpoint accepts — never a scope. */
  private httpParams(): Record<string, string | number> {
    const params: Record<string, string | number> = {};
    const search = this.searchTerm().trim();
    if (search) params['search'] = search;
    if (this.blockedStatus() !== 'all') params['blocked_status'] = this.blockedStatus();
    return params;
  }

  private readonly rawUsersResource = resource({
    params: () => {
      // The endpoint needs report:network:read / report:firm:read — don't fire
      // a guaranteed 403 for an admin without either (or one not provisioned).
      if (!this.isBrowser || this.me.isLoading() || !this.me.canReadReports()) return undefined;
      return {
        page: this.pageNumber(),
        search: this.searchTerm().trim(),
        blockedStatus: this.blockedStatus(),
      };
    },
    loader: ({ params, abortSignal }) =>
      firstValueFrom(
        this.api
          .get<PartnerPanelUsersResponse>(PANEL_USERS, {
            params: { ...this.httpParams(), page: params.page, page_size: PAGE_SIZE },
            context: adminContext(),
          })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        {
          defaultValue: {
            data: [],
            pagination_data: EMPTY_PAGINATION,
          } as PartnerPanelUsersResponse,
        },
      ),
  });

  private readonly listResource = withPreviousValue(this.rawUsersResource);

  /** Local mirror so the table holds its rows through stale-while-revalidate. */
  readonly users = linkedSignal({
    source: this.listResource.snapshot,
    computation: (snap, previous): PartnerPanelUser[] => {
      if (snap.status !== 'resolved') return previous?.value ?? [];
      return snap.value?.data ?? [];
    },
  });

  readonly pagination = computed<PartnerPagination>(
    () => this.listResource.value()?.pagination_data ?? EMPTY_PAGINATION,
  );
  readonly isLoading = computed(() => this.listResource.isLoading());
  /** Backend `message` when the load failed, else null — the banner renders it verbatim. */
  readonly error = computed(() =>
    partnerLoadError(this.listResource.error(), 'Failed to load users.'),
  );
  readonly totalCount = computed(() => this.pagination().total_count);
  readonly hasPrev = computed(() => this.pagination().previous_page != null);
  readonly hasNext = computed(() => this.pagination().next_page != null);

  constructor() {
    // Reset to page 1 whenever a filter changes — a result on page 3 under the
    // old filters is meaningless under the new ones.
    effect(() => {
      this.searchTerm();
      this.blockedStatus();
      untracked(() => {
        if (this.pageNumber() !== 1) this.pageNumber.set(1);
      });
    });
  }

  setSearch(value: string): void {
    this.searchTerm.set(value.trim());
  }

  setBlockedStatus(value: BlockedStatusFilter): void {
    this.blockedStatus.set(value);
  }

  setPage(page: number): void {
    if (page < 1) return;
    this.pageNumber.set(page);
  }

  reload(): void {
    this.rawUsersResource.reload();
  }

  /**
   * Block or unblock a learner. Destructive to that person's access, so the
   * caller confirms first (`BlockStatusDialog`) — never wire a one-click path.
   */
  async setBlockStatus(
    user: PartnerPanelUser,
    isBlocked: boolean,
    reason?: string,
  ): Promise<boolean> {
    const body: BlockStatusRequest = { is_blocked: isBlocked, ...(reason ? { reason } : {}) };
    try {
      const res = await firstValueFrom(
        this.api.post<BlockStatusResponse>(blockStatusUrl(user.id), body, {
          context: adminContext(),
        }),
      );
      if (!res?.status) {
        this.notification.error(
          'Could not update the user',
          'The backend rejected the request. Please try again.',
        );
        return false;
      }
      this.users.update((rows) =>
        rows.map((r) => (r.id === user.id ? { ...r, is_blocked: res.is_blocked } : r)),
      );
      this.notification.success(
        isBlocked ? 'User blocked' : 'User unblocked',
        `${user.name || user.email} is now ${isBlocked ? 'blocked' : 'active'}.`,
      );
      return true;
    } catch (err) {
      this.logger.error('[PartnerUsersFacade] setBlockStatus failed', err);
      this.notification.error('Could not update the user', partnerErrorMessage(err));
      return false;
    }
  }

  /**
   * Server-rendered CSV, same filters as the list and no pagination. It carries
   * the columns the table can't show (signup/login dates, qualification, state
   * board, CAiRA credits), so this is where that detail still lives.
   */
  async exportCsv(): Promise<void> {
    if (!this.isBrowser || this.isExporting()) return;
    this.isExporting.set(true);
    try {
      const res = await firstValueFrom(
        this.api.get<HttpResponse<Blob>>(PANEL_USERS_EXPORT, {
          params: this.httpParams(),
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
          'Partner Users Report.csv',
        ),
      );
      this.notification.success('Export ready', 'Your vendor users CSV has been downloaded.');
    } catch (err) {
      this.logger.error('[PartnerUsersFacade] exportCsv failed', err);
      this.notification.error('Export failed', await partnerBlobErrorMessage(err));
    } finally {
      this.isExporting.set(false);
    }
  }
}
