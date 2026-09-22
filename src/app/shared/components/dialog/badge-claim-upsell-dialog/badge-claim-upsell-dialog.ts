import { Component, computed, signal } from '@angular/core';
import { Button } from '../../ui/button/button';
import { DialogRef } from '@core/services/dialog/dialog';
import { BadgeItem } from '@core/models/cpe-tracker.model';
import { badgeHaloHex } from '../../../utils/badge-level';

export interface BadgeClaimUpsellDialogData {
  badge: BadgeItem;
}

export type BadgeClaimUpsellAction = 'confirm' | 'close';

export interface BadgeClaimUpsellDialogResult {
  action: BadgeClaimUpsellAction;
  result: boolean;
}

@Component({
  selector: 'app-badge-claim-upsell-dialog',
  imports: [Button],
  templateUrl: './badge-claim-upsell-dialog.html',
  styleUrl: './badge-claim-upsell-dialog.css',
})
export class BadgeClaimUpsellDialog {
  dialogRef!: DialogRef<BadgeClaimUpsellDialog, BadgeClaimUpsellDialogResult>;

  private readonly _data = signal<BadgeClaimUpsellDialogData | null>(null);

  set data(value: BadgeClaimUpsellDialogData) {
    this._data.set(value);
  }

  protected readonly badge = computed(() => this._data()?.badge ?? null);
  protected readonly badgeName = computed(() => this.badge()?.name.split(' — ')[0] ?? '');
  protected readonly haloHex = computed(() => badgeHaloHex(this.badge()?.level_rank));

  protected onClose(): void {
    this.dialogRef.close({ action: 'close', result: false });
  }

  protected onConfirm(): void {
    this.dialogRef.close({ action: 'confirm', result: true });
  }
}
