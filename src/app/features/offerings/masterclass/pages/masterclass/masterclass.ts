import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, PLATFORM_ID } from '@angular/core';
import { swiperConfigEven, swiperConfigOdd } from '@core/config/swiper.config';
import { apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { FeatureFacade } from '@core/services/feature-facade/feature-facade';
import { Logger } from '@core/services/logger/logger';
import { Carousel } from '@shared/components/carousel/carousel';
import { Faq } from '@shared/components/faq/faq';
import { SectionNav, SectionNavItem } from '@shared/components/section-nav/section-nav';
import { SliderSkeleton } from '@shared/components/skeleton/slider-skeleton/slider-skeleton';
import { Slider } from '@shared/components/slider/slider';
import { Utils } from '@shared/services/utils';
import { Button } from '@shared/ui/button/button';
import { withPreviousValue } from '@shared/utils/with-previous-value';
import { MasterclassCourseCard } from '@features/offerings/masterclass/components/masterclass-course-card/masterclass-course-card';
import {
  EMPTY_HOME_PAGE,
  HOME_PAGE_COURSES_PER_TRACK,
  MASTERCLASS_ENDPOINTS,
} from '@features/offerings/masterclass/constants/masterclass';
import {
  MASTERCLASS_SECTION_NAV,
  MASTERCLASS_TRACKS_SECTION_ID,
} from '@features/offerings/masterclass/constants/masterclass-nav';
import {
  MasterclassCourse,
  MasterclassHomePage,
  MasterclassLoginType,
  MasterclassTrack,
  parseHomePage,
} from '@features/offerings/masterclass/models/masterclass-home.model';

/**
 * The masterclass landing page: the hero, then one carousel per track from
 * `home-page/`. The page owns the tracks read itself; there is no facade, as
 * nothing else reads them.
 */
@Component({
  selector: 'app-masterclass',
  imports: [Carousel, Faq, SectionNav, Slider, SliderSkeleton, Button, MasterclassCourseCard],
  templateUrl: './masterclass.html',
})
export class Masterclass {
  private readonly auth = inject(AuthSession);
  private readonly logger = inject(Logger);
  private readonly utils = inject(Utils);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * The hero is deliberately left exactly as it was, on its legacy feed — it
   * is out of this rebind's scope. Move it with its own ticket.
   */
  private readonly feature = inject(FeatureFacade);
  protected readonly popular = this.feature.getResource('popular', 'masterclass');

  // ---- Tracks --------------------------------------------------------------

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
        url: apiUrl(MASTERCLASS_ENDPOINTS.homePage),
        params: {
          login_type: loginType,
          // Every course in one response; the API pages them 6 at a time.
          'tracks.courses.page_size': HOME_PAGE_COURSES_PER_TRACK,
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
  protected readonly tracks = computed<MasterclassTrack[]>(() =>
    this.homePage.hasValue()
      ? this.homePage.value().tracks.filter((track) => track.courses.length > 0)
      : [],
  );

  protected readonly isLoading = computed(() => this.homePage.isLoading());

  /** A failed load or a contract mismatch; the template shows it with a retry. */
  protected readonly loadError = computed(() => this.homePageResource.error() ?? null);

  // ---- Layout --------------------------------------------------------------

  // Even tracks render vertical cards (more per view), odd ones horizontal.
  protected readonly swiperConfigEven = swiperConfigEven;
  protected readonly swiperConfigOdd = swiperConfigOdd;

  protected readonly sectionNavItems = computed<SectionNavItem[]>(() =>
    MASTERCLASS_SECTION_NAV.map((item) =>
      item.id === MASTERCLASS_TRACKS_SECTION_ID
        ? { ...item, visible: this.tracks().length > 0 }
        : item,
    ),
  );

  constructor() {
    // A contract drift is a backend conversation, so it must reach the logs and
    // not only the learner's screen.
    effect(() => {
      const error = this.loadError();
      if (error) this.logger.error('[Masterclass] home-page load failed', error);
    });
  }

  protected reload(): void {
    this.homePageResource.reload();
  }

  /** The shared video dialog; it toasts "Trailer Not Found" for a course with none. */
  protected openTrailer(course: MasterclassCourse): void {
    void this.utils.openVideoDialog(course.trailer_url, course.title);
  }
}
