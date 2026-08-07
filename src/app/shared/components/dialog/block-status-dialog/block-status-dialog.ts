import { Component, computed, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroShieldExclamation, heroShieldCheck } from '@ng-icons/heroicons/outline';
import { DialogRef } from '../../../core/services/dialog/dialog';
import { Button } from '../../ui/button/button';
import { AriaInput } from '../../ui/aria/aria-input/aria-input';

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
  imports: [Button, AriaInput, NgIcon],
  providers: [provideIcons({ heroShieldExclamation, heroShieldCheck })],
  templateUrl: './block-status-dialog.html',
  styleUrl: './block-status-dialog.css',
})
export class BlockStatusDialog {
  dialogRef!: DialogRef<BlockStatusDialog, BlockStatusDialogResult>;
  data!: BlockStatusDialogData;

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
