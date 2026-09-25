import { Provider } from '@angular/core';
import { NgpDialogRef } from 'ng-primitives/dialog';
import { vi } from 'vitest';

/**
 * Provides the `NgpDialogRef` that `injectDialogRef()` resolves inside a dialog built on
 * ng-primitives. `close` is a spy and `data` is what the dialog was opened with.
 * Specs only — it imports vitest, so stories keep using `MockDialogRef`.
 */
export function provideMockDialogRef<T>(data?: T): Provider {
  return {
    provide: NgpDialogRef,
    useValue: { data, close: vi.fn(), disableClose: false } as Partial<NgpDialogRef<T>>,
  };
}
