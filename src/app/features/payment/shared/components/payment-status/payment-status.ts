import { Component, computed, input } from '@angular/core';
import {
  paymentFailed,
  paymentPending,
  paymentSuccess,
} from '../../../../../shared/core/constant/icon';
import { NgIconComponent } from '@ng-icons/core';

@Component({
  selector: 'app-payment-status',
  imports: [NgIconComponent],
  templateUrl: './payment-status.html',
  styleUrl: './payment-status.css',
})
export class PaymentStatus {
  status = input.required<'success' | 'pending' | 'cancelled'>();

  content = computed(() => {
    switch (this.status()) {
      case 'pending':
        return {
          title: 'Payment Pending',
          message: 'Your payment is currently being processed. Please wait a moment.',
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
