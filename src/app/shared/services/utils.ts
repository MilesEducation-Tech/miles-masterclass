import {
  computed,
  DestroyRef,
  effect,
  EnvironmentInjector,
  inject,
  Service,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router, NavigationEnd, Event as RouterEvent } from '@angular/router';
import { EMPTY, Observable } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { DynamicRouteParams, ProfessionType } from '@core/models/route-params.model';
import { CountryContext } from '@core/services/country-context/country-context';
import { PROFESSIONS } from '@core/constants/profession';
import { NgpDialogManager } from 'ng-primitives/dialog';
// The dialogs below are imported as types only and loaded with `import()` where
// they open: this service is in the initial bundle (header/footer chrome), so a
// value import would put every one of them there too (PROMPT.md §4.4).
import type { UtilsDialogData, UtilsDialogResult } from '@shared/dialogs/utils-dialog/utils-dialog';
import type { ShareDialogData } from '@shared/dialogs/share-dialog/share-dialog';
import { ApiClient } from '@core/services/api-client/api-client';
import { MASTERCLASS_ROUTES } from '@core/models/masterclass.model';
import { RouteResponse } from '@core/models/http.model';
import { Content, ContentDetails } from '@core/models/course.model';
import type { VideoDialogData } from '@shared/dialogs/video-dialog/video-dialog';
import { NotificationService } from '@core/services/notification/notification';
import { Viewport, ScreenInfo } from '@core/services/viewport/viewport';
import { Logger } from '@core/services/logger/logger';
import { AuthSession } from '@core/services/auth-session/auth-session';

/** Backend-facing course types (snake_case), used in JSON bodies and ID keys. */
export type ApiCourseType = 'masterclass' | 'podcast' | 'micro_learning';
export type CourseIdKey = 'masterclass_id' | 'podcast_id' | 'nano_learning_id';

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
  private readonly notification = inject(NotificationService);
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);
  private readonly viewport = inject(Viewport);
  private readonly auth = inject(AuthSession);

  private readonly _profession = signal<ProfessionType>('accounting');
  private readonly _currentUrl = signal<string>('');

  /**
   * The visitor's country (lower-case). Delegates to `CountryContext`, the single source: the URL
   * country when there is one, otherwise the geo-detected one — never a hard-coded `us`, so links
   * built on `/auth/login` point at the visitor's own country.
   */
  readonly country = inject(CountryContext).current;

  /** Current profession type from route */
  readonly profession = this._profession.asReadonly();

  /** Current URL as a reactive signal */
  readonly currentUrl = this._currentUrl.asReadonly();

  /** Combined route params object */
  readonly routeParams = computed<DynamicRouteParams>(() => ({
    country: this.country(),
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

    // Keep profession/currentUrl in sync with navigation (country is CountryContext's).
    effect(() => {
      const ev = this.navigationEnd();
      if (!ev) return;
      this.extractParamsFromUrl(ev.urlAfterRedirects);
      this._currentUrl.set(ev.urlAfterRedirects);
    });
  }

  /**
   * Extract the profession from URL path (country is tracked by `CountryContext`).
   * Pattern: /:country/:profession_type/...
   * URLs outside that tree (e.g. `/`, `/auth/login`, `/blog/x`)
   * intentionally preserve the last known value so downstream consumers stay on
   * the correct scope while the user navigates through scope-less routes. The
   * second segment must be a real profession, otherwise `/auth/login` would set
   * profession=`login` and every locale-scoped link built from it (login's
   * policy links, footer, header) would 404.
   */
  private extractParamsFromUrl(url: string): void {
    const profession = url.split(/[/?#]/).filter(Boolean)[1]?.toLowerCase();
    if (!PROFESSIONS.some((p) => p.toLowerCase() === profession)) return;

    this._profession.set(profession as ProfessionType);
  }

  /** Get country and profession as a plain object (for non-reactive use). */
  getRouteParams(): DynamicRouteParams {
    return {
      country: this.country(),
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
    const base = `/${this.country()}/${this._profession()}`;
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

  /**
   * Claim a Credly badge via `user-badges/:id/claim/`. Single source of truth
   * for every claim surface (badge library, cpe-tracker, certificate dialog);
   * callers pipe their own error handling. The server is
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

  async openShareDialog(data?: ShareDialogData) {
    const { ShareDialog } = await import('@shared/dialogs/share-dialog/share-dialog');
    this.dialogs.open(ShareDialog, { data: data || {} });
  }

  navigateToCourse(type: string, id: number, title: string, state?: Record<string, unknown>) {
    const titleSlug = this.slugify(title);
    this.router.navigate([`/${this.country()}/${this._profession()}`, type, id, titleSlug], {
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
    const path = `/${this.country()}/${this._profession()}/${urlSegment}/${id}/${titleSlug}`;
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
      [`/${this.country()}/${this._profession()}`, type, id, titleSlug, 'feedback'],
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
    // gets the same sign-in redirect — callers don't need to repeat the check.
    // Returning EMPTY (instead of throwing) keeps `.subscribe(...)` quiet at
    // call sites. Same redirect as the masterclass page's bookmark
    // (`CourseDetailFacade.toggleBookmark`).
    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(['/auth/login'], { queryParams: { redirect: this.router.url } });
      return EMPTY;
    }
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
          }
        }),
      );
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
                containerClass: 'max-w-lg text-start!',
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
export function detectVideoMimeType(src: string): string {
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
