import {
  computed,
  DestroyRef,
  effect,
  EnvironmentInjector,
  inject,
  Injector,
  Service,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpContext } from '@angular/common/http';
import { Router, NavigationEnd, Event as RouterEvent } from '@angular/router';
import { EMPTY, Observable, of } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { ApiClient } from '../api-client/api-client';
import { CAIRA } from '../../http/caira.endpoints';
import { CairaUuid, SKIP_ERROR_NOTIFICATION } from '../../models/caira/envelope.model';
import {
  BookmarkToggleResponse,
  CourseDetailResponse,
  toCourseDetailCard,
} from '../../models/caira/course-detail.model';
import { DynamicRouteParams, ProfessionType, CountryCode } from '../../models/route-params.model';
import { PROFESSIONS } from '../../constant/profession';
import { Dialog } from '../dialog/dialog';
import { UtilsDialog, DialogButton } from '../../../components/dialog/utils-dialog/utils-dialog';
import { ShareDialog, ShareDialogData } from '../../../components/dialog/share-dialog/share-dialog';
import { Analytics } from '../analytics/analytics';
import { Storage } from '../storage/storage';
import {
  CertificateDialogData,
  CertificateDownloadDialog,
} from '../../../components/dialog/certificate-download-dialog/certificate-download-dialog';
import { VideoDialog, VideoDialogData } from '../../../components/dialog/video-dialog/video-dialog';
import { NotificationService } from '../notification/notification';
import { Viewport, ScreenInfo } from '../viewport/viewport';
import { Auth } from '../auth/auth';
import { Logger } from '../logger/logger';
import { UtilsDialogData } from '../../../components/dialog/utils-dialog/utils-dialog';

/**
 * Permissive view of a server-side `user_badge` object. The wire shape varies
 * per surface (course details / webinar / tracker row / badge listing) — all
 * we need for the Credly hand-off is the optional `id` and `accept_url`.
 */
export interface RawCredlyBadge {
  id?: number | null;
  accept_url?: string | null;
}

/** Backend-facing course types (snake_case), used in JSON bodies and ID keys. */
export type ApiCourseType = 'masterclass' | 'podcast' | 'micro_learning';
export type CourseIdKey = 'masterclass_id' | 'podcast_id' | 'nano_learning_id';

/** Shape accepted by `openCourseInfoDialog`. */
// ponytail: was `Content | ContentDetails` from the deleted course model. Retype
// against the new backend's course payload.
export type CourseInfoInput = any;

/**
 * Utility service for common platform-wide operations.
 *
 * Usage:
 *   const utils = inject(Utils);
 *   const country = utils.country();      // e.g., 'in', 'us'
 *   const profession = utils.profession(); // e.g., 'accounting', 'finance'
 */
