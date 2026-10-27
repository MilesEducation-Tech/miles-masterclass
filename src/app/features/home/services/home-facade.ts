import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { computed, effect, inject, PLATFORM_ID, Service } from '@angular/core';
import { environment } from '@env/environment';
import { MasterclassLevel, parseLevels } from '@core/models/masterclass-home.model';
import { apiUrl } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { HomeWebinar, parseHighlightWebinar } from '../models/home-sections.model';

/**
 * The editorial webinar rail for the home page (Postman
 * `web-events-highlight-webinars-v1`). `AllowAny` and pre-login only by
 * design: it takes no `login_type`, a signed-in caller gets the same rail, and
 * any undeclared query parameter is a 400. Upcoming webinars only.
 */
const HIGHLIGHT_WEBINARS_URL = `${environment.API.baseUrl}web-api/v1/events/highlight-webinars/`;

/**
 * The level ladder (Postman `web-masterclass-levels-v1`). Not paginated. Read
 * by guests too (decided 2026-10-12): the ladder is the same for everyone, and
 * the interceptor attaches the bearer only when there is one. UAT still
 * answers a guest 401 until the backend opens the route (Q9 in
 * `docs/MASTERCLASS_API_QUESTIONS.md`); until then the section stays hidden
 * for guests and the failure is logged.
 */
const LEVELS_URL = `${environment.API.baseUrl}web-api/v1/masterclass/levels/`;

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

  // Not gated on the session: signing in or out does not change the ladder.
  private readonly levelsResource = httpResource<MasterclassLevel[]>(
    () => (this.isBrowser ? apiUrl(LEVELS_URL) : undefined),
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
