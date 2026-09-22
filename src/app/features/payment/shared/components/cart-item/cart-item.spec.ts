import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CartItem } from './cart-item';
import { CartItemData } from '../../../../../shared/core/models/payment.model';

const ITEM: CartItemData = {
  id: 1,
  cart_id: 9,
  item_type: 'course',
  item_details: {
    id: 101,
    title: 'Advanced CPA Exam Strategies',
    description: 'Master the techniques needed to pass the CPA exam on your first attempt.',
    category_name: 'Accounting',
    cpe_credits: 4,
    date_of_completion: '',
    delivery_mode: 'masterclass',
    horizontal_thumbnail: 'https://placehold.co/600x300/1a1a2e/ffffff?text=CPA+Strategies',
    instructor_first_name: 'Sarah',
    instructor_last_name: 'Johnson',
    instructors: [],
  },
  base_price: 199,
  selling_price: 149,
};

describe('CartItem', () => {
  let component: CartItem;
  let fixture: ComponentFixture<CartItem>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CartItem],
    }).compileComponents();

    fixture = TestBed.createComponent(CartItem);
    fixture.componentRef.setInput('item', ITEM);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
