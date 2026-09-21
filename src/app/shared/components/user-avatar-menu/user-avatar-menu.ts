import { isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, PLATFORM_ID, signal, ViewEncapsulation } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, Event as RouterEvent } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideLogOut, lucideShoppingBag, lucideUser } from '@ng-icons/lucide';
import { Menu, MenuItem, MenuTrigger } from '@angular/aria/menu';
import { cn } from '../../utils/cn';
import { Utils } from '../../core/services/utils/utils';
import { Analytics } from '../../core/services/analytics/analytics';
import { User } from '../../core/models/profile.model';

@Component({
  selector: 'app-user-avatar-menu',
  imports: [RouterLink, NgIcon, Menu, MenuItem, MenuTrigger],
  providers: [provideIcons({ lucideChevronDown, lucideLogOut, lucideShoppingBag, lucideUser })],
  templateUrl: './user-avatar-menu.html',
  styleUrl: './user-avatar-menu.css',
  encapsulation: ViewEncapsulation.None,
})
export class UserAvatarMenu {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly utils = inject(Utils);
  private readonly analytics = inject(Analytics);

  readonly cn = cn;

  // ponytail: inert — was `auth.currentUser()`.
  readonly user = signal<User | null>(null);

  readonly displayName = computed(() => {
    const u = this.user();
    if (!u) return '';
    const full = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim();
    return full || u.email || '';
  });

  readonly displayEmail = computed(() => this.user()?.email ?? '');

  readonly initials = computed(() => {
    const u = this.user();
    if (!u) return 'U';
    const first = (u.first_name ?? '').trim();
    const last = (u.last_name ?? '').trim();
    const fromName = `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
    if (fromName) return fromName;
    const email = (u.email ?? '').trim();
    return email[0]?.toUpperCase() || 'U';
  });

  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e: RouterEvent) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /**
   * Sign out from the avatar dropdown. There is no session to clear any more,
   * but the hard navigation stays: it bypasses `canDeactivate` guards on the
   * current route and flushes route-scoped state.
   */
  onLogout(): void {
    this.analytics.trackEvent('logout');
    if (isPlatformBrowser(this.platformId)) {
      window.location.assign('/');
    } else {
      this.router.navigateByUrl('/');
    }
  }
}
