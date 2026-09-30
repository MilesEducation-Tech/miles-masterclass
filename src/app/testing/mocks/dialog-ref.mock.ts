import { Component, Provider, Type, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NgpDialogRef } from 'ng-primitives/dialog';
import { vi } from 'vitest';
import { Dialog } from '@shared/ui/dialog/dialog';

/**
 * Provides the `NgpDialogRef` that `injectDialogRef()` resolves inside a dialog built on
 * ng-primitives. `close` is a spy and `data` is what the dialog was opened with.
 * Specs only — it imports vitest, so stories use `provideStoryDialogRef` instead.
 */
export function provideMockDialogRef<T>(data?: T): Provider {
  return {
    provide: NgpDialogRef,
    useValue: { data, close: vi.fn(), disableClose: false } as Partial<NgpDialogRef<T>>,
  };
}

/**
 * Stands in for `<app-dialog>` in a dialog's component spec: same selector and inputs, projects
 * its content, no ng-primitives overlay. A dialog spec tests the dialog; the frame itself is
 * covered by `dialog.spec.ts` against the real manager.
 */
@Component({ selector: 'app-dialog', template: '<ng-content />' })
export class DialogStub {
  readonly header = input<string>();
  readonly description = input<string>();
  readonly ariaLabel = input<string>();
  readonly position = input<string>();
  readonly panelClass = input<string>();
  readonly dismissible = input<boolean>();
  readonly closable = input<boolean>();
  readonly width = input<string>();
  readonly maxWidth = input<string>();
}

/** Swap the real frame for `DialogStub` in `dialog`'s imports. Call before `createComponent`. */
export function stubDialog(dialog: Type<unknown>): void {
  TestBed.overrideComponent(dialog, {
    remove: { imports: [Dialog] },
    add: { imports: [DialogStub] },
  });
}
