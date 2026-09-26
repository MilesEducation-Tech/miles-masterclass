import { Component, DestroyRef, ElementRef, PLATFORM_ID, inject, viewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject, of } from 'rxjs';
import { catchError, exhaustMap, map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '@env/environment';
import { FeatureFacade } from '@core/services/feature-facade/feature-facade';
import { ApiClient } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import {
  NANO_LEARNING_HANDOFF_KEY,
  NANO_LEARNING_ROUTES,
  NanoLearningListResponse,
  NanoLearningPage,
} from '@features/offerings/models/micro-learning-course.model';
import {
  swiperConfigComingSoon,
  swiperConfigEven,
  swiperConfigOdd,
} from '@core/config/swiper.config';
import { Carousel } from '@shared/components/carousel/carousel';
import { Vertical } from '@shared/components/cards/vertical/vertical';
import { ComingSoon } from '@shared/components/cards/coming-soon/coming-soon';
import { Utils } from '@shared/services/utils';
import { MicroLearningHero } from '../../components/micro-learning-hero/micro-learning-hero';
import { Faq } from '@shared/components/faq/faq';
import { PartnerContentList } from '@shared/components/partner-content-list/partner-content-list';

@Component({
  selector: 'app-micro-learning',
  imports: [Carousel, Vertical, ComingSoon, MicroLearningHero, Faq, PartnerContentList],
  templateUrl: './micro-learning.html',
})
export class MicroLearning {
  S3_BUCKET_URL = environment.S3_BUCKET_URL;
  readonly feature: FeatureFacade = inject(FeatureFacade);
  private readonly utils = inject(Utils);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(ApiClient);
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);

  private readonly carouselsRef = viewChild<ElementRef<HTMLElement>>('carousels');

  // Swiper configurations for templates
  readonly swiperConfigEven = swiperConfigEven;
  readonly swiperConfigOdd = swiperConfigOdd;
  readonly swiperConfigComingSoon = swiperConfigComingSoon;

  filterConfig = {
    filterEnabled: true,
  };

  readonly inprogress = this.feature.getResource('inprogress', 'nano_learning', {
    requiresAuth: true,
  });

  readonly track = this.feature.getResource('track', 'nano_learning');
  readonly bookmark = this.feature.getResource('bookmark', 'nano_learning', {
    requiresAuth: true,
  });
  readonly completed = this.feature.getResource('completed', 'micro_learning', {
    requiresAuth: true,
  });
  readonly comingSoon = this.feature.getResource('comingSoon', 'nano_learning');

  /**
   * Hero CTA stream — `exhaustMap` drops repeated clicks while a request is
   * in flight so a rapid double-click can't fire two HTTP calls + two
   * `router.navigate`s. Mirrors `CertificateDownload.perCourseTrigger`.
   */
  private readonly startWatchingTrigger = new Subject<void>();

  constructor() {
    this.startWatchingTrigger
      .pipe(
        exhaustMap(() => this.fetchFirstPage()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => {
        const first = page.reels[0];
        if (!first) {
          this.onBrowseLibrary();
          return;
        }
        // Hand the fetched first page to the course page via router state so it
        // hydrates from it and skips the redundant `v2/nano-learning/:id` call.
        this.utils.navigateToCourse('micro-learning', first.id, first.title, {
          [NANO_LEARNING_HANDOFF_KEY]: page,
        });
      });
  }

  onStartWatching(): void {
    this.startWatchingTrigger.next();
  }

  /** Fetch the first page of the reel feed to pick the reel to open. Empty page on error. */
  private fetchFirstPage(): Observable<NanoLearningPage> {
    return this.http
      .get<NanoLearningListResponse>(NANO_LEARNING_ROUTES.getCourseList.path, {
        params: { cursor: '' },
      })
      .pipe(
        map((res) => ({
          reels: res?.data ?? [],
          nextCursor: res?.pagination_data?.next_cursor ?? null,
        })),
        catchError((err) => {
          this.logger.error('MicroLearning.fetchFirstPage failed', err);
          return of<NanoLearningPage>({ reels: [], nextCursor: null });
        }),
      );
  }

  onBrowseLibrary(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.carouselsRef()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
