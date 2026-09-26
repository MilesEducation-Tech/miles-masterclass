// The component's transitive imports pull in @angular/common, whose partially
// compiled injectables need the JIT compiler present in the test env.
import '@angular/compiler';

import { TestBed } from '@angular/core/testing';
import { NgpDialogRef } from 'ng-primitives/dialog';
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
 * No rendering: the only thing the component injects is its dialog ref, so it is
 * constructed in an injection context with a stub ref rather than through a fixture.
 */
function makeDialog() {
  const dialogRef = {
    close: vi.fn(),
    data: { userEmail: 'someone@example.com', isSubscribed: false },
  };
  TestBed.configureTestingModule({ providers: [{ provide: NgpDialogRef, useValue: dialogRef }] });
  return TestBed.runInInjectionContext(() => new RecordPaymentDialog()) as unknown as {
    file: { set(v: File | null): void };
    comment: { set(v: string): void };
    canSubmit(): boolean;
    submit(): void;
    dialogRef: typeof dialogRef;
  };
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
