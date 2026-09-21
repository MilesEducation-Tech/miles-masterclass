import { TestBed } from '@angular/core/testing';

import { PaymentFacade } from './payment-facade';

describe('PaymentFacade', () => {
  let service: PaymentFacade;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PaymentFacade);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
