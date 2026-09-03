import { Component, computed, inject } from '@angular/core';
import { PaymentFacade } from '../../service/payment-facade/payment-facade';
import { CartItem } from '../../components/cart-item/cart-item';
import { EmptyCart } from '../../components/empty-cart/empty-cart';

@Component({
  selector: 'app-cart',
  imports: [CartItem, EmptyCart],
  templateUrl: './cart.html',
  styleUrl: './cart.css',
  host: {
    class: 'space-y-4',
  },
})
export class Cart {
  readonly facade = inject(PaymentFacade);

  readonly cartData = computed(() => this.facade.cartData());
  readonly itemCount = computed(() => this.cartData()?.cartitem_data.length ?? 0);
  readonly cartItems = computed(() => this.cartData()?.cartitem_data ?? []);
  readonly appliedCoupon = computed(() => this.cartData()?.applied_coupon ?? null);
  protected readonly round = Math.round;
}
