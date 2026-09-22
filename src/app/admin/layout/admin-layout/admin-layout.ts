import { Component, DestroyRef, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { distinctUntilChanged, filter, map, startWith } from 'rxjs';
import { AdminSidebar } from '../admin-sidebar/admin-sidebar';
import { AdminTopbar } from '../admin-topbar/admin-topbar';
import { Viewport } from '@core/services/viewport/viewport';
import { AuditLog } from '@core/services/audit-log/audit-log';

const SIDEBAR_COLLAPSED_KEY = 'mc_admin_sidebar_collapsed';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, AdminSidebar, AdminTopbar],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly viewport = inject(Viewport);
  private readonly router = inject(Router);
  private readonly audit = inject(AuditLog);
  private readonly destroyRef = inject(DestroyRef);

  readonly desktopCollapsed = signal(this.readInitialCollapsed());
  readonly mobileNavOpen = signal(false);

  constructor() {
    effect(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, this.desktopCollapsed() ? '1' : '0');
      } catch {
        // ignore storage errors (private mode, quota)
      }
    });

    this.trackPageViews();
  }

  /**
   * Audit-log every admin page view. This shell is the right host: it wraps
   * only authenticated admin routes, and `adminAuthGuard` has already awaited
   * `AdminAuth.init()` by the time it mounts, so there is always a session.
   *
   * `startWith` is needed because the navigation that loaded the panel fires
   * before this component exists — without it the landing page is never
   * recorded. `distinctUntilChanged` drops re-emits of the same URL so a
   * redirect or a repeated click is one row, not three.
   *
   * Login, forbidden and the password-reset pages sit OUTSIDE this layout and
   * are therefore not covered here; auth events are recorded by AdminAuth.
   */
  private trackPageViews(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        map((e) => e.urlAfterRedirects),
        startWith(this.router.url),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((url) => void this.audit.record('navigation', 'page_view', { context: { url } }));
  }

  toggleSidebar(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    // Mobile (<768): toggle the off-canvas drawer; otherwise collapse the
    // persistent desktop sidebar. Breakpoint via the shared Viewport service.
    if (this.viewport.isMobile()) {
      this.mobileNavOpen.update((v) => !v);
    } else {
      this.desktopCollapsed.update((v) => !v);
    }
  }

  closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  private readInitialCollapsed(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  }
}
