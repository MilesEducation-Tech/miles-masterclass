import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { injectDialogRef } from 'ng-primitives/dialog';

import { Button } from '@shared/ui/button/button';
import { CartStore } from '@core/services/cart/cart-store';
import { PaymentFacade } from '@features/payment/services/payment-facade';
import { Dialog } from '@shared/ui/dialog/dialog';

/** CAIRA accepts a code of 1–50 characters; case and surrounding spaces don't matter. */
const MAX_CODE_LENGTH = 50;

/**
 * Applies a coupon: one of the learner's listed coupons (`commerce/coupons/`), or a typed code
 * for one that isn't listed. The server decides whether it applies and says why not (a 409
 * `message`, shown under the field or the coupon). Applying closes the dialog; the cart already
 * holds the new totals.
 */
@Component({
  selector: 'app-coupon-dialog',
  imports: [Button, Dialog, CurrencyPipe, DatePipe],
  templateUrl: './coupon-dialog.html',
})
export class CouponDialog {
  private readonly dialogRef = injectDialogRef<void, void>();
  private readonly facade = inject(PaymentFacade);
  private readonly cart = inject(CartStore).cart;

  protected readonly maxLength = MAX_CODE_LENGTH;
  protected readonly coupons = this.facade.coupons;
  /** The typed code is on its way. */
  protected readonly applying = signal(false);
  protected readonly error = signal<string | null>(null);
  /** The listed coupon on its way, and the one whose apply was refused (shown under it). */
  protected readonly applyingCode = signal<string | null>(null);
  protected readonly listError = signal<{ code: string; message: string } | null>(null);
  /** One apply at a time, from either place. */
  protected readonly busy = computed(() => this.applying() || this.applyingCode() !== null);

  /** CAIRA treats codes case-insensitively, so the applied badge does too. */
  protected isApplied(code: string): boolean {
    return this.cart()?.coupon?.code.toUpperCase() === code.toUpperCase();
  }

  close(): void {
    this.dialogRef.close();
  }

  apply(raw: string): void {
    if (this.busy()) return;
    const code = raw.trim();
    if (!code) {
      this.error.set('Enter a coupon code.');
      return;
    }
    if (code.length > MAX_CODE_LENGTH) {
      this.error.set(`A coupon code is at most ${MAX_CODE_LENGTH} characters.`);
      return;
    }

    this.applying.set(true);
    this.error.set(null);
    this.listError.set(null);
    this.facade.applyCoupon(code).subscribe({
      next: () => this.dialogRef.close(),
      error: (message: string) => {
        this.applying.set(false);
        this.error.set(message);
      },
    });
  }

  applyListed(code: string): void {
    if (this.busy()) return;
    this.applyingCode.set(code);
    this.error.set(null);
    this.listError.set(null);
    this.facade.applyCoupon(code).subscribe({
      next: () => this.dialogRef.close(),
      error: (message: string) => {
        this.applyingCode.set(null);
        this.listError.set({ code, message });
      },
    });
  }
}
