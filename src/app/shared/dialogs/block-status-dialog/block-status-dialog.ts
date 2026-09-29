import { Component, computed, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroShieldExclamation, heroShieldCheck, heroXMark } from '@ng-icons/heroicons/outline';
import { injectDialogRef } from 'ng-primitives/dialog';

import { Button } from '../../ui/button/button';

import { Dialog } from '@shared/ui/dialog/dialog';
import { Field } from '@shared/ui/field/field';
import { NgpLabel } from 'ng-primitives/form-field';
import { Textarea } from '@shared/ui/textarea/textarea';

export interface BlockStatusDialogData {
  /** What action the admin is about to take. */
  action: 'block' | 'unblock';
  /** Display only — the user being acted on. */
  userName: string;
  userEmail: string;
}

export interface BlockStatusDialogResult {
  confirmed: boolean;
  reason: string;
}

@Component({
  selector: 'app-block-status-dialog',
  imports: [Button, NgIcon, Dialog, Field, NgpLabel, Textarea],
  providers: [provideIcons({ heroShieldExclamation, heroShieldCheck, heroXMark })],
  templateUrl: './block-status-dialog.html',
  host: { class: 'block' },
})
export class BlockStatusDialog {
  private readonly dialogRef = injectDialogRef<BlockStatusDialogData, BlockStatusDialogResult>();
  protected readonly data = this.dialogRef.data;

  protected readonly reason = signal('');
  protected readonly submitting = signal(false);

  protected readonly isBlock = computed(() => this.data?.action === 'block');

  protected readonly canConfirm = computed(() => {
    if (this.submitting()) return false;
    // Reason required for block; optional for unblock.
    if (this.isBlock()) return this.reason().trim().length > 0;
    return true;
  });

  cancel(): void {
    this.dialogRef.close({ confirmed: false, reason: '' });
  }

  confirm(): void {
    if (!this.canConfirm()) return;
    this.submitting.set(true);
    this.dialogRef.close({ confirmed: true, reason: this.reason().trim() });
  }
}
