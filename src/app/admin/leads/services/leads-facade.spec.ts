import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiUrl } from '@core/services/api-client/api-client';
import { IS_ADMIN_REQUEST } from '@core/models/http.model';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import { LeadsFacade } from './leads-facade';

const LEADS_URL = apiUrl('partners/superadmin/leads/');
const page = (rows: { id: number; status?: string }[], next: number | null = null) => ({
  data: rows,
  pagination_data: {
    total_count: rows.length,
    current_page_number: 1,
    next_page: next,
    previous_page: null,
  },
});

describe('LeadsFacade', () => {
  let facade: LeadsFacade;
  let http: HttpTestingController;
  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        // Route-scoped: provided by hand.
        LeadsFacade,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Logger, useValue: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    facade = TestBed.inject(LeadsFacade);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const read = () => {
    void facade.rows();
    void facade.pagination();
    TestBed.tick();
  };

  it('requests page 1 with the admin token context, and exposes the rows', async () => {
    read();
    const req = http.expectOne((r) => r.url === LEADS_URL);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('page_count')).toBe('30');
    expect(req.request.params.has('status')).toBe(false);
    expect(req.request.context.get(IS_ADMIN_REQUEST)).toBe(true);
    req.flush(page([{ id: 1 }, { id: 2 }], 2));
    await settle();

    expect(facade.rows().map((r) => r.id)).toEqual([1, 2]);
    expect(facade.hasNext()).toBe(true);
  });

  it('sends only the filters that are set, and a filter change goes back to page 1', async () => {
    read();
    http.expectOne((r) => r.url === LEADS_URL).flush(page([], 2));
    await settle();
    facade.setPage(2);
    read();
    http.expectOne((r) => r.url === LEADS_URL && r.params.get('page') === '2').flush(page([]));
    await settle();

    facade.setStatusFilter('new' as never);
    facade.setSearch('  acme ');
    read();
    const req = http.expectOne((r) => r.url === LEADS_URL);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('status')).toBe('new');
    expect(req.request.params.get('search')).toBe('acme');
    req.flush(page([]));
    await settle();
  });

  it('reports the server reason on failure without throwing from pagination', async () => {
    read();
    http
      .expectOne((r) => r.url === LEADS_URL)
      .flush({ detail: 'Super-admins only.' }, { status: 403, statusText: 'Forbidden' });
    await settle();

    expect(facade.error()).toBe('Super-admins only.');
    expect(facade.pagination().total_count).toBe(0);
    expect(facade.rows()).toEqual([]);
  });

  it('patches a lead in place after an update, with no refetch', async () => {
    read();
    http.expectOne((r) => r.url === LEADS_URL).flush(page([{ id: 1, status: 'new' }]));
    await settle();

    const done = facade.updateLead(1, { status: 'contacted' } as never);
    http.expectOne(apiUrl('partners/superadmin/leads/1/')).flush({ id: 1, status: 'contacted' });
    expect(await done).toBe(true);
    expect(facade.rows()[0].status).toBe('contacted');
  });
});
