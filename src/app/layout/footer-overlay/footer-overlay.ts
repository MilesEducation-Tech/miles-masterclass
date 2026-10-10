import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { animationFrameScheduler, fromEvent } from 'rxjs';
import { auditTime, filter, map } from 'rxjs/operators';

import { Consent } from '@core/services/consent/consent';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { Utils } from '@shared/services/utils';
import { CartStore } from '@core/services/cart/cart-store';
// Type-only: the dialog loads with `import()` when opened (PROMPT.md §4.4).
import type { CalendlyDialogData } from '@shared/dialogs/calendly-dialog/calendly-dialog';

import { SubscribeCard } from './components/subscribe-card/subscribe-card';
import { UtilsIconCluster } from './components/utils-icon-cluster/utils-icon-cluster';
import {
  CORPORATE_CARD_COPY,
  CORPORATE_CARD_ROUTES,
  FOOTER_OVERLAY_ROUTES,
  SCROLL_THRESHOLD_PX,
  SUBSCRIBE_CARD_COPY,
  isAllowedRoute,
  isEditableTarget,
  isExactRoute,
} from './footer-overlay.config';

@Component({
  selector: 'app-footer-overlay',
  imports: [SubscribeCard, UtilsIconCluster],
  templateUrl: './footer-overlay.html',
  host: {
    class: 'contents z-50',
  },
})
export class FooterOverlay {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly utils = inject(Utils);
  // Suppress the overlay while the cookie-consent banner is open so the two
  // fixed bottom UIs don't overlap (no-op unless consent is active in prod).
  protected readonly consent = inject(Consent);
  // Cart state lives in core, so layout does not import a feature (PROMPT.md §3).
  private readonly cart = inject(CartStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly isBrowser = isPlatformBrowser(this.platformId);

  // ── Scroll + route gates ───────────────────────────────────────────────
  private readonly isScrolled = signal(false);
  protected readonly routeAllowed = computed(() =>
    isAllowedRoute(this.utils.currentUrl(), FOOTER_OVERLAY_ROUTES),
  );
  /**
   * `true` on the corporate landing page (`/cpe-for-corporate`), where the
   * subscribe upsell is swapped for the B2B "bring it to your firm" CTA.
   */
  protected readonly corporateRouteAllowed = computed(() =>
    isExactRoute(this.utils.currentUrl(), CORPORATE_CARD_ROUTES),
  );
  protected readonly isOverlayVisible = computed(
    () => this.isScrolled() && this.routeAllowed() && !this.consent.bannerOpen(),
  );

  // ── Session + subscription state ────────────────────────────────────────
  // The boolean, never the token: a rotation must not re-fire the effects below.
  protected readonly isLoggedIn = inject(AuthSession).isAuthenticated;
  // ponytail: nothing in the app holds the user's plan (see `utils.ts`), so
  // "no plan" stays the answer and the subscribe upsell shows to everyone.
  protected readonly subscribed = signal<boolean | null>(false);

  // ── Cart count ─────────────────────────────────────────────────────────
  // ponytail: nothing here loads the cart. `user/cart/mybucket/` answers 404 on
  // MilesCAIRA, so a load on every signed-in page only made noise; the count is
  // whatever the payment flow last loaded. Load it here again once the cart is
  // rebound to `api/v1/commerce/cart/`.
  protected readonly cartCount = computed(() => this.cart.cartData()?.cartitem_data.length ?? 0);

  // ── State machine: what to render in the bar ───────────────────────────
  // The "continue learning" card is gone: `v2/user/last_viewed/` answers 404
  // and the web API has no replacement (docs/MASTERCLASS_API_QUESTIONS.md Q8).
  protected readonly cardKind = computed<'subscribe' | 'corporate' | 'none'>(() => {
    if (!this.isOverlayVisible()) return 'none';
    // On the corporate landing page the subscribe upsell is replaced by the
    // B2B "bring it to your firm" CTA — shown to everyone, independent of plan.
    if (this.corporateRouteAllowed()) return 'corporate';
    if (this.subscribed() === false) return 'subscribe';
    return 'none';
  });

  // ── Copy ───────────────────────────────────────────────────────────────
  protected readonly subscribeCopy = SUBSCRIBE_CARD_COPY;
  protected readonly corporateCopy = CORPORATE_CARD_COPY;

  constructor() {
    if (this.isBrowser) {
      // Scroll → isScrolled (rAF-throttled, only emits on threshold change)
      fromEvent(window, 'scroll', { passive: true })
        .pipe(
          auditTime(0, animationFrameScheduler),
          map(() => window.scrollY > SCROLL_THRESHOLD_PX),
          filter((next) => next !== this.isScrolled()),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((next) => this.isScrolled.set(next));

      // Global cmd+K / ctrl+K to open search
      fromEvent<KeyboardEvent>(window, 'keydown')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((event) => {
          if (
            (event.metaKey || event.ctrlKey) &&
            event.key.toLowerCase() === 'k' &&
            !isEditableTarget(event.target)
          ) {
            event.preventDefault();
            this.openSearch();
          }
        });
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────

  protected onSubscribe(): void {
    if (this.isLoggedIn()) {
      this.router.navigate(['/', this.utils.country(), this.utils.profession(), 'payment', 'plan']);
    } else {
      this.router.navigate(['/auth/login'], {
        queryParams: { redirect: this.router.url },
      });
    }
  }

  protected async onScheduleDiscoveryCall(): Promise<void> {
    const { CalendlyDialog } = await import('@shared/dialogs/calendly-dialog/calendly-dialog');
    this.dialogs.open(CalendlyDialog, {
      data: {
        ariaLabel: 'Schedule a discovery call',
        url: 'https://calendly.com/rohan-singhai-milesmasterclass/30min',
        closeAction: true,
      } satisfies CalendlyDialogData,
    });
  }

  protected onCartClick(): void {
    this.router.navigate(['/', this.utils.country(), this.utils.profession(), 'payment', 'cart']);
  }

  protected async openSearch(): Promise<void> {
    const { GlobalSearchDialog } =
      await import('@layout/dialogs/global-search-dialog/global-search-dialog');
    this.dialogs.open(GlobalSearchDialog);
  }
}
