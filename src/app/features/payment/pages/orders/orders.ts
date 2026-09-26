import { Component, computed, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NgpMenu, NgpMenuItem, NgpMenuTrigger } from 'ng-primitives/menu';
import { PaymentFacade } from '../../services/payment-facade';
import { CartItem, CartItemConfig } from '../../components/cart-item/cart-item';
import { PageLoading } from '@shared/ui/page-loading/page-loading';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { Button } from '@shared/ui/button/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matFileDownloadOutline,
  matReceiptLongOutline,
  matMoreVertOutline,
  matAutorenewOutline,
  matBlockOutline,
} from '@ng-icons/material-icons/outline';

interface OrderActions {
  hasStripeReceipt: boolean;
  showCancelAutoRenewal: boolean;
  showReactivateAutoRenewal: boolean;
}

@Component({
  selector: 'app-orders',
  imports: [
    CartItem,
    PageLoading,
    ErrorState,
    Button,
    NgIcon,
    CurrencyPipe,
    DatePipe,
    NgpMenu,
    NgpMenuItem,
    NgpMenuTrigger,
  ],
  templateUrl: './orders.html',
  viewProviders: [
    provideIcons({
      matFileDownloadOutline,
      matReceiptLongOutline,
      matMoreVertOutline,
      matAutorenewOutline,
      matBlockOutline,
    }),
  ],
})
export class Orders {
  private readonly facade = inject(PaymentFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly orders = computed(() => this.facade.ordersData());
  readonly ordersCount = computed(() => this.facade.ordersCount());
  readonly loading = computed(() => this.facade.ordersLoading());
  readonly error = computed(() => this.facade.ordersError());

  readonly orderItemConfig: CartItemConfig = {
    showThumbnail: true,
    showEdit: false,
    showDelete: false,
    showValidity: true,
  };

  /** Computed map of order id → action visibility flags */
  readonly orderActionsMap = computed(() => {
    const map = new Map<number, OrderActions>();
    for (const order of this.orders()) {
      map.set(order.id, {
        hasStripeReceipt: order.order_items.some(
          (item) => item.platform?.toLowerCase() === 'stripe',
        ),
        showCancelAutoRenewal: order.order_items.some(
          (item) =>
            item.platform?.toLowerCase() === 'stripe' &&
            item.item_type === 'subscription' &&
            item.paid_amount > 0 &&
            (item.subscription_status === 'Active' || item.subscription_status === 'ReSubscribe'),
        ),
        showReactivateAutoRenewal: order.order_items.some(
          (item) =>
            item.platform?.toLowerCase() === 'stripe' &&
            item.item_type === 'subscription' &&
            item.paid_amount > 0 &&
            item.subscription_status === 'Deactivate',
        ),
      });
    }
    return map;
  });

  readonly paymentStatusClassMap = computed(() => {
    const map = new Map<number, string>();
    for (const order of this.orders()) {
      switch (order.payment_status) {
        case 'Success':
          map.set(order.id, 'text-green-500');
          break;
        case 'Failed':
          map.set(order.id, 'text-red-500');
          break;
        case 'Pending':
          map.set(order.id, 'text-yellow-500');
          break;
        default:
          map.set(order.id, 'text-white');
      }
    }
    return map;
  });

  constructor() {
    this.facade.loadOrders();
  }

  retryLoad() {
    this.facade.loadOrders();
  }

  paymentConfirmation(orderId: number, paymentStatus: string) {
    this.router.navigate(['../invoice', orderId], {
      relativeTo: this.route,
      queryParams: { status: paymentStatus.toLowerCase() },
    });
  }

  downloadStripeReceipt(orderId: number) {
    this.facade.navigateToStripeCustomerDashboard(orderId);
  }

  cancelAutoRenewal(orderId: number) {
    this.facade.cancelAutoRenewal(orderId);
  }

  reactivateAutoRenewal(orderId: number) {
    this.facade.reactivateAutoRenewal(orderId);
  }

  /**
   * Hits `user/order/create_customer_portal/` (no order context) and opens the
   * returned `session_url` in a new tab. Mirrors `downloadStripeReceipt` but
   * scoped to the whole user instead of a single order.
   */
  openStripeDashboard() {
    this.facade.openStripeCustomerPortal();
  }
}
