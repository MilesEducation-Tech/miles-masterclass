import { isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, PLATFORM_ID, ViewEncapsulation } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, Event as RouterEvent } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideLogOut, lucideShoppingBag, lucideUser } from '@ng-icons/lucide';
import { NgpMenu, NgpMenuItem, NgpMenuTrigger } from 'ng-primitives/menu';
import { cn } from '../../utils/cn';
import { Utils } from '@shared/services/utils';
import { Analytics } from '@core/services/analytics/analytics';
import { AccountApi } from '@core/services/account-api/account-api';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { NotificationService } from '@core/services/notification/notification';

@Component({
  selector: 'app-user-avatar-menu',
  imports: [RouterLink, NgIcon, NgpMenu, NgpMenuItem, NgpMenuTrigger],
  providers: [provideIcons({ lucideChevronDown, lucideLogOut, lucideShoppingBag, lucideUser })],
  templateUrl: './user-avatar-menu.html',
  encapsulation: ViewEncapsulation.None,
})
export class UserAvatarMenu {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly utils = inject(Utils);
  private readonly analytics = inject(Analytics);
  private readonly account = inject(AccountApi);
  private readonly auth = inject(AuthSession);
  private readonly notify = inject(NotificationService);

  readonly cn = cn;

  /**
   * The caller's own record. `hasValue()` rather than a bare `value()` read:
   * reading an `httpResource` in its error state throws at runtime, and this
   * renders on every page including ones a signed-out visitor sees.
   */
  readonly user = computed(() => (this.account.user.hasValue() ? this.account.user.value() : null));

  /**
   * `user-details/` carries `full_name` and `first_name` and nothing else about
   * identity — no email, no separate last name — so the menu shows the name
   * alone.
   */
  readonly displayName = computed(() => {
    const u = this.user();
    return u ? u.full_name || u.first_name : '';
  });

  readonly initials = computed(() => {
    const words = this.displayName().split(/\s+/).filter(Boolean);
    const first = words[0]?.[0] ?? '';
    const last = words.length > 1 ? (words[words.length - 1][0] ?? '') : '';
    return `${first}${last}`.toUpperCase() || 'U';
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
   * only once it is really gone — a failed logout deliberately keeps the
   * session. So a failure is SAID, and the page stays put: navigating anyway
   * would put a signed-out-looking screen over a session still live upstream.
   * On success the hard navigation bypasses `canDeactivate` guards on the
   * current route and flushes route-scoped state.
   */
  async onLogout(): Promise<void> {
    this.analytics.trackEvent('logout');
    if (!(await this.auth.logout())) {
      this.notify.error('Sign out failed', 'We could not sign you out. Please try again.');
      return;
    }
    if (isPlatformBrowser(this.platformId)) {
      window.location.assign('/');
    } else {
      this.router.navigateByUrl('/');
    }
  }
}
