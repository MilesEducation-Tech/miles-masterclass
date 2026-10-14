import { Component, computed, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroChevronLeft, heroChevronRight, heroXMark } from '@ng-icons/heroicons/outline';
import { PaymentFacade } from '@features/payment/services/payment-facade';
import { CartStore } from '@core/services/cart/cart-store';
import { Decimal, hasAmount } from '@core/models/commerce.model';

import { Button } from '@shared/ui/button/button';
import { svglStripe } from '@ng-icons/svgl';
import { Router } from '@angular/router';
import { Utils } from '@shared/services/utils';

/** What the price card shows. Every figure is the server's; the card only displays it. */
interface PriceSummary {
  count: number;
  currency: string;
  subtotal: Decimal;
  productDiscount: Decimal;
  couponDiscount: Decimal;
  tax: Decimal;
  total: Decimal;
}

@Component({
  selector: 'app-price-overview',
  imports: [CurrencyPipe, NgIcon, Button],
  viewProviders: [provideIcons({ heroChevronLeft, heroChevronRight, heroXMark, svglStripe })],
  templateUrl: './price-overview.html',
})
export class PriceOverview {
  readonly facade = inject(PaymentFacade);
  readonly router = inject(Router);
  readonly utils = inject(Utils);
  private readonly cart = inject(CartStore).cart;

  protected readonly hasAmount = hasAmount;

  readonly isBilling = computed(() => this.utils.currentUrl()?.includes('/billing') ?? false);
  readonly isCart = computed(() => this.utils.currentUrl()?.includes('/cart') ?? false);
  readonly isReview = computed(() => this.utils.currentUrl()?.includes('/review') ?? false);
  readonly isInvoice = computed(() => this.utils.currentUrl()?.includes('/invoice') ?? false);

  onProceed() {
    const basePath = ['/', this.utils.country(), this.utils.profession(), 'payment'];
    if (this.isCart()) {
      this.router.navigate([...basePath, 'billing']);
    } else if (this.isBilling()) {
      // The picked address goes onto the cart first: checkout copies the cart's address.
      this.facade.attachBillingAddress(() => this.router.navigate([...basePath, 'review']));
    }
  }

  goBack() {
    const basePath = ['/', this.utils.country(), this.utils.profession(), 'payment'];
    if (this.isBilling()) {
      this.router.navigate([...basePath, 'cart']);
    } else if (this.isReview()) {
      this.router.navigate([...basePath, 'billing']);
    }
  }

  /**
   * The invoice shows its order; every other step shows the cart. `null` hides the card: a
   * cart with no lines shows no totals (CAIRA reports a fresh cart's currency wrongly until a
   * line is added; `docs/COMMERCE_API.md`).
   */
  readonly summary = computed<PriceSummary | null>(() => {
    if (this.isInvoice()) {
      const order = this.facade.order();
      if (!order) return null;
      return {
        count: order.lines.length,
        currency: order.currency,
        subtotal: order.money.price_before_discount,
        productDiscount: order.money.discount_amount,
        couponDiscount: order.money.coupon_discount_amount,
        tax: order.money.gst_amount,
        total: order.money.price_after_gst,
      };
    }
    const cart = this.cart();
    if (!cart || cart.lines.length === 0) return null;
    return {
      count: cart.lines.length,
      currency: cart.currency,
      subtotal: cart.money.price_before_discount,
      productDiscount: cart.money.discount_amount,
      couponDiscount: cart.money.coupon_discount_amount,
      tax: cart.money.gst_amount,
      total: cart.money.checkout_amount,
    };
  });

  /** The cart's applied coupon (the Savings Corner never shows on review or invoice). */
  readonly coupon = computed(() => this.cart()?.coupon ?? null);
}
