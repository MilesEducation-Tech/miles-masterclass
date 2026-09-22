import { Component } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { appStoreIcon, googlePlayIcon } from '@core/constant/icon';
import { DialogRef } from '@core/services/dialog/dialog';
import { Button } from '../../ui/button/button';

export const MASTERCLASS_APP_STORE_URL =
  'https://apps.apple.com/in/app/miles-masterclass-ai-cpe/id6736642042';
export const MASTERCLASS_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.miles.masterclass&hl=en';

interface StoreLink {
  label: string;
  url: string;
  icon: string;
}

@Component({
  selector: 'app-app-download-dialog',
  imports: [Button, NgIcon],
  templateUrl: './app-download-dialog.html',
})
export class AppDownloadDialog {
  dialogRef!: DialogRef<AppDownloadDialog>;

  // ponytail: UA sniff is only used to pick which badge leads; ambiguous UAs get both.
  protected readonly storeLinks: StoreLink[] = this.resolveStoreLinks();

  close(): void {
    this.dialogRef.close();
  }

  private resolveStoreLinks(): StoreLink[] {
    const appStore: StoreLink = {
      label: 'App Store',
      url: MASTERCLASS_APP_STORE_URL,
      icon: appStoreIcon,
    };
    const playStore: StoreLink = {
      label: 'Google Play',
      url: MASTERCLASS_PLAY_STORE_URL,
      icon: googlePlayIcon,
    };

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    if (/iPad|iPhone|iPod/i.test(ua)) return [appStore];
    if (/Android/i.test(ua)) return [playStore];
    return [appStore, playStore];
  }
}
