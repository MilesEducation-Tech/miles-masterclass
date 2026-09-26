import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiUrl } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';

import { PaymentFacade } from './payment-facade';

const ORDERS = apiUrl('user/order/my_orders/');
const ORDER = apiUrl('user/order/order_details/');
const ADDRESSES = apiUrl('user/address/');
const PLANS = apiUrl('promotion/subscription/');

describe('PaymentFacade', () => {
  let service: PaymentFacade;
  let http: HttpTestingController;
  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Logger, useValue: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } },
        {
          provide: NotificationService,
          useValue: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
        },
      ],
    });
    service = TestBed.inject(PaymentFacade);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created, and fetches nothing until a page opts in', () => {
    expect(service).toBeTruthy();
    void service.ordersData();
    void service.billingAddress();
    void service.subscriptionPlans();
    void service.recommendedPlans();
    TestBed.tick();
    // Root-provided and built on every page: nothing may load on its own.
    http.expectNone(() => true);
  });

  it('loads orders on the first call and reloads on the next', async () => {
    service.loadOrders();
    TestBed.tick();
    http.expectOne(ORDERS).flush({ data: [{ id: 1 }] });
    await settle();
    expect(service.ordersData().map((o) => o.id)).toEqual([1]);

    service.loadOrders();
    TestBed.tick();
    http.expectOne(ORDERS).flush(null, { status: 500, statusText: 'Boom' });
    await settle();
    expect(service.ordersData()).toEqual([]);
    expect(service.ordersError()).toBe('Failed to load order history');
  });

  it('feeds the order read into the shared loading/error the guards wait on', async () => {
    service.loadOrderById('ord_9');
    TestBed.tick();
    expect(service.loading()).toBe(true);
    const req = http.expectOne((r) => r.url === ORDER);
    expect(req.request.params.get('order_id')).toBe('ord_9');
    req.flush(null, { status: 404, statusText: 'Not Found' });
    await settle();

    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('Failed to load order details');
    expect(service.orderData()).toBeNull();
  });

  it('loads addresses once asked, and a save patches the list in place', async () => {
    service.loadBillingAddress();
    TestBed.tick();
    http.expectOne(ADDRESSES).flush({ data: [{ id: 1, city: 'NYC' }] });
    await settle();
    expect(service.billingAddress().map((a) => a.id)).toEqual([1]);
    expect(service.selectedAddressId()).toBe(1);

    service.saveBillingAddress({ city: 'Austin' } as never);
    const save = http.expectOne((r) => r.url === ADDRESSES && r.method === 'POST');
    save.flush({ data: { id: 2, city: 'Austin' } });

    expect(service.billingAddress().map((a) => a.id)).toEqual([1, 2]);
    http.expectNone((r) => r.url === ADDRESSES && r.method === 'GET');
  });

  it('keeps the full plan list and the recommended slice apart', async () => {
    service.loadSubscriptionPlans();
    service.loadSubscriptionPlans({ recommendedOnly: true });
    void service.subscriptionPlans();
    void service.recommendedPlans();
    TestBed.tick();
    const reqs = http.match((r) => r.url === PLANS);
    const recommended = reqs.find((r) => r.request.params.get('is_recommended') === 'true')!;
    const full = reqs.find((r) => !r.request.params.has('is_recommended'))!;
    full.flush({ data: [{ id: 1 }, { id: 2 }, { id: 3 }] });
    recommended.flush({ data: [{ id: 2 }] });
    await settle();

    expect(service.subscriptionPlans().map((p) => p.id)).toEqual([1, 2, 3]);
    expect(service.recommendedPlans().map((p) => p.id)).toEqual([2]);
  });

  it('lets add-to-cart mark a plan in place until the next load', async () => {
    service.loadSubscriptionPlans();
    void service.subscriptionPlans();
    TestBed.tick();
    http.expectOne(PLANS).flush({ data: [{ id: 1, is_added_to_cart: false }] });
    await settle();
    expect(service.subscriptionPlans()[0].is_added_to_cart).toBe(false);

    service.subscriptionPlans.update((plans) =>
      plans.map((p) => ({ ...p, is_added_to_cart: true })),
    );
    expect(service.subscriptionPlans()[0].is_added_to_cart).toBe(true);

    service.loadSubscriptionPlans();
    TestBed.tick();
    http.expectOne(PLANS).flush({ data: [{ id: 1, is_added_to_cart: false }] });
    await settle();
    expect(service.subscriptionPlans()[0].is_added_to_cart).toBe(false);
  });
});
