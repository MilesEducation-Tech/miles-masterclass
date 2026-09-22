import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Address } from './address';
import { UserAddress } from '../../../../../shared/core/models/payment.model';

const ADDRESS: UserAddress = {
  id: 1,
  phone_no: '+1 555 0100',
  email_id: 'learner@example.test',
  address1: '1 Ledger Way',
  locality: 'Downtown',
  landmark: 'Opposite the courthouse',
  country: 'United States',
  state: 'New York',
  city: 'New York',
  zipcode: '10001',
  is_active: true,
  created_at: '2025-01-15T00:00:00Z',
  user: 42,
  updated_by: null,
};

describe('Address', () => {
  let component: Address;
  let fixture: ComponentFixture<Address>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Address],
    }).compileComponents();

    fixture = TestBed.createComponent(Address);
    fixture.componentRef.setInput('address', ADDRESS);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
