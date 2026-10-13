import { Component, computed, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { PaymentFacade } from '@features/payment/services/payment-facade';
import { CartStore } from '@core/services/cart/cart-store';
import { CartItem } from '@features/payment/components/cart-item/cart-item';
import { EmptyCart } from '@features/payment/components/empty-cart/empty-cart';

@Component({
  selector: 'app-cart',
  imports: [CartItem, EmptyCart, CurrencyPipe],
  templateUrl: './cart.html',
  host: {
    class: 'space-y-4',
  },
})
export class Cart {
  protected readonly facade = inject(PaymentFacade);
  /** The payment shell reads the cart for every step; this page only shows it. */
  protected readonly cart = inject(CartStore).cart;
  protected readonly lines = computed(() => this.cart()?.lines ?? []);
}
