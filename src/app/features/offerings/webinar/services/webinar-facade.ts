import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  DestroyRef,
  inject,
  Service,
  linkedSignal,
  PLATFORM_ID,
  resource,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '@env/environment';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { ApiClient } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { NotificationService } from '@core/services/notification/notification';
import {
  UtilsDialog,
  UtilsDialogData,
  UtilsDialogResult,
} from '@shared/dialogs/utils-dialog/utils-dialog';
import { withPreviousValue } from '@shared/utils/with-previous-value';
import {
  LoginType,
  WebinarCard,
  WebinarMainPageData,
  WebinarMainPageResponse,
  WEBINAR_ENDPOINTS,
  WebinarDetail,
  WebinarDetailsResponse,
} from '../models/webinar.model';
import { ServerClock } from './server-clock';
import { toWebinarError, WebinarError } from '../utils/webinar-error';
import { buildPreviewFeed, PREVIEW_ON, PREVIEW_PARAM } from '../utils/webinar-preview';
import { WebinarRegistration } from './webinar-registration';

/**
 * Owns the webinar landing feed and the registration action.
 *
 * Route-scoped (provided on the webinar route, not `providedIn: 'root'`) so the
 * feed dies with the feature rather than outliving it in memory.
 *
 * Follows the repo's list-facade shape: `resource()` whose `params` return
 * `undefined` on the server, `withPreviousValue` for stale-while-revalidate so
 * the rails hold their rows through a refetch, and `linkedSignal` mirrors.
 */

/** Empty feed, so every consumer reads the same fixed shape even before load. */
const EMPTY_FEED: WebinarMainPageData = {
  login_type: 'pre_login',
  highlight_webinars: [],
  upcoming_webinars: [],
  completed_webinar: [],
  absent_webinar: [],
  missed_webinar: [],
};

/**
 * Whether the stand-in feed can be reached at all. `false` in every production
 * build, where the page is always bound to the live API.
 *
 * The page is now bound to the API BY DEFAULT — the stand-in is opt-in with
 * `?preview=design`, and exists only because UAT still has no future-dated
 * webinar, so there is otherwise no way to look at the hero or the upcoming
 * rail. Delete `webinar-preview.ts` and this flag once it does.
 *
 * Note this does NOT tree-shake that module out of the bundle:
 * `environment.production` is a property read on an object, not a literal, so
 * no bundler can fold the branch. It ships inert (~2 kB, lazy webinar chunk).
 */
const PREVIEW_ENABLED = !environment.production;

