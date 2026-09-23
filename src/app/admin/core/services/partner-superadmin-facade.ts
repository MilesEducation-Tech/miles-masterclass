import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, resource } from '@angular/core';
import { firstValueFrom, fromEvent, Observable, takeUntil } from 'rxjs';
import { PERM } from '@admin/core/models/admin-rbac.model';
import { AdminAuth } from '@admin/core/services/admin-auth';
import { ApiClient } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import {
  adminContext,
  AllocateSeatsRequest,
  AllocateSeatsResponse,
  AssignSeatResponse,
  CreateFirmRequest,
  CreateFirmResponse,
  CreateNetworkRequest,
  CreatePartnerAdminRequest,
  CreatePartnerCodeRequest,
  Firm,
  FirmsResponse,
  Network,
  NetworkDetailResponse,
  NetworkMutationResponse,
  NetworksResponse,
  PartnerAdmin,
  PartnerAdminsResponse,
  PartnerCode,
  PartnerCodesResponse,
  partnerErrorMessage,
  partnerLoadError,
  UpdateFirmRequest,
  UpdateNetworkRequest,
} from '@admin/core/models/partner-platform.model';

const SUPERADMIN_NETWORKS = 'partners/superadmin/networks/';
const SUPERADMIN_PARTNER_CODES = 'partners/superadmin/partner-codes/';
const SUPERADMIN_PARTNER_ADMINS = 'partners/superadmin/partner-admins/';
const SUPERADMIN_FIRMS = 'partners/superadmin/firms/';
const allocateFirmUrl = (firmId: number) => `${SUPERADMIN_FIRMS}${firmId}/allocate/`;
const assignSeatUrl = (seatId: number) => `partners/superadmin/seats/${seatId}/assign-firm/`;

/**
 * Miles-internal super-admin console: networks, firms, partner codes and
 * partner-admin provisioning (`partners/superadmin/…`, gated server-side by
 * `PartnerAdmin.role == "super"`).
 *
 * Writes return the created/updated entity directly with a 201/200 — there is
 * no `{status:true}` envelope to check, so a resolved request is the success
 * path and a rejected one carries `{status:false, message}` for
 * `partnerErrorMessage()` to surface.
 */
