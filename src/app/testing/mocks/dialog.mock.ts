import { Provider } from '@angular/core';
import { NgpDialogRef } from 'ng-primitives/dialog';

/**
 * Provides the `NgpDialogRef` that `injectDialogRef()` resolves inside a dialog built on
 * ng-primitives, for stories. No vitest here (stories bundle this file); specs that need
 * a spy on `close` use `provideMockDialogRef` from `dialog-ref.mock.ts`.
 */
export function provideStoryDialogRef<T>(data?: T): Provider {
  return { provide: NgpDialogRef, useValue: { data, close: () => undefined } };
}
