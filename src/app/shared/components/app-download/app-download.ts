import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { MASTERCLASS_APP_STORE_URL, MASTERCLASS_PLAY_STORE_URL } from '@core/constants/app-store';
import { appStoreIcon, googlePlayIcon } from '@core/constants/icon';
import { environment } from '@env/environment';

/** Figma "Learning on the go" (`2175:26203`): the phone-in-hand render (`2175:26213`). */
const PHONE_RENDER = `${environment.S3_BUCKET_URL}static-assests/web-app/home-v3/app-phone-in-hand.webp`;
const QR_CODE = 'https://asset.milesmasterclass.com/media/web-app/home/qr-code-styling.png';

interface StoreLink {
  label: string;
  url: string;
  icon: string;
}

/**
 * The "Learning on the go" section: the app's points, the QR (desktop only),
 * the store badges and the phone render behind the design's animated download
 * mark. Static; rendered by the home page and the UAE CAIRA page.
 */
@Component({
  selector: 'app-app-download',
  imports: [NgIcon, NgOptimizedImage],
  templateUrl: './app-download.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppDownload {
  protected readonly phoneSrc = PHONE_RENDER;
  protected readonly qrSrc = QR_CODE;

  protected readonly points = [
    'CPE certificates, instantly',
    'In-app CPE tracker',
    'Pick up where you left off, on any device',
    'Watch offline',
  ];

  protected readonly storeLinks: StoreLink[] = [
    { label: 'App Store', url: MASTERCLASS_APP_STORE_URL, icon: appStoreIcon },
    { label: 'Play Store', url: MASTERCLASS_PLAY_STORE_URL, icon: googlePlayIcon },
  ];
}
