import { ApplicationRef, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NgpDialogManager, injectDialogRef } from 'ng-primitives/dialog';

import { Dialog } from './dialog';

@Component({
  imports: [Dialog],
  template: `
    <app-dialog
      header="Test dialog"
      description="A short description"
      [dismissible]="dismissible()"
    >
      <p>{{ ref.data }}</p>
      <button type="button" (click)="ref.close('done')">Done</button>
    </app-dialog>
  `,
})
class TestDialog {
  readonly ref = injectDialogRef<string, string>();
  readonly dismissible = input(true);
}

@Component({
  imports: [Dialog],
  template: `
    <app-dialog ariaLabel="Locked dialog" position="right" [dismissible]="false">
      <button type="button">Stay</button>
    </app-dialog>
  `,
})
class LockedDialog {}

describe('Dialog', () => {
  let dialogs: NgpDialogManager;

  const panel = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
  const overlay = () => document.body.querySelector<HTMLElement>('app-dialog');
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

  it('renders a modal panel named by its header and described by its description', async () => {
    dialogs.open(TestDialog, { data: 'Hello' });
    await settle();

    const dialog = panel()!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const title = document.getElementById(dialog.getAttribute('aria-labelledby')!);
    expect(title?.textContent?.trim()).toBe('Test dialog');
    const description = document.getElementById(dialog.getAttribute('aria-describedby')!);
    expect(description?.textContent?.trim()).toBe('A short description');
    expect(dialog.textContent).toContain('Hello');
  });

  it('falls back to ariaLabel when a dialog draws its own heading', async () => {
    dialogs.open(LockedDialog);
    await settle();

    expect(panel()!.getAttribute('aria-label')).toBe('Locked dialog');
    expect(panel()!.getAttribute('aria-labelledby')).toBeNull();
    expect(overlay()!.className).toContain('justify-end');
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

  it('dismissible=false ignores the backdrop and Escape', async () => {
    dialogs.open(LockedDialog);
    await settle();

    pointerClick(overlay()!);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(panel()).not.toBeNull();
  });
});
