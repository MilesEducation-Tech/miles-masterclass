import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiUrl } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import { PartnerAdminMe } from '@admin/core/services/partner-admin-me';
import { PartnerUsersFacade } from './partner-users-facade';

const USERS = apiUrl('partners/panel/users/');

describe('PartnerUsersFacade', () => {
  let facade: PartnerUsersFacade;
  let http: HttpTestingController;
  const canRead = signal(true);
  const settle = () => TestBed.inject(ApplicationRef).whenStable();
  const read = () => {
    void facade.users();
    void facade.pagination();
    TestBed.tick();
  };

  beforeEach(() => {
    canRead.set(true);
    TestBed.configureTestingModule({
      providers: [
        // Route-scoped: provided by hand.
        PartnerUsersFacade,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: PartnerAdminMe,
          useValue: { isLoading: signal(false), canReadReports: canRead },
        },
        { provide: Logger, useValue: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    facade = TestBed.inject(PartnerUsersFacade);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists page 1 with only the filters that are set', async () => {
    read();
    const req = http.expectOne((r) => r.url === USERS);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('page_size')).toBeTruthy();
    expect(req.request.params.has('search')).toBe(false);
    expect(req.request.params.has('blocked_status')).toBe(false);
    req.flush({ data: [{ id: 1 }], pagination_data: { total_count: 1 } });
    await settle();
    expect(facade.users().map((u) => u.id)).toEqual([1]);
    expect(facade.totalCount()).toBe(1);
  });

  it('asks nothing without a report-read capability', () => {
    canRead.set(false);
    read();
    http.expectNone((r) => r.url === USERS);
  });

  it('keeps pagination readable when the list fails', async () => {
    read();
    http.expectOne((r) => r.url === USERS).flush(null, { status: 500, statusText: 'Boom' });
    await settle();
    expect(facade.totalCount()).toBe(0);
    expect(facade.error()).toBeTruthy();
  });
});
