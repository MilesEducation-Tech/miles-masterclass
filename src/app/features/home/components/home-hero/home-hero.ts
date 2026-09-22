import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { logoIcon } from '@core/constants/icon';
import { Button } from '@shared/components/ui/button/button';
import { environment } from '@env/environment';
import { VideoPoster } from '@shared/components/video-poster/video-poster';
import { MilesSlug } from '@shared/components/miles-slug/miles-slug';
import {
  AppDownloadDialog,
  MASTERCLASS_APP_STORE_URL,
  MASTERCLASS_PLAY_STORE_URL,
} from '@shared/components/dialog/app-download-dialog/app-download-dialog';
import { Dialog } from '@core/services/dialog/dialog';

@Component({
  selector: 'app-home-hero',
  imports: [Button, VideoPoster, MilesSlug],
  templateUrl: './home-hero.html',
  styleUrl: './home-hero.css',
})
export class HomeHero {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly dialog = inject(Dialog);
  readonly S3_BUCKET_URL = environment.S3_BUCKET_URL;

  readonly icons = signal({
    logoIcon,
  });

  /** Video sources */
  readonly desktopVideoSrc = `${this.S3_BUCKET_URL}static-assests/web-app/home/home-hero-web.mp4`;
  readonly mobileVideoSrc = `${this.S3_BUCKET_URL}static-assests/web-app/home/hero-bg-mob.mp4`;

  /** Poster sources */
  readonly desktopPosterSrc = `${this.S3_BUCKET_URL}static-assests/web-app/home/home-hero.webp`;
  readonly mobilePosterSrc = `${this.S3_BUCKET_URL}static-assests/web-app/home/home-hero-sm.webp`;

  /**
   * Known mobile UA → straight to that platform's store (one tap). Anything
   * else (desktop, unknown UA) → the shared AppDownloadDialog, which already
   * shows both badges. Previously this sent every visitor, iPhone included, to
   * the Play Store.
   */
  openAppOrStore(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const ua = navigator.userAgent;
    const storeUrl = /iPad|iPhone|iPod/i.test(ua)
      ? MASTERCLASS_APP_STORE_URL
      : /Android/i.test(ua)
        ? MASTERCLASS_PLAY_STORE_URL
        : null;

    if (!storeUrl) {
      this.dialog.open(AppDownloadDialog, { maxWidth: '360px' });
      return;
    }

    // Popup blockers return null (or throw in hardened in-app webviews) —
    // fall back to a same-tab navigation so the tap is never a no-op.
    try {
      const opened = window.open(storeUrl, '_blank', 'noopener');
      if (!opened) window.location.assign(storeUrl);
    } catch {
      window.location.assign(storeUrl);
    }
  }
}
