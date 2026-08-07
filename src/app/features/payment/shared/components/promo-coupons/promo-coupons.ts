import { Component, computed, effect, inject, output, signal, untracked } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCopy, lucideCheck } from '@ng-icons/lucide';
import { Auth } from '../../../../../shared/core/services/auth/auth';
import { Logger } from '../../../../../shared/core/services/logger/logger';
import { NotificationService } from '../../../../../shared/core/services/notification/notification';

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
  styleUrl: './promo-coupons.css',
})
export class PromoCoupons {
  // ponytail: PaymentFacade was deleted with the Django strip. This placeholder
  // keeps the template bindings compiling and renders the empty state.
  // Swap in the new backend's service — the template needs no changes.
  private readonly facade: any = {
    getCoupons: signal<any[]>([]),
  };
  private readonly auth = inject(Auth);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly currencyPipe = inject(CurrencyPipe);

  /** Emitted when a signed-out user taps the login prompt. */
  readonly login = output<void>();

  protected readonly isLoggedIn = computed(() => this.auth.isLoggedIn());
  protected readonly coupons = signal<any[]>([]);
  protected readonly copiedCode = signal<string | null>(null);

  constructor() {
    // Coupons are user-scoped. Auth state can resolve after construction (hard
    // refresh / deep link), so react to login instead of checking once — the
    // constructor-time check left the strip permanently empty in that case.
    let fetched = false;
    effect(() => {
      if (this.isLoggedIn() && !fetched) {
        fetched = true;
        untracked(() => this.loadCoupons());
      }
    });
  }

  private loadCoupons(): void {
    this.facade.getCoupons().subscribe({
      next: (res: any) => this.coupons.set((res.data ?? []).filter((c: any) => this.isLive(c))),
      error: (err: any) => {
        this.logger.error('Failed to load coupons', err);
        this.coupons.set([]);
      },
    });
  }

  /** Active (status) and within the valid_from…valid_to window. */
  private isLive(c: any): boolean {
    if (!c.status) return false;
    if (!c.coupon_applicable) return false;
    const now = Date.now();
    const from = c.valid_from ? new Date(c.valid_from).getTime() : -Infinity;
    const to = c.valid_to ? new Date(c.valid_to).getTime() : Infinity;
    return now >= from && now <= to;
  }

  protected discountLabel(c: any): string {
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
