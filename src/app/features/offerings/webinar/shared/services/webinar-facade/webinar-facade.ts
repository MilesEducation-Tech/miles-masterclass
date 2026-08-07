import {
  computed,
  DestroyRef,
  EnvironmentInjector,
  inject,
  Injectable,
  signal,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { ApiClient } from '../../../../../../shared/core/services/api-client/api-client';
import { Auth } from '../../../../../../shared/core/services/auth/auth';
import { Dialog } from '../../../../../../shared/core/services/dialog/dialog';
import { NotificationService } from '../../../../../../shared/core/services/notification/notification';
import { Logger } from '../../../../../../shared/core/services/logger/logger';
import { Utils } from '../../../../../../shared/core/services/utils/utils';
import { Analytics } from '../../../../../../shared/core/services/analytics/analytics';
import {
  CertificateDialogData,
  CertificateDownloadDialog,
} from '../../../../../../shared/components/dialog/certificate-download-dialog/certificate-download-dialog';
import {
  UpcomingPremiere,
  WebinarEnrollment,
  WebinarEnrollmentType,
} from '../../../../../../shared/core/models/feature.model';
import {
  ctaFor,
  hasAttended,
  needsSubscription,
  nextSessionOf,
  WebinarCta,
  webinarTagFor,
} from '../../utils/webinar-status';
import { parseNextPage } from '../../../../../../shared/utils/parse-next-page';
import {
  applyV2About,
  v2CardToUpcoming,
  v2DetailsToUpcoming,
  v2EnrollmentToUpcoming,
  WebinarV2About,
  WebinarV2Card,
  WebinarV2Details,
  WebinarV2Enrollment,
  WebinarV2Response,
} from '../../utils/v2-to-upcoming';

/**
 * Response shape for `POST /enrollment/register/`. The success body uses
 * `status_code: boolean` (not the `status` field that `FeatureApiResponse`
 * standardises on), so type it inline.
 */
interface EnrollmentRegisterResponse {
  status_code: boolean;
  data?: WebinarEnrollment;
  message?: string;
}

const ENROLLMENT_REGISTER_URL = 'enrollment/register/';
import { WebinarRegistrationFormValue } from '../../components/webinar-registration-form/webinar-registration-form';
import { WebinarDetailsDialog } from '../../../../../../shared/components/dialog/webinar-details-dialog/webinar-details-dialog';
import { SubscriptionDialog } from '../../../../../../shared/components/dialog/subscription-dialog/subscription-dialog';
import {
  WebinarRegistrationDialog,
  WebinarRegistrationDialogData,
} from '../../../../../../shared/components/dialog/webinar-registration-dialog/webinar-registration-dialog';

/** Local error label keyed off which fetch failed (useful for partial-failure UI). */
type WebinarLoadError = 'highlight' | 'featured' | 'attended' | 'absent' | 'missed' | null;

/** One adapted page of a v2 list endpoint. `next` is `null` once exhausted. */
interface WebinarPage {
  items: UpcomingPremiere[];
  next: number | null;
}

/** Shared empty result for the guest / failed-fetch paths. */
const EMPTY_PAGE: WebinarPage = { items: [], next: null };

/**
 * v2 webinar endpoints (`docs/Webinar_V2_API.md`). Lean, paginated payloads —
 * adapted to `UpcomingPremiere` by `v2-to-upcoming.ts` so nothing downstream
 * has to know v2 exists. `page`/`page_size` go through `params`, not the URL.
 *
 * The rails call nothing beyond these. The lean card fields are everything a
 * rail renders; the long-form content is fetched from `ABOUT_URL` only when
 * the More Info dialog actually opens.
 */
/** Admin-curated hero rail, ordered by priority. We render the top entry. */
const HOME_SECTION_URL = 'v2/webinar/home_section/';
const FILTER_URL = 'v2/webinar/filter/';
const ENROLLMENT_URL = 'v2/webinar/enrollments/';
/** One webinar's card fields + per-user state. Backs the detail page. */
const DETAILS_URL = 'v2/webinar/details/';
/**
 * Long-form content (overview, topics, objectives, instructor) for one
 * webinar. Fetched only when the More Info dialog opens — the rails never
 * need it.
 */
const ABOUT_URL = (id: number): string => `v2/webinar/${id}/about/`;
/** Backend caps `page_size` at 50. */
const PAGE_SIZE = 10;

/**
 * `filter/?type=` value backing "Webinars Missed" — webinars that already ran
 * and the user never registered for. Undocumented in `Webinar_V2_API.md` (which
 * lists only `futured` / `this_month` / `this_week` / `next_30_days`) but live
 * on the API and returning a genuinely distinct past-only list.
 *
 * Treat this string as load-bearing: `v2/webinar/filter/` does NOT validate
 * `type`. An unknown value returns HTTP 200 with the DEFAULT (`futured`) list
 * instead of a 400 — verified, `?type=bogus` returns the futured rows. So a
 * typo here, or a backend that drops support for `past`, degrades silently
 * into "Webinars Missed" showing live and upcoming webinars. The `ended` half
 * of the `missed` predicate below is the backstop for exactly that.
 * (`home_section/` does validate and 400s properly; only `filter/` is loose.)
 */
const MISSED_FILTER_TYPE = 'past';

/**
 * Webinar home facade — owns the four data streams powering the webinar landing
 * page and the derived state used by the hero / list / cards. Provided at the
 * route level (not `providedIn: 'root'`) so navigating away tears the state
 * down. Mirrors the shape of `MasterclassFacade` (signals + forkJoin loader).
 */
@Injectable()
export class WebinarFacade {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(Auth);
  private readonly dialog = inject(Dialog);
  private readonly notification = inject(NotificationService);
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly utils = inject(Utils);
  private readonly analytics = inject(Analytics);
  /**
   * Route-scoped environment injector. Passed to dialogs that need to resolve
   * `WebinarFacade` themselves (e.g. `WebinarDetailsDialog`) — without it the
   * dialog service uses its root injector and the facade `inject()` returns
   * null, silently breaking every CTA in the dialog.
   */
  private readonly envInjector = inject(EnvironmentInjector);

  // ---- raw state ---------------------------------------------------------
  /**
   * Admin-curated highlight section — drives the hero. Kept separate from
   * `featuredWebinars` because it comes from a different endpoint and is
   * ordered by admin priority rather than by session date.
   */
  readonly highlight = signal<UpcomingPremiere[]>([]);
  readonly featuredWebinars = signal<UpcomingPremiere[]>([]);
  /**
   * Unfiltered enrollment rails, exactly as the API returned them. The rendered
   * `attended` / `missed` below narrow these by attendance status; lookups
   * (`findById`) and writes (`patchWebinar`) go through the raw lists so a row
   * that's filtered out of the UI is still findable and still updatable.
   */
  private readonly attendedRaw = signal<UpcomingPremiere[]>([]);
  private readonly absentRaw = signal<UpcomingPremiere[]>([]);
  private readonly missedRaw = signal<UpcomingPremiere[]>([]);
  readonly loading = signal(false);
  readonly error = signal<WebinarLoadError>(null);

  // ---- pagination --------------------------------------------------------
  /**
   * Next page number per rail, `null` once exhausted (or never loaded — guests
   * keep both enrollment rails at `null`, so their `loadMore*` no-op).
   */
  private readonly nextFeatured = signal<number | null>(null);
  private readonly nextAttended = signal<number | null>(null);
  private readonly nextAbsent = signal<number | null>(null);
  private readonly nextMissed = signal<number | null>(null);

  /**
   * Keys of requests currently in flight, so a fast scroll (or a carousel that
   * re-fires `reachEnd` on every frame) can't stack duplicate page fetches.
   * A plain Set, not a signal — nothing in the UI renders it.
   */
  private readonly inFlight = new Set<string>();

  // ---- derived state -----------------------------------------------------
  /**
   * The hero webinar. The admin-curated `home_section?section=highlight` entry
   * wins — that's the whole point of the section. Only when it's empty (or the
   * request failed) do we fall back to deriving one from the upcoming list:
   * currently live if any, else the soonest upcoming. `null` when both are empty.
   */
  readonly liveOrNextUp = computed<UpcomingPremiere | null>(() => {
    const highlighted = this.highlight()[0];
    if (highlighted) return highlighted;

    const list = this.featuredWebinars();
    if (!list.length) return null;
    const now = new Date();
    const live = list.find((w) => webinarTagFor(w, now) === 'live');
    if (live) return live;
    const upcoming = list
      .filter((w) => webinarTagFor(w, now) === 'upcoming')
      .sort((a, b) => {
        const aDate = nextSessionOf(a, now)?.start_date ?? '';
        const bDate = nextSessionOf(b, now)?.start_date ?? '';
        return new Date(aDate).getTime() - new Date(bDate).getTime();
      });
    return upcoming[0] ?? list[0];
  });

  /**
   * "Premiering This Month" list (section 2), minus whatever the hero is
   * showing. The highlight and this-month endpoints are independent, so the
   * same webinar can legitimately appear in both — this drops the duplicate.
   */
  readonly upcomingList = computed<UpcomingPremiere[]>(() => {
    const hero = this.liveOrNextUp();
    return this.featuredWebinars().filter((w) => w.id !== hero?.id);
  });

  /**
   * "Premieres Attended" — only sessions the user actually showed up to.
   * The `completed` endpoint returns `Present`, `Attended` AND `Absent` (it
   * means "the session is over", not "you attended"), so the status narrowing
   * has to happen here or no-shows leak into the attended rail.
   */
  readonly attended = computed<UpcomingPremiere[]>(() =>
    this.attendedRaw().filter((w) =>
      hasAttended(w.registered_webinar?.user_enrollments?.attendance_status),
    ),
  );

  /**
   * "Premieres Absent" — registered but didn't show up. Distinct from `missed`
   * below, which is about webinars the user never registered for at all.
   */
  readonly absent = computed<UpcomingPremiere[]>(() =>
    this.absentRaw().filter(
      (w) => w.registered_webinar?.user_enrollments?.attendance_status === 'Absent',
    ),
  );

  /**
   * "Webinars Missed" — ran without the user, because they never registered.
   *
   * Both halves of that sentence are enforced here rather than trusted from the
   * endpoint: unregistered (no enrollment row) AND the session has ended. The
   * `ended` half is cheap and keeps the silent `filter/?type=` fallback
   * documented on `MISSED_FILTER_TYPE` from spilling live/upcoming webinars
   * into this rail if the param ever stops resolving.
   */
  readonly missed = computed<UpcomingPremiere[]>(() => {
    const now = new Date();
    return this.missedRaw().filter(
      (w) => !w.registered_webinar?.user_enrollments && webinarTagFor(w, now) === 'ended',
    );
  });

  /**
   * Load every section in parallel, in the order the page renders them:
   * highlight (hero) → this-month premieres → attended → absent → missed.
   * The first two are public; the rest are personal and short-circuit to `[]`
   * for guests. Safe to call multiple times.
   */
  loadHomePage(): void {
    this.loading.set(true);
    this.error.set(null);

    const isAuthed = this.auth.isLoggedIn();

    // Only the top-priority entry is rendered, so ask for exactly one row.
    const highlight$ = this.fetchPage<WebinarV2Card>(
      HOME_SECTION_URL,
      { section: 'highlight', page: 1, page_size: 1 },
      v2CardToUpcoming,
    ).pipe(
      catchError((err) => {
        this.logger.error('WebinarFacade: failed to load highlight section', err);
        this.error.update((prev) => prev ?? 'highlight');
        return of(EMPTY_PAGE);
      }),
    );

    const featured$ = this.fetchPage<WebinarV2Card>(
      FILTER_URL,
      { type: 'this_month', page: 1, page_size: PAGE_SIZE },
      v2CardToUpcoming,
    ).pipe(
      catchError((err) => {
        this.logger.error('WebinarFacade: failed to load this-month webinars', err);
        this.error.update((prev) => prev ?? 'featured');
        return of(EMPTY_PAGE);
      }),
    );

    // "Missed" is inherently personal — for a guest every webinar is
    // unregistered, so the rail would be meaningless noise. Skip it.
    const missed$ = isAuthed
      ? this.fetchPage<WebinarV2Card>(
          FILTER_URL,
          { type: MISSED_FILTER_TYPE, page: 1, page_size: PAGE_SIZE },
          v2CardToUpcoming,
        ).pipe(
          catchError((err) => {
            this.logger.error('WebinarFacade: failed to load missed webinars', err);
            this.error.update((prev) => prev ?? 'missed');
            return of(EMPTY_PAGE);
          }),
        )
      : of(EMPTY_PAGE);

    // Guests have no enrollments — short-circuit rather than firing
    // authenticated requests that will 401.
    const enrollment$ = (type: WebinarEnrollmentType, key: WebinarLoadError) =>
      isAuthed
        ? this.fetchPage<WebinarV2Enrollment>(
            ENROLLMENT_URL,
            { type, page: 1, page_size: PAGE_SIZE },
            v2EnrollmentToUpcoming,
          ).pipe(
            catchError((err) => {
              this.logger.error(`WebinarFacade: failed to load ${type} enrollments`, err);
              this.error.update((prev) => prev ?? key);
              return of(EMPTY_PAGE);
            }),
          )
        : of(EMPTY_PAGE);

    forkJoin({
      highlight: highlight$,
      featured: featured$,
      attended: enrollment$('completed', 'attended'),
      absent: enrollment$('absent', 'absent'),
      missed: missed$,
    })
      .pipe(
        tap(({ highlight, featured, attended, absent, missed }) => {
          this.highlight.set(highlight.items);
          this.featuredWebinars.set(featured.items);
          this.nextFeatured.set(featured.next);
          this.attendedRaw.set(attended.items);
          this.nextAttended.set(attended.next);
          this.absentRaw.set(absent.items);
          this.nextAbsent.set(absent.next);
          this.missedRaw.set(missed.items);
          this.nextMissed.set(missed.next);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        complete: () => this.loading.set(false),
        error: () => this.loading.set(false),
      });
  }

  /**
   * One page of a v2 list endpoint, adapted to `UpcomingPremiere`. `next` is
   * the page NUMBER — v2 sends `next_page` as a full URL, which `parseNextPage`
   * already knows how to unwrap.
   */
  private fetchPage<T>(
    url: string,
    params: Record<string, string | number>,
    adapt: (row: T) => UpcomingPremiere,
  ): Observable<WebinarPage> {
    return this.api.get<WebinarV2Response<T[]>>(url, { params }).pipe(
      map((res) => ({
        items: (res?.data ?? []).map(adapt),
        next: parseNextPage(res?.pagination_data?.next_page),
      })),
    );
  }

  /**
   * Append the next page of a rail. No-ops when the rail is exhausted
   * (`next === null`) or a fetch for it is already in flight — infinite-scroll
   * sentinels and Swiper's `reachEnd` both fire repeatedly.
   */
  private loadMore<T>(
    key: string,
    url: string,
    params: Record<string, string | number>,
    adapt: (row: T) => UpcomingPremiere,
    items: WritableSignal<UpcomingPremiere[]>,
    next: WritableSignal<number | null>,
  ): void {
    const page = next();
    if (page === null || this.inFlight.has(key)) return;
    this.inFlight.add(key);

    this.fetchPage<T>(url, { ...params, page, page_size: PAGE_SIZE }, adapt)
      .pipe(
        catchError((err) => {
          this.logger.error(`WebinarFacade: failed to load more (${key})`, err);
          // Clear `next` so a persistent failure doesn't retry on every scroll.
          next.set(null);
          return of(EMPTY_PAGE);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        this.inFlight.delete(key);
        // Advance `next` unconditionally — bailing out early on an empty page
        // would leave it pointing at the page we just consumed, and every
        // subsequent scroll would re-fetch it forever.
        next.set(res.next);
        if (res.items.length) items.update((prev) => [...prev, ...res.items]);
      });
  }

  loadMoreFeatured(): void {
    this.loadMore<WebinarV2Card>(
      'featured',
      FILTER_URL,
      { type: 'this_month' },
      v2CardToUpcoming,
      this.featuredWebinars,
      this.nextFeatured,
    );
  }

  loadMoreAttended(): void {
    this.loadMore<WebinarV2Enrollment>(
      'attended',
      ENROLLMENT_URL,
      { type: 'completed' },
      v2EnrollmentToUpcoming,
      this.attendedRaw,
      this.nextAttended,
    );
  }

  loadMoreAbsent(): void {
    this.loadMore<WebinarV2Enrollment>(
      'absent',
      ENROLLMENT_URL,
      { type: 'absent' },
      v2EnrollmentToUpcoming,
      this.absentRaw,
      this.nextAbsent,
    );
  }

  loadMoreMissed(): void {
    this.loadMore<WebinarV2Card>(
      'missed',
      FILTER_URL,
      { type: MISSED_FILTER_TYPE },
      v2CardToUpcoming,
      this.missedRaw,
      this.nextMissed,
    );
  }

  /**
   * The detail page's record, in one call. Two requests because neither
   * endpoint has both halves:
   *
   *  - `details/?id=` → per-user state (registration, attendance, badge,
   *    feedback, active plan) plus the card fields the hero renders.
   *  - `:id/about/`   → the long-form write-up `<app-course-about>` renders.
   *
   * `details` is the source of truth; `about` is layered on top by
   * `applyV2About`, which preserves registration state (the about payload has
   * none, and spreading it wholesale would reset the CTA). Emits `null` only
   * when `details` fails — an `about` failure just leaves the write-up empty.
   */
  loadDetails(id: number): Observable<UpcomingPremiere | null> {
    const details$ = this.api
      .get<WebinarV2Response<WebinarV2Details>>(DETAILS_URL, { params: { id } })
      .pipe(
        map((res) => res?.data ?? null),
        catchError((err) => {
          this.logger.error(`WebinarFacade: failed to load details for webinar ${id}`, err);
          return of<WebinarV2Details | null>(null);
        }),
      );

    return forkJoin({ details: details$, about: this.fetchAbout(id) }).pipe(
      map(({ details, about }) => {
        if (!details) return null;
        const base = v2DetailsToUpcoming(details);
        return about ? applyV2About(base, about) : base;
      }),
    );
  }

  /** One `about/` request, failure-tolerant. Shared by `loadAbout` and `loadDetails`. */
  private fetchAbout(id: number): Observable<WebinarV2About | null> {
    return this.api.get<WebinarV2Response<WebinarV2About>>(ABOUT_URL(id)).pipe(
      map((res) => res?.data ?? null),
      catchError((err) => {
        this.logger.error(`WebinarFacade: failed to load about for webinar ${id}`, err);
        return of<WebinarV2About | null>(null);
      }),
    );
  }

  /**
   * Pull the long-form content for one webinar and splice it into whichever
   * lists hold it. Idempotent — skips when the row already has content or the
   * request is in flight, so it's safe to call on every dialog open.
   *
   * `WebinarDetailsDialog` re-derives its webinar from these lists by id, so
   * the dialog fills itself in when this lands, with no changes of its own.
   */
  loadAbout(id: number): void {
    const current = this.findById(id);
    // `course_overview` is the marker for "content already loaded" —
    // `instructor_details` would be a false positive on the detail page, which
    // gets an instructor from `v2/webinar/details/` but no overview.
    if (!current || current.course_overview) return;

    const key = `about:${id}`;
    if (this.inFlight.has(key)) return;
    this.inFlight.add(key);

    this.fetchAbout(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((about) => {
        this.inFlight.delete(key);
        if (!about) return;
        // Re-read: a booking may have landed while this was in flight, and
        // `applyV2About` merges onto whatever the latest row is.
        const latest = this.findById(id);
        if (latest) this.patchWebinar(applyV2About(latest, about));
      });
  }

  /**
   * First match across EVERY list. Public because the details dialog and the
   * detail page both need to re-derive their webinar from the live signals —
   * they used to inline their own rail-by-rail lookup, and each time a rail was
   * added (most recently `missed`) they silently fell back to a stale snapshot
   * and stopped updating. One lookup, so a new rail only has to be added here.
   *
   * Reads the RAW enrollment lists on purpose: a row filtered out of a rendered
   * rail by attendance status is still findable. Reading the signals here also
   * means callers can use this inside a `computed` and stay reactive.
   *
   * `highlight` is searched first — the hero usually lives ONLY there (the
   * highlight and this-month endpoints are independent), so omitting it would
   * leave the hero unreachable to `patchWebinar` and its CTA would never flip
   * after a booking.
   */
  findById(id: number): UpcomingPremiere | undefined {
    return (
      this.highlight().find((w) => w.id === id) ??
      this.featuredWebinars().find((w) => w.id === id) ??
      this.attendedRaw().find((w) => w.id === id) ??
      this.absentRaw().find((w) => w.id === id) ??
      this.missedRaw().find((w) => w.id === id)
    );
  }

  /** CTA decision for templates. Pure pass-through to the utility. */
  ctaFor(webinar: UpcomingPremiere): WebinarCta {
    return ctaFor(webinar, this.auth.isLoggedIn());
  }

  /**
   * Post-login booking. Hits `POST /enrollment/register/` with the canonical
   * `{ Webinar_date_id, webinar_id }` body (note the capital `W` — that's the
   * backend's actual field name, not a typo). On success, the response carries
   * the full `WebinarEnrollment` record which we splice onto the webinar's
   * `registered_webinar.user_enrollments` and propagate to every list that
   * holds this webinar (highlight, this-month, attended, missed) so the UI
   * flips to "Booked" / "Join Live" everywhere it appears.
   *
   * Failure leaves all signals untouched so the original card stays bookable.
   */
  enroll(webinar: UpcomingPremiere): Observable<UpcomingPremiere> {
    if (!this.auth.isLoggedIn()) {
      this.notification.info('Sign in required', 'Please log in to book a webinar.');
      return of(webinar);
    }
    if (webinar.registered_webinar?.user_enrollments) {
      this.notification.info('Already booked', 'This webinar is in Your Bookings.');
      return of(webinar);
    }

    // Paid webinar, no subscription → upsell instead of enrolling. Gated here
    // rather than in each caller: the hero, the list item, the carousel card
    // and the details dialog all book through this one method.
    //
    // Reads the cached `hasActivePlan` signal (as the badge / CPE-tracker
    // gates do) rather than re-fetching the plan. `Auth` loads it right after
    // the profile on boot, so the only stale window is a click that lands
    // mid-boot — cheap to be wrong about, and the dialog is dismissible.
    if (needsSubscription(webinar, this.auth.hasActivePlan())) {
      this.openSubscriptionDialog();
      return of(webinar);
    }

    const session = nextSessionOf(webinar) ?? webinar.webinar_dates?.[0];
    if (!session) {
      this.notification.error('No session', 'This webinar has no upcoming sessions.');
      return of(webinar);
    }

    const body = { Webinar_date_id: session.id, webinar_id: webinar.id };

    return this.api.post<EnrollmentRegisterResponse>(ENROLLMENT_REGISTER_URL, body).pipe(
      map((response) => {
        if (!response?.status_code || !response.data) {
          throw new Error(response?.message || 'Failed to register');
        }
        const updated: UpcomingPremiere = {
          ...webinar,
          registered_webinar: {
            added: true,
            user_enrollments: response.data,
          },
        };
        this.patchWebinar(updated);
        this.analytics.trackEvent('webinar_register', {
          course_id: webinar.id,
          course_name: webinar.webinar_title,
          course_type: 'webinar',
        });
        this.notification.success(
          'Booked!',
          response.message || `You're registered for "${webinar.webinar_title}".`,
        );
        return updated;
      }),
      catchError((err) => {
        const msg =
          err?.error?.message || err?.message || 'Failed to book this webinar. Please try again.';
        this.notification.error('Booking failed', msg);
        this.logger.error('WebinarFacade.enroll failed', err);
        return of(webinar);
      }),
    );
  }

  /**
   * Replace this webinar wherever it already appears, so a "Booked" / "Join
   * Live" CTA flip reaches the hero, the this-month
   * list, the enrollment rails and the details dialog simultaneously.
   *
   * Purely in-place: nothing is inserted into a list it wasn't already in.
   * The rails are all server-filtered views, so a locally-invented row would
   * only disagree with the next fetch.
   */
  private patchWebinar(updated: UpcomingPremiere): void {
    const patch = (list: UpcomingPremiere[]): UpcomingPremiere[] =>
      list.map((w) => (w.id === updated.id ? updated : w));
    this.highlight.update(patch);
    this.featuredWebinars.update(patch);
    this.attendedRaw.update(patch);
    this.absentRaw.update(patch);
    this.missedRaw.update(patch);
  }

  /**
   * Subscription upsell for a paid webinar. Same dialog and options
   * `EngagementDialog` uses for its periodic prompt, so the paywall a learner
   * meets here looks identical to the one the app shows unprompted.
   *
   * No `injector` is passed: `SubscriptionDialog` only needs `PaymentFacade`,
   * which is `providedIn: 'root'` and therefore resolvable from the dialog
   * service's own injector.
   */
  private openSubscriptionDialog(): void {
    this.dialog.open<SubscriptionDialog, void>(SubscriptionDialog, {
      maxWidth: '95vw',
      ariaLabel: 'Subscribe to a plan',
    });
  }

  /** Open the details modal for the given webinar. */
  // The long-form content is NOT fetched here — `WebinarDetailsDialog.ngOnInit`
  // calls `loadAbout` itself, so the cards' info button (which reaches the
  // dialog via `Utils.openCourseInfoDialog`, bypassing this method) gets it too.
  openDetails(webinar: UpcomingPremiere): void {
    this.analytics.trackEvent('view_item', {
      course_id: webinar.id,
      course_name: webinar.webinar_title,
      course_type: 'webinar',
    });
    this.dialog.open<WebinarDetailsDialog>(WebinarDetailsDialog, {
      maxWidth: '90vw',
      enterAnimationDuration: '300ms',
      exitAnimationDuration: '300ms',
      data: { webinar },
      // Hand the route-scoped injector to the dialog so it can resolve
      // `WebinarFacade` (and any other route-scoped providers it relies on).
      environmentInjector: this.envInjector,
    });
  }

  /**
   * Open the pre-login registration modal. Used by list items (e.g.
   * `PremiereListItem`) when a guest taps "Book Now" — the dialog wraps the
   * same `WebinarRegistrationForm` the hero / details page mount inline, so
   * the OTP + auto-login flow are identical regardless of entry point.
   */
  openRegistration(webinar: UpcomingPremiere): void {
    const data: WebinarRegistrationDialogData = {
      webinar,
      onRegistered: (payload, w) => this.registerAndEnroll(payload, w),
    };
    this.dialog.open<WebinarRegistrationDialog>(WebinarRegistrationDialog, {
      maxWidth: '92vw',
      enterAnimationDuration: '300ms',
      exitAnimationDuration: '300ms',
      data,
    });
  }

  /**
   * Mark a webinar as booked locally after a successful guest registration.
   * The `<app-webinar-registration-form>` owns the network flow (registration
   * + OTP) and emits once the backend confirms enrollment; this just mirrors
   * the optimistic mutation used by `enroll()` so the hero flips into the
   * "Booked" state without an auth token round-trip.
   */
  registerAndEnroll(_payload: WebinarRegistrationFormValue, webinar: UpcomingPremiere): void {
    // Source of truth for "Booked" is `user_enrollments`, so the optimistic
    // flip has to populate it. The session-level fields (`webinar_dates`,
    // `webinar_date`, `webinar`) are real; the user-scoped fields fall back
    // to placeholders since we don't have the user's actual enrollment row
    // until the next `/webinar/enrollments/` refresh.
    const session = nextSessionOf(webinar);
    const stubEnrollment: WebinarEnrollment = {
      id: -1,
      webinar_dates:
        session ?? webinar.webinar_dates?.[0] ?? ({} as WebinarEnrollment['webinar_dates']),
      feedback_submitted: false,
      attendance_status: 'Pending',
      active_plan: null,
      zoom_class_details: null,
      has_attended_class: false,
      is_active: true,
      join_url: session?.join_url ?? null,
      joined_time: null,
      leave_time: null,
      time_durations: 0,
      created_at: webinar.created_at,
      webinar: webinar.id,
      webinar_date: session?.id ?? webinar.webinar_dates?.[0]?.id ?? 0,
      user: -1,
      updated_by: null,
    };
    const optimistic: UpcomingPremiere = {
      ...webinar,
      registered_webinar: {
        ...webinar.registered_webinar,
        added: true,
        user_enrollments: stubEnrollment,
      },
    };
    this.patchWebinar(optimistic);
  }

  /**
   * Navigate to the feedback page for the given webinar. Mirrors
   * `MasterclassFacade.submitFeedback`: takes the current URL (stripped of
   * query params), appends `feedback`, and stashes a `redirect` so the page
   * can route the user back after submit.
   */
  submitFeedback(_webinar: UpcomingPremiere): void {
    const url = this.router.url.split('?')[0];
    this.router.navigate([url, 'feedback'], { queryParams: { redirect: this.router.url } });
  }

  /**
   * Open the shared certificate download dialog with webinar-specific data.
   * Passes through `webinar.certificate_type` (`'nasba'` / `'miles'` / `'both'`)
   * so the backend returns the right variant.
   */
  openCertificateDownloadDialog(webinar: UpcomingPremiere): void {
    // `accept_url` may be null on the wire (user not yet badge-eligible), so
    // the type's non-nullable `string` is loosened locally before narrowing.
    const rawBadge = webinar.user_badge as {
      id?: number | null;
      badge_name?: string | null;
      badge_image?: string | null;
      description?: string | null;
      accept_url?: string | null;
    } | null;
    // Surface the badge row whenever the server has minted one — the dialog
    // claims via `id` on Share click when `acceptUrl` isn't yet set.
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

    const rawType = webinar.certificate_type as string | undefined;
    const certificateType =
      rawType === 'nasba' || rawType === 'miles' || rawType === 'both' ? rawType : undefined;

    const data: CertificateDialogData = {
      courseId: webinar.id,
      courseType: 'webinar',
      courseTitle: webinar.webinar_title,
      badge,
      certificateType,
    };
    this.dialog.open<CertificateDownloadDialog, CertificateDialogData>(CertificateDownloadDialog, {
      maxWidth: '100%',
      enterAnimationDuration: '300ms',
      exitAnimationDuration: '300ms',
      data,
    });
  }
}
