import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, resource } from '@angular/core';
import { firstValueFrom, fromEvent, Observable, takeUntil } from 'rxjs';
import { AdminAuth } from '../../../../shared/core/services/admin-auth/admin-auth';
import { ApiClient } from '../../../../shared/core/services/api-client/api-client';
import { Logger } from '../../../../shared/core/services/logger/logger';
import { NotificationService } from '../../../../shared/core/services/notification/notification';
import {
  adminContext,
  CouponsResponse,
  CouponStatusFilter,
  CreateFirmRequest,
  CreateFirmResponse,
  CreateNetworkRequest,
  CreatePartnerAdminRequest,
  CreatePartnerCodeRequest,
  Network,
  NetworkMutationResponse,
  NetworksResponse,
  NetworkTrackerResponse,
  PartnerAdminMutationResponse,
  PartnerCode,
  PartnerCodeMutationResponse,
  PartnerCodesResponse,
  partnerErrorMessage,
  partnerLoadError,
  SuperFirm,
  SuperFirmsResponse,
  UpdateNetworkRequest,
} from '../models/partner-platform.model';

const SUPERADMIN_NETWORKS = 'reports/superadmin/networks/';
const SUPERADMIN_PARTNER_CODES = 'reports/superadmin/partner-codes/';
const SUPERADMIN_PARTNER_ADMINS = 'reports/superadmin/partner-admins/';
const SUPERADMIN_FIRMS = 'reports/superadmin/firms/';
const SUPERADMIN_COUPONS = 'reports/superadmin/coupons/';

/** Query for the super-admin coupon tracker — exactly one of network_id / firm_id. */
export interface SuperCouponsQuery {
  network_id?: number;
  firm_id?: number;
  status?: CouponStatusFilter;
  page?: number;
  page_size?: number;
}

/**
 * Owns the super-admin console state: networks, partner codes, and partner-admin
 * provisioning. All calls carry the Supabase admin token (`adminContext()`); the
 * Django side authorises `role=super`.
 *
 * ponytail: reload-after-write, no optimistic patching — these lists are tiny
 * and rarely edited (same call as `RbacFacade`).
 */
