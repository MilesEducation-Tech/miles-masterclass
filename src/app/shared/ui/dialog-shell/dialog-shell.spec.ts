import { ApplicationRef, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NgpDialogManager, injectDialogRef } from 'ng-primitives/dialog';

import { DialogShell } from './dialog-shell';

@Component({
  imports: [DialogShell],
  template: `
    <app-dialog-shell ariaLabel="Test dialog" maxWidth="480px" [dismissible]="dismissible()">
      <p>{{ ref.data }}</p>
      <button type="button" (click)="ref.close('done')">Done</button>
    </app-dialog-shell>
  `,
})
class TestDialog {
  readonly ref = injectDialogRef<string, string>();
  readonly dismissible = input(true);
}

@Component({
  imports: [DialogShell],
  template: `<app-dialog-shell [dismissible]="false"
    ><button type="button">Stay</button></app-dialog-shell
  >`,
})
class LockedDialog {}

describe('DialogShell', () => {
  let dialogs: NgpDialogManager;

  const panel = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
  const overlay = () => document.body.querySelector<HTMLElement>('[ngpDialogOverlay]');
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    TestBed.inject(ApplicationRef).tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  function pointerClick(el: HTMLElement): void {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  beforeEach(() => {
    dialogs = TestBed.inject(NgpDialogManager);
  });

  afterEach(async () => {
    dialogs.closeAll();
    await settle();
  });

  it('renders a labelled modal panel with the dialog data and the given size', async () => {
    dialogs.open(TestDialog, { data: 'Hello' });
    await settle();

    expect(panel()).not.toBeNull();
    expect(panel()!.getAttribute('aria-modal')).toBe('true');
    expect(panel()!.getAttribute('aria-label')).toBe('Test dialog');
    expect(panel()!.style.maxWidth).toBe('480px');
    expect(panel()!.textContent).toContain('Hello');
  });

  it('moves focus into the dialog and hands it back to the opener on close', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const ref = dialogs.open<string, string>(TestDialog, { data: 'x' });
    await settle();
    expect(panel()!.contains(document.activeElement)).toBe(true);

    await ref.close();
    await settle();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('closes with a result, which afterClosed delivers', async () => {
    const ref = dialogs.open<string, string>(TestDialog, { data: 'x' });
    const results: (string | undefined)[] = [];
    ref.afterClosed.subscribe((r) => results.push(r));
    await settle();

    panel()!.querySelector('button')!.click();
    await settle();
    expect(results).toEqual(['done']);
  });

  it('a backdrop click and Escape close a dismissible dialog', async () => {
    dialogs.open(TestDialog, { data: 'x' });
    await settle();
    pointerClick(overlay()!);
    await settle();
    expect(panel()).toBeNull();

    dialogs.open(TestDialog, { data: 'x' });
    await settle();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(panel()).toBeNull();
  });

  it('dismissible=false ignores the backdrop and Escape (the old disableClose)', async () => {
    dialogs.open(LockedDialog);
    await settle();

    pointerClick(overlay()!);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(panel()).not.toBeNull();
  });
});
