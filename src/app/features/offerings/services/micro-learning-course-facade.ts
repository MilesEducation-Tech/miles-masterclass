import { isPlatformBrowser, Location } from '@angular/common';
import { HttpContext, HttpErrorResponse, httpResource } from '@angular/common/http';
import {
  computed,
  DOCUMENT,
  effect,
  inject,
  linkedSignal,
  PLATFORM_ID,
  Service,
  Signal,
  signal,
  untracked,
} from '@angular/core';
import { Router, UrlSegment } from '@angular/router';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { firstValueFrom } from 'rxjs';
import { SKIP_ERROR_NOTIFICATION } from '@core/models/http.model';
import { ApiClient, apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { SUBSCRIPTION_DIALOG } from '@core/services/dialog/feature-dialog-tokens';
import { Logger } from '@core/services/logger/logger';
import { MasterclassBookmarks } from '@core/services/masterclass-bookmarks/masterclass-bookmarks';
import { NotificationService } from '@core/services/notification/notification';
import { withPreviousValue } from '@core/utils/with-previous-value';
import { VideoSource } from '@shared/components/video-js/video-js';
import { detectVideoMimeType, Utils } from '@shared/services/utils';
import {
  COURSE_DETAIL_API,
  COURSE_DETAIL_CHAPTERS_PAGE_SIZE,
  COURSE_ID_PATTERN,
} from '@features/offerings/constants/course-detail';
import {
  REEL_ACCESS_COPY,
  REEL_COURSE_TYPES,
  REEL_PLAYER_COPY,
  REELS_FEED_PAGE_SIZE,
  REELS_FEED_URL,
} from '@features/offerings/constants/reels';
import {
  MasterclassCourseDetail,
  parseAboutCourseId,
  parseCourseDetail,
} from '@features/offerings/models/course-detail.model';
import { MicroLearningOptionId } from '@features/offerings/models/micro-learning-course.model';
import {
  parseReelAnchor,
  parseReelFeed,
  Reel,
  ReelAccess,
  ReelFeedPage,
  ReelRouteParams,
  ReelScrollRequest,
} from '@features/offerings/models/reel.model';
// Type-only: both dialogs load with `import()` when opened (AGENTS.md §4.4).
import type { HtmlContentDialogData } from '@features/offerings/dialogs/html-content-dialog/html-content-dialog';

/** Window (ms) after a programmatic scroll during which scroll events are ignored. */
const PROGRAMMATIC_SCROLL_DEBOUNCE_MS = 600;

/** A 404 for a reel the feed doesn't show, or a 400 for a malformed id or slug. */
const isMissing = (error: unknown): boolean =>
  error instanceof HttpErrorResponse && (error.status === 404 || error.status === 400);

/**
 * The reel player, on the web API's reel feed. The page `connect()`s it to the
 * reel in its URL; the feed opens on that reel (`reels-feed/<uuid>/`), and
 * scrolling to the end reads the next page. A reel carries the learner's state
 * on it, so what plays is decided from the reel itself: the server's
 * `course_is_locked` strips the stream, and the player then plays the trailer
 * with a sign-in (signed out) or subscribe (signed in) button. Signing in
 * re-reads the feed as `post_login`, so a reel the learner may watch unlocks in
 * place.
 *
 * Route-scoped: the player's route lists it in `providers`. The page and the
 * reel cards inject it, read its signals and call its methods; none of them
 * calls the API.
 */
@Service({ autoProvided: false })
export class MicroLearningCourseFacade {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthSession);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly subscriptionDialog = inject(SUBSCRIPTION_DIALOG);
  private readonly bookmarks = inject(MasterclassBookmarks);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly utils = inject(Utils);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // ─── The reel in the URL ──────────────────────────────────────────────────

  /** The reel the page opened on, as a signal; `null` until `connect()`. */
  private readonly params = signal<Signal<ReelRouteParams> | null>(null);

  private readonly routeId = computed(() => {
    const id = this.params()?.().courseId;
    return id && COURSE_ID_PATTERN.test(id) ? id : null;
  });

  /** An old numeric link (still in search results and shared links) is looked up by slug. */
  private readonly legacySlug = computed(() =>
    this.routeId() ? null : this.params()?.().slug || null,
  );

  private readonly unresolvable = computed(
    () => this.params() !== null && !this.routeId() && !this.legacySlug(),
  );

  /** The feed takes a UUID only, so an old link's slug asks `about-course/` for it first. */
  private readonly legacyIdResource = httpResource<string>(
    () => {
      const slug = this.legacySlug();
      return slug
        ? { url: apiUrl(COURSE_DETAIL_API.reels.aboutCourse), params: { slug } }
        : undefined;
    },
    { parse: parseAboutCourseId },
  );

  /** The reel the feed opens on. */
  private readonly openedId = computed(
    () =>
      this.routeId() ?? (this.legacyIdResource.hasValue() ? this.legacyIdResource.value() : null),
  );

  /** From the session's boolean, never the token, so a token rotation doesn't refetch. */
  private readonly loginType = computed(() =>
    this.auth.isAuthenticated() ? 'post_login' : 'pre_login',
  );

  /** What the feed is keyed on: a new reel, or signing in or out, starts it over. */
  private readonly feedKey = computed(() => `${this.openedId()}|${this.loginType()}`);

  private readonly feedParams = (page?: number) => ({
    login_type: this.loginType(),
    course_type: REEL_COURSE_TYPES.join(','),
    page_size: REELS_FEED_PAGE_SIZE,
    ...(page ? { page } : {}),
  });

  // ─── The feed ─────────────────────────────────────────────────────────────

  /**
   * The feed opened on the reel: that reel, then page 1 without it. `pre_login`
   * is public, so the SERVER reads it: the reel is in the SSR HTML and the
   * browser reuses it. `post_login` needs the learner's token, which lives in
   * the browser.
   */
  private readonly anchorResource = httpResource(
    () => {
      const id = this.openedId();
      if (!id) return undefined;
      if (!this.isBrowser && this.loginType() === 'post_login') return undefined;
      return { url: apiUrl(`${REELS_FEED_URL}${id}/`), params: this.feedParams() };
    },
    { parse: parseReelAnchor },
  );

  /** Holds the feed through a re-read (sign-in), so the player doesn't flash empty. */
  private readonly anchor = withPreviousValue(this.anchorResource);

  /** The feed page asked for beyond the first; 1 (none) until the learner nears the end. */
  private readonly requestedPage = linkedSignal({ source: this.feedKey, computation: () => 1 });

  private readonly pageResource = httpResource(
    () => {
      const page = this.requestedPage();
      if (page < 2 || !this.openedId()) return undefined;
      return { url: apiUrl(REELS_FEED_URL), params: this.feedParams(page) };
    },
    { parse: parseReelFeed },
  );

  /** The reels of the pages read after the first, in order; reset with the feed. */
  private readonly appended = linkedSignal<string, Reel[]>({
    source: this.feedKey,
    computation: () => [],
  });

  /** The last page read, and whether there is another. */
  private readonly lastPage = linkedSignal<
    ReelFeedPage | undefined,
    Pick<ReelFeedPage, 'page' | 'hasNext'>
  >({
    source: () => (this.anchor.hasValue() ? this.anchor.value().rest : undefined),
    computation: (rest) => ({ page: rest?.page ?? 1, hasNext: rest?.hasNext ?? false }),
  });

  private readonly appendPage = effect(() => {
    if (!this.pageResource.hasValue()) return;
    const page = this.pageResource.value();
    untracked(() => {
      this.appended.update((reels) => [...reels, ...page.reels]);
      this.lastPage.set({ page: page.page, hasNext: page.hasNext });
    });
  });

  /**
   * Every reel read so far: the one opened on first. A later page can repeat a
   * reel (the anchor's page leaves it out, the plain feed doesn't), so each
   * reel is listed once.
   */
  readonly reels = computed<Reel[]>(() => {
    if (!this.anchor.hasValue()) return [];
    const { anchor, rest } = this.anchor.value();
    const seen = new Set<string>();
    return [anchor, ...rest.reels, ...this.appended()].filter((reel) => {
      if (seen.has(reel.id)) return false;
      seen.add(reel.id);
      return true;
    });
  });

  readonly loading = computed(
    () => this.legacyIdResource.isLoading() || this.anchorResource.isLoading(),
  );

  /** No such reel: a URL that names none, or a 404 / 400 for its id or slug. */
  readonly notFound = computed(
    () =>
      this.unresolvable() ||
      isMissing(this.legacyIdResource.error()) ||
      isMissing(this.anchorResource.error()),
  );

  /** Any other failed read, a contract mismatch included; the page shows it with a retry. */
  readonly loadError = computed(() =>
    this.notFound() ? null : (this.legacyIdResource.error() ?? this.anchorResource.error() ?? null),
  );

  /** Follow the reel in the page's URL; called once, from the page's constructor. */
  connect(params: Signal<ReelRouteParams>): void {
    this.params.set(params);
  }

  reload(): void {
    if (this.legacyIdResource.error()) this.legacyIdResource.reload();
    else this.anchorResource.reload();
  }

  /** Read the next page; the page calls it as the learner nears the end. */
  loadNextPage(): void {
    if (this.pageResource.isLoading()) return;
    if (this.pageResource.error()) {
      this.pageResource.reload();
      return;
    }
    const { page, hasNext } = this.lastPage();
    if (hasNext) this.requestedPage.set(page + 1);
  }

  // ─── The reel on screen ───────────────────────────────────────────────────

  private readonly selectedId = linkedSignal(() => this.openedId());

  readonly activeIndex = computed(() => {
    const index = this.reels().findIndex((reel) => reel.id === this.selectedId());
    return index >= 0 ? index : 0;
  });

  readonly activeReel = computed<Reel | null>(() => this.reels()[this.activeIndex()] ?? null);

  /** The page scrolls a reel into view when this changes. */
  readonly scrollRequest = signal<ReelScrollRequest | null>(null);

  private scrollToken = 0;

  /** When a programmatic scroll started, so the scroll it causes doesn't re-select. */
  private lastProgrammaticScrollAt = 0;

  /** Sound on by default; `VideoJs` swallows an autoplay the browser blocks. */
  readonly muted = signal(false);

  isActive(reel: Reel): boolean {
    return reel.id === this.activeReel()?.id;
  }

  /** The reel on screen and its neighbours mount a player, so a swipe starts at once. */
  isPreloaded(reel: Reel): boolean {
    const index = this.reels().findIndex((item) => item.id === reel.id);
    return index >= 0 && Math.abs(index - this.activeIndex()) <= 1;
  }

  toggleMute(): void {
    this.muted.update((muted) => !muted);
  }

  navigateToReel(id: string): void {
    if (!this.reels().some((reel) => reel.id === id)) return;
    this.selectedId.set(id);
    this.lastProgrammaticScrollAt = Date.now();
    this.scrollRequest.set({ id, token: ++this.scrollToken });
    this.syncUrlToReel(id);
  }

  /** The page's scroll settled on a reel. Ignored right after a programmatic scroll. */
  onScrollSelect(id: string): void {
    if (Date.now() - this.lastProgrammaticScrollAt < PROGRAMMATIC_SCROLL_DEBOUNCE_MS) return;
    if (id === this.selectedId()) return;
    this.selectedId.set(id);
    this.syncUrlToReel(id);
  }

  // An old numeric link: once the feed answers, the URL carries the reel's UUID and slug.
  private readonly urlFromLegacyLink = effect(() => {
    if (this.routeId() || !this.anchor.hasValue()) return;
    const id = this.anchor.value().anchor.id;
    untracked(() => this.syncUrlToReel(id));
  });

  /**
   * Put the reel's UUID and slug in the URL's last two segments.
   * `Location.replaceState` bypasses the router, so the route's inputs (and so
   * the feed) stay put; a refresh or a shared link opens on this reel.
   */
  private syncUrlToReel(id: string): void {
    const reel = this.reels().find((item) => item.id === id);
    if (!reel || !this.isBrowser) return;
    const tree = this.router.parseUrl(this.router.url);
    const primary = tree.root.children['primary'];
    const segments = primary?.segments ?? [];
    if (!primary || segments.length < 2) return;
    primary.segments = segments.map((segment, index) => {
      if (index === segments.length - 2) return new UrlSegment(reel.id, segment.parameters);
      if (index === segments.length - 1) return new UrlSegment(reel.slug, segment.parameters);
      return segment;
    });
    this.location.replaceState(this.router.serializeUrl(tree));
  }

  /** The reel's own page: what sign-in returns to and what share sends. */
  private reelPath(reel: Reel): string {
    return `/${this.utils.country()}/${this.utils.profession()}/${COURSE_DETAIL_API.reels.urlSegment}/${reel.id}/${reel.slug}`;
  }

  // ─── Access ───────────────────────────────────────────────────────────────

  /** Decided by the server: `course_is_locked` is set signed out and without an entitlement. */
  access(reel: Reel): ReelAccess {
    if (!this.auth.isAuthenticated()) return 'guest';
    return reel.user_state.course_is_locked ? 'locked' : 'open';
  }

  /** What the overlay over a locked reel says; `null` when the learner may watch it. */
  accessCopy(reel: Reel): (typeof REEL_ACCESS_COPY)[keyof typeof REEL_ACCESS_COPY] | null {
    const access = this.access(reel);
    return access === 'open' ? null : REEL_ACCESS_COPY[access];
  }

  /** The reel's stream when the learner may watch it, its trailer otherwise. */
  sources(reel: Reel): VideoSource[] {
    const url =
      this.access(reel) === 'open' ? reel.chapter.hls_video_url : reel.vertical_trailer_url;
    return url ? [{ src: url, type: detectVideoMimeType(url) }] : [];
  }

  /** The overlay's button: sign in and come back to this reel, or the subscription offer. */
  async unlock(reel: Reel): Promise<void> {
    if (this.access(reel) === 'guest') {
      void this.router.navigate(['/auth/login'], {
        queryParams: { redirect: this.reelPath(reel) },
      });
      return;
    }
    const SubscriptionDialog = await this.subscriptionDialog();
    this.dialogs.open(SubscriptionDialog);
  }

  // ─── Bookmark and share ───────────────────────────────────────────────────

  isBookmarked(reel: Reel): boolean {
    return this.bookmarks.isBookmarked(reel);
  }

  /** `bookmark/<uuid>/`, through the root service, so the landing page's My List follows. */
  toggleBookmark(reel: Reel): void {
    this.bookmarks.toggle(reel);
  }

  /** The reel's own URL: the address bar can lag a swipe behind. */
  share(reel: Reel): void {
    void this.utils.openShareDialog({
      url: `${this.document.location.origin}${this.reelPath(reel)}`,
    });
  }

  // ─── About, Transcript, Glossary ──────────────────────────────────────────

  onOption(reel: Reel, option: MicroLearningOptionId): void {
    if (option === 'about') void this.openAbout(reel);
    else if (option === 'transcript') void this.openTranscript(reel);
    else void this.openGlossary(reel);
  }

  /** The side panel reads the reel's `course-detail/` through its own `CourseDetailFacade`. */
  private async openAbout(reel: Reel): Promise<void> {
    const { MicroLearningAboutPanel } =
      await import('@features/offerings/micro-learning/components/micro-learning-about-panel/micro-learning-about-panel');
    this.dialogs.open<ReelRouteParams>(MicroLearningAboutPanel, {
      data: { courseId: reel.id, slug: reel.slug },
    });
  }

  private async openTranscript(reel: Reel): Promise<void> {
    const detail = await this.reelDetail(reel);
    if (!detail) return;
    const chapter =
      detail.chapters.find((item) => item.id === reel.chapter.id) ?? detail.chapters[0];
    const html = chapter?.transcript_text;
    if (!html) {
      const { title, body } = REEL_PLAYER_COPY.noTranscript;
      this.notification.info(title, body);
      return;
    }
    await this.showHtml(`Transcript - ${reel.title}`, html);
  }

  private async openGlossary(reel: Reel): Promise<void> {
    const detail = await this.reelDetail(reel);
    if (!detail) return;
    const html = detail.miscellaneous_data.glossary;
    if (!html) {
      const { title, body } = REEL_PLAYER_COPY.noGlossary;
      this.notification.info(title, body);
      return;
    }
    await this.showHtml(`${reel.title} - Glossary`, html);
  }

  /** `course-detail/` per reel, read when the learner first asks, kept for the visit. */
  private readonly details = new Map<string, Promise<MasterclassCourseDetail>>();

  /**
   * The reel's `course-detail/`, for its transcript and glossary, which the
   * feed doesn't carry. On demand: a learner swipes through many reels and
   * opens these on few. `null` (and a toast) when the read fails.
   */
  private async reelDetail(reel: Reel): Promise<MasterclassCourseDetail | null> {
    const key = `${reel.id}|${this.loginType()}`;
    let pending = this.details.get(key);
    if (!pending) {
      pending = firstValueFrom(
        this.api.get<unknown>(`${COURSE_DETAIL_API.reels.courseDetail}${reel.id}/`, {
          params: {
            login_type: this.loginType(),
            'chapters.page_size': COURSE_DETAIL_CHAPTERS_PAGE_SIZE,
          },
          context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
        }),
      ).then(parseCourseDetail);
      this.details.set(key, pending);
    }
    try {
      return await pending;
    } catch (error) {
      this.details.delete(key);
      this.logger.error('[MicroLearningCourse] course-detail read failed', error);
      const { title, body } = REEL_PLAYER_COPY.readFailed;
      this.notification.error(title, body);
      return null;
    }
  }

  private async showHtml(title: string, htmlContent: string): Promise<void> {
    const { HtmlContentDialog } =
      await import('@features/offerings/dialogs/html-content-dialog/html-content-dialog');
    this.dialogs.open<HtmlContentDialogData>(HtmlContentDialog, { data: { title, htmlContent } });
  }

  // A contract drift is a backend conversation, so it must reach the logs and
  // not only the learner's screen.
  private readonly loadErrorLog = effect(() => {
    const error = this.loadError();
    if (error) this.logger.error('[MicroLearningCourse] reels-feed load failed', error);
  });

  private readonly pageErrorLog = effect(() => {
    const error = this.pageResource.error();
    if (error) this.logger.error('[MicroLearningCourse] next feed page failed', error);
  });
}
