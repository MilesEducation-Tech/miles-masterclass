import { Component, inject, input, output, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroChevronDown } from '@ng-icons/heroicons/outline';
import {
  NgpAccordion,
  NgpAccordionContent,
  NgpAccordionItem,
  NgpAccordionTrigger,
} from 'ng-primitives/accordion';
import { NgpButton } from 'ng-primitives/button';

import { AuthSession } from '@core/services/auth-session/auth-session';
import { Plan } from '@features/payment/models/commerce.model';
import { PaymentFacade } from '@features/payment/services/payment-facade';
import { Button } from '@shared/ui/button/button';

/**
 * "Your offers", under the plan page's Subscribe Now. Signed out, it asks the learner to log in.
 * Signed in, it headlines the best coupon and, opened, lists every coupon with Apply. Apply puts
 * the selected plan in the cart, applies the code and tells the page to go to the cart. The page
 * opts the coupon list in and renders this only when there is something to show.
 */
@Component({
  selector: 'app-promo-coupons',
  imports: [
    NgpAccordion,
    NgpAccordionItem,
    NgpAccordionTrigger,
    NgpAccordionContent,
    NgpButton,
    NgIcon,
    NgTemplateOutlet,
    Button,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
  ],
  providers: [provideIcons({ heroChevronDown })],
  templateUrl: './promo-coupons.html',
})
export class PromoCoupons {
  private readonly facade = inject(PaymentFacade);
  // The boolean, never the token.
  protected readonly isLoggedIn = inject(AuthSession).isAuthenticated;
  protected readonly coupons = this.facade.coupons;
  protected readonly best = this.facade.bestCoupon;

  /** What Apply puts in an empty cart: the plan the learner has selected. */
  readonly plan = input<Plan | null>(null);
  /** A signed-out learner tapped Log in; the page opens its sign-up prompt. */
  readonly login = output<void>();
  /** The coupon is on the cart; the page goes there. */
  readonly applied = output<void>();

  /** The coupon on its way (one at a time), and the one the API refused, with its message. */
  protected readonly applyingCode = signal<string | null>(null);
  protected readonly failed = signal<{ code: string; message: string } | null>(null);

  protected apply(code: string): void {
    const plan = this.plan();
    if (!plan || this.applyingCode()) return;
    this.applyingCode.set(code);
    this.failed.set(null);
    this.facade.applyCouponWithPlan(plan, code).subscribe({
      next: () => {
        this.applyingCode.set(null);
        this.applied.emit();
      },
      error: (message: string) => {
        this.applyingCode.set(null);
        this.failed.set({ code, message });
      },
    });
  }
}
