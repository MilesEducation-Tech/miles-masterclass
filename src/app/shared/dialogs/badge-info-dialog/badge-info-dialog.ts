import { Component, computed, signal } from '@angular/core';
import { DialogRef } from '@core/services/dialog/dialog';
import { BadgeItem } from '@core/models/cpe-tracker.model';
import { BadgeHeroCard } from '../../components/cards/badge-hero-card/badge-hero-card';
import { Button } from '../../ui/button/button';

export interface BadgeInfoDialogData {
  badges: BadgeItem[];
}

export type BadgeInfoAction = 'claim' | 'share' | 'close';

export interface BadgeInfoDialogResult {
  action: BadgeInfoAction;
  result: boolean;
  data?: BadgeItem;
}

@Component({
  selector: 'app-badge-info-dialog',
  imports: [BadgeHeroCard, Button],
  templateUrl: './badge-info-dialog.html',
  styleUrl: './badge-info-dialog.css',
})
export class BadgeInfoDialog {
  dialogRef!: DialogRef<BadgeInfoDialog, BadgeInfoDialogResult>;

  private readonly _data = signal<BadgeInfoDialogData | null>(null);

  set data(value: BadgeInfoDialogData) {
    this._data.set(value);
  }

  protected readonly badges = computed(() => this._data()?.badges ?? []);

  protected onClaim(badge: BadgeItem): void {
    this.dialogRef.close({ action: 'claim', result: true, data: badge });
  }

  protected onShare(badge: BadgeItem): void {
    this.dialogRef.close({ action: 'share', result: true, data: badge });
  }

  protected onClose(): void {
    this.dialogRef.close({ action: 'close', result: false });
  }
}