@Service()
export class Utils {
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly storage = inject(Storage);
  private readonly injector = inject(Injector);
  private readonly notification = inject(NotificationService);
  private readonly auth = inject(Auth);
  private readonly analytics = inject(Analytics);
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);
  private readonly viewport = inject(Viewport);
  private readonly api = inject(ApiClient);

  private readonly _country = signal<CountryCode>('us');
  private readonly _profession = signal<ProfessionType>('accounting');
  private readonly _currentUrl = signal<string>('');

  /** Current country code from route (lowercase) */
  readonly country = this._country.asReadonly();

  /** Current profession type from route */
  readonly profession = this._profession.asReadonly();

  /** Current URL as a reactive signal */
  readonly currentUrl = this._currentUrl.asReadonly();

  /** Combined route params object */
  readonly routeParams = computed<DynamicRouteParams>(() => ({
    country: this._country(),
    profession: this._profession(),
  }));

  // ── Responsive state (re-exposed from the Viewport service) ───────────────
  // The Viewport service is the single source of truth; these delegates let any
  // component that already injects Utils read screen size / orientation without
  // a separate inject. New low-level code can inject `Viewport` directly.

  /** Current screen size: `'mobile'` (<768) | `'tablet'` (768–1023) | `'desktop'` (≥1024). */
  readonly screen = this.viewport.screen;
  /** Current viewport orientation: `'portrait'` | `'landscape'`. */
  readonly orientation = this.viewport.orientation;
  /** `true` in the mobile bucket (<768). */
  readonly isMobile = this.viewport.isMobile;
  /** `true` in the tablet bucket (768–1023). */
  readonly isTablet = this.viewport.isTablet;
  /** `true` in the desktop bucket (≥1024). */
  readonly isDesktop = this.viewport.isDesktop;
  /** `true` below the desktop breakpoint — mobile OR tablet (<1024). */
  readonly isHandheld = this.viewport.isHandheld;
  /** `true` when the viewport is portrait. */
  readonly isPortrait = this.viewport.isPortrait;
  /** `true` when the viewport is landscape. */
  readonly isLandscape = this.viewport.isLandscape;

  /**
   * Snapshot of the current screen size + orientation, e.g.
   * `{ screen: 'mobile', orientation: 'portrait' }`. Prefer the `screen` /
   * `orientation` signals in reactive contexts.
   */
  getScreenInfo(): ScreenInfo {
    return this.viewport.getScreenInfo();
  }

  /** Router NavigationEnd events as a signal — auto-cleaned via `toSignal`. */
  private readonly navigationEnd = toSignal(
    this.router.events.pipe(
      filter((e: RouterEvent): e is NavigationEnd => e instanceof NavigationEnd),
    ),
    { initialValue: null },
  );

  constructor() {
    // Seed from initial URL.
    this.extractParamsFromUrl(this.router.url);
    this._currentUrl.set(this.router.url);

    // Keep country/profession/currentUrl in sync with navigation.
    effect(() => {
      const ev = this.navigationEnd();
      if (!ev) return;
      this.extractParamsFromUrl(ev.urlAfterRedirects);
      this._currentUrl.set(ev.urlAfterRedirects);
    });
  }

  /**
   * Extract country and profession from URL path.
   * Pattern: /:country/:profession_type/...
   * URLs outside that tree (e.g. `/`, `/auth/login`, `/admin/users`, `/blog/x`)
   * intentionally preserve the last known values so downstream consumers stay on
   * the correct scope while the user navigates through scope-less routes. The
   * second segment must be a real profession, otherwise `/auth/login` would set
   * country=`auth`/profession=`login` and every locale-scoped link built from
   * them (login's policy links, footer, header) would 404.
   */
  private extractParamsFromUrl(url: string): void {
    const segments = url.split(/[/?#]/).filter(Boolean);
    if (segments.length < 2) return;

    const [country, profession] = segments.map((s) => s.toLowerCase());
    if (!PROFESSIONS.some((p) => p.toLowerCase() === profession)) return;

    this._country.set(country as CountryCode);
    this._profession.set(profession as ProfessionType);
  }

  /** Get country and profession as a plain object (for non-reactive use). */
  getRouteParams(): DynamicRouteParams {
    return {
      country: this._country(),
      profession: this._profession(),
    };
  }

  slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-');
  }

  /**
   * Build an absolute, locale-scoped path from a relative nav route (e.g.
   * `'caira'` → `/us/accounting/caira`). Routes already absolute (starting
   * with `/`) pass through unchanged. Lets shared chrome (header, dropdown
   * menus, avatar menu) link correctly even when rendered outside the
   * `:country/:profession_type` tree — e.g. on the top-level `/blog` pages.
   */
  localePath(route?: string): string {
    const base = `/${this._country()}/${this._profession()}`;
    if (!route) return base;
    return route.startsWith('/') ? route : `${base}/${route}`;
  }

  /** Derives URL-style course type from current route. */
  getCourseType(): string {
    const url = this.router.url;
    if (url.includes('/podcast/')) return 'podcast';
    if (url.includes('/micro-learning/')) return 'micro-learning';
    if (url.includes('/webinar/')) return 'webinar';
    return 'masterclass';
  }

  /**
   * Backend-safe course type (snake_case) used in JSON bodies like
   * toggle-bookmark and cart requests. `getCourseType()` returns the URL-style
   * `'micro-learning'` which the backend rejects — this normalises it.
   */
  getApiCourseType(): ApiCourseType {
    const type = this.getCourseType();
    if (type === 'micro-learning') return 'micro_learning';
    return type as 'masterclass' | 'podcast';
  }

  /** Returns the JSON body ID key matching the current course type. */
  getCourseIdKey(): CourseIdKey {
    const type = this.getApiCourseType();
    return type === 'podcast'
      ? 'podcast_id'
      : type === 'micro_learning'
        ? 'nano_learning_id'
        : 'masterclass_id';
  }

  startFinalAssessment(
    courseId: string,
    courseTitle: string,
    courseType: string,
    examRules: string,
  ) {
    // The API type (`micro_learning`) differs from the URL segment
    // (`micro-learning`) that `offerings.ts` registers the feature at.
    // Masterclass and podcast share the same token for both.
    const urlSegment = courseType === 'micro_learning' ? 'micro-learning' : courseType;

    const examRulesArray: string[] = examRules ? examRules.split(/\r?\n/) : [];
    const dialogRef = this.dialog.open<
      UtilsDialog,
      { action?: DialogButton['action']; result: boolean }
    >(UtilsDialog, {
      maxWidth: '100%',
      enterAnimationDuration: '300ms',
      exitAnimationDuration: '300ms',
      data: {
        title: 'Final Assessment',
        containerClass: 'flex flex-col space-y-4 text-left',
        content: [
          { type: 'text', value: 'QAS Self-Study Qualified Assessment Rules:' },
          { type: 'list', items: examRulesArray, ordered: true },
        ],
        buttons: [{ label: 'Start Exam', variant: 'default', action: 'confirm' }],
      },
    });

    dialogRef.afterClosed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!(result?.result && result?.action === 'confirm')) return;

      // ponytail: the POST that minted a session id is gone, and CAIRA never
      // had one — an attempt is `(user, course, attempt_number)`. The route is
      // course-keyed now, so navigation no longer waits on a session; the exam
      // page reports its own empty state until #9 is bound.
      this.router.navigate([
        `${this._country()}/${this._profession()}/${urlSegment}/${courseId}/${courseTitle}/final-assessment/exam`,
      ]);
    });
  }

  openCertificateDownloadDialog(content: any) {
    const userPlan = this.auth.currentPlan();

    // Course is excluded from subscription — must be purchased individually.
    if (content.is_subscription_excluded && !content.active_plan) {
      this.openPurchaseGateDialog({
        title: 'Purchase Required',
        message:
          'This course is not included in any subscription plan and must be purchased individually to download the certificate.',
        buttons: [
          { label: 'Close', variant: 'outline', action: 'close' },
          { label: 'Add to Cart', variant: 'default', action: 'confirm' },
        ],
        onConfirm: () =>
          this.addCourseToCart(content.id, content.is_added_to_cart)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(),
      });
      return;
    }

    // Course can be purchased individually — user needs subscription or purchase.
    if (content.can_purchase_individually && !userPlan && !content.active_plan) {
      this.openPurchaseGateDialog({
        title: 'Purchase Required',
        message:
          'You need an active subscription or to purchase this course individually to download the certificate.',
        buttons: [
          { label: 'Subscribe', variant: 'outline', action: 'cancel' },
          { label: 'Add to Cart', variant: 'default', action: 'confirm' },
        ],
        onConfirm: () =>
          this.addCourseToCart(content.id, content.is_added_to_cart)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(),
        onCancel: () =>
          this.router.navigate(['/', this._country(), this._profession(), 'payment', 'plan']),
      });
      return;
    }

    // User has no active subscription — must subscribe.
    if (!userPlan && !content.active_plan) {
      this.openPurchaseGateDialog({
        title: 'Subscription Required',
        message:
          'You need an active subscription to download the certificate. Subscribe now to unlock certificate downloads and access premium content.',
        buttons: [
          { label: 'Close', variant: 'outline', action: 'close' },
          { label: 'Subscribe', variant: 'default', action: 'confirm' },
        ],
        onConfirm: () =>
          this.router.navigate(['/', this._country(), this._profession(), 'payment', 'plan']),
      });
      return;
    }

    // NASBA cert URLs are sourced lazily from `user-assessment/download_certificate/`
    // (the dialog hits it on download click). The Credly badge data still
    // comes from the course details payload — `user_badge` is typed as
    // `unknown` so we narrow here without leaking the cast into the dialog API.
    const rawBadge = content.user_badge as
      | (RawCredlyBadge & {
          badge_name?: string | null;
          badge_image?: string | null;
          description?: string | null;
        })
      | null;
    // Show the badge row whenever the server has minted a `user_badge` for
    // this user — either an already-claimed badge (acceptUrl present) or an
    // id-only stub the dialog can claim on Share click. If both are missing
    // the user isn't badge-eligible yet, so we omit the row entirely.
    const badge =
      rawBadge && (rawBadge.accept_url || rawBadge.id != null)
        ? {
            id: rawBadge.id ?? undefined,
            acceptUrl: rawBadge.accept_url ?? undefined,
            name: rawBadge.badge_name ?? undefined,
            image: rawBadge.badge_image ?? undefined,
            description: rawBadge.description ?? undefined,
          }
        : undefined;

    const data: CertificateDialogData = {
      courseId: content.id,
      courseType:
        content.course_type.toLocaleLowerCase() === 'video' ? 'masterclass' : content.course_type, // backend expects empty string instead of 'video'
      courseTitle: content.title,
      badge,
    };
    this.dialog.open<CertificateDownloadDialog, CertificateDialogData>(CertificateDownloadDialog, {
      maxWidth: '100%',
      enterAnimationDuration: '300ms',
      exitAnimationDuration: '300ms',
      data,
    });
  }

  /**
   * Claim a Credly badge via `user-badges/:id/claim/`. Single source of truth
   * for every claim surface (badge library, cpe-tracker, certificate dialog);
   * callers pipe their own error handling / analytics. The server is
   * idempotent, so a repeat claim returns the same badge + `credly_accept_url`.
   */
  // ponytail: no claim endpoint — resolves to null so callers' `.subscribe(...)`
  // and `claimAcceptUrl(...)` chains stay intact.
  claimBadge(badgeId: number): Observable<any> {
    this.logger.warn('claimBadge: no backend configured', { badgeId });
    return of(null);
  }

  /** Credly accept URL from a claim response, or `null` when none was issued. */
  claimAcceptUrl(res: any | null | undefined): string | null {
    return res?.credly_accept_url ?? null;
  }

  /**
   * Open a purchase/subscription confirmation dialog. Centralises the three
   * near-identical gating dialogs used by `openCertificateDownloadDialog`.
   */
  private openPurchaseGateDialog(config: {
    title: string;
    message: string;
    buttons: UtilsDialogData['buttons'];
    onConfirm: () => void;
    onCancel?: () => void;
  }): void {
    const data: UtilsDialogData = {
      title: config.title,
      containerClass: 'max-w-lg text-left!',
      content: [{ type: 'text', value: config.message }],
      buttons: config.buttons,
    };

    const ref = this.dialog.open<UtilsDialog, { action?: string; result: boolean }>(UtilsDialog, {
      data,
      width: 'auto',
      maxWidth: '32rem',
      disableClose: false,
    });

    ref.afterClosed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result?.result) return;
      if (result.action === 'confirm') config.onConfirm();
      else if (result.action === 'cancel') config.onCancel?.();
    });
  }

  openShareDialog(data?: ShareDialogData) {
    this.dialog.open(ShareDialog, {
      maxWidth: '100%',
      enterAnimationDuration: '300ms',
      exitAnimationDuration: '300ms',
      data: data || {},
    });
  }

  navigateToCourse(
    type: string,
    id: CairaUuid | number,
    title: string,
    state?: Record<string, unknown>,
  ) {
    const titleSlug = this.slugify(title);
    this.router.navigate([`/${this._country()}/${this._profession()}`, type, id, titleSlug], {
      state,
    });
  }

  /**
   * Build the absolute URL for a course page. Mirrors `navigateToCourse`'s path
   * shape so a link generated here matches what the router would navigate to.
   * `course_type` from API responses arrives in snake_case (`micro_learning`);
   * the URL segment is kebab‑case (`micro-learning`), so we normalize here.
   */
  buildCourseUrl(type: string, id: CairaUuid | number, title: string): string {
    const urlSegment = type === 'micro_learning' ? 'micro-learning' : type;
    const titleSlug = this.slugify(title);
    const path = `/${this._country()}/${this._profession()}/${urlSegment}/${id}/${titleSlug}`;
    if (typeof window === 'undefined') return path;
    return `${window.location.origin}${path}`;
  }

  /**
   * Navigate to the feedback route for a given course/webinar/podcast. Mirrors
   * `navigateToCourse` and appends `/feedback`, so the URL stays correct
   * regardless of which page the caller lives on (listing vs. detail). The
   * `redirect` query param defaults to the current URL when the caller
   * doesn't pass one — this way the feedback page can always route the user
   * back to where they were after submit, even when called from places that
   * forget to thread it through.
   */
  navigateToCourseFeedback(type: string, id: CairaUuid | number, title: string, redirect?: string) {
    const titleSlug = this.slugify(title);
    const redirectTo = redirect ?? this.router.url;
    this.router.navigate(
      [`/${this._country()}/${this._profession()}`, type, id, titleSlug, 'feedback'],
      { queryParams: { redirect: redirectTo } },
    );
  }

  /**
   * `environmentInjector` is required for the webinar variant — the dialog
   * lazily resolves `WebinarFacade`, which is provided at the webinar route
   * level. Without the route-scoped injector the dialog falls back to root
   * and every CTA inside silently bails. Callers that live under the webinar
   * route (e.g. `Horizontal` card) should pass `inject(EnvironmentInjector)`.
   */
  async openCourseInfoDialog(card: CourseInfoInput, environmentInjector?: EnvironmentInjector) {
    // Webinar adapter stashes the original `UpcomingPremiere` on `_webinar`.
    // When present, route to the webinar-specific dialog so we don't try to
    // render a masterclass-shaped CourseInfo with webinar fields.
    const webinar = (card as { _webinar?: unknown })._webinar;
    if (webinar) {
      const { WebinarDetailsDialog } =
        await import('../../../components/dialog/webinar-details-dialog/webinar-details-dialog');
      this.dialog.open(WebinarDetailsDialog, {
        maxWidth: '100%',
        enterAnimationDuration: '300ms',
        exitAnimationDuration: '300ms',
        data: { webinar },
        environmentInjector,
      });
      return;
    }
    const { CourseInfo } = await import('../../../components/dialog/course-info/course-info');
    this.dialog.open(CourseInfo, {
      maxWidth: '100%',
      enterAnimationDuration: '300ms',
      exitAnimationDuration: '300ms',
      disableClose: true,
      ariaLabel: 'Confirmation dialog',
      ariaDescribedBy: 'dialog-description',
      data: card,
    });
  }

  /**
   * Open the info dialog with the **full** about section.
   *
   * A list card carries only what the rail endpoints return; the dialog renders
   * `app-course-about`, which wants `course_overview`, `learning_objective_list`
   * and the instructor list — all of which live on #4. Each card type used to
   * fetch that through its own `FeatureFacade.getAbout` call; the facade went
   * with the Django strip, so all three threw on the first click.
   *
   * No cache: #4 is already cached server-side per user, and a second click is
   * cheaper than a stale about panel.
   */
  openCourseInfo(card: CourseInfoInput, environmentInjector?: EnvironmentInjector): void {
    // The webinar branch renders a different dialog from the raw payload the
    // adapter stashed — there is no #4 for a webinar.
    if ((card as { _webinar?: unknown })._webinar) {
      void this.openCourseInfoDialog(card, environmentInjector);
      return;
    }

    this.api
      .get<CourseDetailResponse>(CAIRA.courseDetail(card.id), {
        // The fallback below is the user-visible handling; a toast on top of it
        // would report a failure the learner never experiences.
        context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          void this.openCourseInfoDialog(
            toCourseDetailCard(response.course_details),
            environmentInjector,
          );
        },
        // Fall back to the card itself — a partial about section beats nothing.
        error: (error: unknown) => {
          this.logger.warn('Course about fetch failed', error);
          void this.openCourseInfoDialog(card, environmentInjector);
        },
      });
  }

  openVideoDialog(trailerLink: string | null | undefined, title: string) {
    if (!trailerLink) {
      this.notification.info('Trailer Not Found', 'No trailer is available for this course.');
      return;
    }

    const type = detectVideoMimeType(trailerLink);

    this.dialog.open<VideoDialog, VideoDialogData>(VideoDialog, {
      maxWidth: '100%',
      panelClass: 'video-dialog-panel',
      enterAnimationDuration: '300ms',
      exitAnimationDuration: '300ms',
      data: {
        videoSource: {
          src: trailerLink,
          type,
        },
        title,
        videoConfig: {
          autoplay: true,
          controls: true,
          responsive: true,
          fluid: true,
          fullScreenOnReady: true,
        },
      },
    });
  }

  /**
   * #15 · `POST caira/masterclass/<uuid>/bookmark/`.
   *
   * A **pure toggle**: CAIRA never reads the request body, so there is nothing
   * to send and no way to set a specific state. The response's `bookmarked` is
   * the new state — callers patch from that, never from a local flip.
   *
   * `options.course_type` is accepted and ignored. CAIRA has one bookmark
   * endpoint and it takes a masterclass course id; podcasts are masterclasses
   * with an audio player. The parameter stays so the five card and dialog call
   * sites keep compiling.
   *
   * Guarded centrally so every bookmark surface gets the same login prompt.
   * `EMPTY` (rather than an error) keeps `.subscribe(...)` quiet at call sites;
   * the toast is the user-facing feedback.
   */
  toggleBookmarkCourse(
    courseId: CairaUuid,
    options?: { course_type: string },
  ): Observable<{ status: boolean; is_bookmarked: boolean }> {
    if (!this.auth.isLoggedIn()) {
      this.notification.info('Login Required', 'Please log in to bookmark this course.');
      return EMPTY;
    }
    if (!courseId) return EMPTY;
    void options;

    return this.api.post<BookmarkToggleResponse>(CAIRA.bookmark(courseId), null).pipe(
      map((response) => ({
        status: response?.status === 'success',
        is_bookmarked: response?.bookmarked === true,
      })),
    );
  }

  /**
   * ponytail: no cart endpoint exists in CAIRA — there is no payment or
   * subscription model at all. Kept so the cart design stays reachable.
   */
  addCourseToCart(courseId: CairaUuid | number, isAddedToCart: boolean): Observable<any> {
    if (isAddedToCart) {
      this.notification.info('Already in Cart', 'This course is already in your cart.');
      this.openCartDrawer();
      return EMPTY;
    }
    // Still opens the drawer so the cart design remains reachable from every
    // course surface.
    this.logger.warn('addCourseToCart: no backend configured', { courseId });
    this.openCartDrawer();
    return EMPTY;
  }

  async openCartDrawer(): Promise<void> {
    const { CartDrawerDialog } =
      await import('../../../components/dialog/cart-drawer-dialog/cart-drawer-dialog');
    this.dialog.open(CartDrawerDialog, {
      width: '500px',
      maxWidth: '90vw',
      height: '100vh',
      position: 'right',
      ariaLabel: 'Cart',
      data: {},
      injector: this.injector,
    });
  }

  /**
   * ponytail: card surfaces have no resource list to open — #4 carries
   * `ai_kit` and `exercise_file_url`, but only on the course detail payload,
   * and the catalog endpoints omit both. From a card there is nothing to fetch:
   * CAIRA has no per-course resources endpoint. `CourseDetail` calls
   * `openResourceLinks` directly with the data it already holds.
   */
  openAdditionalResources(courseId: CairaUuid | number): void {
    this.logger.warn('openAdditionalResources: no resource source for a card', { courseId });
    this.openResourceLinks([]);
  }

  /**
   * Render a list of downloadable / external resources as the shared links
   * dialog, or tell the user there are none.
   */
  openResourceLinks(
    resources: {
      title?: string | null;
      description?: string | null;
      resource_file?: string | null;
      resource_link?: string | null;
    }[],
  ): void {
    // Map each resource to its openable URL (hosted file first, else the
    // external link). Resources with neither are dropped — there'd be
    // nothing to open.
    const links = resources
      .map((r) => ({
        label: r.title,
        description: r.description,
        href: r.resource_file ?? r.resource_link ?? '',
      }))
      .filter((link) => !!link.href);

    if (links.length) {
      this.dialog.open(UtilsDialog, {
        maxWidth: '100%',
        enterAnimationDuration: '300ms',
        exitAnimationDuration: '300ms',
        data: {
          title: 'Additional Resources',
          containerClass: 'max-w-lg text-left!',
          content: [{ type: 'links', items: links }],
          buttons: [{ label: 'Close', variant: 'default', action: 'close' }],
        },
      });
    } else {
      this.notification.info(
        'No Resources',
        'No additional resources are available for this course.',
      );
    }
  }
}

/**
 * Detect a video MIME type from the URL. Uses the URL API for host matching so
 * substrings don't false-match the YouTube host (e.g. `my-youtube.com`).
 */
function detectVideoMimeType(src: string): string {
  const host = parseHostname(src);
  const isYouTube =
    host === 'youtube.com' ||
    host === 'www.youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'youtu.be';
  if (isYouTube) return 'video/youtube';

  if (src.toLowerCase().endsWith('.m3u8')) return 'application/x-mpegURL';
  return 'video/mp4';
}

function parseHostname(src: string): string {
  try {
    return new URL(src, 'https://placeholder.local').hostname.toLowerCase();
  } catch {
    return '';
  }
}
