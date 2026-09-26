import { NgOptimizedImage } from '@angular/common';
import { Component } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { appStoreIcon, googlePlayIcon } from '@core/constants/icon';
import { FooterLink } from '@core/models/footer.model';

@Component({
  selector: 'app-app-download',
  imports: [NgIcon, NgOptimizedImage],
  templateUrl: './app-download.html',
})
export class AppDownload {
  readonly appStoreLinks: FooterLink[] = [
    {
      label: 'App Store',
      url: 'https://apps.apple.com/in/app/miles-masterclass-ai-cpe/id6736642042',
      icon: 'appStoreIcon',
    },
    {
      label: 'Google Play',
      url: 'https://play.google.com/store/apps/details?id=com.miles.masterclass&hl=en',
      icon: 'googlePlayIcon',
    },
  ];

  readonly icons = {
    appStoreIcon,
    googlePlayIcon,
  };

  getIcon(iconName: string): any {
    return this.icons[iconName as keyof typeof this.icons];
  }
}
