import { Component, computed, inject } from '@angular/core';
import { PaymentFacade } from '@features/payment/services/payment-facade';
import { CartItem } from '@features/payment/components/cart-item/cart-item';
import { EmptyCart } from '@features/payment/components/empty-cart/empty-cart';

@Component({
  selector: 'app-cart',
  imports: [CartItem, EmptyCart],
  templateUrl: './cart.html',
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
