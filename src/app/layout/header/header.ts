import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  IsActiveMatchOptions,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  Event as RouterEvent,
} from '@angular/router';
import { animationFrameScheduler, fromEvent } from 'rxjs';
import { auditTime, filter, map } from 'rxjs/operators';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronRight, lucideMenu, lucideX } from '@ng-icons/lucide';
import { Menu, MenuContent, MenuTrigger } from '@angular/aria/menu';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { crownIcon, logo } from '../../shared/core/constant/icon';
import { NavActionKind, NavItem } from '../../shared/core/models/nav.model';
import { Button } from '../../shared/components/ui/button/button';
import { Auth } from '../../shared/core/services/auth/auth';
import { cn } from '../../shared/utils/cn';
import { SectionNav } from '../../shared/components/section-nav/section-nav';
import { UserAvatarMenu } from '../../shared/components/user-avatar-menu/user-avatar-menu';
import { NavMenuItem } from '../../shared/components/nav-menu-item/nav-menu-item';
import { GUEST_NAV, LOGGED_IN_NAV } from './nav.config';
import { Utils } from '../../shared/core/services/utils/utils';
import { Viewport } from '../../shared/core/services/viewport/viewport';
import {
  CalendlyDialog,
  CalendlyDialogData,
} from '../../shared/components/dialog/calendly-dialog/calendly-dialog';
import { Dialog } from '../../shared/core/services/dialog/dialog';

const SCROLL_THRESHOLD_PX = 150;

/** Subset-match against the current route — accurate, no substring collisions. */
const ROUTE_MATCH_OPTIONS: IsActiveMatchOptions = {
  paths: 'subset',
  queryParams: 'ignored',
  fragment: 'ignored',
  matrixParams: 'ignored',
};

