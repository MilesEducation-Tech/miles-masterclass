import { Service, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { Viewport } from '@core/services/viewport/viewport';

const SESSION_KEY = 'app_download_prompted';
const ANDROID_PACKAGE_ID = 'com.miles.masterclass';

interface RelatedApp {
  id?: string;
  platform: string;
}

/**
 * Prompts small-screen visitors on course detail pages to install the
 * Miles Masterclass mobile app, once per browser session. If the app is
 * already installed, OS-level Universal/App Links open it before the web
 * page is ever seen, so this only targets browser visitors.
 */
@Service()
export class AppDownloadPrompt {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly viewport = inject(Viewport);
  private readonly dialogs = inject(NgpDialogManager);

  maybePrompt(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.viewport.isMobile()) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, '1');

    // Defer so the prompt never competes with initial page render.
    setTimeout(() => void this.detectAndOpen(), 1000);
  }

  private async detectAndOpen(): Promise<void> {
    // ponytail: install detection only exists on Android Chrome
    // (getInstalledRelatedApps + manifest related_applications). iOS has no
    // API, and Android degrades to "always show" if the app doesn't declare
    // asset_statements — acceptable: worst case is one extra popup/session.
    try {
      const nav = navigator as Navigator & {
        getInstalledRelatedApps?: () => Promise<RelatedApp[]>;
      };
      if (nav.getInstalledRelatedApps) {
        const apps = await nav.getInstalledRelatedApps();
        if (apps.some((app) => app.id === ANDROID_PACKAGE_ID)) return;
      }
    } catch {
      // Detection failed — fall through and show the prompt.
    }

    // The dialog loads only for the visitors who actually see it (PROMPT.md §4.4).
    const { AppDownloadDialog } =
      await import('@shared/dialogs/app-download-dialog/app-download-dialog');
    this.dialogs.open(AppDownloadDialog);
  }
}
