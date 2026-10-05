import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { computed, effect, inject, PLATFORM_ID, Service } from '@angular/core';
import { apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { Logger } from '@core/services/logger/logger';
import { Utils } from '@shared/services/utils';
import { withPreviousValue } from '@shared/utils/with-previous-value';
import { MASTERCLASS_ENDPOINTS } from '@features/offerings/masterclass/constants/masterclass';
import {
  MasterclassCourse,
  MasterclassHomePage,
  MasterclassLoginType,
  MasterclassTrack,
  parseHomePage,
} from '@features/offerings/masterclass/models/masterclass-home.model';

/** Empty page, so every consumer reads the same fixed shape before the load. */
const EMPTY_HOME_PAGE: MasterclassHomePage = { login_type: 'pre_login', tracks: [] };

/**
 * Owns the masterclass page's data: the tracks from `home-page/`.
 *
 * Route-scoped (listed in the masterclass route's `providers`), so the page's
 * data dies with the page rather than outliving it in a root singleton the way
 * the old `FeatureFacade` caches did.
 */
@Service({ autoProvided: false })
export class MasterclassHomeFacade {
  private readonly auth = inject(AuthSession);
  private readonly logger = inject(Logger);
  private readonly utils = inject(Utils);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Derived from the session's boolean, never the token, so a token rotation
   * does not refetch — but signing in or out does, by itself.
   */
  readonly loginType = computed<MasterclassLoginType>(() =>
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
        url: apiUrl(MASTERCLASS_ENDPOINTS.homePage),
        params: { login_type: loginType },
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

  /** A failed load or a contract mismatch; the page shows it with a retry. */
  readonly loadError = computed(() => this.homePageResource.error() ?? null);

  constructor() {
    // A contract drift is a backend conversation, so it must reach the logs and
    // not only the learner's screen.
    effect(() => {
      const error = this.loadError();
      if (error) this.logger.error('[MasterclassHomeFacade] home-page load failed', error);
    });
  }

  reload(): void {
    this.homePageResource.reload();
  }

  /** The shared video dialog; it toasts "Trailer Not Found" for a course with none. */
  openTrailer(course: MasterclassCourse): void {
    void this.utils.openVideoDialog(course.trailer_url, course.title);
  }
}
