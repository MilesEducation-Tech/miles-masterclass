import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiUrl } from '@core/services/api-client/api-client';
import { IS_ADMIN_REQUEST } from '@core/models/http.model';
import { AdminAuth } from '@admin/core/services/admin-auth';
import { PartnerAdminMe } from './partner-admin-me';

const ME = apiUrl('partners/panel/me/');

describe('PartnerAdminMe', () => {
  let me: PartnerAdminMe;
  let http: HttpTestingController;
  const isAuthenticated = signal(true);
  const adminUser = signal<{ user_id: string } | null>({ user_id: 'u1' });
  const settle = () => TestBed.inject(ApplicationRef).whenStable();
  const read = () => {
    void me.isPartnerAdmin();
    TestBed.tick();
  };

  beforeEach(() => {
    isAuthenticated.set(true);
    adminUser.set({ user_id: 'u1' });
    TestBed.configureTestingModule({
      providers: [
        // Route-scoped: provided by hand.
        PartnerAdminMe,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AdminAuth, useValue: { isAuthenticated, adminUser } },
      ],
    });
    me = TestBed.inject(PartnerAdminMe);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads /me/ with the admin token and exposes the capabilities', async () => {
    read();
    const req = http.expectOne(ME);
    expect(req.request.context.get(IS_ADMIN_REQUEST)).toBe(true);
    req.flush({
      is_partner_admin: true,
      role: 'network_admin',
      capabilities: ['report:network:read'],
    });
    await settle();

    expect(me.isPartnerAdmin()).toBe(true);
    expect(me.canReadReports()).toBe(true);
  });

  it('does not refetch when the same user is rebuilt (profile refresh, token rotation)', async () => {
    read();
    http.expectOne(ME).flush({ is_partner_admin: false });
    await settle();

    adminUser.set({ user_id: 'u1' }); // a new object, same user
    read();
    http.expectNone(ME);

    adminUser.set({ user_id: 'u2' }); // a different user does refetch
    read();
    http.expectOne(ME).flush({ is_partner_admin: false });
    await settle();
  });

  it('fails closed: a failed /me/ reads as "not a partner admin"', async () => {
    read();
    http.expectOne(ME).flush(null, { status: 500, statusText: 'Boom' });
    await settle();

    expect(me.isPartnerAdmin()).toBe(false);
    expect(me.canReadReports()).toBe(false);
  });

  it('asks nothing while signed out', () => {
    isAuthenticated.set(false);
    read();
    http.expectNone(ME);
  });
});