@Injectable({ providedIn: 'root' })
export class PartnerSuperAdminFacade {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AdminAuth);
  private readonly notification = inject(NotificationService);
  private readonly logger = inject(Logger);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Superadmin endpoints 403 for everyone else — don't even ask. */
  private canLoad(): boolean {
    return this.isBrowser && this.auth.isSuperAdmin();
  }

  // ---- Networks ------------------------------------------------------------

  private readonly networksResource = resource({
    params: () => (this.canLoad() ? {} : undefined),
    loader: ({ abortSignal }) =>
      firstValueFrom(
        this.api
          .get<NetworksResponse>(SUPERADMIN_NETWORKS, { context: adminContext() })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: { networks: [] } as NetworksResponse },
      ),
  });

  readonly networks = computed<Network[]>(() => this.networksResource.value()?.networks ?? []);
  readonly networksLoading = computed(() => this.networksResource.isLoading());
  readonly networksError = computed(() =>
    partnerLoadError(this.networksResource.error(), 'Failed to load networks.'),
  );

  /** Active networks, for the "assign to network" selectors. */
  readonly activeNetworks = computed(() => this.networks().filter((n) => n.is_active));

  /** Returns the created network (so callers can deep-link to admin provisioning), or null on failure. */
  async createNetwork(body: CreateNetworkRequest): Promise<Network | null> {
    try {
      const res = await firstValueFrom(
        this.api.post<NetworkMutationResponse>(SUPERADMIN_NETWORKS, body, {
          context: adminContext(),
        }),
      );
      if (!res?.status || !res.network) {
        this.notification.error(
          'Could not create network',
          res?.message ?? 'The backend rejected the request.',
        );
        return null;
      }
      this.networksResource.reload();
      this.notification.success('Network created', `“${body.name}” is ready.`);
      return res.network;
    } catch (err) {
      this.logger.error('[PartnerSuperAdminFacade] createNetwork failed', err);
      this.notification.error('Could not create network', partnerErrorMessage(err));
      return null;
    }
  }

  /**
   * Edit a network and/or stock its own coupon pool. When `patch.allocations` is
   * present the backend mints that many coupons with **no sub-company**
   * (`coupon.firm === null`) — they land in the tracker under `—`.
   */
  async updateNetwork(id: number, patch: UpdateNetworkRequest): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.api.patch<NetworkMutationResponse>(`${SUPERADMIN_NETWORKS}${id}/`, patch, {
          context: adminContext(),
        }),
      );
      if (!res?.status) {
        this.notification.error(
          'Could not update network',
          res?.message ?? 'The backend rejected the request.',
        );
        return false;
      }
      this.networksResource.reload();
      const minted = res.coupons_minted ?? 0;
      this.notification.success(
        'Network updated',
        minted > 0 ? `Changes saved · ${minted} coupon(s) minted to the pool.` : 'Changes saved.',
      );
      return true;
    } catch (err) {
      this.logger.error('[PartnerSuperAdminFacade] updateNetwork failed', err);
      this.notification.error('Could not update network', partnerErrorMessage(err));
      return false;
    }
  }

  reloadNetworks(): void {
    this.networksResource.reload();
  }

  // ---- Partner codes -------------------------------------------------------

  private readonly partnerCodesResource = resource({
    params: () => (this.canLoad() ? {} : undefined),
    loader: ({ abortSignal }) =>
      firstValueFrom(
        this.api
          .get<PartnerCodesResponse>(SUPERADMIN_PARTNER_CODES, { context: adminContext() })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: { partner_codes: [] } as PartnerCodesResponse },
      ),
  });

  readonly partnerCodes = computed<PartnerCode[]>(
    () => this.partnerCodesResource.value()?.partner_codes ?? [],
  );
  readonly partnerCodesLoading = computed(() => this.partnerCodesResource.isLoading());
  readonly partnerCodesError = computed(() =>
    partnerLoadError(this.partnerCodesResource.error(), 'Failed to load partner codes.'),
  );

  async createPartnerCode(body: CreatePartnerCodeRequest): Promise<boolean> {
    return this.write(
      () =>
        this.api.post<PartnerCodeMutationResponse>(SUPERADMIN_PARTNER_CODES, body, {
          context: adminContext(),
        }),
      () => this.partnerCodesResource.reload(),
      'Partner code created',
      `“${body.code}” is ready.`,
      'Could not create partner code',
    );
  }

  reloadPartnerCodes(): void {
    this.partnerCodesResource.reload();
  }

  // ---- Firms (created directly by super admins) ----------------------------

  private readonly firmsResource = resource({
    params: () => (this.canLoad() ? {} : undefined),
    loader: ({ abortSignal }) =>
      firstValueFrom(
        this.api
          .get<SuperFirmsResponse>(SUPERADMIN_FIRMS, { context: adminContext() })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: { firms: [] } as SuperFirmsResponse },
      ),
  });

  readonly firms = computed<SuperFirm[]>(() => this.firmsResource.value()?.firms ?? []);
  readonly firmsLoading = computed(() => this.firmsResource.isLoading());

  /** Firms belonging to one network (client-side filter of the full list). */
  firmsForNetwork(networkId: number): SuperFirm[] {
    return this.firms().filter((f) => f.network === networkId);
  }

  /** Standalone firms — single companies with no network. */
  readonly standaloneFirms = computed<SuperFirm[]>(() =>
    this.firms().filter((f) => f.network == null),
  );

  /** Returns the created firm (so callers can deep-link to admin provisioning), or null on failure. */
  async createFirm(body: CreateFirmRequest): Promise<SuperFirm | null> {
    try {
      const res = await firstValueFrom(
        this.api.post<CreateFirmResponse>(SUPERADMIN_FIRMS, body, { context: adminContext() }),
      );
      if (!res?.status || !res.firm) {
        this.notification.error(
          'Could not create firm',
          res?.message ?? 'The backend rejected the request.',
        );
        return null;
      }
      this.firmsResource.reload();
      this.networksResource.reload(); // seat allocation may have changed
      this.notification.success(
        'Firm created',
        `${body.name} created with ${res.coupons_minted ?? 0} coupon(s).`,
      );
      return { ...res.firm, email_domain: body.email_domain, is_active: true };
    } catch (err) {
      this.logger.error('[PartnerSuperAdminFacade] createFirm failed', err);
      this.notification.error('Could not create firm', partnerErrorMessage(err));
      return null;
    }
  }

  reloadFirms(): void {
    this.firmsResource.reload();
  }

  // ---- Super-admin per-network tracker -------------------------------------

  /** Header (stat-card summary + sub-companies) for one network's tracker. */
  networkTracker(networkId: number): Observable<NetworkTrackerResponse> {
    return this.api.get<NetworkTrackerResponse>(`${SUPERADMIN_NETWORKS}${networkId}/`, {
      context: adminContext(),
    });
  }

  /** Coupons for a network (or one of its firms). Pass exactly one of network_id / firm_id. */
  superCoupons(query: SuperCouponsQuery): Observable<CouponsResponse> {
    const params: Record<string, string | number> = {};
    if (query.network_id != null) params['network_id'] = query.network_id;
    if (query.firm_id != null) params['firm_id'] = query.firm_id;
    if (query.status && query.status !== 'all') params['status'] = query.status;
    if (query.page != null) params['page'] = query.page;
    if (query.page_size != null) params['page_size'] = query.page_size;
    return this.api.get<CouponsResponse>(SUPERADMIN_COUPONS, {
      params,
      context: adminContext(),
    });
  }

  // ---- Partner-admin provisioning -----------------------------------------

  /**
   * Register a Django PartnerAdmin for an existing Supabase user. Called by the
   * Admin Users provisioning form. Returns the created record on success.
   */
  async createPartnerAdmin(
    body: CreatePartnerAdminRequest,
  ): Promise<PartnerAdminMutationResponse | null> {
    try {
      const res = await firstValueFrom(
        this.api.post<PartnerAdminMutationResponse>(SUPERADMIN_PARTNER_ADMINS, body, {
          context: adminContext(),
        }),
      );
      if (!res?.status) {
        this.notification.error(
          'Could not create partner admin',
          res?.message ?? 'The backend rejected the request.',
        );
        return null;
      }
      this.notification.success('Partner admin created', `${body.email} is provisioned.`);
      return res;
    } catch (err) {
      this.logger.error('[PartnerSuperAdminFacade] createPartnerAdmin failed', err);
      this.notification.error('Could not create partner admin', partnerErrorMessage(err));
      return null;
    }
  }

  // ---- Shared write helper -------------------------------------------------

  private async write(
    call: () => Observable<{ status: boolean; message?: string }>,
    onSuccess: () => void,
    successTitle: string,
    successBody: string,
    failTitle: string,
  ): Promise<boolean> {
    try {
      const res = await firstValueFrom(call());
      if (!res?.status) {
        this.notification.error(failTitle, res?.message ?? 'The backend rejected the request.');
        return false;
      }
      onSuccess();
      this.notification.success(successTitle, successBody);
      return true;
    } catch (err) {
      this.logger.error(`[PartnerSuperAdminFacade] ${failTitle}`, err);
      this.notification.error(failTitle, partnerErrorMessage(err));
      return false;
    }
  }
}
