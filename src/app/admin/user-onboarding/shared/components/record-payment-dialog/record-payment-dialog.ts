import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { Button } from '../../../../../shared/components/ui/button/button';
import { DialogRef } from '../../../../../shared/core/services/dialog/dialog';

export interface RecordPaymentDialogData {
  userEmail: string;
}

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
  imports: [Button],
  templateUrl: './record-payment-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordPaymentDialog {
  dialogRef!: DialogRef<RecordPaymentDialog, RecordPaymentDialogResult | undefined>;
  data!: RecordPaymentDialogData;

  protected readonly file = signal<File | null>(null);
  protected readonly comment = signal('');

  /**
   * EXACTLY one of the two: the API rejects both together as well as neither.
   * The invoice is the proof when there is one; the comment is the written
   * justification when there isn't.
   */
  protected readonly hasBoth = computed(() => !!this.file() && this.comment().trim().length > 0);
  protected readonly canSubmit = computed(
    () => (!!this.file() || this.comment().trim().length > 0) && !this.hasBoth(),
  );

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.[0] ?? null);
  }

  protected onCommentInput(event: Event): void {
    this.comment.set((event.target as HTMLTextAreaElement).value);
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected submit(): void {
    if (!this.canSubmit()) return;
    this.dialogRef.close({ file: this.file(), comment: this.comment().trim() });
  }
}
