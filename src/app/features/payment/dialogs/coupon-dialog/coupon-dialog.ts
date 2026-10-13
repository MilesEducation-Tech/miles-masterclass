import { Component, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';
import { injectDialogRef } from 'ng-primitives/dialog';

import { Button } from '@shared/ui/button/button';
import { PaymentFacade } from '@features/payment/services/payment-facade';
import { Dialog } from '@shared/ui/dialog/dialog';

/** CAIRA accepts a code of 1–50 characters; case and surrounding spaces don't matter. */
const MAX_CODE_LENGTH = 50;

/**
 * Coupon code entry. CAIRA has no coupon list, so the learner types the code; the
 * server decides whether it applies and says why not (a 409 `message`, shown under
 * the field). Applying closes the dialog; the cart already holds the new totals.
 */
@Component({
  selector: 'app-coupon-dialog',
  imports: [Button, NgIcon, Dialog],
  viewProviders: [provideIcons({ heroXMark })],
  templateUrl: './coupon-dialog.html',
})
export class CouponDialog {
  private readonly dialogRef = injectDialogRef<void, void>();
  private readonly facade = inject(PaymentFacade);

  protected readonly maxLength = MAX_CODE_LENGTH;
  protected readonly applying = signal(false);
  protected readonly error = signal<string | null>(null);

  close(): void {
    this.dialogRef.close();
  }

  apply(raw: string): void {
    if (this.applying()) return;
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
    this.facade.applyCoupon(code).subscribe({
      next: () => this.dialogRef.close(),
      error: (message: string) => {
        this.applying.set(false);
        this.error.set(message);
      },
    });
  }
}
