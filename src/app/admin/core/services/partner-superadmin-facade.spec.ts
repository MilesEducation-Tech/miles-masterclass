import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiUrl } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import { AdminAuth } from '@admin/core/services/admin-auth';
import { PartnerSuperAdminFacade } from './partner-superadmin-facade';

const NETWORKS = apiUrl('partners/superadmin/networks/');
const CODES = apiUrl('partners/superadmin/partner-codes/');
const FIRMS = apiUrl('partners/superadmin/firms/');
const ADMINS = apiUrl('partners/superadmin/partner-admins/');

describe('PartnerSuperAdminFacade', () => {
  let facade: PartnerSuperAdminFacade;
  let http: HttpTestingController;
  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  const setup = (canManage: boolean) => {
    TestBed.configureTestingModule({
      providers: [
        // Route-scoped: provided by hand.
        PartnerSuperAdminFacade,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AdminAuth, useValue: { hasPermission: () => canManage } },
        { provide: Logger, useValue: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    facade = TestBed.inject(PartnerSuperAdminFacade);
    http = TestBed.inject(HttpTestingController);
    void facade.networks();
    void facade.partnerCodes();
    void facade.firms();
    void facade.partnerAdmins();
    TestBed.tick();
  };

  afterEach(() => http.verify());

  it('fetches nothing without partner:platform:manage', () => {
    setup(false);
    http.expectNone(() => true);
  });

  it('loads its four lists, and a failed one reads as empty instead of throwing', async () => {
    setup(true);
    http.expectOne(NETWORKS).flush({ networks: [{ id: 1, is_active: true }] });
    http.expectOne(CODES).flush({ partner_codes: [] });
    http.expectOne(FIRMS).flush(null, { status: 500, statusText: 'Boom' });
    http.expectOne(ADMINS).flush({ partner_admins: [] });
    await settle();

    expect(facade.activeNetworks().map((n) => n.id)).toEqual([1]);
    expect(facade.firms()).toEqual([]);
    expect(facade.standaloneFirms()).toEqual([]);
  });

  it('reloads the networks after creating one', async () => {
    setup(true);
    http.expectOne(NETWORKS).flush({ networks: [] });
    [CODES, FIRMS].forEach((u) => http.expectOne(u).flush({ partner_codes: [], firms: [] }));
    http.expectOne(ADMINS).flush({ partner_admins: [] });
    await settle();

    const done = facade.createNetwork({ name: 'Mid-Atlantic' } as never);
    http
      .expectOne((r) => r.url === NETWORKS && r.method === 'POST')
      .flush({ id: 2, name: 'Mid-Atlantic' });
    await done;
    TestBed.tick();
    http
      .expectOne((r) => r.url === NETWORKS && r.method === 'GET')
      .flush({ networks: [{ id: 2, is_active: true }] });
    await settle();
    expect(facade.networks().map((n) => n.id)).toEqual([2]);
  });

  it('builds the per-page network-detail and filtered-firms resources', async () => {
    setup(false); // no list loads, so only the factories' requests are in flight
    const networkId = signal(4);
    const filter = signal<{ networkId?: number; standalone?: boolean } | undefined>({
      standalone: true,
    });
    const detail = TestBed.runInInjectionContext(() => facade.networkDetailResource(networkId));
    const firms = TestBed.runInInjectionContext(() => facade.listFirmsResource(filter));
    void detail.value();
    void firms.value();
    TestBed.tick();

    http
      .expectOne(apiUrl('partners/superadmin/networks/4/'))
      .flush({ network: { id: 4 }, firms: [] });
    const f = http.expectOne((r) => r.url === FIRMS);
    expect(f.request.params.get('standalone')).toBe('1');
    expect(f.request.params.has('network_id')).toBe(false);
    f.flush({ firms: [{ id: 9 }] });
    await settle();
    expect(detail.hasValue() && detail.value()?.network.id).toBe(4);

    filter.set({ networkId: 4 });
    TestBed.tick();
    const byNetwork = http.expectOne((r) => r.url === FIRMS);
    expect(byNetwork.request.params.get('network_id')).toBe('4');
    byNetwork.flush({ firms: [] });
    await settle();
  });
});
