import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { DialogRef } from '../../../core/services/dialog/dialog';
import { Utils } from '../../../core/services/utils/utils';
import { CartItem } from '../../../../features/payment/shared/components/cart-item/cart-item';
import { Button } from '../../ui/button/button';

@Component({
  selector: 'app-cart-drawer-dialog',
  imports: [CartItem, Button, CurrencyPipe],
  templateUrl: './cart-drawer-dialog.html',
  styleUrl: './cart-drawer-dialog.css',
})
export class CartDrawerDialog {
  dialogRef!: DialogRef<CartDrawerDialog>;

  // ponytail: PaymentFacade was deleted with the Django strip. This placeholder

  // keeps the template bindings compiling and renders the empty state.

  // Swap in the new backend's service — the template needs no changes.

  private readonly facade: any = {

    cartData: signal<any>(null),

    loading: signal<any>(null),

    removeCartItem: (..._args: any[]): any => null,

  };
  private readonly router = inject(Router);
  private readonly utils = inject(Utils);

  readonly cartData = computed(() => this.facade.cartData());
  readonly cartItems = computed(() => this.cartData()?.cartitem_data ?? []);
  readonly currencyCode = computed(() => this.cartData()?.selected_country?.currency ?? 'USD');
  readonly totalAmount = computed(() => this.cartData()?.total_amount ?? 0);
  readonly loading = computed(() => this.facade.loading());

  // Monthly (EMI): show the monthly payable alongside the annual total when any
  // item was added with pay_method 'monthly'. Derived as total ÷ 12.
  readonly hasMonthly = computed(() => this.cartItems().some((i: any) => i.pay_method === 'monthly'));
  readonly monthlyAmount = computed(() => this.totalAmount() / 12);

  close(): void {
    this.dialogRef.close();
  }

  proceedToCart(): void {
    this.dialogRef.close();
    this.router.navigate(['/', this.utils.country(), this.utils.profession(), 'payment', 'cart']);
  }

  removeItem(itemId?: number): void {
    if (!itemId) return;
    this.facade.removeCartItem(itemId);
  }
}
