import { Component, computed, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { PaymentFacade } from '@features/payment/services/payment-facade';
import { CartStore } from '@core/services/cart/cart-store';
import { CartItem } from '@features/payment/components/cart-item/cart-item';
import { EmptyCart } from '@features/payment/components/empty-cart/empty-cart';
import { PageLoading } from '@shared/ui/page-loading/page-loading';
import { ErrorState } from '@shared/ui/error-state/error-state';

@Component({
  selector: 'app-cart',
  imports: [CartItem, EmptyCart, PageLoading, ErrorState, CurrencyPipe],
  templateUrl: './cart.html',
  host: {
    class: 'space-y-4',
  },
})
export class Cart {
  protected readonly facade = inject(PaymentFacade);
  private readonly store = inject(CartStore);

  /** The payment shell reads the cart for every step; this page only shows it. */
  protected readonly cart = this.store.cart;
  protected readonly lines = computed(() => this.cart()?.lines ?? []);
  // The read's own state, so the empty state never shows for a cart that is still on its way.
  protected readonly loading = computed(
    () => this.store.status() === 'loading' || this.store.status() === 'reloading',
  );
  protected readonly failed = computed(() => this.store.status() === 'error');

  constructor() {
    // The Savings Corner (price card) offers these only on the cart step.
    this.facade.loadCoupons();
  }

  protected retry(): void {
    this.store.reload();
  }
}
