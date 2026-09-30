import { Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { appStoreIcon, googlePlayIcon } from '@core/constants/icon';
import { injectDialogRef } from 'ng-primitives/dialog';
import { Button } from '../../ui/button/button';

import { MASTERCLASS_APP_STORE_URL, MASTERCLASS_PLAY_STORE_URL } from '@core/constants/app-store';
import { Dialog } from '@shared/ui/dialog/dialog';
import { heroXMark } from '@ng-icons/heroicons/outline';

interface StoreLink {
  label: string;
  url: string;
  icon: string;
}

@Component({
  selector: 'app-app-download-dialog',
  imports: [Button, NgIcon, Dialog],
  providers: [provideIcons({ heroXMark })],
  templateUrl: './app-download-dialog.html',
})
export class AppDownloadDialog {
  private readonly dialogRef = injectDialogRef();

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
