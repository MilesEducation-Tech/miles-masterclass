import { Component, computed, inject, input, output } from '@angular/core';
import { CurrencyPipe, NgOptimizedImage } from '@angular/common';
import { CartLine, Decimal, hasAmount } from '@core/models/commerce.model';
import { OrderLine } from '@features/payment/models/commerce.model';
import { environment } from '@env/environment';
import { NgIcon } from '@ng-icons/core';
import { matDeleteOutline, matEditOutline } from '@ng-icons/material-icons/outline';
import { Button } from '@shared/ui/button/button';
import { RouterLink } from '@angular/router';
import { Utils } from '@shared/services/utils';

/** A CAIRA cart line or order line: both carry their own title, image and `money`. */
export type CartDisplayItem = CartLine | OrderLine;

export interface CartItemConfig {
  showThumbnail?: boolean;
  showEdit?: boolean;
  showDelete?: boolean;
  /** When true, price and actions render below the item details instead of beside */
  stacked?: boolean;
}

const DEFAULT_CONFIG: Required<CartItemConfig> = {
  showThumbnail: true,
  showEdit: false,
  showDelete: true,
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
  readonly stacked = computed(() => this.config().stacked ?? DEFAULT_CONFIG.stacked);

  /** What the line costs: CAIRA's `final_amount` (after discounts and tax). */
  readonly amount = computed<Decimal>(() => this.item().money.final_amount);
  /** The list price, struck through, only when the line is discounted. */
  readonly listAmount = computed<Decimal | null>(() => {
    const { money } = this.item();
    if ('unit_price' in money) return money.unit_discount_price ? money.unit_price : null;
    return hasAmount(money.discount_amount) ? money.price_before_discount : null;
  });

  readonly icons = { delete: matDeleteOutline, edit: matEditOutline };

  // Outputs
  removeItem = output<string>();
  editItem = output<string>();

  onDelete(): void {
    this.removeItem.emit(this.item().id);
  }

  onEdit(): void {
    this.editItem.emit(this.item().id);
  }

  thumbnail = computed(
    () =>
      this.item().image_url ||
      this.S3_BUCKET_URL + 'static-assests/web-app/payment/cart-subscription.webp',
  );

  S3_BUCKET_URL = environment.ASSETS.s3Url;
}
