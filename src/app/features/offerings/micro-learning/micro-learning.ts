import { Component, DestroyRef, ElementRef, PLATFORM_ID, inject, viewChild, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Route } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { exhaustMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { authGuard } from '../../../shared/core/guards/auth/auth-guard';
import { canDeactivateExamGuard } from '../../../shared/core/guards/can-deactivate-exam-guard';
import { environment } from '../../../../environments/environment';
import { Logger } from '../../../shared/core/services/logger/logger';
import {
  swiperConfigComingSoon,
  swiperConfigEven,
  swiperConfigOdd,
} from '../../../shared/core/config/swiper.config';
import { Carousel } from '../../../shared/components/carousel/carousel';
import { Vertical } from '../../../shared/components/cards/vertical/vertical';
import { ComingSoon } from '../../../shared/components/cards/coming-soon/coming-soon';
import { Utils } from '../../../shared/core/services/utils/utils';
import { MicroLearningHero } from './shared/components/micro-learning-hero/micro-learning-hero';
import { Faq } from '../../../pages/faq/faq';
import { PartnerContentList } from '../../partners/shared/components/partner-content-list/partner-content-list';

@Component({
  selector: 'app-micro-learning',
  imports: [Carousel, Vertical, ComingSoon, MicroLearningHero, Faq, PartnerContentList],
  templateUrl: './micro-learning.html',
  styleUrl: './micro-learning.css',
})
export class MicroLearning {
  S3_BUCKET_URL = environment.S3_BUCKET_URL;
  // ponytail: FeatureFacade was deleted with the Django strip. This placeholder
  // keeps the template bindings compiling and renders the empty state.
  // Swap in the new backend's service — the template needs no changes.
  readonly feature: any = {
    getResource: (..._args: any[]): any => ({
      items: signal<any[]>([]),
      isLoading: signal(false),
      hasMore: signal(false),
      error: signal(null),
      loadNextPage: () => undefined,
      loadNextTrackPage: () => undefined,
      setFilters: () => undefined,
      setTrackFilters: () => undefined,
      webp: signal(null),
    }),
  };
  private readonly utils = inject(Utils);
  private readonly platformId = inject(PLATFORM_ID);
  // ponytail: ApiClient was deleted with the Django strip. This placeholder
  // keeps the template bindings compiling and renders the empty state.
  // Swap in the new backend's service — the template needs no changes.
  private readonly http: any = {

  };
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
        // can hydrate from it instead of refetching the reel detail.
        this.utils.navigateToCourse('micro-learning', first.id, first.title, {
          nanoLearningHandoff: page,
        });
      });
  }

  onStartWatching(): void {
    this.startWatchingTrigger.next();
  }

  /**
   * ponytail: fetched the first cursor page of the reel feed to pick which reel
   * the hero CTA opens. Return the new backend's first page here — the
   * exhaustMap guard and the handoff navigation above still apply.
   */
  private fetchFirstPage(): Observable<any> {
    this.logger.warn('MicroLearning.fetchFirstPage: no backend configured');
    return of<any>({ reels: [], nextCursor: null });
  }

  onBrowseLibrary(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.carouselsRef()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export const microLearningRoutes: Route[] = [
  { path: '', component: MicroLearning },
  {
    path: ':courseId/:courseTitle',
    children: [
      {
        path: '',
        data: { layout: 'plain' },
        // ChapterFacade is route-scoped so the `ChapterQuiz` component
        // (opened via `MicroLearningQuizDialog`) can resolve it via `inject()`.
        // ponytail: route-scoped facade providers removed with the Django strip.
        loadComponent: () =>
          import('./shared/pages/micro-learning-course/micro-learning-course').then(
            (m) => m.MicroLearningCourse,
          ),
      },
      {
        path: 'final-assessment/:sessionId/exam',
        canActivate: [authGuard],
        // ponytail: route-scoped facade providers removed with the Django strip.
        canDeactivate: [canDeactivateExamGuard],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('../shared/pages/final-assessment-exam/final-assessment-exam').then(
            (m) => m.FinalAssessmentExam,
          ),
      },
      {
        path: 'final-assessment/:sessionId/report',
        canActivate: [authGuard],
        // ponytail: route-scoped facade providers removed with the Django strip.
        data: { layout: 'plain' },
        loadComponent: () =>
          import('../shared/pages/final-assessment-report/final-assessment-report').then(
            (m) => m.FinalAssessmentReport,
          ),
      },
      {
        path: 'feedback',
        canActivate: [authGuard],
        // ponytail: route-scoped facade providers removed with the Django strip.
        loadComponent: () =>
          import('../shared/pages/course-feedback/course-feedback').then((m) => m.CourseFeedback),
      },
    ],
  },
];