// Route-scoped (see admin.routes.ts): the injector dies on navigation, which
// aborts in-flight resource() loads and stops this page's calls firing elsewhere.
@Injectable()
export class PartnerSuperAdminFacade {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AdminAuth);
  private readonly notification = inject(NotificationService);
  private readonly logger = inject(Logger);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Never fetch on the server, or for an admin the backend would 403 anyway.
   * Gate on the same PERM the superadmin routes use — a role-slug check here
   * left any non-`super_admin` role holding `partner:platform:manage` staring
   * at silently empty pages.
   */
  private canLoad(): boolean {
    return this.isBrowser && this.auth.hasPermission(PERM.PARTNER_PLATFORM_MANAGE);
  }

  // ---- Networks ------------------------------------------------------------

  private readonly networksResource = resource({
    params: () => (this.canLoad() ? true : undefined),
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
  readonly activeNetworks = computed(() => this.networks().filter((n) => n.is_active));

  /** Returns the created network (the caller deep-links with its id), or null. */
  async createNetwork(body: CreateNetworkRequest): Promise<Network | null> {
    try {
      const network = await firstValueFrom(
        this.api.post<Network>(SUPERADMIN_NETWORKS, body, { context: adminContext() }),
      );
      this.networksResource.reload();
      this.notification.success('Network created', `${network.name} is ready.`);
      return network;
    } catch (err) {
      this.logger.error('[PartnerSuperAdminFacade] createNetwork failed', err);
      this.notification.error('Could not create network', partnerErrorMessage(err));
      return null;
    }
  }

  /** Update fields and/or mint seats straight into the network's own pool. */
  async updateNetwork(networkId: number, patch: UpdateNetworkRequest): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.api.patch<NetworkMutationResponse>(`${SUPERADMIN_NETWORKS}${networkId}/`, patch, {
          context: adminContext(),
        }),
      );
      this.networksResource.reload();
      const minted = res.seats_minted ?? 0;
      this.notification.success(
        'Network updated',
        minted > 0 ? `Changes saved · ${minted} seat(s) minted to the pool.` : 'Changes saved.',
      );
      return true;
    } catch (err) {
      this.logger.error('[PartnerSuperAdminFacade] updateNetwork failed', err);
      this.notification.error('Could not update network', partnerErrorMessage(err));
      return false;
    }
  }

  /** `GET /superadmin/networks/<id>/` — the network plus its member firms. */
  networkDetail(networkId: number): Observable<NetworkDetailResponse> {
    return this.api.get<NetworkDetailResponse>(`${SUPERADMIN_NETWORKS}${networkId}/`, {
      context: adminContext(),
    });
  }

  // ---- Partner codes -------------------------------------------------------

  private readonly partnerCodesResource = resource({
    params: () => (this.canLoad() ? true : undefined),
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
    try {
      const code = await firstValueFrom(
        this.api.post<PartnerCode>(SUPERADMIN_PARTNER_CODES, body, { context: adminContext() }),
      );
      this.partnerCodesResource.reload();
      this.notification.success('Partner code created', `${code.code} is ready.`);
      return true;
    } catch (err) {
      this.logger.error('[PartnerSuperAdminFacade] createPartnerCode failed', err);
      this.notification.error('Could not create partner code', partnerErrorMessage(err));
      return false;
    }
  }

  reloadPartnerCodes(): void {
    this.partnerCodesResource.reload();
  }

  // ---- Firms ---------------------------------------------------------------

  private readonly firmsResource = resource({
    params: () => (this.canLoad() ? true : undefined),
    loader: ({ abortSignal }) =>
      firstValueFrom(
        this.api
          .get<FirmsResponse>(SUPERADMIN_FIRMS, { context: adminContext() })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: { firms: [] } as FirmsResponse },
      ),
  });

  readonly firms = computed<Firm[]>(() => this.firmsResource.value()?.firms ?? []);
  readonly firmsLoading = computed(() => this.firmsResource.isLoading());

  firmsForNetwork(networkId: number): Firm[] {
    return this.firms().filter((f) => f.network?.id === networkId);
  }

  /** Firms licensed directly, with no network above them. */
  readonly standaloneFirms = computed<Firm[]>(() => this.firms().filter((f) => f.is_standalone));

  /**
   * Server-side filtered firm list — `?network_id=` for one network's firms,
   * `?standalone=1` for firms with no network. The unfiltered root resource
   * above stays for callers that want everything cached once.
   */
  listFirms(filter?: { networkId?: number; standalone?: boolean }): Observable<FirmsResponse> {
    const params: Record<string, string | number> = {};
    if (filter?.networkId != null) params['network_id'] = filter.networkId;
    if (filter?.standalone) params['standalone'] = 1;
    return this.api.get<FirmsResponse>(SUPERADMIN_FIRMS, { params, context: adminContext() });
  }

  /**
   * Move an already-minted, unassigned network-pool seat (`firm: null`) onto a
   * firm under the same network. Returns the moved seat, or null on failure.
   */
  async assignSeatToFirm(seatId: number, firmId: number): Promise<AssignSeatResponse | null> {
    try {
      const seat = await firstValueFrom(
        this.api.post<AssignSeatResponse>(
          assignSeatUrl(seatId),
          { firm: firmId },
          { context: adminContext() },
        ),
      );
      // The seat left the pool and landed on a firm — both counts moved.
      this.firmsResource.reload();
      this.networksResource.reload();
      this.notification.success('Seat assigned', `${seat.code} moved to the firm.`);
      return seat;
    } catch (err) {
      this.logger.error('[PartnerSuperAdminFacade] assignSeatToFirm failed', err);
      this.notification.error('Could not assign seat', partnerErrorMessage(err));
      return null;
    }
  }

  /**
   * Create a firm, optionally with its seats AND its admin login in one atomic
   * call — pass `admin.supabase_uid` (from `AdminProvisioning`) to have the
   * backend create the firm-role `PartnerAdmin` too, instead of a second
   * request that can leave a firm without an admin when it fails.
   */
  async createFirm(body: CreateFirmRequest): Promise<CreateFirmResponse | null> {
    try {
      const firm = await firstValueFrom(
        this.api.post<CreateFirmResponse>(SUPERADMIN_FIRMS, body, { context: adminContext() }),
      );
      this.firmsResource.reload();
      // Minting draws down the network's pool.
      this.networksResource.reload();
      this.notification.success(
        'Firm created',
        `${firm.name} created with ${firm.seats_minted ?? 0} seat(s).`,
      );
      return firm;
    } catch (err) {
      this.logger.error('[PartnerSuperAdminFacade] createFirm failed', err);
      this.notification.error('Could not create firm', partnerErrorMessage(err));
      return null;
    }
  }

  /**
   * Edit a firm — name, email domains, active flag. Super-admin only (the
   * button is gated on `AdminAuth.isSuperAdmin()`); `email_domains` replaces
   * the whole list, so send every domain the firm should keep.
   */
  async updateFirm(firmId: number, patch: UpdateFirmRequest): Promise<Firm | null> {
    try {
      const firm = await firstValueFrom(
        this.api.patch<Firm>(`${SUPERADMIN_FIRMS}${firmId}/`, patch, { context: adminContext() }),
      );
      this.firmsResource.reload();
      this.notification.success('Firm updated', `${firm.name} saved.`);
      return firm;
    } catch (err) {
      this.logger.error('[PartnerSuperAdminFacade] updateFirm failed', err);
      this.notification.error('Could not update firm', partnerErrorMessage(err));
      return null;
    }
  }

  /** Top up an existing firm's seats. */
  async allocateSeats(firmId: number, body: AllocateSeatsRequest): Promise<number | null> {
    try {
      const res = await firstValueFrom(
        this.api.post<AllocateSeatsResponse>(allocateFirmUrl(firmId), body, {
          context: adminContext(),
        }),
      );
      this.firmsResource.reload();
      this.networksResource.reload();
      this.notification.success('Seats allocated', `${res.seats_minted} seat(s) minted.`);
      return res.seats_minted;
    } catch (err) {
      this.logger.error('[PartnerSuperAdminFacade] allocateSeats failed', err);
      this.notification.error('Could not allocate seats', partnerErrorMessage(err));
      return null;
    }
  }

  reloadFirms(): void {
    this.firmsResource.reload();
  }

  // ---- Partner admins ------------------------------------------------------

  private readonly partnerAdminsResource = resource({
    params: () => (this.canLoad() ? true : undefined),
    loader: ({ abortSignal }) =>
      firstValueFrom(
        this.api
          .get<PartnerAdminsResponse>(SUPERADMIN_PARTNER_ADMINS, { context: adminContext() })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: { partner_admins: [] } as PartnerAdminsResponse },
      ),
  });

  readonly partnerAdmins = computed<PartnerAdmin[]>(
    () => this.partnerAdminsResource.value()?.partner_admins ?? [],
  );
  readonly partnerAdminsLoading = computed(() => this.partnerAdminsResource.isLoading());
  readonly partnerAdminsError = computed(() =>
    partnerLoadError(this.partnerAdminsResource.error(), 'Failed to load partner admins.'),
  );

  reloadPartnerAdmins(): void {
    this.partnerAdminsResource.reload();
  }

  /**
   * Register a Supabase login as a Django partner admin. The Supabase user must
   * already exist — `AdminProvisioning.provisionAdminUser()` mints it and
   * returns the `supabase_uid` this needs.
   */
  async createPartnerAdmin(body: CreatePartnerAdminRequest): Promise<PartnerAdmin | null> {
    try {
      const admin = await firstValueFrom(
        this.api.post<PartnerAdmin>(SUPERADMIN_PARTNER_ADMINS, body, { context: adminContext() }),
      );
      this.partnerAdminsResource.reload();
      this.notification.success(
        'Partner admin created',
        `${body.email ?? admin.email} is provisioned.`,
      );
      return admin;
    } catch (err) {
      this.logger.error('[PartnerSuperAdminFacade] createPartnerAdmin failed', err);
      this.notification.error('Could not create partner admin', partnerErrorMessage(err));
      return null;
    }
  }
}
