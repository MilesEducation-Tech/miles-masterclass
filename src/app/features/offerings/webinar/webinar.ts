import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Route } from '@angular/router';

import { authGuard } from '../../../shared/core/guards/auth/auth-guard';
import { Horizontal } from '../../../shared/components/cards/horizontal/horizontal';
import { Carousel } from '../../../shared/components/carousel/carousel';
import { swiperConfigEven } from '../../../shared/core/config/swiper.config';
import { Utils } from '../../../shared/core/services/utils/utils';
import { PremiereListItem } from './shared/components/premiere-list-item/premiere-list-item';
import { WebinarHero } from './shared/components/webinar-hero/webinar-hero';
import {
  WebinarClaimCard,
  WebinarClaimState,
} from './shared/components/webinar-claim-card/webinar-claim-card';
import { upcomingToContent } from './shared/utils/upcoming-to-content';
import { Faq } from '../../../pages/faq/faq';

/**
 * Default timezone for every `DatePipe` rendered under the webinar feature.
 * `'America/New_York'` keeps display in Eastern Time and honours DST (EST in
 * winter, EDT in summer). The literal "EST" label in templates is the brand
 * shorthand the design uses regardless of DST.
 */

@Component({
  selector: 'app-webinar',
  imports: [Carousel, Horizontal, PremiereListItem, WebinarHero, WebinarClaimCard, Faq],
  templateUrl: './webinar.html',
  styleUrl: './webinar.css',
})
export class Webinar {
  // ponytail: WebinarFacade was deleted with the Django strip. This placeholder
  // keeps the template bindings compiling and renders the empty state.
  // Swap in the new backend's service — the template needs no changes.
  protected readonly facade: any = {
    absent: signal<any[]>([]),
    attended: signal<any[]>([]),
    liveOrNextUp: signal<any>(null),
    loadHomePage: signal<any>(null),
    loading: signal<any>(null),
    loadMoreAbsent: signal<any>(null),
    loadMoreAttended: signal<any>(null),
    loadMoreFeatured: signal<any>(null),
    loadMoreMissed: signal<any>(null),
    missed: signal<any[]>([]),
    openCertificateDownloadDialog: (..._args: any[]): any => null,
    upcomingList: signal<any[]>([]),
  };
  private readonly utils = inject(Utils);

  protected readonly swiperConfigEven = swiperConfigEven;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Placeholder rows rendered while `facade.loading()` is true. */
  protected readonly skeletonRows = [0, 1, 2, 3];

  /**
   * Infinite-scroll trigger for the Premiering This Month list. Same pattern
   * as the library course / badge / instructor pages. Replaced the old
   * "Show more" slice — the list is paginated server-side now.
   */
  private readonly sentinel = viewChild<ElementRef<HTMLDivElement>>('sentinel');

  // Pre-adapt webinar lists to `Content` shape for the shared cards.
  protected readonly attendedContent = computed(() =>
    this.facade.attended().map(upcomingToContent),
  );
  protected readonly absentContent = computed(() => this.facade.absent().map(upcomingToContent));
  protected readonly missedContent = computed(() => this.facade.missed().map(upcomingToContent));

  // Bottom-right claim card. Session-only dismissal — clicking Cancel hides the
  // card until the user reloads / re-navigates. We don't persist this because
  // the data the card derives from (`attended()`) can change in-session as the
  // user submits feedback or claims a badge.
  private readonly claimDismissed = signal(false);

  /**
   * First attended webinar that still needs the user's attention:
   *   - `feedback`: enrollment exists and `feedback_submitted` is false
   *   - `badge`: feedback already submitted, badge exists, but `accept_url`
   *     hasn't been minted yet
   * Returns `null` when nothing qualifies or the user dismissed the card.
   */
  protected readonly claimCard = computed<{
    webinar: any;
    state: WebinarClaimState;
  } | null>(() => {
    if (this.claimDismissed()) return null;
    for (const webinar of this.facade.attended()) {
      const enrollment = webinar.registered_webinar?.user_enrollments;
      if (!enrollment) continue;
      if (
        !webinar.user_feedback_details?.user_feedback_submitted &&
        enrollment.attendance_status === 'Present'
      ) {
        return { webinar, state: 'feedback' };
      }
      if (
        webinar.user_badge &&
        !webinar.user_badge.accept_url &&
        enrollment.attendance_status === 'Present'
      ) {
        return { webinar, state: 'badge' };
      }
    }
    return null;
  });

  constructor() {
    this.facade.loadHomePage();

    effect((onCleanup) => {
      const el = this.sentinel()?.nativeElement;
      if (!el || !this.isBrowser) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) this.facade.loadMoreFeatured();
        },
        { rootMargin: '300px' },
      );
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });
  }

  protected onClaimPrimary(webinar: any, state: WebinarClaimState): void {
    if (state === 'feedback') {
      // Build the absolute feedback URL — `WebinarFacade.submitFeedback` only
      // works from the detail route (`/webinar/:id/:title`) because it appends
      // `feedback` to the current URL. The home page calls into Utils so the
      // route is built from country/profession + webinar id/title regardless.
      this.utils.navigateToCourseFeedback('webinar', webinar.id, webinar.webinar_title);
    } else {
      this.facade.openCertificateDownloadDialog(webinar);
    }
  }

  protected onClaimCancel(): void {
    this.claimDismissed.set(true);
  }
}

export const webinarRoutes: Route[] = [
  {
    path: '',
    component: Webinar,
    // ponytail: route-scoped facade providers removed with the Django strip.
    // Re-add `providers: [YourService]` here when the new backend lands.
  },
  {
    path: ':courseId/:courseTitle',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./shared/pages/webinar-course/webinar-course').then((m) => m.WebinarCourse),
      },
      {
        // Post-webinar feedback page — same `CourseFeedback` component that
        // masterclass / podcast / nano-learning use. `Utils.getCourseType()` keys
        // off the URL pattern (`/webinar/`) so the feedback submit posts to the
        // webinar variant of the backend.
        path: 'feedback',
        canActivate: [authGuard],
        // ponytail: route-scoped facade providers removed with the Django strip.
        // Re-add `providers: [YourService]` here when the new backend lands.
        loadComponent: () =>
          import('../shared/pages/course-feedback/course-feedback').then((m) => m.CourseFeedback),
      },
    ],
  },
];
