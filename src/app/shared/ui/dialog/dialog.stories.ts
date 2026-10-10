import { Component, inject, input } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';
import { NgpDialogManager, injectDialogRef } from 'ng-primitives/dialog';
import { Button } from '../button/button';
import { Dialog, DialogPosition } from './dialog';

/** A dialog as the app writes one: its template wrapped in `<app-dialog>`. */
@Component({
  imports: [Dialog, Button],
  template: `
    <app-dialog
      header="Example dialog"
      description="Tab stays inside. Escape and the backdrop close it unless it is not dismissible."
      [position]="ref.data.position"
      [dismissible]="ref.data.dismissible"
    >
      <p class="mt-4 text-sm">Any content goes here.</p>
      <div class="mt-6 flex justify-end gap-2">
        <button app-button type="button" variant="ghost" (click)="ref.close()">Cancel</button>
        <button app-button type="button" (click)="ref.close('confirmed')">Confirm</button>
      </div>
    </app-dialog>
  `,
})
class ExampleDialog {
  protected readonly ref = injectDialogRef<{ position: DialogPosition; dismissible: boolean }>();
}

/** Stories can't call `NgpDialogManager.open()` from args, so a button opens the dialog. */
@Component({
  selector: 'app-dialog-demo',
  imports: [Button],
  template: `<button app-button type="button" (click)="open()">Open dialog</button>`,
})
class DialogDemo {
  private readonly dialogs = inject(NgpDialogManager);
  readonly position = input<DialogPosition>('center');
  readonly dismissible = input(true);

  open(): void {
    this.dialogs.open(ExampleDialog, {
      data: { position: this.position(), dismissible: this.dismissible() },
    });
  }
}

const meta: Meta<DialogDemo> = {
  title: 'UI/Dialog',
  component: DialogDemo,
  tags: ['autodocs'],
  argTypes: {
    position: { control: 'select', options: ['center', 'right'] },
    dismissible: { control: 'boolean' },
  },
  args: { position: 'center', dismissible: true },
};

export default meta;
type Story = StoryObj<DialogDemo>;

export const Centered: Story = {};

export const RightDrawer: Story = {
  args: { position: 'right' },
};

export const NotDismissible: Story = {
  args: { dismissible: false },
};
