import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse, httpResource } from '@angular/common/http';
import {
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  inject,
  Service,
  linkedSignal,
  PLATFORM_ID,
  ResourceSnapshot,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { environment } from '@env/environment';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { apiUrl } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { NotificationService } from '@core/services/notification/notification';
// Type-only: UtilsDialog loads with `import()` when opened (PROMPT.md §4.4).
import type { UtilsDialogData, UtilsDialogResult } from '@shared/dialogs/utils-dialog/utils-dialog';
import { withPreviousValue } from '@core/utils/with-previous-value';
import { Utils } from '@shared/services/utils';
import {
  PROFILE_REQUIRED_PROMPT,
  SIGN_IN_PROMPTS,
} from '@features/offerings/webinar/constants/sign-in-prompts';
import {
  FeedCard,
  LoginType,
  parseDetail,
  parseMainPage,
  SignInPromptAction,
  UpcomingWebinarCard,
  WebinarMainPageData,
  WEBINAR_ENDPOINTS,
  WebinarDetail,
} from '@features/offerings/webinar/models/webinar.model';
import { resolveJoinTarget } from '@features/offerings/webinar/utils/join-target';
import { toWebinarError, WebinarError } from '@features/offerings/webinar/utils/webinar-error';
import type { WebinarBucket } from '@features/offerings/webinar/utils/webinar-status';
import { WebinarRegistration } from './webinar-registration';

/**
 * Owns the webinar landing feed and the registration action.
 *
 * Route-scoped (provided on the webinar route, not `providedIn: 'root'`) so the
 * feed dies with the feature rather than outliving it in memory.
 *
 * Follows the repo's list-facade shape: `httpResource` whose request returns
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

@Service({ autoProvided: false })
export class WebinarFacade {
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthSession);
  private readonly registration = inject(WebinarRegistration);
  private readonly utils = inject(Utils);
  /** Injected rather than reached for, so the external hop is testable. */
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * `pre_login` / `post_login` are the literal values the backend stores and
   * filters on, so there is one vocabulary end to end and no translation map.
   * Derived from the session signal, so signing in refetches automatically.
   */
  readonly loginType = computed<LoginType>(() =>
    this.auth.isAuthenticated() ? 'post_login' : 'pre_login',
  );

  // ---- The five-bucket feed ------------------------------------------------

  private readonly feedResource = httpResource<WebinarMainPageData>(
    () => {
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

      return {
        url: apiUrl(WEBINAR_ENDPOINTS.mainPage),
        // Required, with no default. Omitting it is a 400 naming it —
        // deliberately, so a signed-in client that forgot cannot silently
        // receive the anonymous page as a valid 200.
        params: { login_type: loginType },
      };
    },
    {
      defaultValue: EMPTY_FEED,
      // The trust boundary: a body that drifted from the contract lands in
      // `error()` here — and so in `loadError()` — instead of on screen.
      parse: parseMainPage,
    },
  );

  /**
   * Surfaced for the error state; a feed failure is not a silent condition.
   * Held through a refetch (like the old flag, cleared only by a success), so a
   * retry does not blank the banner before it has an answer.
   */
  readonly loadError = linkedSignal<ResourceSnapshot<WebinarMainPageData>, WebinarError | null>({
    source: this.feedResource.snapshot,
    computation: (snap, previous) => {
      if (snap.status === 'error') return toWebinarError(snap.error);
      if (snap.status === 'resolved' || snap.status === 'local') return null;
      return previous?.value ?? null;
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

  readonly isLoading = computed(() => this.feed.isLoading());

  // ---- Sections ------------------------------------------------------------

  /**
   * The hero. `highlight_webinars` is editorial: driven by priority rows for
   * this login state, and the ABSENCE of a row is the signal — an unranked
   * webinar is not last, it is simply not curated. Falls back to the soonest
   * upcoming so the hero is never empty while anything is scheduled.
   */
  readonly heroWebinar = computed<UpcomingWebinarCard | null>(() => {
    const data = this.feedData();
    return data.highlight_webinars[0] ?? data.upcoming_webinars[0] ?? null;
  });

  /**
   * `highlight_webinars` is a curated rail over the same webinars as
   * `upcoming_webinars`, so the two overlap by design. De-duplicate against
   * whatever the hero took, or it renders twice on one page.
   */
  readonly upcomingWebinars = computed<UpcomingWebinarCard[]>(() => {
    const heroId = this.heroWebinar()?.id;
    return this.feedData().upcoming_webinars.filter((w) => w.id !== heroId);
  });

  /** Past webinars the user attended. Each carries `eligible`. */
  readonly attendedWebinars = computed(() => this.feedData().completed_webinar);
  /** Past webinars the user booked and did not attend. */
  readonly absentWebinars = computed(() => this.feedData().absent_webinar);
  /** Past webinars in the window the user never booked at all. */
  readonly missedWebinars = computed(() => this.feedData().missed_webinar);

  /** True when there is genuinely nothing to show — not merely still loading. */
  readonly isEmpty = computed(() => {
    const data = this.feedData();
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
  private readonly detailResource = httpResource<WebinarDetail | null>(
    () => {
      const id = this.detailId();
      return id
        ? { url: apiUrl(WEBINAR_ENDPOINTS.detailsPage), params: { webinar_id: id } }
        : undefined;
    },
    { parse: parseDetail },
  );

  /**
   * A 404 is a real answer here, not a failure: the contract makes it
   * deliberately ambiguous between "no such id" and "an id you may not see".
   * A 400 is too — the only documented one is `invalid_request` for a
   * `webinar_id` that is not a uuid, which is what an old integer-id link
   * sends. Either way the page renders its not-found state, so both count as
   * "missing" rather than as an error.
   */
  private readonly isDetailNotFound = computed(() => {
    const error = this.detailResource.error();
    return error instanceof HttpErrorResponse && (error.status === 404 || error.status === 400);
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
      (this.isDetailNotFound() ||
        (this.detailResource.hasValue() && this.detailResource.value() === null)),
  );

  constructor() {
    // The old loaders logged from their catch blocks; a resource has none.
    effect(() => {
      const error = this.feedResource.error();
      if (error) {
        this.logger.error('[WebinarFacade] feed load failed', toWebinarError(error).code, error);
      }
    });
    effect(() => {
      const error = this.detailResource.error();
      if (error && !this.isDetailNotFound()) {
        this.logger.error('[WebinarFacade] detail load failed', toWebinarError(error).code, error);
      }
    });
  }

  // ---- Lookup --------------------------------------------------------------

  /**
   * Find a card across every bucket. The detail page uses this so navigating
   * from a rail renders instantly instead of refetching what is already loaded.
   * Returns `null` on a cold load (deep link), which the detail page handles.
   */
  findById(id: string): FeedCard | null {
    return this.locate(id)?.card ?? null;
  }

  /**
   * Which bucket the feed placed this webinar in, or `null` when it is not in
   * the feed (a deep link before the feed lands, or a webinar outside it).
   *
   * The detail page needs this because the details payload carries no bucket,
   * and the CTA for a past webinar — attended, absent, missed — is decided by
   * the bucket, not by anything on the card.
   */
  bucketOf(id: string): WebinarBucket | null {
    return this.locate(id)?.bucket ?? null;
  }

  private locate(id: string): { card: FeedCard; bucket: WebinarBucket } | null {
    const data = this.feedData();
    const buckets: [WebinarBucket, readonly FeedCard[]][] = [
      ['highlight', data.highlight_webinars],
      ['upcoming', data.upcoming_webinars],
      ['completed', data.completed_webinar],
      ['absent', data.absent_webinar],
      ['missed', data.missed_webinar],
    ];
    for (const [bucket, cards] of buckets) {
      const card = cards.find((w) => w.id === id);
      if (card) return { card, bucket };
    }
    return null;
  }

  // ---- Actions -------------------------------------------------------------

  /**
   * The webinar whose seat form should take focus when it renders, set by a
   * guest's "Book Now" (`book`) and cleared by `takeSeatFocus`.
   */
  private readonly seatFocusFor = signal<string | null>(null);

  /**
   * Register for a webinar, then refresh the feed so the card picks up its new
   * `registration` block.
   *
   * A signed-out visitor is stopped here, not at the API. The `pre_login` feed
   * carries no `registration` block, so `ctaFor` correctly offers "Register
   * Now" to everyone — but posting it without a token is a `401` and a generic
   * error toast, which tells the learner nothing about what to do next. They
   * get the sign-in prompt instead, and come back to this webinar afterwards.
   *
   * A signed-in learner with an incomplete profile is sent to finish it the
   * same way, and comes back here once it is complete. This is the only place
   * the app registers, so the list, the detail page and the guest seat form
   * all get it.
   */
  async register(webinarId: string): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      await this.promptSignIn('register');
      return;
    }

    // `register-via-zoom` refuses a learner with no name or email on file, and
    // it is the only route that does. Known incomplete → finish the profile
    // first instead of earning that 400. `null` (the row has not arrived yet)
    // goes ahead, and the refusal below is the backstop.
    if (this.auth.isProfileCompleted() === false) {
      await this.sendToProfile(PROFILE_REQUIRED_PROMPT.title, PROFILE_REQUIRED_PROMPT.body);
      return;
    }

    const outcome = await this.registration.register(webinarId);

    if ('code' in outcome) {
      // A profile problem is not retryable and its `detail` already names what
      // to fix, so the server's own copy goes on the toast, and the learner goes
      // where they can fix it.
      if (outcome.isProfileProblem) {
        await this.sendToProfile(PROFILE_REQUIRED_PROMPT.title, outcome.message);
        return;
      }
      this.notification.error('Registration failed', outcome.message);
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
   * Join a live session: sign-in first, then wherever `resolveJoinTarget`
   * sends this webinar.
   *
   * The sign-in check is not cosmetic. A signed-out visitor normally sees
   * Register, because the `pre_login` feed carries no `registration` block. But
   * the detail row is keyed on the webinar id alone, so after a sign-out it
   * still holds the signed-in `registration`, `join_url` included, and so does
   * the feed's last good value when its refetch fails. Without this check, that
   * stale row opened Zoom for a visitor with no session.
   */
  async join(webinarId: string): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      await this.promptSignIn('join');
      return;
    }

    const target = resolveJoinTarget(this.joinCardFor(webinarId));

    switch (target.kind) {
      case 'embedded':
        // The live room is its own route: it is client-rendered, holds the
        // session lease for exactly as long as it is mounted, and tears the SDK
        // down on navigation away. Opening the meeting in place would tie all
        // of that to the lifetime of the feed.
        void this.router.navigate(this.webinarPath(webinarId, 'live'));
        break;
      case 'external':
        // `noopener` is not optional on a `_blank` to a third party: without it
        // Zoom's tab gets a handle on `window.opener` and can navigate us.
        this.document.defaultView?.open(target.url, '_blank', 'noopener,noreferrer');
        break;
      case 'unavailable':
        this.notification.error(
          'That session is not ready yet',
          'We could not find a join link for this webinar. Refresh in a moment, or contact support if it persists.',
        );
        break;
    }
  }

  /**
   * The row the page shows for this webinar: the detail row on its own detail
   * page (it wins once it lands, as on the page), otherwise the feed row.
   */
  private joinCardFor(webinarId: string): FeedCard | null {
    const detail = this.detailId() === webinarId ? this.detailWebinar() : null;
    return detail ?? this.findById(webinarId);
  }

  /**
   * "Book Now" on a list row.
   *
   * A member registers in place. A guest books through the seat form, which
   * signs them in and registers in one flow, so they are taken to this
   * webinar's page with that form focused. The list has a seat form of its own,
   * but it belongs to the hero webinar: focusing it booked the hero, not the
   * row that was clicked.
   */
  async book(webinarId: string): Promise<void> {
    if (this.auth.isAuthenticated()) {
      await this.register(webinarId);
      return;
    }
    this.seatFocusFor.set(webinarId);
    await this.router.navigate(this.webinarPath(webinarId));
  }

  /**
   * `true` exactly once, for the seat form of the webinar a guest just chose
   * to book; `SeatForm` asks after its first render. One-shot, so a refresh, a
   * shared link or a later visit to that page never steals focus.
   */
  takeSeatFocus(webinarId: string): boolean {
    if (this.seatFocusFor() !== webinarId) return false;
    this.seatFocusFor.set(null);
    return true;
  }

  /**
   * An absolute path into this feature. Absolute because this facade lives on
   * the feature's parent route, with no `ActivatedRoute` for the page that
   * asked.
   */
  private webinarPath(webinarId: string, ...rest: string[]): string[] {
    return ['/', this.utils.country(), this.utils.profession(), 'webinar', webinarId, ...rest];
  }

  /**
   * Ask the learner to sign in, and send them back here afterwards.
   *
   * `redirect` is the same query parameter `authGuard` uses, so the two routes
   * into `/auth/login` return to the same place and only one convention exists.
   * The dialog is `UtilsDialog` rather than a webinar-specific component —
   * a title, a line of copy and two buttons is exactly what it is for.
   */
  private async promptSignIn(action: SignInPromptAction): Promise<void> {
    const prompt = SIGN_IN_PROMPTS[action];
    const data: UtilsDialogData = {
      title: prompt.title,
      containerClass: 'max-w-md text-start!',
      content: [{ type: 'text', value: prompt.body }],
      buttons: [
        { label: 'Not now', variant: 'ghost', action: 'cancel' },
        { label: 'Sign in', variant: 'default', action: 'confirm' },
      ],
    };

    const { UtilsDialog } = await import('@shared/dialogs/utils-dialog/utils-dialog');
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

  /**
   * Say why, then open the profile page; once the profile is complete it brings
   * the learner back to this page. Same `redirect` convention as `promptSignIn`.
   */
  private async sendToProfile(title: string, body: string): Promise<void> {
    this.notification.info(title, body);
    await this.router.navigate(['/auth/profile'], {
      queryParams: { redirect: this.router.url },
    });
  }

  /**
   * Refresh everything that carries a `registration` block. The detail page
   * prefers the detail row over the feed row, so reloading only the feed left
   * its button on "Register Now" after a successful registration. On the
   * landing page `detailId` is null and the detail reload is a no-op.
   */
  reload(): void {
    this.feedResource.reload();
    this.detailResource.reload();
  }
}