@Service({ autoProvided: false })
export class WebinarFacade {
  private readonly api = inject(ApiClient);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthSession);
  private readonly clock = inject(ServerClock);
  private readonly registration = inject(WebinarRegistration);
  private readonly route = inject(ActivatedRoute);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * `pre_login` / `post_login` are the literal values the backend stores and
   * filters on, so there is one vocabulary end to end and no translation map.
   * Derived from the session signal, so signing in refetches automatically.
   */
  readonly loginType = computed<LoginType>(() =>
    this.auth.isAuthenticated() ? 'post_login' : 'pre_login',
  );

  /** Surfaced for the error state; a feed failure is not a silent condition. */
  private readonly feedError = signal<WebinarError | null>(null);

  // ---- The five-bucket feed ------------------------------------------------

  private readonly feedResource = resource({
    params: () => {
      const loginType = this.loginType();

      // The `pre_login` feed is served anonymously by design, so the SERVER
      // fetches it. That is the entire reason this route is `RenderMode.Server`
      // — without it a crawler gets "no webinars scheduled", which is worse for
      // SEO than not server-rendering at all. The response lands in the HTTP
      // transfer cache, so the browser reuses it rather than refetching.
      //
      // `post_login` is skipped on the server: the learner token lives in the
      // browser, and asking for the signed-in page without one is a 401.
      if (!this.isBrowser && loginType !== 'pre_login') return undefined;

      return { loginType };
    },
    loader: async ({ params, abortSignal }): Promise<WebinarMainPageData> => {
      try {
        const res = await firstValueFrom(
          this.api
            .get<WebinarMainPageResponse>(WEBINAR_ENDPOINTS.mainPage, {
              // Required, with no default. Omitting it is a 400 naming it —
              // deliberately, so a signed-in client that forgot cannot silently
              // receive the anonymous page as a valid 200.
              params: { login_type: params.loginType },
            })
            .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        );
        this.feedError.set(null);
        this.clock.syncFrom(res.data?.server_time);
        return res.data ?? EMPTY_FEED;
      } catch (err) {
        const error = toWebinarError(err);
        this.logger.error('[WebinarFacade] feed load failed', error.code, err);
        this.feedError.set(error);
        throw err;
      }
    },
  });

  private readonly feed = withPreviousValue(this.feedResource);

  /** Holds the last good feed through a refetch so the rails do not flash empty. */
  private readonly feedData = linkedSignal({
    source: this.feed.snapshot,
    computation: (snap, previous): WebinarMainPageData => {
      if (snap.status !== 'resolved') return previous?.value ?? EMPTY_FEED;
      return snap.value ?? EMPTY_FEED;
    },
  });

  // ---- Stand-in feed (development builds only) ----------------------------

  /**
   * The page reads the live API. `?preview=design` swaps in
   * `webinar-preview.ts` instead, for looking at sections UAT cannot currently
   * populate. Never available in a production build.
   */
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** Captured once — dates that tick every second are unreviewable. */
  private readonly previewBaseTime = Date.now();

  /** Exposed so the page can also relax its signed-out gate under preview. */
  readonly isPreview = computed(
    () => PREVIEW_ENABLED && this.queryParams().get(PREVIEW_PARAM) === PREVIEW_ON,
  );

  /**
   * The feed error the page shows. Suppressed under preview: the page is not
   * bound to the live call there, so an error banner over stand-in content
   * would be reporting a failure that has no bearing on what is on screen.
   */
  readonly loadError = computed(() => (this.isPreview() ? null : this.feedError()));

  /** What the sections below read. Identical to `feedData` in production. */
  private readonly visibleFeed = computed<WebinarMainPageData>(() =>
    this.isPreview() ? buildPreviewFeed(this.previewBaseTime) : this.feedData(),
  );

  readonly isLoading = computed(() => this.feed.isLoading());

  // ---- Sections ------------------------------------------------------------

  /**
   * The hero. `highlight_webinars` is editorial: driven by priority rows for
   * this login state, and the ABSENCE of a row is the signal — an unranked
   * webinar is not last, it is simply not curated. Falls back to the soonest
   * upcoming so the hero is never empty while anything is scheduled.
   */
  readonly heroWebinar = computed<WebinarCard | null>(() => {
    const data = this.visibleFeed();
    return data.highlight_webinars[0] ?? data.upcoming_webinars[0] ?? null;
  });

  /**
   * `highlight_webinars` is a curated rail over the same webinars as
   * `upcoming_webinars`, so the two overlap by design. De-duplicate against
   * whatever the hero took, or it renders twice on one page.
   */
  readonly upcomingWebinars = computed<WebinarCard[]>(() => {
    const heroId = this.heroWebinar()?.id;
    return this.visibleFeed().upcoming_webinars.filter((w) => w.id !== heroId);
  });

  /** Past webinars the user attended. Each carries `eligible`. */
  readonly attendedWebinars = computed(() => this.visibleFeed().completed_webinar);
  /** Past webinars the user booked and did not attend. */
  readonly absentWebinars = computed(() => this.visibleFeed().absent_webinar);
  /** Past webinars in the window the user never booked at all. */
  readonly missedWebinars = computed(() => this.visibleFeed().missed_webinar);

  /** True when there is genuinely nothing to show — not merely still loading. */
  readonly isEmpty = computed(() => {
    const data = this.visibleFeed();
    return (
      !this.isLoading() &&
      data.highlight_webinars.length === 0 &&
      data.upcoming_webinars.length === 0 &&
      data.completed_webinar.length === 0 &&
      data.absent_webinar.length === 0 &&
      data.missed_webinar.length === 0
    );
  });

  // ---- Bookings: DELIBERATELY NOT FETCHED ----------------------------------
  //
  // `all-bookings` is the only source of attended-vs-total duration and poll
  // counts — the numbers that tell a `Not Eligible` learner what they missed.
  // The contract records it moved to `app-api/v1/events/all-bookings/` on
  // 2026-09-17 and that "the web twin is not built". THIS PROJECT DOES NOT CALL
  // `app-api/`, so there is nothing to fetch and the resource that used to try
  // has been removed rather than left 404ing on every signed-in page load.
  //
  // Restore it when those four fields appear on a `web-api` route — see the
  // note on `completionLine` in `webinar-card.ts` for the rendering half.

  // ---- One webinar, for the detail page ------------------------------------

  /**
   * The id the detail page is showing, or `null` on the landing page.
   *
   * Set by the page rather than read from `ActivatedRoute` here: this facade is
   * provided on the componentless PARENT route, so its own `ActivatedRoute` has
   * no `:id` to read.
   */
  private readonly detailId = signal<string | null>(null);

  showDetail(id: string | null): void {
    this.detailId.set(id);
  }

  /**
   * One webinar in full.
   *
   * The feed is not enough on its own. A deep link, a crawler, or a link to a
   * webinar outside the five buckets all arrive with nothing in memory, and
   * there is no bucket to find it in — the page would show "we could not find
   * that webinar" for a webinar that exists. This is the endpoint that answers.
   *
   * Runs on the SERVER too, unlike the bookings resource: `webinar-details-page`
   * is `AllowAny` and serves the `pre_login` surface to an anonymous caller, so
   * a crawler gets the real page rather than an empty shell.
   */
  private readonly detailResource = resource({
    params: () => {
      const id = this.detailId();
      return id ? { id } : undefined;
    },
    loader: async ({ params, abortSignal }): Promise<WebinarDetail | null> => {
      try {
        const res = await firstValueFrom(
          this.api
            .get<WebinarDetailsResponse>(WEBINAR_ENDPOINTS.detailsPage, {
              params: { webinar_id: params.id },
            })
            .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        );
        return res.data?.webinar ?? null;
      } catch (err) {
        const error = toWebinarError(err);
        // A 404 is a real answer here, not a failure: the contract makes it
        // deliberately ambiguous between "no such id" and "an id you may not
        // see". Either way the page renders its not-found state, so this
        // resolves to `null` rather than throwing into the error branch.
        if (error.status === 404) return null;
        this.logger.error('[WebinarFacade] detail load failed', error.code, err);
        throw err;
      }
    },
  });

  /** `true` while the detail request is in flight. */
  readonly isDetailLoading = computed(() => this.detailResource.isLoading());

  /**
   * The detail row, or `null`. Reads through `hasValue()` because `value()`
   * THROWS on an errored resource, which would take the whole page down rather
   * than just the row it could not fetch.
   */
  readonly detailWebinar = computed<WebinarDetail | null>(() =>
    this.detailResource.hasValue() ? this.detailResource.value() : null,
  );

  /**
   * `true` only once the endpoint has actually answered "no such webinar" —
   * never merely because the feed has not loaded. The page needs the two apart:
   * one is a spinner, the other is a 404.
   */
  readonly isDetailMissing = computed(
    () =>
      this.detailId() !== null &&
      !this.isDetailLoading() &&
      this.detailResource.hasValue() &&
      this.detailResource.value() === null,
  );

  // ---- Lookup --------------------------------------------------------------

  /**
   * Find a card across every bucket. The detail page uses this so navigating
   * from a rail renders instantly instead of refetching what is already loaded.
   * Returns `null` on a cold load (deep link), which the detail page handles.
   */
  findById(id: string): WebinarCard | null {
    const data = this.visibleFeed();
    const buckets = [
      data.highlight_webinars,
      data.upcoming_webinars,
      data.completed_webinar,
      data.absent_webinar,
      data.missed_webinar,
    ];
    for (const bucket of buckets) {
      const found = bucket.find((w) => w.id === id);
      if (found) return found;
    }
    return null;
  }

  // ---- Actions -------------------------------------------------------------

  isRegistering(webinarId: string): boolean {
    return this.registration.isRegistering(webinarId);
  }

  /**
   * Register for a webinar, then refresh the feed so the card picks up its new
   * `registration` block.
   *
   * A signed-out visitor is stopped here, not at the API. The `pre_login` feed
   * carries no `registration` block, so `ctaFor` correctly offers "Register
   * Now" to everyone — but posting it without a token is a `401` and a generic
   * error toast, which tells the learner nothing about what to do next. They
   * get the sign-in prompt instead, and come back to this webinar afterwards.
   */
  async register(webinarId: string): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      this.promptSignIn();
      return;
    }

    const outcome = await this.registration.register(webinarId);

    if ('code' in outcome) {
      // A profile problem is not retryable and its `detail` already names what
      // to fix, so surface the server's own copy rather than a generic message.
      this.notification.error(
        outcome.isProfileProblem ? 'Update your profile first' : 'Registration failed',
        outcome.message,
      );
      return;
    }

    switch (outcome.result) {
      case 'registered':
        this.notification.success(
          'You are registered',
          `We will open the session ${environment.WEBINAR.joinWindowMinutes} minutes before it starts.`,
        );
        break;
      case 'already-registered':
        this.notification.info('Already registered', outcome.message ?? 'You already hold a seat.');
        break;
      case 'retry':
        this.notification.error(
          'Registration did not complete',
          outcome.message ?? 'No seat was taken. Please try again.',
        );
        break;
      case 'timed-out':
        // Not a failure. The pipeline runs server-side whether or not the
        // browser is still watching, so the honest message is "still working".
        this.notification.info(
          'Still working on it',
          outcome.message ?? 'Your registration is taking longer than usual. Refresh in a moment.',
        );
        break;
    }

    this.reload();
  }

  /**
   * Ask the learner to sign in, and send them back here afterwards.
   *
   * `redirect` is the same query parameter `authGuard` uses, so the two routes
   * into `/auth/login` return to the same place and only one convention exists.
   * The dialog is `UtilsDialog` rather than a webinar-specific component —
   * a title, a line of copy and two buttons is exactly what it is for.
   */
  private promptSignIn(): void {
    const data: UtilsDialogData = {
      title: 'Sign in to register',
      containerClass: 'max-w-md text-left!',
      content: [
        {
          type: 'text',
          value:
            'Registering for a webinar reserves your seat and tracks your attendance for CPE credit, so we need to know who you are. Sign in and we will bring you straight back here.',
        },
      ],
      buttons: [
        { label: 'Not now', variant: 'ghost', action: 'cancel' },
        { label: 'Sign in', variant: 'default', action: 'confirm' },
      ],
    };

    const ref = this.dialogs.open<UtilsDialogData, UtilsDialogResult>(UtilsDialog, {
      data: { ...data, maxWidth: '28rem' },
    });

    ref.afterClosed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (result?.action !== 'confirm') return;
      void this.router.navigate(['/auth/login'], {
        queryParams: { redirect: this.router.url },
      });
    });
  }

  reload(): void {
    this.feedResource.reload();
  }
}
