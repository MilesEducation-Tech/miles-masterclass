import { Component, inject, output, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCopy, lucideCheck } from '@ng-icons/lucide';
import { PaymentFacade } from '../../services/payment-facade';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import { CouponList } from '@core/models/payment.model';

/**
 * Post-login coupon strip shown beside the plan CTAs. Lists active, currently
 * valid coupons with copy-to-clipboard; the user applies the code on the cart
 * page. Renders nothing for signed-out users or when there are no live coupons.
 */
@Component({
  selector: 'app-promo-coupons',
  imports: [NgIcon],
  providers: [CurrencyPipe],
  viewProviders: [provideIcons({ lucideCopy, lucideCheck })],
  templateUrl: './promo-coupons.html',
  host: { class: 'block' },
})
export class PromoCoupons {
  private readonly facade = inject(PaymentFacade);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly currencyPipe = inject(CurrencyPipe);

  /** Emitted when a signed-out user taps the login prompt. */
  readonly login = output<void>();

  // ponytail: inert — the template renders its signed-out design.
  protected readonly isLoggedIn = signal(false);
  protected readonly coupons = signal<CouponList[]>([]);
  protected readonly copiedCode = signal<string | null>(null);

  // ponytail: an effect here loaded the user-scoped coupons once auth
  // resolved. `loadCoupons()` is kept as the re-wire point.

  private loadCoupons(): void {
    this.facade.getCoupons().subscribe({
      next: (res) => this.coupons.set((res.data ?? []).filter((c) => this.isLive(c))),
      error: (err) => {
        this.logger.error('Failed to load coupons', err);
        this.coupons.set([]);
      },
    });
  }

  /** Active (status) and within the valid_from…valid_to window. */
  private isLive(c: CouponList): boolean {
    if (!c.status) return false;
    if (!c.coupon_applicable) return false;
    const now = Date.now();
    const from = c.valid_from ? new Date(c.valid_from).getTime() : -Infinity;
    const to = c.valid_to ? new Date(c.valid_to).getTime() : Infinity;
    return now >= from && now <= to;
  }

  protected discountLabel(c: CouponList): string {
    if (c.discount_type === 'percent') return `${Math.round(c.discount)}% Off`;
    return `${this.currencyPipe.transform(c.discount, 'USD', 'symbol', '1.0-0')} Off`;
  }

  protected async copy(code: string): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
        this.copiedCode.set(code);
        this.notification.success('Copied', `Coupon ${code} copied — apply it on the cart page.`);
      }
    } catch (err) {
      this.logger.error('Failed to copy coupon code', err);
    }
  }
}
