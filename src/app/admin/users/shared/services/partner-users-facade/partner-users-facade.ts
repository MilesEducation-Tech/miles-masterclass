import { HttpContext } from '@angular/common/http';
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
import { IS_ADMIN_REQUEST, SKIP_AUTH_TOKEN } from '../../../../../shared/core/models/http.model';
import { ApiClient } from '../../../../../shared/core/services/api-client/api-client';
import { AdminAuth } from '../../../../../shared/core/services/admin-auth/admin-auth';
import { Logger } from '../../../../../shared/core/services/logger/logger';
import { NotificationService } from '../../../../../shared/core/services/notification/notification';
import { withPreviousValue } from '../../../../../shared/utils/with-previous-value';
import {
  BlockedStatusFilter,
  BlockStatusRequest,
  BlockStatusResponse,
  PartnerUser,
  PartnerUsersResponse,
} from '../../models/partner-user.model';

const PARTNER_USERS_ENDPOINT = 'reports/partner-admin/users/';

/**
 * `partner-admin/users/` is called WITHOUT an Authorization header: scope comes
 * from the `email_domain` param instead of a token. `IS_ADMIN_REQUEST` keeps the
 * public-site 401/refresh interceptor out of the way; `SKIP_AUTH_TOKEN` stops
 * both the cookie JWT (appInterceptor) and the Supabase bearer
 * (adminTokenInterceptor) from being attached.
 */
function adminContext(): HttpContext {
  return new HttpContext().set(IS_ADMIN_REQUEST, true).set(SKIP_AUTH_TOKEN, true);
}

/**
 * Owns state for the admin /admin/users page. Mirrors the library facade
 * pattern (signals + resource + IS_ADMIN_REQUEST context) but paginates
 * page-by-page rather than appending — admin tables show one page at a time.
 */
@Injectable({ providedIn: 'root' })
export class PartnerUsersFacade {
  private readonly api = inject(ApiClient);
  private readonly adminAuth = inject(AdminAuth);
  private readonly notification = inject(NotificationService);
  private readonly logger = inject(Logger);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // ---- Filter state --------------------------------------------------------

  readonly searchTerm = signal('');
  readonly blockedStatus = signal<BlockedStatusFilter>('all');
  readonly pageNumber = signal(1);

  /** Optional report scope from the admin's Supabase profile (admin_users.report_type). */
  readonly reportType = computed(() => this.adminAuth.adminUser()?.report_type ?? '');

  /**
   * Partner domains mapped to this admin (admin_user_email_domains, via the
   * get_my_admin_profile RPC), comma-joined. Empty when the admin has no
   * mapping — the backend then falls back to token-derived membership scope.
   */
  readonly emailDomain = computed(() => this.adminAuth.emailDomains().join(','));

  // ---- Listing resource ----------------------------------------------------

  private readonly rawUsersResource = resource({
    params: () => {
      if (!this.isBrowser) return undefined;
      return {
        page: this.pageNumber(),
        search: this.searchTerm(),
        blocked_status: this.blockedStatus(),
        report_type: this.reportType(),
        email_domain: this.emailDomain(),
      };
    },
    loader: ({ params, abortSignal }) => {
      const httpParams: Record<string, string | number> = {
        page: params.page,
        search: params.search,
        blocked_status: params.blocked_status,
      };
      if (params.report_type) httpParams['report_type'] = params.report_type;
      if (params.email_domain) httpParams['email_domain'] = params.email_domain;
      return firstValueFrom(
        this.api
          .get<PartnerUsersResponse>(PARTNER_USERS_ENDPOINT, {
            params: httpParams,
            context: adminContext(),
          })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        {
          defaultValue: { data: [] } as PartnerUsersResponse,
        },
      );
    },
  });

  private readonly usersResource = withPreviousValue(this.rawUsersResource);

  /**
   * Local mirror so optimistic patches after block/unblock survive
   * stale-while-revalidate without forcing a full refetch.
   */
  readonly users = linkedSignal({
    source: this.usersResource.snapshot,
    computation: (snap, previous): PartnerUser[] => {
      if (snap.status !== 'resolved') return previous?.value ?? [];
      return snap.value?.data ?? [];
    },
  });

  readonly pagination = computed(() => this.usersResource.value()?.pagination_data);
  readonly isLoading = computed(() => this.usersResource.isLoading());
  readonly error = computed(() => this.usersResource.error());

  constructor() {
    // Reset to page 1 whenever search, filter, or the report scope changes —
    // otherwise a result on page 3 with a different filter would load stale rows.
    effect(() => {
      this.searchTerm();
      this.blockedStatus();
      this.reportType();
      this.emailDomain();
      untracked(() => {
        if (this.pageNumber() !== 1) this.pageNumber.set(1);
      });
    });
  }

  // ---- Filter setters ------------------------------------------------------

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

  // ---- Block / unblock mutation -------------------------------------------

  /** POST the block status for one user — the backend scope-checks the target. */
  async setBlockStatus(args: {
    user: PartnerUser;
    isBlocked: boolean;
    reason?: string;
  }): Promise<boolean> {
    const { user, isBlocked, reason } = args;

    const body: BlockStatusRequest = {
      is_blocked: isBlocked,
      ...(reason ? { reason } : {}),
    };

    try {
      const res = await firstValueFrom(
        this.api.post<BlockStatusResponse>(
          `${PARTNER_USERS_ENDPOINT}${user.id}/block-status/`,
          body,
          { context: adminContext() },
        ),
      );

      if (!res?.status) {
        this.notification.error(
          isBlocked ? 'Block failed' : 'Unblock failed',
          'The backend rejected the update.',
        );
        return false;
      }

      // Optimistic patch — flip just the affected row.
      this.users.update((rows) =>
        rows.map((r) => (r.id === user.id ? { ...r, is_blocked: res.is_blocked } : r)),
      );

      this.notification.success(
        res.is_blocked ? 'User blocked' : 'User unblocked',
        `${user.email} is now ${res.is_blocked ? 'blocked' : 'active'}.`,
      );
      return true;
    } catch (err) {
      this.logger.error('[PartnerUsersFacade] setBlockStatus failed', err);
      this.notification.error(
        isBlocked ? 'Block failed' : 'Unblock failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
      return false;
    }
  }

  /** Force-reload the list — used after mutations that need authoritative state. */
  reload(): void {
    this.rawUsersResource.reload();
  }

  /** Download the current (filtered) user list as a CSV from the server. */
  async exportCsv(): Promise<void> {
    if (!this.isBrowser) return;
    try {
      const params: Record<string, string> = {
        search: this.searchTerm(),
        blocked_status: this.blockedStatus(),
      };
      const reportType = this.reportType();
      if (reportType) params['report_type'] = reportType;
      const emailDomain = this.emailDomain();
      if (emailDomain) params['email_domain'] = emailDomain;

      const blob = await firstValueFrom(
        this.api.get<Blob>(`${PARTNER_USERS_ENDPOINT}export-csv/`, {
          params,
          responseType: 'blob',
          context: adminContext(),
        }),
      );

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'vendor-users.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      this.logger.error('[PartnerUsersFacade] exportCsv failed', err);
      this.notification.error(
        'Export failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
    }
  }
}
