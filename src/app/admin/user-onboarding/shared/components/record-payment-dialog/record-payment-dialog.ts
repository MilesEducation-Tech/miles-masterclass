import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { AriaInput } from '@shared/components/ui/aria/aria-input/aria-input';
import { Button } from '@shared/components/ui/button/button';
import { DialogRef } from '@core/services/dialog/dialog';

export interface RecordPaymentDialogData {
  userEmail: string;
  /**
   * Already subscribed (auto-subscribe code): an invoice attaches to the
   * existing transaction and a comment is just recorded. Otherwise this
   * proof IS the payment and a subscription is granted now.
   */
  isSubscribed: boolean;
}

/** Server rule mirrored client-side so the 400 never has to fire. */
const ACCEPTED_TYPES: readonly string[] = ['application/pdf', 'image/png', 'image/jpeg'];
export const MAX_INVOICE_BYTES = 10 * 1024 * 1024;

export interface RecordPaymentDialogResult {
  /** Null when the admin recorded the payment with a comment instead. */
  file: File | null;
  /** Trimmed; empty string when only a file was provided. */
  comment: string;
}

/**
 * Collects proof of an offline payment: an invoice file, a free-text comment,
 * or both. **At least one is required** — an admin who has no invoice to hand
 * (bank transfer, cheque, a payment settled out of band) records why instead,
 * so the activation is never untraceable.
 *
 * Pure UI — returns what was captured; the list page performs the multipart
 * upload via the facade. `data` / `dialogRef` are property-injected by the
 * Dialog service.
 */
@Component({
  selector: 'app-record-payment-dialog',
  imports: [Button, AriaInput],
  templateUrl: './record-payment-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordPaymentDialog {
  dialogRef!: DialogRef<RecordPaymentDialog, RecordPaymentDialogResult | undefined>;
  data!: RecordPaymentDialogData;

  protected readonly file = signal<File | null>(null);
  protected readonly comment = signal('');

  protected readonly isSubscribed = computed(() => this.data?.isSubscribed === true);

  /** `.pdf/.png/.jpg/.jpeg`, max 10 MB — the same limits the backend enforces. */
  protected readonly fileError = computed<string | null>(() => {
    const f = this.file();
    if (!f) return null;
    if (!ACCEPTED_TYPES.includes(f.type))
      return 'Only .pdf, .png, .jpg or .jpeg files are accepted.';
    if (f.size > MAX_INVOICE_BYTES) return 'The invoice must be 10 MB or smaller.';
    return null;
  });

  /**
   * EXACTLY one of the two: the API rejects both together as well as neither.
   * The invoice is the proof when there is one; the comment is the written
   * justification when there isn't.
   */
  protected readonly hasBoth = computed(() => !!this.file() && this.comment().trim().length > 0);
  protected readonly canSubmit = computed(
    () =>
      (!!this.file() || this.comment().trim().length > 0) && !this.hasBoth() && !this.fileError(),
  );

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.[0] ?? null);
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected submit(): void {
    if (!this.canSubmit()) return;
    this.dialogRef.close({ file: this.file(), comment: this.comment().trim() });
  }
}
