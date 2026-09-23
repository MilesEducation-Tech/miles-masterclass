import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroChevronLeft, heroChevronRight, heroXMark } from '@ng-icons/heroicons/outline';
import { PaymentFacade } from '../../services/payment-facade';

import { Button } from '@shared/ui/button/button';
import { svglStripe } from '@ng-icons/svgl';
import { Router } from '@angular/router';
import { Utils } from '@shared/services/utils';
import { CouponList } from '@core/models/payment.model';

@Component({
  selector: 'app-price-overview',
  imports: [CurrencyPipe, NgIcon, Button],
  providers: [CurrencyPipe],
  viewProviders: [provideIcons({ heroChevronLeft, heroChevronRight, heroXMark, svglStripe })],
  templateUrl: './price-overview.html',
  styleUrl: './price-overview.css',
})
export class PriceOverview {
  readonly facade = inject(PaymentFacade);
  readonly router = inject(Router);
  readonly utils = inject(Utils);
  private readonly currencyPipe = inject(CurrencyPipe);

  // ponytail: the constructor fetched coupons once signed in. Coupons are a
  // user-scoped endpoint and there is no session to scope them to, so the
  // inline strip stays empty.

  /** First directly-applicable coupon shown inline; the rest live behind "Show more". */
  readonly firstCoupon = computed(
    () => this.facade.coupons().find((c) => c.coupon_applicable) ?? null,
  );
  readonly applyingCoupon = signal(false);
  readonly round = Math.round;

  applyFirst(code: string): void {
    if (this.applyingCoupon()) return;
    this.applyingCoupon.set(true);
    // Facade sets cart data + toasts on success/error; we just track the button state.
    this.facade.applyCoupon(code).subscribe({
      next: () => this.applyingCoupon.set(false),
      error: () => this.applyingCoupon.set(false),
    });
  }

  discountLabel(coupon: CouponList): string {
    const discount = Math.round(coupon.discount);
    if (coupon.discount_type === 'percent') return `${discount}% Off`;
    return `${this.currencyPipe.transform(discount, 'USD', 'symbol', '1.0-0')} Off`;
  }

  readonly isBilling = computed(() => this.utils.currentUrl()?.includes('/billing') ?? false);
  readonly isCart = computed(() => this.utils.currentUrl()?.includes('/cart') ?? false);
  readonly isReview = computed(() => this.utils.currentUrl()?.includes('/review') ?? false);
  readonly isInvoice = computed(() => this.utils.currentUrl()?.includes('/invoice') ?? false);

  onProceed() {
    const basePath = ['/', this.utils.country(), this.utils.profession(), 'payment'];
    if (this.isCart()) {
      this.router.navigate([...basePath, 'billing']);
    } else if (this.isBilling()) {
      this.router.navigate([...basePath, 'review']);
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

  readonly cartData = this.facade.cartData;
  readonly orderData = this.facade.orderData;

  readonly itemCount = computed(() => {
    if (this.isInvoice()) {
      return this.facade.invoiceItemCount();
    }
    return this.cartData()?.cartitem_data.length ?? 0;
  });

  readonly currencySymbol = computed(() => {
    if (this.isInvoice()) {
      return this.facade.invoiceCurrencySymbol();
    }
    return this.cartData()?.selected_country.currency_symbol ?? '$';
  });

  readonly currencyCode = computed(() => {
    if (this.isInvoice()) {
      return this.facade.invoiceCurrency();
    }
    return this.cartData()?.selected_country.currency ?? 'USD';
  });

  readonly subAmount = computed(() => {
    if (this.isInvoice()) {
      return this.facade.invoiceSubTotal();
    }
    return this.cartData()?.sub_amount ?? 0;
  });

  readonly totalDiscountAmount = computed(() => {
    if (this.isInvoice()) {
      return this.facade.invoiceTotalDiscount();
    }
    return this.cartData()?.total_discount_amount ?? 0;
  });

  readonly totalDiscountPercent = computed(() => {
    if (this.isInvoice()) {
      return this.facade.invoiceTotalDiscountPercent();
    }
    return this.cartData()?.total_discount_percent ?? 0;
  });

  readonly grandTotal = computed(() => {
    if (this.isInvoice()) {
      return this.facade.invoiceGrandTotal();
    }
    return this.cartData()?.total_amount ?? 0;
  });

  readonly taxAmount = computed(() => {
    if (this.isInvoice()) {
      return this.facade.invoiceTaxAmount();
    }
    return this.cartData()?.tax_amount ?? 0;
  });

  readonly appliedCoupon = computed(() => {
    if (this.isInvoice()) {
      return this.facade.invoiceCouponDetails();
    }
    return this.cartData()?.applied_coupon;
  });

  readonly productDiscount = computed(() => {
    if (this.isInvoice()) {
      return this.facade.invoiceProductDiscount();
    }
    const data = this.cartData();
    if (!data) return 0;
    let totalBase = 0;
    let totalSelling = 0;
    for (const item of data.cartitem_data) {
      totalBase += item.base_price;
      totalSelling += item.selling_price;
    }
    return totalBase - totalSelling;
  });

  readonly couponDiscount = computed(() => {
    return this.totalDiscountAmount() - this.productDiscount();
  });

  // Monthly (EMI): if any cart item was added with pay_method 'monthly', show the
  // monthly payable alongside the annual grand total.
  // ponytail: derive as grandTotal ÷ 12 per the agreed contract — assumes monthly
  // carts are subscription-only. Revisit if mixed monthly + one-time carts ship.
  readonly hasMonthly = computed(() => {
    if (this.isInvoice()) return false;
    return this.cartData()?.cartitem_data.some((i) => i.pay_method === 'monthly') ?? false;
  });

  readonly monthlyPayable = computed(() => this.grandTotal() / 12);
}
