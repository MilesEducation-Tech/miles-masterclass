import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import { PartnerAdminMe } from '@admin/core/services/partner-admin-me';
import { PartnerReportFacade } from './partner-report-facade';

describe('PartnerReportFacade reads', () => {
  let facade: PartnerReportFacade;
  let http: HttpTestingController;
  const role = signal<'network' | 'super'>('network');
  const canRead = signal(true);
  const settle = () => TestBed.inject(ApplicationRef).whenStable();
  const read = () => {
    void facade.summary();
    void facade.users();
    void facade.deliveryTypes();
    TestBed.tick();
  };
  const endsWith = (suffix: string) => (r: { url: string }) => r.url.endsWith(suffix);

  beforeEach(() => {
    role.set('network');
    canRead.set(true);
    TestBed.configureTestingModule({
      providers: [
        // Route-scoped: provided by hand.
        PartnerReportFacade,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: PartnerAdminMe,
          useValue: { isLoading: signal(false), role, canReadReports: canRead },
        },
        { provide: Logger, useValue: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    facade = TestBed.inject(PartnerReportFacade);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('a panel admin reads summary, users and filters, never sending a scope', async () => {
    read();
    const summary = http.expectOne(endsWith('summary/'));
    expect(summary.request.params.get('subject')).toBe('courses');
    expect(summary.request.params.has('network_id')).toBe(false);
    const users = http.expectOne(endsWith('users/'));
    expect(users.request.params.get('page')).toBe('1');
    summary.flush({ total_users: 3 });
    users.flush({ users: [{ user_id: 1 }], pagination_data: { total_count: 1 } });
    http
      .expectOne(endsWith('filters/'))
      .flush({ delivery_types: ['webinar'], fields_of_study: [] });
    await settle();

    expect(facade.users()).toHaveLength(1);
    expect(facade.totalCount()).toBe(1);
    expect(facade.deliveryTypes()).toEqual(['webinar']);
  });

  it('fetches the filters once, not again on every filter change', async () => {
    read();
    http.expectOne(endsWith('summary/')).flush({});
    http.expectOne(endsWith('users/')).flush({ users: [] });
    http.expectOne(endsWith('filters/')).flush({ delivery_types: [], fields_of_study: [] });
    await settle();

    facade.setSubject('webinars');
    read();
    http.expectOne(endsWith('summary/')).flush({});
    http.expectOne(endsWith('users/')).flush({ users: [] });
    http.expectNone(endsWith('filters/'));
    await settle();
  });

  it('a super admin waits for a scope before reading anything', () => {
    role.set('super');
    read();
    http.expectNone(() => true);
    expect(facade.needsScope()).toBe(true);
  });

  it('keeps the counters readable when the users read fails', async () => {
    read();
    http.expectOne(endsWith('summary/')).flush(null, { status: 500, statusText: 'Boom' });
    http.expectOne(endsWith('users/')).flush(null, { status: 500, statusText: 'Boom' });
    http.expectOne(endsWith('filters/')).flush(null, { status: 500, statusText: 'Boom' });
    await settle();

    expect(facade.summary()).toBeUndefined();
    expect(facade.users()).toEqual([]);
    expect(facade.totalCount()).toBe(0);
    expect(facade.deliveryTypes()).toEqual([]);
  });
});
