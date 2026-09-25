import { Component, inject, input } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';
import { NgpDialogManager, injectDialogRef } from 'ng-primitives/dialog';
import { Button } from '../button/button';
import { DialogShell } from './dialog-shell';

/** A dialog as the app writes one: its template wrapped in `<app-dialog-shell>`. */
@Component({
  imports: [DialogShell, Button],
  template: `
    <app-dialog-shell
      ariaLabel="Example dialog"
      maxWidth="420px"
      [position]="ref.data.position"
      [dismissible]="ref.data.dismissible"
    >
      <div class="flex flex-col gap-4 p-6">
        <h2 class="text-lg font-semibold">Example dialog</h2>
        <p class="text-sm text-muted-foreground">
          Tab stays inside. Escape and the backdrop close it unless it is not dismissible.
        </p>
        <app-button (clicked)="ref.close()">Close</app-button>
      </div>
    </app-dialog-shell>
  `,
})
class ExampleDialog {
  protected readonly ref = injectDialogRef<{
    position: 'center' | 'right';
    dismissible: boolean;
  }>();
}

/** Stories can't call `NgpDialogManager.open()` from args, so a button opens the dialog. */
@Component({
  selector: 'app-dialog-shell-demo',
  imports: [Button],
  template: `<app-button (clicked)="open()">Open dialog</app-button>`,
})
class DialogShellDemo {
  private readonly dialogs = inject(NgpDialogManager);
  readonly position = input<'center' | 'right'>('center');
  readonly dismissible = input(true);

  open(): void {
    this.dialogs.open(ExampleDialog, {
      data: { position: this.position(), dismissible: this.dismissible() },
    });
  }
}

const meta: Meta<DialogShellDemo> = {
  title: 'UI/DialogShell',
  component: DialogShellDemo,
  tags: ['autodocs'],
  argTypes: {
    position: { control: 'select', options: ['center', 'right'] },
    dismissible: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<DialogShellDemo>;

export const Centered: Story = { args: { position: 'center', dismissible: true } };

export const Drawer: Story = { args: { position: 'right', dismissible: true } };

/** The old `disableClose: true`: only the Close button dismisses it. */
export const NotDismissible: Story = { args: { position: 'center', dismissible: false } };
