import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
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
import {
  NgpAccordion,
  NgpAccordionContent,
  NgpAccordionItem,
  NgpAccordionTrigger,
} from 'ng-primitives/accordion';
import {
  NgpCollapsible,
  NgpCollapsibleContent,
  NgpCollapsibleTrigger,
} from 'ng-primitives/collapsible';
import { NgpFocusTrap } from 'ng-primitives/focus-trap';
import { crownIcon, logo } from '@core/constants/icon';
import { NavActionKind, NavItem } from '@core/models/nav.model';
import { Button } from '@shared/ui/button/button';
import { cn } from '@shared/utils/cn';
import { SectionNav } from '@shared/components/section-nav/section-nav';
import { UserAvatarMenu } from '@shared/components/user-avatar-menu/user-avatar-menu';
import { NavMenuItem } from '@shared/components/nav-menu-item/nav-menu-item';
import { GUEST_NAV, LOGGED_IN_NAV } from './nav.config';
import { Utils } from '@shared/services/utils';
import { Viewport } from '@core/services/viewport/viewport';
// Type-only: the dialog loads with `import()` when opened (PROMPT.md §4.4).
import type { CalendlyDialogData } from '@shared/dialogs/calendly-dialog/calendly-dialog';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { User } from '@core/models/profile.model';

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
    NgpAccordion,
    NgpAccordionItem,
    NgpAccordionTrigger,
    NgpAccordionContent,
    NgpCollapsible,
    NgpCollapsibleTrigger,
    NgpCollapsibleContent,
    NgpFocusTrap,
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
  private readonly injector = inject(Injector);
  private readonly mobileToggler = viewChild<ElementRef<HTMLButtonElement>>('mobileToggler');

  private readonly dialogs = inject(NgpDialogManager);
  protected readonly utils = inject(Utils);
  private readonly viewport = inject(Viewport);

  protected readonly logoIcon = logo;
  protected readonly crownIcon = crownIcon;
  protected readonly cn = cn;

  // ── UI state ──────────────────────────────────────────────────────────
  // "Mobile" here means "below desktop" (<1024) — i.e. show the hamburger /
  // drawer instead of the inline nav. Sourced from the shared Viewport service.
  readonly isMobile = this.viewport.isHandheld;
  readonly isScrolled = signal<boolean>(false);
  readonly isMobileMenuOpen = signal<boolean>(false);

  // ── ponytail: inert session state ─────────────────────────────────────
  // These were live signals off the removed `Auth` service. The header now
  // always renders its signed-out design: guest nav, no plan-gated items.
  readonly isLoggedIn = signal(false);
  readonly userData = signal<User | null>(null);
  protected readonly hasActivePlan = signal(false);

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
   * an item until an active plan is reported. Recurses so gated children
   * inside menus are filtered too.
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
      untracked(() => this.closeMobileMenu());
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
   * Single point for "the user clicked sign out" — UI cleanup only now that
   * there is no session to clear. Still hard-navigates to `/` so any stale
   * in-memory state is flushed and `canDeactivate` prompts are bypassed.
   */
  signOut(): void {
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
    if (!this.isMobileMenuOpen()) return;
    this.isMobileMenuOpen.set(false);
    // `ngpFocusTrap`, unlike `cdkTrapFocusAutoCapture`, does not hand focus back when the
    // drawer closes, so return it to the toggler as CDK did. Unconditional on purpose: while
    // the drawer is open the trap pulls focus back inside, so it always goes down with it.
    afterNextRender(
      { write: () => this.mobileToggler()?.nativeElement.focus() },
      { injector: this.injector },
    );
  }

  /**
   * Outside-click dismissal for the mobile drawer. The host listener fires
   * for every document click; we close only when the drawer is open and the
   * click target sits outside the host element.
   */
  /**
   * Which desktop nav dropdown is open, by item label.
   *
   * The dropdowns are a single-select `ngpAccordion` rather than independent
   * collapsibles so that opening one closes the others — behaviour the old
   * menu primitive provided for free, and which a disclosure does not.
   */
  readonly openNavItem = signal<string | null>(null);

  protected onNavOpenChange(value: string | string[] | null): void {
    this.openNavItem.set(Array.isArray(value) ? (value[0] ?? null) : value);
  }

  closeNavDropdown(): void {
    this.openNavItem.set(null);
  }

  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    const outside = !target || !this.hostRef.nativeElement.contains(target);

    // Closing on an outside click is also something the menu primitive did on
    // its own; a disclosure has no notion of "outside".
    if (outside && this.openNavItem() !== null) {
      this.closeNavDropdown();
    }

    if (!this.isMobileMenuOpen()) return;
    if (!outside) return;
    this.closeMobileMenu();
  }

  async openScheduler(): Promise<void> {
    const { CalendlyDialog } = await import('@shared/dialogs/calendly-dialog/calendly-dialog');
    this.dialogs.open(CalendlyDialog, {
      data: {
        ariaLabel: 'Schedule a demo',
        url: 'https://calendly.com/rohan-singhai-milesmasterclass/30min',
        closeAction: true,
      } satisfies CalendlyDialogData,
    });
  }
}
