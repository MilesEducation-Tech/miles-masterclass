import {
  computed,
  DestroyRef,
  effect,
  EnvironmentInjector,
  inject,
  Service,
  Injector,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpContext } from '@angular/common/http';
import { Router, NavigationEnd, Event as RouterEvent } from '@angular/router';
import { EMPTY, Observable } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { DynamicRouteParams, ProfessionType, CountryCode } from '@core/models/route-params.model';
import { PROFESSIONS } from '@core/constants/profession';
import { NgpDialogManager } from 'ng-primitives/dialog';
// The dialogs below are imported as types only and loaded with `import()` where
// they open: this service is in the initial bundle (header/footer chrome), so a
// value import would put every one of them there too (PROMPT.md §4.4).
import type { UtilsDialogData, UtilsDialogResult } from '@shared/dialogs/utils-dialog/utils-dialog';
import type { ShareDialogData } from '@shared/dialogs/share-dialog/share-dialog';
import { ApiClient } from '@core/services/api-client/api-client';
import { Analytics } from '@core/services/analytics/analytics';
import { MASTERCLASS_ROUTES } from '@core/models/masterclass.model';
import {
  RouteParams,
  RouteResponse,
  RouteRequest,
  SKIP_ERROR_NOTIFICATION,
} from '@core/models/http.model';
import {
  Content,
  ContentDetails,
  FinalAssessmentExamResponse,
  QuizQuestion,
} from '@core/models/course.model';
import { Storage } from '@core/services/storage/storage';
import type { CertificateDialogData } from '@shared/dialogs/certificate-download-dialog/certificate-download-dialog';
import type { VideoDialogData } from '@shared/dialogs/video-dialog/video-dialog';
import { NotificationService } from '@core/services/notification/notification';
import { Viewport, ScreenInfo } from '@core/services/viewport/viewport';
// CartDrawerDialog is loaded lazily in openCartDrawer() — this service is
// eagerly instantiated (injected by the header/footer chrome), so a static
// import would pull the dialog and its `@angular/forms` dependency into the
// initial bundle.
import { CartStore } from '@core/services/cart/cart-store';
import {
  CART_DRAWER_DIALOG,
  SUBSCRIPTION_DIALOG,
} from '@core/services/dialog/feature-dialog-tokens';
import { FeatureFacade } from '@core/services/feature-facade/feature-facade';
import { Logger } from '@core/services/logger/logger';
import { canAccessCpeMode, CpeModeGateContent } from '@shared/utils/cpe-mode-access';

type StartFinalAssessmentParams = RouteParams<typeof MASTERCLASS_ROUTES.startFinalAssessment>;

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

/**
 * Normalises every spelling of a course type the app can hand around into the
 * backend token. Route literals use `masterclass`/`podcast`/`micro_learning`,
 * payloads use the display label (`Video`, `Podcast`), and the CPE tracker uses
 * `nano_learning`. Returns `null` for anything unrecognised so callers can bail
 * instead of firing a request with no course-id key.
 *
 * Per-caller translation kept missing a case — the exam-retake path mapped only
 * `Video` and sent `Podcast` straight through.
 */
export function toApiCourseType(courseType: string): ApiCourseType | null {
  switch (courseType?.trim().toLowerCase()) {
    case 'video':
    case 'masterclass':
      return 'masterclass';
    case 'audio':
    case 'podcast':
      return 'podcast';
    // An AI Lab course is a nano-learning row, so it shares the id key.
    case 'ai_lab':
    case 'nano_learning':
    case 'micro_learning':
    case 'micro-learning':
      return 'micro_learning';
    default:
      return null;
  }
}

