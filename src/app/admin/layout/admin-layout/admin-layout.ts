import { Component, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AdminSidebar } from '../admin-sidebar/admin-sidebar';
import { AdminTopbar } from '../admin-topbar/admin-topbar';
import { Viewport } from '../../../shared/core/services/viewport/viewport';

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
