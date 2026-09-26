import { Component, Provider, Type, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NgpDialogRef } from 'ng-primitives/dialog';
import { vi } from 'vitest';
import { DialogShell } from '@shared/ui/dialog-shell/dialog-shell';

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
 * Stands in for `<app-dialog-shell>` in a dialog's component spec: same selector and
 * inputs, projects its content, no ng-primitives overlay. A dialog spec tests the
 * dialog; the frame itself is covered by `dialog-shell.spec.ts` against the real manager.
 */
@Component({ selector: 'app-dialog-shell', template: '<ng-content />' })
export class DialogShellStub {
  readonly ariaLabel = input<string>();
  readonly width = input<string>();
  readonly maxWidth = input<string>();
  readonly height = input<string>();
  readonly position = input<string>();
  readonly panelClass = input<string>();
  readonly dismissible = input<boolean>();
}

/** Swap the real shell for `DialogShellStub` in `dialog`'s imports. Call before `createComponent`. */
export function stubDialogShell(dialog: Type<unknown>): void {
  TestBed.overrideComponent(dialog, {
    remove: { imports: [DialogShell] },
    add: { imports: [DialogShellStub] },
  });
}
