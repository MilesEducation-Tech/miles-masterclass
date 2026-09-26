import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Service, PLATFORM_ID, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { APP_VERSION } from '@core/version/app-version';
import { NgpDialogManager } from 'ng-primitives/dialog';

/**
 * Detects when a newer build has been deployed while the user is on an older
 * one, and prompts them to update.
 *
 * The running bundle has its build version baked in (`APP_VERSION`); the
 * server exposes the *currently deployed* version at `/version.json`. When
 * the two differ, a non-closeable dialog is shown whose only action clears
 * caches and reloads onto the new version.
 *
 * Checks run on app open, on every navigation, when the tab is re-focused,
 * and on a long safety interval — all browser-only and throttled.
 */
@Service()
export class UpdateChecker {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly document = inject(DOCUMENT);

  private readonly runningVersion = APP_VERSION;

  /** Minimum gap between checks so navigation bursts don't spam the network. */
  private readonly throttleMs = 30_000;
  /** Safety poll for tabs left open a long time. */
  private readonly pollMs = 10 * 60_000;

  private lastCheckAt = 0;
  private prompted = false;
  private started = false;

  /** Wire up the version checks. Browser-only; a no-op during SSR. */
  init(): void {
    if (!isPlatformBrowser(this.platformId) || this.started) return;
    this.started = true;

    // Initial check shortly after boot so it doesn't compete with hydration.
    setTimeout(() => this.check(), 4000);

    // Every in-app navigation.
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) this.check();
    });

    // Returning to the tab (covers re-opening the platform after backgrounding).
    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'visible') this.check();
    });

    // Long-interval safety net for tabs that stay open.
    setInterval(() => this.check(), this.pollMs);
  }

  /** Compare the deployed version to the running one; prompt once on mismatch. */
  private check(): void {
    if (this.prompted || !isPlatformBrowser(this.platformId)) return;

    const now = Date.now();
    if (now - this.lastCheckAt < this.throttleMs) return;
    this.lastCheckAt = now;

    fetch(`/version.json?_=${now}`, { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<{ buildId?: string }>) : null))
      .then((data) => {
        // why: `buildId`, never `version`. `version` is the SemVer (e.g. "3.0.1"),
        // which changes only at a release and is NOT what this compares against —
        // reading it here would mismatch `APP_VERSION` on every single check and
        // show every user a permanent update dialog. No fallback to `version` for
        // the same reason. An absent `buildId` deliberately does nothing.
        const deployed = data?.buildId;
        if (deployed && deployed !== this.runningVersion && !this.prompted) {
          this.prompted = true;
          void this.openDialog();
        }
      })
      .catch(() => {
        // Offline, or /version.json unavailable (e.g. local dev) — ignore.
      });
  }

  /** Lazily loaded so the dialog stays out of the initial bundle. */
  private async openDialog(): Promise<void> {
    const { VersionUpdateDialog } =
      await import('@shared/dialogs/version-update-dialog/version-update-dialog');
    this.dialogs.open(VersionUpdateDialog);
  }
}