@Component({
  selector: 'app-header',
  imports: [
    RouterLink,
    RouterLinkActive,
    NgIcon,
    Button,
    SectionNav,
    UserAvatarMenu,
    NavMenuItem,
    Menu,
    MenuTrigger,
    MenuContent,
    CdkTrapFocus,
  ],
  providers: [provideIcons({ lucideChevronDown, lucideChevronRight, lucideMenu, lucideX })],
  templateUrl: './header.html',
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class Header {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly dialog = inject(Dialog);
  protected readonly utils = inject(Utils);
  private readonly viewport = inject(Viewport);

  readonly auth = inject(Auth);

  protected readonly logoIcon = logo;
  protected readonly crownIcon = crownIcon;
  protected readonly cn = cn;

  // ── UI state ──────────────────────────────────────────────────────────
  // "Mobile" here means "below desktop" (<1024) — i.e. show the hamburger /
  // drawer instead of the inline nav. Sourced from the shared Viewport service.
  readonly isMobile = this.viewport.isHandheld;
  readonly isScrolled = signal<boolean>(false);
  readonly isMobileMenuOpen = signal<boolean>(false);

  // ── Auth pass-through (no extra `computed` wrapper — Auth signals are already reactive) ──
  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly userData = this.auth.currentUser;
  protected readonly hasActivePlan = computed(() => !!this.auth.currentPlan());

  // Latest navigated URL — used as `redirect` query param on profile/login links.
  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e: RouterEvent) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /**
   * Filter nav items by capability. The `requires: 'activePlan'` flag hides
   * an item until `auth.currentPlan()` reports an active plan. Recurses so
   * gated children inside menus are filtered too.
   */
  readonly navItems = computed<readonly NavItem[]>(() => {
    const source = this.isLoggedIn() ? LOGGED_IN_NAV : GUEST_NAV;
    const hasActivePlan = this.hasActivePlan();
    return this.filterByCapabilities(source, hasActivePlan);
  });

  private filterByCapabilities(
    items: readonly NavItem[],
    hasActivePlan: boolean,
  ): readonly NavItem[] {
    return items
      .filter((item) => this.satisfiesRequirement(item, hasActivePlan))
      .map((item) =>
        item.children
          ? { ...item, children: this.filterByCapabilities(item.children, hasActivePlan) }
          : item,
      );
  }

  private satisfiesRequirement(item: NavItem, hasActivePlan: boolean): boolean {
    if (!item.requires) return true;
    if (item.requires === 'activePlan') return hasActivePlan;
    return true;
  }

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Viewport breakpoint (mobile/desktop) is owned by the shared Viewport
      // service — see `isMobile` above. Here we only track scroll.
      // rAF-throttle scroll. Short-circuit when the threshold boolean
      // wouldn't change so OnPush CD doesn't run per-tick.
      fromEvent(window, 'scroll', { passive: true })
        .pipe(
          // rAF-aligned: collapses bursts to one update per animation frame.
          auditTime(0, animationFrameScheduler),
          map(() => window.scrollY > SCROLL_THRESHOLD_PX),
          filter((next) => next !== this.isScrolled()),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((next) => this.isScrolled.set(next));
    }

    // Close the mobile drawer on every navigation completion.
    effect(() => {
      void this.currentUrl();
      untracked(() => this.isMobileMenuOpen.set(false));
    });
  }

  // ── Route helpers ─────────────────────────────────────────────────────

  /**
   * Active-route check using `Router.isActive` with subset-matching. Fixes
   * the substring-collision bug of the old `router.url.includes(route)`.
   */
  isActiveRoute(route?: string): boolean {
    if (!route) return false;
    return this.router.isActive(route, ROUTE_MATCH_OPTIONS);
  }

  hasActiveChild(item: NavItem): boolean {
    if (!item.children) return false;
    return item.children.some(
      (child) => this.isActiveRoute(child.route) || this.hasActiveChild(child),
    );
  }

  // ── Action dispatch (string-keyed instead of inline arrows on data) ───

  /**
   * Dispatch table for nav-button actions. Keying by string keeps the nav
   * data fully serializable (no closures bound to `this`).
   */
  private readonly actionHandlers: Record<NavActionKind, () => void> = {
    bookDemo: () => this.openScheduler(),
    signup: () => this.handleSignup(),
  };

  handleAction(item: NavItem): void {
    // A button-styled item can carry a plain `route` instead of an action —
    // it navigates like a nav link but keeps its button chrome. Routed through
    // the same `localePath` the `<a routerLink>` items use, so it stays inside
    // the current `:country/:profession_type` tree.
    if (item.route) {
      void this.router.navigateByUrl(this.utils.localePath(item.route));
      return;
    }
    if (!item.actionKind) return;
    this.actionHandlers[item.actionKind]();
  }

  handleSignup(): void {
    this.router.navigate(['/auth/login'], {
      queryParams: { redirect: this.router.url },
    });
  }

  /**
   * Single point for "the user clicked sign out" — auth + UI cleanup.
   *
   * Hard-navigates to `/` instead of relying on `router.navigate`. The header
   * is mounted on auth-protected routes (e.g. `/cpe-tracker`) too — `clearAuth`
   * flips `isLoggedIn` to false, but Angular's `authGuard` only re-evaluates
   * on the next navigation; without an explicit navigation here, the user
   * gets stuck on a protected URL with no valid session. A full-page
   * `window.location.assign('/')` also bypasses `canDeactivate` guards
   * (profile route's unsaved-changes prompt) and flushes any stale
   * in-memory state from the previous session.
   */
  signOut(): void {
    this.auth.clearAuth();
    this.closeMobileMenu();
    if (isPlatformBrowser(this.platformId)) {
      window.location.assign('/');
    } else {
      this.router.navigateByUrl('/');
    }
  }

  // ── Mobile drawer ─────────────────────────────────────────────────────

  toggleMobileMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.isMobileMenuOpen.update((v) => !v);
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  /**
   * Outside-click dismissal for the mobile drawer. The host listener fires
   * for every document click; we close only when the drawer is open and the
   * click target sits outside the host element.
   */
  onDocumentClick(event: MouseEvent): void {
    if (!this.isMobileMenuOpen()) return;
    const target = event.target as Node | null;
    if (!target || this.hostRef.nativeElement.contains(target)) return;
    this.closeMobileMenu();
  }

  openScheduler(): void {
    this.dialog.open<CalendlyDialog, boolean>(CalendlyDialog, {
      width: 'min(95vw, 760px)',
      ariaLabel: 'Schedule a demo',
      data: {
        url: 'https://calendly.com/rohan-singhai-milesmasterclass/30min',
        closeAction: true,
      } satisfies CalendlyDialogData,
    });
  }
}
