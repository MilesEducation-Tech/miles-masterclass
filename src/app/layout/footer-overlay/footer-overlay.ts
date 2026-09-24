import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { animationFrameScheduler, fromEvent } from 'rxjs';
import { auditTime, filter, map } from 'rxjs/operators';

import { Consent } from '@core/services/consent/consent';
import { Analytics } from '@core/services/analytics/analytics';
import { Dialog } from '@core/services/dialog/dialog';
import { Utils } from '@shared/services/utils';
import { FeatureFacade, FeatureResource } from '@core/services/feature-facade/feature-facade';
import { CartStore } from '@core/services/cart/cart-store';
import { GlobalSearchDialog } from '@layout/dialogs/global-search-dialog/global-search-dialog';
import {
  CalendlyDialog,
  CalendlyDialogData,
} from '@shared/dialogs/calendly-dialog/calendly-dialog';
import { Content } from '@core/models/course.model';

import { SubscribeCard } from './components/subscribe-card/subscribe-card';
import { ContinueLearningCard } from './components/continue-learning-card/continue-learning-card';
import { UtilsIconCluster } from './components/utils-icon-cluster/utils-icon-cluster';
import {
  CONTINUE_CARD_ROUTES,
  CORPORATE_CARD_COPY,
  CORPORATE_CARD_ROUTES,
  FOOTER_OVERLAY_ROUTES,
  SCROLL_THRESHOLD_PX,
  SUBSCRIBE_CARD_COPY,
  isAllowedRoute,
  isEditableTarget,
  isExactRoute,
} from './footer-overlay.config';

type InProgressType = 'masterclass' | 'podcast' | 'micro_learning';

@Component({
  selector: 'app-footer-overlay',
  imports: [SubscribeCard, ContinueLearningCard, UtilsIconCluster],
  templateUrl: './footer-overlay.html',
  styleUrl: './footer-overlay.css',
  host: {
    class: 'z-50',
  },
})
export class FooterOverlay {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly utils = inject(Utils);
  // Suppress the overlay while the cookie-consent banner is open so the two
  // fixed bottom UIs don't overlap (no-op unless consent is active in prod).
  protected readonly consent = inject(Consent);
  private readonly analytics = inject(Analytics);
  private readonly feature = inject(FeatureFacade);
  // Cart state and its loader live in core, so layout does not import a
  // feature (PROMPT.md §3).
  private readonly cart = inject(CartStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly isBrowser = isPlatformBrowser(this.platformId);

  // ── Scroll + route gates ───────────────────────────────────────────────
  private readonly isScrolled = signal(false);
  protected readonly routeAllowed = computed(() =>
    isAllowedRoute(this.utils.currentUrl(), FOOTER_OVERLAY_ROUTES),
  );
  /**
   * Tighter check than `routeAllowed` — matches only the listing/home pages
   * of each offering (exact equality, no prefix). Used to gate the Continue
   * Learning card so it doesn't appear on course detail / chapter deeplinks.
   */
  protected readonly continueRouteAllowed = computed(() =>
    isExactRoute(this.utils.currentUrl(), CONTINUE_CARD_ROUTES),
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

  // ── ponytail: inert session + subscription state ───────────────────────
  // Both read the removed `Auth` service. Signed-out with no plan is the
  // design the overlay now always shows.
  protected readonly isLoggedIn = signal(false);
  protected readonly subscribed = signal<boolean | null>(false);

  // ── In-progress data (auth-gated; reuses FeatureFacade cache) ──────────
  private readonly activeInProgressType = computed<InProgressType>(() => {
    const url = this.utils.currentUrl();
    if (url.includes('/podcast')) return 'podcast';
    if (url.includes('/micro-learning')) return 'micro_learning';
    return 'masterclass';
  });

  /**
   * Holds the current `FeatureResource` for the in-progress carousel. Set via
   * `effect()` rather than `computed()` because `FeatureFacade.getResource()`
   * triggers a `refresh()` (signal writes) on cache hits — which is illegal
   * inside `computed()` (NG0600).
   */
  private readonly inProgressResource = signal<FeatureResource | null>(null);

  protected readonly inProgressCourse = computed<Content | null>(() => {
    const resource = this.inProgressResource();
    if (!resource) return null;
    const list = resource.items() as Content[];
    return list?.[0] ?? null;
  });

  // ── Cart count ─────────────────────────────────────────────────────────
  protected readonly cartCount = computed(() => this.cart.cartData()?.cartitem_data.length ?? 0);

  // ── State machine: what to render in the bar ───────────────────────────
  protected readonly cardKind = computed<'continue' | 'subscribe' | 'corporate' | 'none'>(() => {
    if (!this.isOverlayVisible()) return 'none';
    // On the corporate landing page the subscribe upsell is replaced by the
    // B2B "bring it to your firm" CTA — shown to everyone, independent of plan.
    if (this.corporateRouteAllowed()) return 'corporate';
    // `continue` is restricted to the offering home pages (see
    // CONTINUE_CARD_ROUTES). On detail / deeplink pages we fall through to
    // the subscribe upsell (or hide if already subscribed).
    if (this.continueRouteAllowed() && this.inProgressCourse()) return 'continue';
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

    // Lazy cart load. Gate only on `isLoggedIn()` — the facade handles
    // idempotency via `cartFetched`. Reading `cartData()`/`loading()` here
    // would re-fire this effect during the load lifecycle and could loop
    // forever if the API resolved with null/error.
    effect(() => {
      if (this.isLoggedIn()) {
        untracked(() => this.cart.loadMyBucket());
      }
    });

    // Resolve the in-progress FeatureResource reactively. `getResource()` may
    // mutate facade-internal signals on cache hits (calls `refresh()`), so it
    // runs inside `untracked()` here — and never inside a `computed()`.
    effect(() => {
      const loggedIn = this.isLoggedIn();
      const type = this.activeInProgressType();
      if (!loggedIn) {
        untracked(() => this.inProgressResource.set(null));
        return;
      }
      untracked(() => {
        const resource = this.feature.getResource('lastViewed', type, { requiresAuth: true });
        this.inProgressResource.set(resource);
      });
    });
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

  protected onScheduleDiscoveryCall(): void {
    this.dialog.open<CalendlyDialog, boolean>(CalendlyDialog, {
      width: 'min(95vw, 760px)',
      ariaLabel: 'Schedule a discovery call',
      data: {
        url: 'https://calendly.com/rohan-singhai-milesmasterclass/30min',
        closeAction: true,
      } satisfies CalendlyDialogData,
    });
  }

  protected onResume(course: Content): void {
    this.analytics.trackEvent('continue_learning_click', {
      course_id: course.id,
      course_type: course.course_type,
    });
    const urlSegment =
      course.course_type.toLocaleLowerCase() === 'video'
        ? 'masterclass'
        : course.course_type.toLocaleLowerCase() === 'micro_learning'
          ? 'micro-learning'
          : course.course_type.toLocaleLowerCase() === 'nano_learning'
            ? 'micro-learning'
            : course.course_type.toLocaleLowerCase();
    this.utils.navigateToCourse(urlSegment, course.id, course.title);
  }

  protected onCartClick(): void {
    this.router.navigate(['/', this.utils.country(), this.utils.profession(), 'payment', 'cart']);
  }

  protected openSearch(): void {
    this.dialog.open(GlobalSearchDialog, {
      width: 'min(95vw, 720px)',
      maxWidth: '95vw',
      ariaLabel: 'Global search',
      enterAnimationDuration: '200ms',
      exitAnimationDuration: '180ms',
    });
  }
}
