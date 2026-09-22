import { isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, PLATFORM_ID, ViewEncapsulation } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, Event as RouterEvent } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideLogOut, lucideShoppingBag, lucideUser } from '@ng-icons/lucide';
import { NgpMenu, NgpMenuItem, NgpMenuTrigger } from 'ng-primitives/menu';
import { cn } from '../../utils/cn';
import { Utils } from '../../core/services/utils/utils';
import { Analytics } from '../../core/services/analytics/analytics';
import { AccountApi } from '../../core/services/account-api/account-api';
import { AuthSession } from '../../core/services/auth-session/auth-session';

@Component({
  selector: 'app-user-avatar-menu',
  imports: [RouterLink, NgIcon, NgpMenu, NgpMenuItem, NgpMenuTrigger],
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
  private readonly account = inject(AccountApi);
  private readonly auth = inject(AuthSession);

  readonly cn = cn;

  /**
   * The caller's own record. `hasValue()` rather than a bare `value()` read:
   * reading an `httpResource` in its error state throws at runtime, and this
   * renders on every page including ones a signed-out visitor sees.
   */
  readonly user = computed(() => (this.account.user.hasValue() ? this.account.user.value() : null));

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
   * Sign out from the avatar dropdown.
   *
   * `AuthSession.logout()` ends the session at the SSO and clears the cookies
   * only if that succeeded — a failed logout deliberately keeps the session, so
   * a UI that merely looked signed out could not hide one still live upstream.
   * The hard navigation stays regardless: it bypasses `canDeactivate` guards on
   * the current route and flushes route-scoped state.
   */
  async onLogout(): Promise<void> {
    this.analytics.trackEvent('logout');
    await this.auth.logout();
    if (isPlatformBrowser(this.platformId)) {
      window.location.assign('/');
    } else {
      this.router.navigateByUrl('/');
    }
  }
}
