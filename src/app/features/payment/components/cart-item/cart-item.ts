import { Component, computed, inject, input, output } from '@angular/core';
import { CurrencyPipe, NgOptimizedImage } from '@angular/common';
import { CartItemData, OrderItem } from '@core/models/payment.model';
import { environment } from '@env/environment';
import { NgIcon } from '@ng-icons/core';
import { matDeleteOutline, matEditOutline } from '@ng-icons/material-icons/outline';
import { Button } from '@shared/ui/button/button';
import { RouterLink } from '@angular/router';
import { Utils } from '@shared/services/utils';

export type CartDisplayItem = CartItemData | OrderItem;

export interface CartItemConfig {
  showThumbnail?: boolean;
  showEdit?: boolean;
  showDelete?: boolean;
  showValidity?: boolean;
  /** When true, price and actions render below the item details instead of beside */
  stacked?: boolean;
}

const DEFAULT_CONFIG: Required<CartItemConfig> = {
  showThumbnail: true,
  showEdit: false,
  showDelete: true,
  showValidity: false,
  stacked: false,
};

@Component({
  selector: 'app-cart-item',
  imports: [NgOptimizedImage, NgIcon, CurrencyPipe, Button, RouterLink],
  templateUrl: './cart-item.html',
  host: {
    '[class]':
      'stacked() ? "flex flex-col gap-3" : "flex justify-between max-sm:flex-col sm:flex-row"',
  },
})
export class CartItem {
  private readonly utils = inject(Utils);

  item = input.required<CartDisplayItem>();
  currencyCode = input<string>('USD');
  config = input<CartItemConfig>({});

  /** Absolute plan route: `/:country/:profession_type/payment/plan`. */
  readonly planRoute = computed(
    () => `/${this.utils.country()}/${this.utils.profession()}/payment/plan`,
  );

  // Computed config values with defaults
  readonly showThumbnail = computed(
    () => this.config().showThumbnail ?? DEFAULT_CONFIG.showThumbnail,
  );
  readonly showEdit = computed(() => this.config().showEdit ?? DEFAULT_CONFIG.showEdit);
  readonly showDelete = computed(() => this.config().showDelete ?? DEFAULT_CONFIG.showDelete);
  readonly showValidity = computed(() => this.config().showValidity ?? DEFAULT_CONFIG.showValidity);
  readonly stacked = computed(() => this.config().stacked ?? DEFAULT_CONFIG.stacked);
  readonly validityText = computed(() => {
    const item = this.item();
    if (!('valid_from' in item) || !('valid_to' in item)) return '';
    const from = new Date(item.valid_from);
    const to = new Date(item.valid_to);
    const diffMs = to.getTime() - from.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays >= 365) {
      const years = Math.round(diffDays / 365);
      return `Valid till - ${years} year${years > 1 ? 's' : ''}`;
    }
    if (diffDays >= 30) {
      const months = Math.round(diffDays / 30);
      return `Valid till - ${months} month${months > 1 ? 's' : ''}`;
    }
    return `Valid till - ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  });

  // Monthly (EMI) subscriptions: show the price ÷ 12 with a /mo suffix and the
  // annual total as microcopy. `pay_method` exists on cart items only (not order
  // items), so guard the access.
  readonly isMonthly = computed(() => {
    const item = this.item();
    return 'pay_method' in item && item.pay_method === 'monthly';
  });
  readonly sellingDisplay = computed(() =>
    this.isMonthly() ? this.item().selling_price / 12 : this.item().selling_price,
  );
  readonly baseDisplay = computed(() =>
    this.isMonthly() ? this.item().base_price / 12 : this.item().base_price,
  );

  // Computed display values that work with both item types
  readonly isOrderItem = computed(() => 'order' in this.item());
  /** Actual amount paid for this line — present on order-history items only; null for cart items. */
  readonly paidAmount = computed<number | null>(() => {
    const item = this.item();
    return 'paid_amount' in item ? item.paid_amount : null;
  });
  readonly deliveryMode = computed(() => {
    const item = this.item();
    if (item.item_type) return item.item_type;
    if ('delivery_mode' in item.item_details) return item.item_details.delivery_mode;
    return 'subscription';
  });
  readonly isSubscription = computed(() => {
    const mode = this.deliveryMode();
    return mode === 'subscription' || mode === 'Subscription';
  });
  readonly title = computed(() => {
    const details = this.item().item_details;
    if ('subscription_name' in details) {
      return details.subscription_name;
    }
    return 'title' in details ? details.title : '';
  });
  readonly description = computed(() => this.item().item_details.description);

  readonly icons = { delete: matDeleteOutline, edit: matEditOutline };

  // Outputs
  removeItem = output<number>();
  editItem = output<number>();

  onDelete(): void {
    this.removeItem.emit(this.item().id);
  }

  onEdit(): void {
    this.editItem.emit(this.item().id);
  }

  thumbnail = computed(() => {
    const item = this.item();
    if (this.isSubscription()) {
      return this.S3_BUCKET_URL + 'static-assests/web-app/payment/cart-subscription.webp';
    }
    if ('horizontal_thumbnail' in item.item_details) {
      return item.item_details.horizontal_thumbnail;
    }
    return this.S3_BUCKET_URL + 'static-assests/web-app/payment/cart-subscription.webp';
  });

  S3_BUCKET_URL = environment.S3_BUCKET_URL;
}
