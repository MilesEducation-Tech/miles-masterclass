import { isPlatformBrowser } from '@angular/common';
import { HttpContext, HttpErrorResponse, httpResource } from '@angular/common/http';
import { computed, effect, inject, PLATFORM_ID, Service, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, map } from 'rxjs';
import { SKIP_LOADING } from '@core/models/http.model';
import { MasterclassCourse, MasterclassRail } from '@core/models/masterclass-home.model';
import { ApiClient, apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { MasterclassBookmarks } from '@core/services/masterclass-bookmarks/masterclass-bookmarks';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import { Utils } from '@shared/services/utils';
import {
  complimentaryHeading,
  LIBRARY_OFFERINGS,
  MASTERCLASS_COMING_SOON_NOTIFY_ROUTE,
  MASTERCLASS_COMING_SOON_PARAMS,
  MASTERCLASS_COMING_SOON_URL,
  MASTERCLASS_COMPLETED_PARAMS,
  MASTERCLASS_COMPLETED_URL,
  MASTERCLASS_LIBRARY_PARAMS,
  MASTERCLASS_LIBRARY_URL,
  MASTERCLASS_RAIL_HEADINGS,
  MASTERCLASS_RAIL_SECTION_IDS,
  MASTERCLASS_RAILS_ABOVE_TRACKS,
  MASTERCLASS_REMINDER_TOASTS,
} from '@features/offerings/constants/masterclass-library';
import {
  LibraryOffering,
  MasterclassComingSoonCourse,
  MasterclassLibrary,
  parseComingSoon,
  parseCompletedSection,
  parseMasterclassLibrary,
  parseNotifyMe,
} from '@features/offerings/models/masterclass-library.model';

/**
 * An offering landing page's signed-in rails: Continue Watching, Recommended
 * For You, Complimentary and Because You Watched above the tracks, My List,
 * the completed courses and Coming Soon below them. Offering-wide, like
 * `CourseDetailFacade`: the routes are the same for every course type, and
 * what differs (`course_type`) comes from `LIBRARY_OFFERINGS` once the page
 * calls `connect()`. Route-scoped: the landing route lists it in `providers`.
 *
 * The reads run only once connected, only signed in and only in the browser:
 * the token lives there, and signed out `library/` sends these rails empty.
 * `coming-soon/` is public, but the rail shows only signed in. Signing in or
 * out re-runs them by itself, off the session's boolean. A bookmark changed
 * anywhere re-reads `library/`, so My List follows it. A Coming Soon card's
 * Remind Me and trailer live here too, beside the rail they belong to.
 */
@Service({ autoProvided: false })
export class MasterclassLibraryFacade {
  private readonly auth = inject(AuthSession);
  private readonly logger = inject(Logger);
  private readonly bookmarks = inject(MasterclassBookmarks);
  private readonly api = inject(ApiClient);
  private readonly notification = inject(NotificationService);
  private readonly utils = inject(Utils);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Which offering's courses to read; `null` until `connect()`. */
  private readonly offering = signal<LibraryOffering | null>(null);

  /** The connected offering's `course_type`; `null` until `connect()`. */
  private readonly courseType = computed(() => {
    const offering = this.offering();
    return offering ? LIBRARY_OFFERINGS[offering].courseType : null;
  });

  private readonly signedIn = computed(() => this.isBrowser && this.auth.isAuthenticated());

  private readonly library = httpResource<MasterclassLibrary>(
    () => {
      const course_type = this.courseType();
      if (!course_type || !this.signedIn()) return undefined;
      // `course_type` second, where it always sat, so the query string is unchanged.
      const { login_type, ...pageSizes } = MASTERCLASS_LIBRARY_PARAMS;
      return {
        url: apiUrl(MASTERCLASS_LIBRARY_URL),
        params: { login_type, course_type, ...pageSizes },
      };
    },
    // The trust boundary: an answer that drifted from the contract lands in `error()`.
    { parse: parseMasterclassLibrary },
  );

  private readonly completed = httpResource<MasterclassCourse[]>(
    () => {
      const course_type = this.courseType();
      if (!course_type || !this.signedIn()) return undefined;
      return {
        url: apiUrl(MASTERCLASS_COMPLETED_URL),
        params: { course_type, ...MASTERCLASS_COMPLETED_PARAMS },
      };
    },
    { parse: parseCompletedSection },
  );

  private readonly comingSoonResource = httpResource<MasterclassComingSoonCourse[]>(
    () => {
      const course_type = this.courseType();
      if (!course_type || !this.signedIn()) return undefined;
      return {
        url: apiUrl(MASTERCLASS_COMING_SOON_URL),
        params: { course_type, ...MASTERCLASS_COMING_SOON_PARAMS },
      };
    },
    { parse: parseComingSoon },
  );

  /** Read one offering's courses; the landing page calls it once, from its constructor. */
  connect(offering: LibraryOffering): void {
    this.offering.set(offering);
  }

  private readonly latestLibrary = computed(() =>
    this.library.hasValue() ? this.library.value() : undefined,
  );

  /** The rails above the tracks, in order; a rail with no courses is left out. */
  readonly railsAboveTracks = computed<MasterclassRail[]>(() => {
    const library = this.latestLibrary();
    if (!library) return [];
    return MASTERCLASS_RAILS_ABOVE_TRACKS.map(({ key, id, heading }) => ({
      id,
      heading:
        key === 'complimentary' && library.companyName
          ? complimentaryHeading(library.companyName)
          : heading,
      courses: library.rails[key],
    })).filter((rail) => rail.courses.length > 0);
  });

  /**
   * My List and the completed courses, below the tracks. `bookmarked` is not
   * narrowed by the request's `course_type`, so My List keeps the connected
   * offering's own: a bookmarked podcast belongs on the podcast page.
   */
  readonly railsBelowTracks = computed<MasterclassRail[]>(() => {
    const bookmarked = this.latestLibrary()?.rails.bookmarked ?? [];
    const courseType = this.courseType();
    const rails: MasterclassRail[] = [
      {
        id: MASTERCLASS_RAIL_SECTION_IDS.myList,
        heading: MASTERCLASS_RAIL_HEADINGS.myList,
        courses: bookmarked.filter((course) => course.course_type === courseType),
      },
      {
        id: MASTERCLASS_RAIL_SECTION_IDS.completed,
        heading: MASTERCLASS_RAIL_HEADINGS.completed,
        courses: this.completed.hasValue() ? this.completed.value() : [],
      },
    ];
    return rails.filter((rail) => rail.courses.length > 0);
  });

  /** The Coming Soon rail, last on the page; empty until it loads, and on failure. */
  readonly comingSoon = computed<MasterclassComingSoonCourse[]>(() =>
    this.comingSoonResource.hasValue() ? this.comingSoonResource.value() : [],
  );

  private readonly reminderPending = signal<ReadonlySet<string>>(new Set());

  /** Teasers whose reminder is in flight: their button disables, and a second click is ignored. */
  readonly remindersInFlight = this.reminderPending.asReadonly();

  /** A Coming Soon teaser's trailer, in the shared video dialog. */
  openComingSoonTrailer(course: MasterclassComingSoonCourse): void {
    void this.utils.openVideoDialog(course.trailer_url, course.name);
  }

  /**
   * A Coming Soon card's Remind Me. The button flips at once, then keeps the
   * server's answer; a failure flips it back and says so. A teaser that has
   * launched (409) or is no longer listed (404) leaves the rail on a re-read.
   */
  toggleReminder(course: MasterclassComingSoonCourse): void {
    const { id, name } = course;
    if (this.reminderPending().has(id)) return;
    const next = !course.notify_me;
    this.setReminder(id, next);
    this.reminderPending.update((ids) => new Set(ids).add(id));
    const toasts = MASTERCLASS_REMINDER_TOASTS;
    this.api
      .call(
        {
          ...MASTERCLASS_COMING_SOON_NOTIFY_ROUTE,
          path: MASTERCLASS_COMING_SOON_NOTIFY_ROUTE.path.replace(':id', id),
        },
        { notify_me: next },
        // The button changing is the indicator, so no page-wide loading bar.
        { context: new HttpContext().set(SKIP_LOADING, true) },
      )
      .pipe(
        map(parseNotifyMe),
        finalize(() =>
          this.reminderPending.update(
            (ids) => new Set([...ids].filter((pending) => pending !== id)),
          ),
        ),
      )
      .subscribe({
        next: (on) => {
          this.setReminder(id, on);
          this.notification.success(on ? toasts.on : toasts.off, name);
        },
        error: (error: unknown) => {
          this.logger.error('[MasterclassLibraryFacade] reminder failed', error);
          const status = error instanceof HttpErrorResponse ? error.status : 0;
          if (status === 409 || status === 404) {
            this.notification.info(status === 409 ? toasts.launched : toasts.gone, name);
            this.comingSoonResource.reload();
            return;
          }
          this.setReminder(id, !next);
          this.notification.error(toasts.failed.title, toasts.failed.message);
        },
      });
  }

  /** The section ids on the page, for the sidenav's entries. */
  readonly sectionIds = computed(() => {
    const ids = [...this.railsAboveTracks(), ...this.railsBelowTracks()].map((rail) => rail.id);
    if (this.comingSoon().length) ids.push(MASTERCLASS_RAIL_SECTION_IDS.comingSoon);
    return new Set(ids);
  });

  // From a card or the course page. Route injectors outlive the page, so this
  // runs on the course page too and My List is current on the way back.
  // `reload()` keeps the rails on screen while it reads.
  private readonly myListSync = this.bookmarks.changed$
    .pipe(takeUntilDestroyed())
    .subscribe(() => this.library.reload());

  // The rails hide on failure, so the log is the only place a drift shows.
  private readonly libraryErrorLog = effect(() => {
    const error = this.library.error();
    if (error) this.logger.error('[MasterclassLibraryFacade] library load failed', error);
  });

  private readonly completedErrorLog = effect(() => {
    const error = this.completed.error();
    if (error) this.logger.error('[MasterclassLibraryFacade] completed load failed', error);
  });

  /** One teaser's reminder, set on the rail's own rows so every read of them agrees. */
  private setReminder(id: string, on: boolean): void {
    if (!this.comingSoonResource.hasValue()) return;
    this.comingSoonResource.value.update((rows) =>
      rows.map((row) => (row.id === id ? { ...row, notify_me: on } : row)),
    );
  }

  private readonly comingSoonErrorLog = effect(() => {
    const error = this.comingSoonResource.error();
    if (error) this.logger.error('[MasterclassLibraryFacade] coming soon load failed', error);
  });
}
