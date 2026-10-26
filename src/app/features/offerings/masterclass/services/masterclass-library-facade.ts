import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { computed, effect, inject, PLATFORM_ID, Service } from '@angular/core';
import { MASTERCLASS_COURSE_TYPE } from '@core/constants/masterclass';
import { MasterclassCourse } from '@core/models/masterclass-home.model';
import { apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { Logger } from '@core/services/logger/logger';
import {
  complimentaryHeading,
  MASTERCLASS_COMPLETED_PARAMS,
  MASTERCLASS_COMPLETED_URL,
  MASTERCLASS_LIBRARY_PARAMS,
  MASTERCLASS_LIBRARY_URL,
  MASTERCLASS_RAIL_HEADINGS,
  MASTERCLASS_RAIL_SECTION_IDS,
  MASTERCLASS_RAILS_ABOVE_TRACKS,
} from '@features/offerings/masterclass/constants/masterclass';
import {
  MasterclassLibrary,
  MasterclassRail,
  parseCompletedSection,
  parseMasterclassLibrary,
} from '@features/offerings/masterclass/models/masterclass-library.model';

/**
 * The masterclass page's signed-in rails: Continue Watching, Recommended For
 * You, Complimentary and Because You Watched above the tracks, My List and the
 * completed courses below them. Route-scoped, like `MasterclassHighlightFacade`:
 * only `/masterclass` renders them.
 *
 * Both reads run only signed in and only in the browser: the token lives
 * there, and signed out `library/` sends these rails empty. Signing in or out
 * re-runs them by itself, off the session's boolean.
 */
@Service({ autoProvided: false })
export class MasterclassLibraryFacade {
  private readonly auth = inject(AuthSession);
  private readonly logger = inject(Logger);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly signedIn = computed(() => this.isBrowser && this.auth.isAuthenticated());

  private readonly library = httpResource<MasterclassLibrary>(
    () =>
      this.signedIn()
        ? { url: apiUrl(MASTERCLASS_LIBRARY_URL), params: MASTERCLASS_LIBRARY_PARAMS }
        : undefined,
    // The trust boundary: an answer that drifted from the contract lands in `error()`.
    { parse: parseMasterclassLibrary },
  );

  private readonly completed = httpResource<MasterclassCourse[]>(
    () =>
      this.signedIn()
        ? { url: apiUrl(MASTERCLASS_COMPLETED_URL), params: MASTERCLASS_COMPLETED_PARAMS }
        : undefined,
    { parse: parseCompletedSection },
  );

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
   * narrowed by the request's `course_type`, so My List keeps the masterclasses:
   * a bookmarked podcast belongs on the podcast page.
   */
  readonly railsBelowTracks = computed<MasterclassRail[]>(() => {
    const bookmarked = this.latestLibrary()?.rails.bookmarked ?? [];
    const rails: MasterclassRail[] = [
      {
        id: MASTERCLASS_RAIL_SECTION_IDS.myList,
        heading: MASTERCLASS_RAIL_HEADINGS.myList,
        courses: bookmarked.filter((course) => course.course_type === MASTERCLASS_COURSE_TYPE),
      },
      {
        id: MASTERCLASS_RAIL_SECTION_IDS.completed,
        heading: MASTERCLASS_RAIL_HEADINGS.completed,
        courses: this.completed.hasValue() ? this.completed.value() : [],
      },
    ];
    return rails.filter((rail) => rail.courses.length > 0);
  });

  /** The section ids on the page, for the sidenav's entries. */
  readonly sectionIds = computed(
    () => new Set([...this.railsAboveTracks(), ...this.railsBelowTracks()].map((rail) => rail.id)),
  );

  // The rails hide on failure, so the log is the only place a drift shows.
  private readonly libraryErrorLog = effect(() => {
    const error = this.library.error();
    if (error) this.logger.error('[MasterclassLibraryFacade] library load failed', error);
  });

  private readonly completedErrorLog = effect(() => {
    const error = this.completed.error();
    if (error) this.logger.error('[MasterclassLibraryFacade] completed load failed', error);
  });
}
