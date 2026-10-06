import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { computed, effect, inject, PLATFORM_ID, Service } from '@angular/core';
import { environment } from '@env/environment';
import {
  MasterclassHomePage,
  MasterclassLoginType,
  MasterclassTrack,
  parseHomePage,
} from '@core/models/masterclass-home.model';
import { apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { Logger } from '@core/services/logger/logger';
import { withPreviousValue } from '@core/utils/with-previous-value';

/**
 * Absolute URL off `BASE_API_URL`, which is the ORIGIN ROOT (trailing slash,
 * no `api/` segment). Built whole, the same way as `WEBINAR_ENDPOINTS`, so
 * `apiUrl()` passes it through untouched and the `web-api/` surface is
 * spelled out where a reviewer can see it. This read never calls `app-api/`.
 *
 * Web-only read, `AllowAny`: the tracks with their courses inline. Replaced
 * `home-page/` on 2026-10-07 (Postman `web-masterclass-tracks-page-v1`); the
 * old route is a 404 on every host.
 *
 * `login_type` is required and strict — leaving it out, or sending any other
 * key, is a 400 `invalid_query`. An anonymous `post_login` is a 401, and so
 * is a bad or expired token on either branch (the backend rechecked this on
 * 2026-10-07; it used to be a 403).
 */
const TRACKS_PAGE_URL = `${environment.BASE_API_URL}web-api/v1/masterclass/tracks-page/`;

/**
 * Rows asked for per list on `tracks-page/`: `tracks.page_size` for the tracks
 * and `tracks.courses.page_size` for each track's courses.
 *
 * The API pages both lists, 6 rows each by default, with a ceiling of 100. A
 * later page needs its own request (`?tracks.page=2`, or `?track=<slug>` plus
 * `tracks.courses.page=N` for one track's courses). Both pages show every track
 * and every course in each carousel, so this asks for the ceiling once instead
 * of paging. UAT holds 4 tracks of up to 34 courses; a list past 100 rows
 * would be cut off at 100.
 */
const HOME_PAGE_LIST_PAGE_SIZE = 100;

/** The page before `tracks-page/` answers, so templates read one fixed shape. */
const EMPTY_HOME_PAGE: MasterclassHomePage = { login_type: 'pre_login', tracks: [] };

/**
 * The `tracks-page/` read: the masterclass tracks with their courses, shared by
 * the home page and the masterclass page.
 *
 * Root on purpose, like `FeatureFacade`: two routes render the same rails, and
 * a root instance means home → masterclass reuses the parsed page instead of
 * refetching ~216 KB. The read is live from first inject, so only pages inject
 * this — never a layout or a shared component.
 *
 * The trailer dialog is not here: it lives in `Utils` (shared), which core
 * cannot import, so each page opens it itself.
 */
@Service()
export class MasterclassHomeFacade {
  private readonly auth = inject(AuthSession);
  private readonly logger = inject(Logger);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Derived from the session's boolean, never the token, so a token rotation
   * does not refetch — but signing in or out does, by itself.
   */
  private readonly loginType = computed<MasterclassLoginType>(() =>
    this.auth.isAuthenticated() ? 'post_login' : 'pre_login',
  );

  private readonly homePageResource = httpResource<MasterclassHomePage>(
    () => {
      const loginType = this.loginType();

      // `pre_login` is served anonymously, so the SERVER fetches it and a
      // crawler gets the real tracks; the response lands in the HTTP transfer
      // cache and the browser reuses it rather than refetching. `post_login` is
      // skipped on the server: the learner token lives in the browser, and
      // asking for the signed-in page without one is a 401.
      if (!this.isBrowser && loginType === 'post_login') return undefined;

      return {
        url: apiUrl(TRACKS_PAGE_URL),
        params: {
          login_type: loginType,
          // Every track and every course in one response; the API pages both
          // lists 6 rows at a time.
          'tracks.page_size': HOME_PAGE_LIST_PAGE_SIZE,
          'tracks.courses.page_size': HOME_PAGE_LIST_PAGE_SIZE,
        },
      };
    },
    {
      defaultValue: EMPTY_HOME_PAGE,
      // The trust boundary: a body that drifted from the contract lands in
      // `error()` here — and so in `loadError()` — instead of on screen.
      parse: parseHomePage,
    },
  );

  /** Holds the last good page through a refetch (sign-in), so rails don't flash empty. */
  private readonly homePage = withPreviousValue(this.homePageResource);

  /**
   * The tracks to render, in the API's order (the backend owns ordering).
   * A track with no courses is dropped: the API returns empty tracks, and an
   * empty rail is a heading with nothing under it.
   */
  readonly tracks = computed<MasterclassTrack[]>(() =>
    this.homePage.hasValue()
      ? this.homePage.value().tracks.filter((track) => track.courses.length > 0)
      : [],
  );

  readonly isLoading = computed(() => this.homePage.isLoading());

  /** A failed load or a contract mismatch; pages show it with a retry. */
  readonly loadError = computed(() => this.homePageResource.error() ?? null);

  // A contract drift is a backend conversation, so it must reach the logs and
  // not only the learner's screen.
  private readonly loadErrorLog = effect(() => {
    const error = this.loadError();
    if (error) this.logger.error('[MasterclassHomeFacade] tracks-page load failed', error);
  });

  reload(): void {
    this.homePageResource.reload();
  }
}
