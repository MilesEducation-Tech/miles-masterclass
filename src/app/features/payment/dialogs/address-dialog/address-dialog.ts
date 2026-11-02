import { Component, inject } from '@angular/core';
import { injectDialogRef } from 'ng-primitives/dialog';

import { Button } from '@shared/ui/button/button';
import { Dialog } from '@shared/ui/dialog/dialog';
import { BillingAddress } from '@features/payment/components/billing-address/billing-address';
import { PaymentFacade } from '@features/payment/services/payment-facade';

/**
 * The learner's billing addresses: pick one, add one, or edit one. The address is optional;
 * the pick lives in `PaymentFacade.selectedAddressId`. Done, or a successful save, closes with
 * the picked id; the X, Escape and the backdrop close with nothing, so a caller can tell a
 * choice from a dismissal.
 */
@Component({
  selector: 'app-address-dialog',
  imports: [Button, Dialog, BillingAddress],
  templateUrl: './address-dialog.html',
})
export class AddressDialog {
  private readonly dialogRef = injectDialogRef<void, string | null>();
  private readonly facade = inject(PaymentFacade);

  /** The form is open: its own Save and Cancel decide, so Done would only drop what was typed. */
  protected readonly editing = this.facade.isEditingAddress;

  protected dismiss(): void {
    this.dialogRef.close();
  }

  protected done(): void {
    this.dialogRef.close(this.facade.selectedAddressId());
  }
}
