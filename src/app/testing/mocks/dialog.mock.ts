import { Provider } from '@angular/core';
import { NgpDialogRef } from 'ng-primitives/dialog';
// why: the only export of the exit-animation provider. `NgpDialogManager` supplies it to a real
// dialog's injector; a story renders the dialog component directly, so it has to be provided here.
// Story-only code, so an internal import can't reach a shipped bundle.
import { provideExitAnimationManager } from 'ng-primitives/internal';

/**
 * Provides what a dialog built on ng-primitives needs when a story renders it directly, outside
 * `NgpDialogManager`:
 *
 *  - the `NgpDialogRef` that `injectDialogRef()` resolves — `data`, a no-op `close`, and an empty
 *    `config`, which the overlay reads (`closeOnClick`) as it is created;
 *  - the exit-animation manager the overlay injects.
 *
 * Without either, every story whose dialog wraps `app-dialog` fails with NG0201.
 */
export function provideStoryDialogRef<T>(data?: T): Provider[] {
  return [
    provideExitAnimationManager(),
    { provide: NgpDialogRef, useValue: { data, close: () => undefined, config: {} } },
  ];
}
