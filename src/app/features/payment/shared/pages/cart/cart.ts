import { Component, computed, signal } from '@angular/core';
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
  // ponytail: PaymentFacade was deleted with the Django strip. This placeholder
  // keeps the template bindings compiling and renders the empty state.
  // Swap in the new backend's service — the template needs no changes.
  readonly facade: any = {
    cartData: signal<any>(null),
    removeCartItem: (..._args: any[]): any => null,
  };

  readonly cartData = computed(() => this.facade.cartData());
  readonly itemCount = computed(() => this.cartData()?.cartitem_data.length ?? 0);
  readonly cartItems = computed(() => this.cartData()?.cartitem_data ?? []);
  readonly appliedCoupon = computed(() => this.cartData()?.applied_coupon ?? null);
  protected readonly round = Math.round;
}
