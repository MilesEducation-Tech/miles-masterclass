import { Provider } from '@angular/core';
import { NgpDialogRef } from 'ng-primitives/dialog';

/**
 * Provides the `NgpDialogRef` that `injectDialogRef()` resolves inside a dialog built on
 * ng-primitives, for stories.
 */
export function provideStoryDialogRef<T>(data?: T): Provider {
  return { provide: NgpDialogRef, useValue: { data, close: () => undefined } };
}
