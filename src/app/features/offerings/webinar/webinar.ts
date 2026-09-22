import { Component, signal } from '@angular/core';
import { Route } from '@angular/router';

import { Horizontal } from '@shared/components/cards/horizontal/horizontal';
import { Carousel } from '@shared/components/carousel/carousel';
import { swiperConfigEven } from '@core/config/swiper.config';
import { PremiereListItem } from './shared/components/premiere-list-item/premiere-list-item';
import { WebinarHero } from './shared/components/webinar-hero/webinar-hero';
import {
  WebinarClaimCard,
  WebinarClaimState,
} from './shared/components/webinar-claim-card/webinar-claim-card';
import { FeedbackFacade } from '../shared/services/feedback-facade/feedback-facade';
import { Faq } from '../../../pages/faq/faq';
import { UpcomingPremiere } from '@core/models/feature.model';
import { Content } from '@core/models/course.model';

/**
 * ponytail: design-only shell. The webinar data layer (WebinarFacade, the
 * registration/enrolment API, the status + adapter utils) was removed; every
 * member below exists purely so `webinar.html` still type-checks and renders.
 * Lists are permanently empty, so the page shows its empty-state design.
 * Re-wire by reintroducing a facade and pointing these signals at it.
 */
@Component({
  selector: 'app-webinar',
  imports: [Carousel, Horizontal, PremiereListItem, WebinarHero, WebinarClaimCard, Faq],
  templateUrl: './webinar.html',
  styleUrl: './webinar.css',
})
export class Webinar {
  protected readonly swiperConfigEven = swiperConfigEven;

  /** Placeholder rows rendered while `loading()` is true. */
  protected readonly skeletonRows = [0, 1, 2, 3];

  protected readonly loading = signal(false);
  protected readonly liveOrNextUp = signal<UpcomingPremiere | null>(null);
  protected readonly upcomingList = signal<UpcomingPremiere[]>([]);

  protected readonly attendedContent = signal<Content[]>([]);
  protected readonly absentContent = signal<Content[]>([]);
  protected readonly missedContent = signal<Content[]>([]);

  protected readonly claimCard = signal<{
    webinar: UpcomingPremiere;
    state: WebinarClaimState;
  } | null>(null);

  protected loadMoreAttended(): void {
    // ponytail: inert
  }
  protected loadMoreAbsent(): void {
    // ponytail: inert
  }
  protected loadMoreMissed(): void {
    // ponytail: inert
  }

  protected onClaimPrimary(_webinar: UpcomingPremiere, _state: WebinarClaimState): void {
    // ponytail: inert
  }
  protected onClaimCancel(): void {
    // ponytail: inert
  }
}

export const webinarRoutes: Route[] = [
  {
    path: '',
    component: Webinar,
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
        path: 'feedback',
        providers: [FeedbackFacade],
        loadComponent: () =>
          import('../shared/pages/course-feedback/course-feedback').then((m) => m.CourseFeedback),
      },
    ],
  },
];
