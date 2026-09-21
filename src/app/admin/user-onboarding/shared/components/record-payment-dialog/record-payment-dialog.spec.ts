// The component's transitive imports pull in @angular/common, whose partially
// compiled injectables need the JIT compiler present in the test env.
import '@angular/compiler';

import { describe, expect, it, vi } from 'vitest';

import {
  MAX_INVOICE_BYTES,
  RecordPaymentDialog,
  RecordPaymentDialogResult,
} from './record-payment-dialog';

/**
 * Pins the either-or rule: an offline payment needs an invoice file **or** a
 * comment, never neither. If this regresses, an admin can activate a paid
 * subscription leaving no record of why — which is exactly what the comment
 * field exists to prevent.
 *
 * No TestBed: the component injects nothing (`data` / `dialogRef` are
 * property-injected by the Dialog service), so a plain `new` is enough.
 */
function makeDialog() {
  const dialog = new RecordPaymentDialog() as unknown as {
    file: { set(v: File | null): void };
    comment: { set(v: string): void };
    canSubmit(): boolean;
    submit(): void;
    dialogRef: { close: ReturnType<typeof vi.fn> };
    data: { userEmail: string; isSubscribed: boolean };
  };
  dialog.dialogRef = { close: vi.fn() };
  dialog.data = { userEmail: 'someone@example.com', isSubscribed: false };
  return dialog;
}

const invoice = () => new File(['x'], 'invoice.pdf', { type: 'application/pdf' });
const closedWith = (d: ReturnType<typeof makeDialog>) =>
  d.dialogRef.close.mock.calls[0]?.[0] as RecordPaymentDialogResult | undefined;

describe('RecordPaymentDialog — invoice or comment', () => {
  it('blocks submit when neither is provided', () => {
    const d = makeDialog();
    expect(d.canSubmit()).toBe(false);

    d.submit();
    expect(d.dialogRef.close).not.toHaveBeenCalled();
  });

  it('treats a whitespace-only comment as no comment', () => {
    const d = makeDialog();
    d.comment.set('   \n  ');
    expect(d.canSubmit()).toBe(false);

    d.submit();
    expect(d.dialogRef.close).not.toHaveBeenCalled();
  });

  it('accepts a file alone', () => {
    const d = makeDialog();
    d.file.set(invoice());
    expect(d.canSubmit()).toBe(true);

    d.submit();
    expect(closedWith(d)).toMatchObject({ comment: '' });
    expect(closedWith(d)?.file?.name).toBe('invoice.pdf');
  });

  it('accepts a comment alone, trimmed, with no file', () => {
    const d = makeDialog();
    d.comment.set('  Paid by bank transfer, ref TXN-8842.  ');
    expect(d.canSubmit()).toBe(true);

    d.submit();
    expect(closedWith(d)).toEqual({
      file: null,
      comment: 'Paid by bank transfer, ref TXN-8842.',
    });
  });

  it('rejects both together — the API wants exactly one proof', () => {
    const d = makeDialog();
    d.file.set(invoice());
    d.comment.set('Partial payment.');
    expect(d.canSubmit()).toBe(false);

    d.submit();
    expect(d.dialogRef.close).not.toHaveBeenCalled();
  });

  it('rejects a file type the backend would 400', () => {
    const d = makeDialog();
    d.file.set(new File(['x'], 'invoice.exe', { type: 'application/octet-stream' }));
    expect(d.canSubmit()).toBe(false);
  });

  it('rejects an invoice over 10 MB', () => {
    const d = makeDialog();
    d.file.set(
      new File([new Uint8Array(MAX_INVOICE_BYTES + 1)], 'big.pdf', { type: 'application/pdf' }),
    );
    expect(d.canSubmit()).toBe(false);
  });
});
