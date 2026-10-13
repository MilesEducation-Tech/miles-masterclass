import { Component, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentFacade } from '@features/payment/services/payment-facade';
import { CartItem, CartItemConfig } from '@features/payment/components/cart-item/cart-item';
import { Order } from '@features/payment/models/commerce.model';
import { paymentDisplayStatus } from '@features/payment/utils/order-status';
import { PageLoading } from '@shared/ui/page-loading/page-loading';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { Button } from '@shared/ui/button/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matFileDownloadOutline } from '@ng-icons/material-icons/outline';

/** Status colour by what the status means for the learner, not by each CAIRA value. */
const STATUS_CLASS = {
  success: 'text-green-500',
  pending: 'text-yellow-500',
  cancelled: 'text-red-500',
} as const;

@Component({
  selector: 'app-orders',
  imports: [CartItem, PageLoading, ErrorState, Button, NgIcon, CurrencyPipe, DatePipe],
  templateUrl: './orders.html',
  viewProviders: [provideIcons({ matFileDownloadOutline })],
})
export class Orders {
  private readonly facade = inject(PaymentFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly orders = this.facade.orders;
  protected readonly ordersCount = this.facade.ordersCount;
  protected readonly loading = this.facade.ordersLoading;
  protected readonly error = this.facade.ordersError;

  protected readonly lineConfig: CartItemConfig = {
    showThumbnail: true,
    showEdit: false,
    showDelete: false,
  };

  constructor() {
    this.facade.loadOrders();
  }

  protected retryLoad(): void {
    this.facade.loadOrders();
  }

  protected statusClass(order: Order): string {
    return STATUS_CLASS[paymentDisplayStatus(order.status)];
  }

  /** `partial_paid` → `partial paid`; the template capitalises it. */
  protected statusLabel(order: Order): string {
    return order.status.replace(/_/g, ' ');
  }

  protected viewInvoice(order: Order): void {
    this.router.navigate(['../invoice', order.id], {
      relativeTo: this.route,
      queryParams: { status: order.status },
    });
  }
}
