import { Component, computed, input } from '@angular/core';
import { paymentFailed, paymentPending, paymentSuccess } from '@core/constants/icon';
import { NgIconComponent } from '@ng-icons/core';

@Component({
  selector: 'app-payment-status',
  imports: [NgIconComponent],
  templateUrl: './payment-status.html',
})
export class PaymentStatus {
  status = input.required<'success' | 'pending' | 'cancelled'>();

  content = computed(() => {
    switch (this.status()) {
      case 'pending':
        return {
          title: 'Payment Pending',
          // Covers both faces of `pending`: a Stripe return the webhook hasn't settled yet, and an
          // order whose payment never started (the invoice offers Try again).
          message:
            'Your order is waiting for payment. If you just paid, this updates in a moment; otherwise, try again below.',
          icon: paymentPending,
          color: 'orange',
        };
      case 'cancelled':
        return {
          title: 'Payment Cancelled',
          message: 'Your payment was cancelled. If this was a mistake, please try again.',
          icon: paymentFailed,
          color: 'red',
        };
      default:
        return {
          title: 'Cheers to leveling up!',
          message:
            'Download your payment confirmation here or catch it anytime in your Order History.',
          icon: paymentSuccess,
        };
    }
  });
}
