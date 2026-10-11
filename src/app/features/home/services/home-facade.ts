import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { computed, effect, inject, PLATFORM_ID, Service } from '@angular/core';
import { environment } from '@env/environment';
import { MasterclassLevel, parseLevels } from '@core/models/masterclass-home.model';
import { apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { Logger } from '@core/services/logger/logger';
import { HomeWebinar, parseHighlightWebinar } from '../models/home-sections.model';

/**
 * The editorial webinar rail for the home page (Postman
 * `web-events-highlight-webinars-v1`). `AllowAny` and pre-login only by
 * design: it takes no `login_type`, a signed-in caller gets the same rail, and
 * any undeclared query parameter is a 400. Upcoming webinars only.
 */
const HIGHLIGHT_WEBINARS_URL = `${environment.BASE_API_URL}web-api/v1/events/highlight-webinars/`;

/**
 * The level ladder (Postman `web-masterclass-levels-v1`). Sign-in only — a
 * guest is a 401 — and there is no pre-login variant, so guests get no CAIRA
 * section at all (decided 2026-10-11). Not paginated.
 */
const LEVELS_URL = `${environment.BASE_API_URL}web-api/v1/masterclass/levels/`;

/** The programme whose ladder the CAIRA stack shows; `levels/` returns every programme's. */
const CAIRA_SUBJECT = 'CAIRA';

/**
 * The home page's own reads: the live-webinar ticket and the CAIRA levels.
 * The track rails stay on the root `MasterclassHomeFacade`, which
 * `/masterclass` shares.
 *
 * Both reads are browser-only, like the rails on this page (MIL-23): neither
 * section is in the first viewport, and each appears only once it has data,
 * so there is no placeholder to shift.
 */
@Service({ autoProvided: false })
export class HomeFacade {
  private readonly auth = inject(AuthSession);
  private readonly logger = inject(Logger);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // The ticket renders one webinar, so ask for one row.
  private readonly webinarResource = httpResource<HomeWebinar | null>(
    () =>
      this.isBrowser
        ? { url: apiUrl(HIGHLIGHT_WEBINARS_URL), params: { page_size: 1 } }
        : undefined,
    { defaultValue: null, parse: parseHighlightWebinar },
  );

  /**
   * Gated on the session's boolean, never the token, so a token rotation does
   * not refetch. Signing out makes the request `undefined`: the resource goes
   * idle, falls back to `[]`, and the section disappears by itself.
   */
  private readonly levelsResource = httpResource<MasterclassLevel[]>(
    () => (this.isBrowser && this.auth.isAuthenticated() ? apiUrl(LEVELS_URL) : undefined),
    { defaultValue: [], parse: parseLevels },
  );

  /** The highlighted webinar for the ticket; `null` hides the section and its sidenav entry. */
  readonly webinar = computed<HomeWebinar | null>(() =>
    this.webinarResource.hasValue() ? this.webinarResource.value() : null,
  );

  /** The CAIRA ladder; empty hides the section and its sidenav entry. */
  readonly cairaLevels = computed<MasterclassLevel[]>(() =>
    this.levelsResource.hasValue()
      ? this.levelsResource.value().filter((level) => level.subject_name === CAIRA_SUBJECT)
      : [],
  );

  // Both sections hide on failure, so the log is the only place a drift shows.
  private readonly loadErrorLog = effect(() => {
    const webinarError = this.webinarResource.error();
    const levelsError = this.levelsResource.error();
    if (webinarError)
      this.logger.error('[HomeFacade] highlight-webinars load failed', webinarError);
    if (levelsError) this.logger.error('[HomeFacade] levels load failed', levelsError);
  });
}
