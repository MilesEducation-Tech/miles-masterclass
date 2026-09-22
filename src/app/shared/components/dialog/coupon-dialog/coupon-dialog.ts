import { Component, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroXMark, heroPlus, heroMinus } from '@ng-icons/heroicons/outline';
import { DialogRef } from '@core/services/dialog/dialog';
import { Button } from '../../ui/button/button';
import { PageLoading } from '../../ui/page-loading/page-loading';
import { Logger } from '@core/services/logger/logger';
import { PaymentFacade } from '@features/payment/shared/service/payment-facade/payment-facade';
import { CouponList, CartDetails } from '@core/models/payment.model';

export interface CouponDialogData {
  cartData: CartDetails;
}

@Component({
  selector: 'app-coupon-dialog',
  imports: [Button, NgIcon, ReactiveFormsModule, PageLoading],
  providers: [CurrencyPipe],
  viewProviders: [provideIcons({ heroXMark, heroPlus, heroMinus })],
  templateUrl: './coupon-dialog.html',
  styleUrl: './coupon-dialog.css',
})
export class CouponDialog implements OnInit {
  dialogRef!: DialogRef<CouponDialog, CartDetails | undefined>;
  data!: CouponDialogData;

  private readonly facade = inject(PaymentFacade);
  private readonly logger = inject(Logger);

  readonly couponCodeControl = new FormControl('', { nonNullable: true });
  readonly coupons = signal<CouponList[]>([]);
  readonly loading = signal(true);
  readonly applying = signal(false);
  readonly expandedCoupons = signal<Set<number>>(new Set());
  readonly appliedCouponCode = signal<string | null>(null);

  ngOnInit(): void {
    this.appliedCouponCode.set(this.data?.cartData?.applied_coupon?.coupon_code ?? null);
    this.loadCoupons();
  }

  close(): void {
    this.dialogRef.close();
  }

  loadCoupons(): void {
    this.loading.set(true);
    this.facade.getCoupons().subscribe({
      next: (res) => {
        this.coupons.set(res.data ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.logger.error('Failed to load coupons', err);
        this.coupons.set([]);
        this.loading.set(false);
      },
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
