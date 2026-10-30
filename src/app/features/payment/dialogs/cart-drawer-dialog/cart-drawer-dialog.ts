import { Component, computed, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { injectDialogRef } from 'ng-primitives/dialog';

import { Utils } from '@shared/services/utils';
import { PaymentFacade } from '@features/payment/services/payment-facade';
import { CartStore } from '@core/services/cart/cart-store';
import { CartItem } from '@features/payment/components/cart-item/cart-item';
import { Button } from '@shared/ui/button/button';
import { Dialog } from '@shared/ui/dialog/dialog';

@Component({
  selector: 'app-cart-drawer-dialog',
  imports: [CartItem, Button, CurrencyPipe, Dialog],
  templateUrl: './cart-drawer-dialog.html',
})
export class CartDrawerDialog {
  private readonly dialogRef = injectDialogRef();

  private readonly facade = inject(PaymentFacade);
  private readonly cartStore = inject(CartStore);
  private readonly router = inject(Router);
  private readonly utils = inject(Utils);

  readonly cart = this.cartStore.cart;
  readonly lines = computed(() => this.cart()?.lines ?? []);

  constructor() {
    // The drawer opens from any page (after an add, or from the header), so it asks for the cart itself.
    this.cartStore.load();
  }

  close(): void {
    this.dialogRef.close();
  }

  proceedToCart(): void {
    this.dialogRef.close();
    this.router.navigate(['/', this.utils.country(), this.utils.profession(), 'payment', 'cart']);
  }

  removeLine(lineId: string): void {
    this.facade.removeLine(lineId);
  }
}
