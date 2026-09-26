import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiUrl } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { PAYMENT_ROUTES } from '@core/models/payment.model';
import { PaymentFacade } from '@features/payment/services/payment-facade';
import { provideMockDialogRef, stubDialogShell } from '@testing/mocks/dialog-ref.mock';
import { CouponDialog } from './coupon-dialog';

const URL = apiUrl(PAYMENT_ROUTES.listCoupon.path);

describe('CouponDialog', () => {
  let fixture: ComponentFixture<CouponDialog>;
  let http: HttpTestingController;
  let logError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    logError = vi.fn();
    stubDialogShell(CouponDialog);
    TestBed.configureTestingModule({
      imports: [CouponDialog],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockDialogRef({ cartData: { applied_coupon: null } }),
        { provide: PaymentFacade, useValue: { applyCoupon: vi.fn() } },
        { provide: Logger, useValue: { error: logError, warn: vi.fn(), info: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CouponDialog);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('loads the coupon list when it opens', async () => {
    expect(fixture.componentInstance.loading()).toBe(true);
    http.expectOne(URL).flush({ data: [{ id: 1, coupon_code: 'SAVE10' }] });
    await fixture.whenStable();

    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.coupons().map((c) => c.id)).toEqual([1]);
  });

  it('shows the empty state and logs when the list fails', async () => {
    http.expectOne(URL).flush(null, { status: 500, statusText: 'Boom' });
    await fixture.whenStable();

    expect(fixture.componentInstance.coupons()).toEqual([]);
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(logError).toHaveBeenCalledWith('Failed to load coupons', expect.anything());
  });
});
