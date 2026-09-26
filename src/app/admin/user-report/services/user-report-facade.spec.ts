import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiUrl } from '@core/services/api-client/api-client';
import { SKIP_AUTH_TOKEN } from '@core/models/http.model';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import { USER_REPORT_ENDPOINTS } from '@admin/user-report/models/user-report.model';
import { UserReportFacade } from './user-report-facade';

const LIST_URL = apiUrl(USER_REPORT_ENDPOINTS.list);

describe('UserReportFacade', () => {
  let facade: UserReportFacade;
  let http: HttpTestingController;
  const settle = () => TestBed.inject(ApplicationRef).whenStable();
  const read = () => {
    void facade.rows();
    void facade.hasNext();
    TestBed.tick();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        // Route-scoped: provided by hand.
        UserReportFacade,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Logger, useValue: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    facade = TestBed.inject(UserReportFacade);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests the page with auth suppressed and reshapes the paginated envelope', async () => {
    read();
    const req = http.expectOne((r) => r.url === LIST_URL);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.has('search')).toBe(false);
    expect(req.request.context.get(SKIP_AUTH_TOKEN)).toBe(true);
    req.flush({
      data: [{ id: 1 }, { id: 2 }],
      pagination_data: { total_count: 45, current_page: 1, next_page: '?page=2' },
    });
    await settle();

    expect(facade.rows()).toHaveLength(2);
    expect(facade.totalCount()).toBe(45);
    expect(facade.currentPage()).toBe(1);
    expect(facade.hasNext()).toBe(true);
    expect(facade.hasPrev()).toBe(false);
  });

  it('falls back to the DRF count/next fields and to the requested page', async () => {
    facade.setSearch(' jane ');
    read();
    http
      .expectOne((r) => r.url === LIST_URL && r.params.get('page') === '1')
      .flush({ data: [], count: 31, next: '?page=2' });
    await settle();

    facade.setPage(2);
    read();
    const req = http.expectOne((r) => r.url === LIST_URL);
    expect(req.request.params.get('search')).toBe('jane');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ data: [{ id: 3 }], count: 31, next: null, previous: '?page=1' });
    await settle();

    expect(facade.totalCount()).toBe(31);
    expect(facade.currentPage()).toBe(2);
    expect(facade.hasPrev()).toBe(true);
    expect(facade.hasNext()).toBe(false);
  });

  it('keeps the counters readable when the request fails', async () => {
    read();
    http.expectOne((r) => r.url === LIST_URL).flush(null, { status: 500, statusText: 'Boom' });
    await settle();

    expect(facade.error()).toBeTruthy();
    expect(facade.totalCount()).toBe(0);
    expect(facade.hasNext()).toBe(false);
    expect(facade.rows()).toEqual([]);
  });
});