/** Shape accepted by `openCourseInfoDialog`. */
export type CourseInfoInput = Content | ContentDetails;

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
  private readonly dialogs = inject(NgpDialogManager);
  private readonly http = inject(ApiClient);
  private readonly storage = inject(Storage);
  private readonly injector = inject(Injector);
  private readonly notification = inject(NotificationService);
  // Cart state and its loader live in core, so this shared service does not
  // import the payment feature (PROMPT.md §3).
  private readonly cart = inject(CartStore);
  private readonly cartDrawerDialog = inject(CART_DRAWER_DIALOG);
  private readonly subscriptionDialog = inject(SUBSCRIPTION_DIALOG);
  private readonly featureFacade = inject(FeatureFacade);
  private readonly analytics = inject(Analytics);
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);
  private readonly viewport = inject(Viewport);

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
    // AI Lab courses are nano-learning rows that report `course_type: 'ai_lab'`.
    // The route lives under the AI Labs landing page, not under /offerings.
    if (url.includes('/ai-labs/')) return 'ai_lab';
    return 'masterclass';
  }

  /**
   * Segment for `v2/:course_type/details/`. Everything matches
   * `getCourseType()` except AI Lab, whose details are served by the
   * micro-learning serializer (`v2/ai_lab/details/` is a 404) — the payload
   * still comes back with `course_type: 'ai_lab'`.
   */
  getCourseDetailsSegment(): string {
    const type = this.getCourseType();
    return type === 'ai_lab' ? 'micro-learning' : type;
  }

  /**
   * Backend-safe course type (snake_case) used in JSON bodies like
   * toggle-bookmark and cart requests. `getCourseType()` returns the URL-style
   * `'micro-learning'` which the backend rejects — this normalises it.
   */
  getApiCourseType(): ApiCourseType {
    const type = this.getCourseType();
    if (type === 'micro-learning' || type === 'ai_lab') return 'micro_learning';
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

  async startFinalAssessment(
    courseId: string,
    courseTitle: string,
    courseType: string,
    examRules: string,
  ) {
    const apiType = toApiCourseType(courseType);
    if (!apiType) {
      // No id key means the request can only 400. Fail before opening the rules
      // dialog rather than after the user has agreed to them.
      this.logger.error('Cannot start final assessment: unknown course type', { courseType });
      this.notification.error('Error', 'Unable to start the assessment. Please try again later.');
      return;
    }
    // The API type (`micro_learning`) differs from the URL segment
    // (`micro-learning`) that `offerings.ts` registers the feature at.
    // Masterclass and podcast share the same token for both. AI Lab keeps its
    // own segment — its exam routes hang off the /ai-labs page, not /offerings.
    const urlSegment =
      courseType === 'ai_lab'
        ? 'ai-labs'
        : apiType === 'micro_learning'
          ? 'micro-learning'
          : apiType;
    // Titles arrive raw from details payloads (`Fraud Risk & Detection`) as well
    // as pre-slugged from route params. Slugify both — a raw title can carry a
    // `/` that would split the URL into an extra segment and miss the route.
    const titleSlug = this.slugify(courseTitle);

    const examRulesArray: string[] = examRules ? examRules.split(/\r?\n/) : [];
    const { UtilsDialog } = await import('@shared/dialogs/utils-dialog/utils-dialog');
    const dialogRef = this.dialogs.open<UtilsDialogData, UtilsDialogResult>(UtilsDialog, {
      data: {
        title: 'Final Assessment',
        containerClass: 'flex flex-col space-y-4 text-left',
        content: [
          { type: 'text', value: 'QAS Self-Study Qualified Assessment Rules:' },
          { type: 'list', items: examRulesArray, ordered: true },
        ],
        buttons: [{ label: 'Start Exam', variant: 'default', action: 'confirm' }],
        maxWidth: '100%',
      },
    });

    dialogRef.afterClosed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!(result?.result && result?.action === 'confirm')) return;

      const cached: QuizQuestion[] =
        this.storage.getLocal(`final_assessment_questions_${courseId}`) || [];
      if (cached.length) {
        const session_id = this.storage.getLocal('session_id');
        this.router.navigate([
          `${this._country()}/${this._profession()}/${urlSegment}/${courseId}/${titleSlug}/final-assessment/${session_id}/exam`,
        ]);
        return;
      }

      const params: StartFinalAssessmentParams = {};
      if (apiType === 'masterclass') params.masterclass_id = +courseId;
      else if (apiType === 'podcast') params.podcast_id = +courseId;
      else params.nano_learning_id = +courseId;
      // Same id key as a reel, so the backend needs to be told it's a lab.
      if (courseType === 'ai_lab') params.course_type = 'ai_lab';

      const context = new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);
      this.http
        .post<FinalAssessmentExamResponse>(
          MASTERCLASS_ROUTES.startFinalAssessment.path,
          {},
          { params, context },
        )
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (value) => {
            this.storage.setLocal('session_id', value.session_id.toString());
            this.storage.setLocal(`final_assessment_questions_${courseId}`, value.questions);
            this.router.navigate([
              `${this._country()}/${this._profession()}/${urlSegment}/${courseId}/${titleSlug}/final-assessment/${value.session_id}/exam`,
            ]);
          },
          error: (error) => {
            this.logger.error('Failed to start final assessment', error);
            // The rules dialog has already closed — without this the user is
            // left staring at the page with no feedback at all.
            this.notification.error('Error', 'Unable to start the assessment. Please try again.');
          },
        });
    });
  }

  /**
   * Whether the user may enter CPE Certification Mode for this content.
   *
   * CPE mode is the paid tier — it awards credit and a certificate — so it
   * needs an active subscription. Preview mode is free and is never gated by
   * this. Free content and content the user bought individually
   * (`active_plan`) are exempt.
   *
   * Falls back to the cookie snapshot for the same reason `activePlanGuard`
   * does: on a hard refresh `currentPlan` starts `null` until the async
   * current-plan fetch lands, and without the fallback an active subscriber
   * clicking straight through would be wrongly paywalled.
   *
   * Reads `hasActivePlan()` (status === 'active'), NOT `!!currentPlan()` —
   * the truthiness form used by some older gates lets an expired or cancelled
   * plan through.
   *
   * The rule itself lives in `shared/utils/cpe-mode-access` as a pure
   * function; this wrapper only supplies the plan flag.
   */
  canAccessCpeMode(content: CpeModeGateContent): boolean {
    // ponytail: the subscription flag came from the removed session service.
    // With nothing to check against, the gate is open — restore the plan
    // lookup here to make it decide again.
    return canAccessCpeMode(content, true);
  }

  /**
   * Gate for every CPE mode-selection entry point. Returns `true` when the
   * caller may proceed; otherwise sends the user where they need to go
   * (login for guests, the subscription upsell for everyone else) and returns
   * `false` so the caller can bail.
   *
   * Same dialog and options `EngagementDialog` uses, so the paywall a learner
   * meets here is identical to the one everywhere else. The dialog now lives in
   * `features/payment` and is resolved through `SUBSCRIPTION_DIALOG`, so this
   * stays synchronous: the open is fired and not awaited, exactly as before,
   * and the gate's `false` is returned immediately either way.
   */
  requireCpeModeAccess(content: CpeModeGateContent): boolean {
    if (this.canAccessCpeMode(content)) return true;

    // ponytail: the guest branch (redirect to login) went with the auth layer.
    void this.subscriptionDialog().then((SubscriptionDialog) =>
      this.dialogs.open(SubscriptionDialog),
    );
    return false;
  }

  async openCertificateDownloadDialog(content: ContentDetails) {
    // ponytail: was `auth.currentPlan()`; no session layer, so the
    // subscription branch below falls back to the content's own flags.
    const userPlan = null;

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
    const { CertificateDownloadDialog } =
      await import('@shared/dialogs/certificate-download-dialog/certificate-download-dialog');
    this.dialogs.open(CertificateDownloadDialog, { data });
  }

  /**
   * Claim a Credly badge via `user-badges/:id/claim/`. Single source of truth
   * for every claim surface (badge library, cpe-tracker, certificate dialog);
   * callers pipe their own error handling / analytics. The server is
   * idempotent, so a repeat claim returns the same badge + `credly_accept_url`.
   */
  claimBadge(badgeId: number): Observable<RouteResponse<typeof MASTERCLASS_ROUTES.claimBadge>> {
    const path = MASTERCLASS_ROUTES.claimBadge.path.replace(':id', String(badgeId));
    return this.http.get<RouteResponse<typeof MASTERCLASS_ROUTES.claimBadge>>(path);
  }

  /** Credly accept URL from a claim response, or `null` when none was issued. */
  claimAcceptUrl(
    res: RouteResponse<typeof MASTERCLASS_ROUTES.claimBadge> | null | undefined,
  ): string | null {
    return res?.credly_accept_url ?? null;
  }

  /**
   * Open a purchase/subscription confirmation dialog. Centralises the three
   * near-identical gating dialogs used by `openCertificateDownloadDialog`.
   */
  private async openPurchaseGateDialog(config: {
    title: string;
    message: string;
    buttons: UtilsDialogData['buttons'];
    onConfirm: () => void;
    onCancel?: () => void;
  }): Promise<void> {
    const data: UtilsDialogData = {
      title: config.title,
      containerClass: 'max-w-lg text-left!',
      content: [{ type: 'text', value: config.message }],
      buttons: config.buttons,
    };

    const { UtilsDialog } = await import('@shared/dialogs/utils-dialog/utils-dialog');
    const ref = this.dialogs.open<UtilsDialogData, UtilsDialogResult>(UtilsDialog, {
      data: { ...data, maxWidth: '32rem' },
    });

    ref.afterClosed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result?.result) return;
      if (result.action === 'confirm') config.onConfirm();
      else if (result.action === 'cancel') config.onCancel?.();
    });
  }

  async openShareDialog(data?: ShareDialogData) {
    const { ShareDialog } = await import('@shared/dialogs/share-dialog/share-dialog');
    this.dialogs.open(ShareDialog, { data: data || {} });
  }

  navigateToCourse(type: string, id: number, title: string, state?: Record<string, unknown>) {
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
  buildCourseUrl(type: string, id: number, title: string): string {
    const urlSegment =
      type === 'micro_learning' ? 'micro-learning' : type === 'ai_lab' ? 'ai-labs' : type;
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
  navigateToCourseFeedback(type: string, id: number, title: string, redirect?: string) {
    const titleSlug = this.slugify(title);
    const redirectTo = redirect ?? this.router.url;
    this.router.navigate(
      [`/${this._country()}/${this._profession()}`, type, id, titleSlug, 'feedback'],
      { queryParams: { redirect: redirectTo } },
    );
  }

  /**
   * `environmentInjector` lets a caller hand the dialog its route-scoped
   * injector. It used to be required for the webinar variant, which resolved
   * `WebinarFacade` from the webinar route; that facade is gone, so the
   * parameter is now only forwarded for any other route-scoped provider.
   */
  async openCourseInfoDialog(card: CourseInfoInput, environmentInjector?: EnvironmentInjector) {
    // Webinar adapter stashes the original `UpcomingPremiere` on `_webinar`.
    // When present, route to the webinar-specific dialog so we don't try to
    // render a masterclass-shaped CourseInfo with webinar fields.
    const webinar = (card as { _webinar?: unknown })._webinar;
    if (webinar) {
      const { WebinarDetailsDialog } =
        await import('@shared/dialogs/webinar-details-dialog/webinar-details-dialog');
      this.dialogs.open(WebinarDetailsDialog, { data: { webinar }, injector: environmentInjector });
      return;
    }
    const { CourseInfo } = await import('@shared/dialogs/course-info/course-info');
    this.dialogs.open(CourseInfo, { data: card });
  }

  async openVideoDialog(trailerLink: string | null | undefined, title: string) {
    if (!trailerLink) {
      this.notification.info('Trailer Not Found', 'No trailer is available for this course.');
      return;
    }

    const type = detectVideoMimeType(trailerLink);
    const { VideoDialog } = await import('@shared/dialogs/video-dialog/video-dialog');

    this.dialogs.open<VideoDialogData>(VideoDialog, {
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

  toggleBookmarkCourse(courseId: number, options?: { course_type: string }) {
    // Guarded centrally so every bookmark surface (cards, Remind Me, dialog)
    // gets the same login prompt — callers don't need to repeat the check.
    // Returning EMPTY (instead of throwing) keeps `.subscribe(...)` quiet at
    // call sites; the toast is the user-facing feedback.
    const rawCourseType = options?.course_type ?? this.getApiCourseType();
    // Content tagged as `video` is served from the masterclass bookmark
    // endpoint — the bookmark API doesn't recognize a `video` course type, so
    // we collapse it here rather than asking every caller to remember.
    const courseType = rawCourseType === 'video' ? 'masterclass' : rawCourseType;
    return this.http
      .post<RouteResponse<typeof MASTERCLASS_ROUTES.toggleBookmark>>(
        MASTERCLASS_ROUTES.toggleBookmark.path,
        { course_id: courseId, course_type: courseType },
      )
      .pipe(
        tap((response) => {
          if (response.status) {
            this.notification.success(
              response.is_bookmarked ? 'Bookmarked' : 'Bookmark Removed',
              response.message,
            );
            // Fan out to every cached feature list so any visible card flips
            // its bookmark icon in lockstep, and the dedicated bookmark listing
            // (if loaded) adds/removes the course locally — no extra round-trip.
            this.featureFacade.applyBookmarkChange(courseId, response.is_bookmarked, courseType);
            this.analytics.trackEvent(response.is_bookmarked ? 'bookmark_add' : 'bookmark_remove', {
              course_id: courseId,
              course_type: courseType,
            });
          }
        }),
      );
  }

  addCourseToCart(courseId: number, isAddedToCart: boolean) {
    if (isAddedToCart) {
      this.notification.info('Already in Cart', 'This course is already in your cart.');
      this.openCartDrawer();
      return EMPTY;
    }
    const courseType = this.getApiCourseType();
    const body: RouteRequest<typeof MASTERCLASS_ROUTES.addToCart> = {
      item_id: courseId,
      item_type: courseType,
    };
    return this.http
      .post<RouteResponse<typeof MASTERCLASS_ROUTES.addToCart>>(
        MASTERCLASS_ROUTES.addToCart.path,
        body,
      )
      .pipe(
        tap((response) => {
          if (response.status) {
            this.notification.success('Added to Cart', response.message);
            this.openCartDrawer();
          }
        }),
      );
  }

  async openCartDrawer(): Promise<void> {
    this.cart.loadMyBucket({ force: true });
    const CartDrawerDialog = await this.cartDrawerDialog();
    this.dialogs.open(CartDrawerDialog, { injector: this.injector });
  }

  openAdditionalResources(courseId: number): void {
    const path = MASTERCLASS_ROUTES.additionalResources.path.replace(
      ':courseId',
      courseId.toString(),
    );
    this.http
      .get<RouteResponse<typeof MASTERCLASS_ROUTES.additionalResources>>(path)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: async (response) => {
          // Map each resource to its openable URL (hosted file first, else the
          // external link). Resources with neither are dropped — there'd be
          // nothing to open.
          const links = (response.data ?? [])
            .map((r) => ({
              label: r.title,
              description: r.description,
              href: r.resource_file ?? r.resource_link ?? '',
            }))
            .filter((link) => !!link.href);

          if (links.length) {
            const { UtilsDialog } = await import('@shared/dialogs/utils-dialog/utils-dialog');
            this.dialogs.open<UtilsDialogData, UtilsDialogResult>(UtilsDialog, {
              data: {
                title: 'Additional Resources',
                containerClass: 'max-w-lg text-left!',
                content: [{ type: 'links', items: links }],
                buttons: [{ label: 'Close', variant: 'default', action: 'close' }],
                maxWidth: '100%',
              },
            });
          } else {
            this.notification.info(
              'No Resources',
              'No additional resources are available for this course.',
            );
          }
        },
        error: (error) => {
          this.logger.error('Failed to fetch additional resources', error);
          this.notification.error(
            'Error',
            'Failed to fetch additional resources. Please try again later.',
          );
        },
      });
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
