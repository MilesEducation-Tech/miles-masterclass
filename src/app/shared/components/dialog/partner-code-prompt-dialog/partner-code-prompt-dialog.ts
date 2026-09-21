import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField as AngularFormField, disabled, form, required } from '@angular/forms/signals';
import { DialogRef } from '../../../core/services/dialog/dialog';
import { PartnerCode } from '../../../core/services/partner-code/partner-code';
import { Button } from '../../ui/button/button';
import { AriaInput } from '../../ui/aria/aria-input/aria-input';
import { Forms } from '../../ui/forms/forms';

/**
 * Result emitted on dialog close:
 * - `subscribe` — user picked the primary CTA; caller should add to cart.
 * - `partner-code-applied` — user successfully applied a partner code;
 *   typically no further action needed (toast + profile refresh handled in
 *   the service).
 * - `closed` — user dismissed without choosing.
 */
export type PartnerCodePromptAction = 'subscribe' | 'partner-code-applied' | 'closed';

export interface PartnerCodePromptResult {
  action: PartnerCodePromptAction;
}

export interface PartnerCodePromptData {
  /**
   * Hide the "Continue to subscribe" CTA and show only the code entry. Used
   * where subscribing is already its own button on the page (the plan page),
   * so the dialog isn't asking a question the user has answered by choosing
   * which button to press. Defaults to showing it.
   */
  codeOnly?: boolean;
}

@Component({
  selector: 'app-partner-code-prompt-dialog',
  imports: [Button, AriaInput, Forms, AngularFormField],
  templateUrl: './partner-code-prompt-dialog.html',
  styleUrl: './partner-code-prompt-dialog.css',
})
export class PartnerCodePromptDialog {
  dialogRef!: DialogRef<PartnerCodePromptDialog, PartnerCodePromptResult>;
  /** Optional — assigned post-construction by the dialog service. */
  data?: PartnerCodePromptData;

  private readonly partnerCode = inject(PartnerCode);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = this.partnerCode.loading;

  readonly model = signal<{ partner_code: string }>({ partner_code: '' });

  readonly partnerCodeForm = form(this.model, (s) => {
    required(s.partner_code, { message: 'Partner code is required' });
    disabled(s.partner_code, { when: () => this.loading() });
  });

  readonly canSubmit = computed(
    () => this.model().partner_code.trim().length > 0 && !this.loading(),
  );

  /**
   * Plain getter, not a computed: `data` is assigned after construction, so a
   * computed would capture the pre-assignment `undefined`.
   */
  protected get showSubscribe(): boolean {
    return !this.data?.codeOnly;
  }

  close(): void {
    this.dialogRef.close({ action: 'closed' });
  }

  continueToSubscribe(): void {
    this.dialogRef.close({ action: 'subscribe' });
  }

  applyCode(): void {
    if (!this.canSubmit()) return;
    this.partnerCode
      .apply(this.model().partner_code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) this.dialogRef.close({ action: 'partner-code-applied' });
      });
  }
}
