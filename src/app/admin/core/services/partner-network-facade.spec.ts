import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiUrl } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import { PartnerAdminMe } from './partner-admin-me';
import { PartnerNetworkFacade } from './partner-network-facade';

const DASHBOARD = apiUrl('partners/panel/dashboard/');
const FIRMS = apiUrl('partners/panel/firms/');
const CODES = apiUrl('partners/panel/partner-codes/');
const SEATS = apiUrl('partners/panel/seats/');

describe('PartnerNetworkFacade', () => {
  let facade: PartnerNetworkFacade;
  let http: HttpTestingController;
  const role = signal<'network' | 'firm'>('network');
  const caps = signal<string[]>(['report:network:read', 'seat:usage:read']);
  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  const setup = () => {
    TestBed.configureTestingModule({
      providers: [
        // Route-scoped: provided by hand.
        PartnerNetworkFacade,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: PartnerAdminMe,
          useValue: {
            isLoading: signal(false),
            isNetworkAdmin: () => role() === 'network',
            isFirmAdmin: () => role() === 'firm',
            can: (c: string) => caps().includes(c),
            canReadReports: () => caps().some((c) => c.startsWith('report:')),
          },
        },
        { provide: Logger, useValue: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    facade = TestBed.inject(PartnerNetworkFacade);
    http = TestBed.inject(HttpTestingController);
    void facade.dashboard();
    void facade.firms();
    void facade.panelPartnerCodes();
    void facade.seats();
    TestBed.tick();
  };
  const answer = (url: string, body: object) =>
    http.match((r) => r.url === url).forEach((r) => r.flush(body));

  beforeEach(() => {
    role.set('network');
    caps.set(['report:network:read', 'seat:usage:read']);
  });

  afterEach(() => http.verify());

  it('a network admin loads the dashboard, firms, codes and page 1 of seats', async () => {
    setup();
    answer(DASHBOARD, { total_seats: 5 });
    answer(FIRMS, { firms: [{ id: 1, name: 'Acme' }] });
    answer(CODES, { partner_codes: [] });
    const seats = http.expectOne((r) => r.url === SEATS);
    expect(seats.request.params.get('page')).toBe('1');
    expect(seats.request.params.has('firm_id')).toBe(false);
    seats.flush({ seats: [{ id: 7 }], pagination_data: { total_count: 1 } });
    await settle();

    expect(facade.firms().map((f) => f.id)).toEqual([1]);
    expect(facade.seats().map((s) => s.id)).toEqual([7]);
    expect(facade.totalCount()).toBe(1);
  });

  it('fires nothing an admin lacks the capability for', () => {
    caps.set([]);
    setup();
    answer(FIRMS, { firms: [] }); // firms are gated on the network role, not a capability
    http.expectNone(DASHBOARD);
    http.expectNone(CODES);
    http.expectNone((r) => r.url === SEATS);
  });

  it('never sends firm_id for a firm admin, even with a firm selected', () => {
    role.set('firm');
    caps.set(['seat:usage:read']);
    setup();
    facade.selectFirm(99);
    TestBed.tick();
    const reqs = http.match((r) => r.url === SEATS);
    expect(reqs.every((r) => !r.request.params.has('firm_id'))).toBe(true);
    reqs.forEach((r) => r.flush({ seats: [] }));
  });

  it('keeps the counters readable when seats fail, and patches a sent seat in place', async () => {
    setup();
    answer(DASHBOARD, {});
    answer(FIRMS, { firms: [] });
    answer(CODES, { partner_codes: [] });
    http.expectOne((r) => r.url === SEATS).flush(null, { status: 500, statusText: 'Boom' });
    await settle();
    expect(facade.totalCount()).toBe(0);
    expect(facade.error()).toBeTruthy();

    facade.reload();
    TestBed.tick();
    answer(DASHBOARD, {});
    answer(FIRMS, { firms: [] });
    http.expectOne((r) => r.url === SEATS).flush({ seats: [{ id: 7, status: 'unsent' }] });
    await settle();

    const done = facade.sendSeat({ id: 7 } as never, 'a@b.co');
    http.expectOne(apiUrl('partners/panel/seats/7/send/')).flush({ id: 7, status: 'sent' });
    expect(await done).toBe(true);
    expect(facade.seats()[0].status).toBe('sent');
  });
});
