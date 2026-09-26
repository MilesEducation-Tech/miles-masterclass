import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { CurrencyPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroXMark, heroPlus, heroMinus } from '@ng-icons/heroicons/outline';
import { injectDialogRef } from 'ng-primitives/dialog';
import { DialogShell } from '@shared/ui/dialog-shell/dialog-shell';
import { Button } from '@shared/ui/button/button';
import { PageLoading } from '@shared/ui/page-loading/page-loading';
import { Logger } from '@core/services/logger/logger';
import { PaymentFacade } from '@features/payment/services/payment-facade';
import {
  CartDetails,
  CouponList,
  CouponListResponse,
  PAYMENT_ROUTES,
} from '@core/models/payment.model';
import { apiUrl } from '@core/services/api-client/api-client';

export interface CouponDialogData {
  cartData: CartDetails;
}

@Component({
  selector: 'app-coupon-dialog',
  imports: [Button, DialogShell, NgIcon, ReactiveFormsModule, PageLoading],
  providers: [CurrencyPipe],
  viewProviders: [provideIcons({ heroXMark, heroPlus, heroMinus })],
  templateUrl: './coupon-dialog.html',
})
export class CouponDialog implements OnInit {
  private readonly dialogRef = injectDialogRef<CouponDialogData, CartDetails | undefined>();
  protected readonly data = this.dialogRef.data;

  private readonly facade = inject(PaymentFacade);
  private readonly logger = inject(Logger);

  readonly couponCodeControl = new FormControl('', { nonNullable: true });
  /** The list is read once per dialog open; applying a coupon closes the dialog. */
  private readonly couponsResource = httpResource<CouponListResponse>(() =>
    apiUrl(PAYMENT_ROUTES.listCoupon.path),
  );
  /** Guarded: `value()` throws on an errored resource; a failure shows the empty state. */
  readonly coupons = computed<CouponList[]>(() =>
    this.couponsResource.hasValue() ? (this.couponsResource.value()?.data ?? []) : [],
  );
  readonly loading = computed(() => this.couponsResource.isLoading());
  readonly applying = signal(false);
  readonly expandedCoupons = signal<Set<number>>(new Set());
  readonly appliedCouponCode = signal<string | null>(null);

  ngOnInit(): void {
    this.appliedCouponCode.set(this.data?.cartData?.applied_coupon?.coupon_code ?? null);
  }

  close(): void {
    this.dialogRef.close();
  }

  constructor() {
    effect(() => {
      const err = this.couponsResource.error();
      if (err) this.logger.error('Failed to load coupons', err);
    });
  }

  toggleTerms(couponId: number): void {
    this.expandedCoupons.update((set) => {
      const next = new Set(set);
      if (next.has(couponId)) {
        next.delete(couponId);
      } else {
        next.add(couponId);
      }
      return next;
    });
  }

  isExpanded(couponId: number): boolean {
    return this.expandedCoupons().has(couponId);
  }

  applyCoupon(couponCode: string): void {
    if (this.applying()) return;
    this.applying.set(true);

    this.facade.applyCoupon(couponCode).subscribe({
      next: (res) => {
        this.appliedCouponCode.set(couponCode);
        this.applying.set(false);
        this.dialogRef.close(res.data);
      },
      error: (err) => {
        this.logger.error('Failed to apply coupon', err);
        this.applying.set(false);
      },
    });
  }

  applyCouponFromInput(): void {
    const code = this.couponCodeControl.value.trim();
    if (!code) return;
    this.applyCoupon(code);
  }

  private readonly currencyPipe = inject(CurrencyPipe);

  getDiscountLabel(coupon: CouponList): string {
    const discount = Math.round(coupon.discount);
    if (coupon.discount_type === 'percent') {
      return `${discount}% Off`;
    }
    const formattedAmount = this.currencyPipe.transform(discount, 'USD', 'symbol', '1.0-0');
    return `${formattedAmount} Off`;
  }

  getDiscountDescription(coupon: CouponList): string {
    const discount = Math.round(coupon.discount);
    if (coupon.discount_type === 'percent') {
      return `Save upto ${discount}% on this order`;
    }
    const formattedAmount = this.currencyPipe.transform(discount, 'USD', 'symbol', '1.0-0');
    return `Save ${formattedAmount} on this order`;
  }
}
