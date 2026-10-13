import { Component, computed, inject, input, output } from '@angular/core';
import { CurrencyPipe, NgOptimizedImage } from '@angular/common';
import { CartLine, Decimal, hasAmount } from '@core/models/commerce.model';
import { OrderLine } from '@features/payment/models/commerce.model';
import { OrderItem } from '@core/models/payment.model';
import { environment } from '@env/environment';
import { NgIcon } from '@ng-icons/core';
import { matDeleteOutline, matEditOutline } from '@ng-icons/material-icons/outline';
import { Button } from '@shared/ui/button/button';
import { RouterLink } from '@angular/router';
import { Utils } from '@shared/services/utils';

/**
 * A commerce cart line, a commerce order line, or a legacy order item. Order history still
 * passes `OrderItem` until PR6 of `prompts/commerce-api-rebind.md` moves it onto CAIRA
 * orders; the legacy branch goes with it.
 */
export type CartDisplayItem = CartLine | OrderLine | OrderItem;

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

/** A CAIRA line (cart or order): both carry `money` and their own title and image. */
const isCommerceLine = (item: CartDisplayItem): item is CartLine | OrderLine => 'money' in item;

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

  /** What the line costs: CAIRA's `final_amount` (after discounts and tax). */
  readonly amount = computed<Decimal | number>(() => {
    const item = this.item();
    return isCommerceLine(item) ? item.money.final_amount : item.selling_price;
  });
  /** The list price, struck through, only when the line is discounted. */
  readonly listAmount = computed<Decimal | number | null>(() => {
    const item = this.item();
    if (isCommerceLine(item)) {
      if ('unit_price' in item.money) {
        return item.money.unit_discount_price ? item.money.unit_price : null;
      }
      return hasAmount(item.money.discount_amount) ? item.money.price_before_discount : null;
    }
    return item.base_price > 0 ? item.base_price : null;
  });

  /** Actual amount paid for this line — present on order-history items only; null for cart items. */
  readonly paidAmount = computed<number | null>(() => {
    const item = this.item();
    return 'paid_amount' in item ? item.paid_amount : null;
  });
  readonly title = computed(() => {
    const item = this.item();
    return isCommerceLine(item) ? item.title : item.item_details.subscription_name;
  });
  readonly description = computed(() => {
    const item = this.item();
    return isCommerceLine(item) ? item.description : item.item_details.description;
  });

  readonly icons = { delete: matDeleteOutline, edit: matEditOutline };

  // Outputs
  removeItem = output<string>();
  editItem = output<string>();

  onDelete(): void {
    this.removeItem.emit(String(this.item().id));
  }

  onEdit(): void {
    this.editItem.emit(String(this.item().id));
  }

  thumbnail = computed(() => {
    const item = this.item();
    const fallback = this.S3_BUCKET_URL + 'static-assests/web-app/payment/cart-subscription.webp';
    return (isCommerceLine(item) && item.image_url) || fallback;
  });

  S3_BUCKET_URL = environment.S3_BUCKET_URL;
}
