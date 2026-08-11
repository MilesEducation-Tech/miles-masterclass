import { Component, computed, inject } from '@angular/core';
import { Route } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { Horizontal } from '../../../shared/components/cards/horizontal/horizontal';
import { Vertical } from '../../../shared/components/cards/vertical/vertical';
import { Carousel } from '../../../shared/components/carousel/carousel';
import {
  swiperConfigComingSoon,
  swiperConfigEven,
  swiperConfigOdd,
} from '../../../shared/core/config/swiper.config';
import { Slider } from '../../../shared/components/slider/slider';
import { SliderSkeleton } from '../../../shared/components/skeleton/slider-skeleton/slider-skeleton';
import { authGuard } from '../../../shared/core/guards/auth/auth-guard';
import { canDeactivateExamGuard } from '../../../shared/core/guards/can-deactivate-exam-guard';
import { ComingSoon } from '../../../shared/components/cards/coming-soon/coming-soon';
import { Faq } from '../../../pages/faq/faq';
import { PartnerContentList } from '../../partners/shared/components/partner-content-list/partner-content-list';
import { SectionNav, SectionNavItem } from '../../../shared/components/section-nav/section-nav';
import { FeatureFacade } from '../../shared/services/feature-facade/feature-facade';
import { CourseDetail } from '../shared/services/course-detail/course-detail';
import { ChapterProgress } from '../shared/services/chapter-progress/chapter-progress';

@Component({
  selector: 'app-masterclass',
  imports: [
    Horizontal,
    Vertical,
    Carousel,
    Slider,
    SliderSkeleton,
    ComingSoon,
    Faq,
    PartnerContentList,
    SectionNav,
  ],
  templateUrl: './masterclass.html',
  styleUrl: './masterclass.css',
})
export class Masterclass {
  S3_BUCKET_URL = environment.S3_BUCKET_URL;
  readonly feature = inject(FeatureFacade);

  // Swiper configurations for templates
  readonly swiperConfigEven = swiperConfigEven;
  readonly swiperConfigOdd = swiperConfigOdd;
  readonly swiperConfigComingSoon = swiperConfigComingSoon;

  filterConfig = {
    filterEnabled: true,
  };

  readonly popular = this.feature.getResource('popular', 'masterclass');
  readonly inprogress = this.feature.getResource('inprogress', 'masterclass', {
    requiresAuth: true,
  });
  readonly recommended = this.feature.getResource('recommended', 'masterclass', {
    requiresAuth: true,
  });
  readonly complimentary = this.feature.getResource('complimentary', 'masterclass', {
    requiresAuth: true,
  });
  readonly becauseYouWatched = this.feature.getResource('becauseYouWatched', 'masterclass', {
    requiresAuth: true,
  });
  readonly track = this.feature.getResource('track', 'masterclass');
  readonly bookmark = this.feature.getResource('bookmark', 'masterclass', { requiresAuth: true });
  readonly completed = this.feature.getResource('completed', 'masterclass', { requiresAuth: true });
  readonly comingSoon = this.feature.getResource('comingSoon', 'masterclass');

  /**
   * Both headings fall back to their generic form: CAIRA returns no rail
   * metadata, and both rails are unsourced anyway, so neither section renders.
   * Kept so the bindings stay live if the endpoints ever land.
   */
  readonly complimentaryHeading = computed(() => {
    const details = this.complimentary.metadata()?.['details'] as
      { company_name?: string } | undefined;
    return details?.company_name
      ? `Complimentary Courses for ${details.company_name} Employees`
      : 'Complimentary Courses';
  });

  readonly becauseYouWatchedHeading = computed(() => {
    const watched = this.becauseYouWatched.metadata()?.['watched_course'] as
      { title?: string } | undefined;
    return watched?.title ? `Because You Watched ${watched.title}` : 'Because You Watched';
  });

  /**
   * Sidenav structure mirrors the legacy masterclass-page nav (status:true
   * items always visible; status:false items show only when their feed has
   * content). Section ids are kebab-case and match the anchors in
   * `masterclass.html`; SectionNav resolves them via `getElementById`.
   *
   * Legacy entries `learningPathway` and `instructor` are intentionally
   * omitted — they don't correspond to any section rendered on this page
   * today; adding them would create dead anchors.
   */
  readonly sectionNavItems = computed<SectionNavItem[]>(() => [
    { id: 'masterclass-home', label: 'Home', visible: true, icon: 'lucideHome' },
    {
      id: 'continue-watching',
      label: 'Continue Watching',
      visible: this.inprogress.items().length > 0,
      icon: 'lucideClock',
    },
    {
      id: 'masterclass-tracks',
      label: 'Tracker',
      visible: this.track.items().length > 0,
      icon: 'lucideLayers',
    },
    {
      id: 'my-list',
      label: 'My List',
      visible: this.bookmark.items().length > 0,
      icon: 'lucideBookmark',
    },
    {
      id: 'completed-courses',
      label: 'Completed Courses',
      visible: this.completed.items().length > 0,
      icon: 'lucideCheckCircle',
    },
    {
      id: 'masterclass-coming-soon',
      label: 'Coming Soon',
      visible: this.comingSoon.items().length > 0,
      icon: 'lucideRocket',
    },
    { id: 'masterclass-faq', label: 'FAQ', visible: true, icon: 'lucideHelpCircle' },
  ]);
}

export const masterclassRoutes: Route[] = [
  { path: '', component: Masterclass },
  {
    path: ':courseId/:courseTitle',
    // One `CourseDetail` per course route, shared by the page, hero, chapter
    // list, resources and related rails. Route-scoped rather than a singleton
    // so leaving the course disposes it and aborts anything still in flight.
    providers: [CourseDetail],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./shared/pages/masterclass-course/masterclass-course').then(
            (m) => m.MasterclassCourse,
          ),
      },
      {
        path: 'chapter/:chapterId/:chapterTitle',
        canActivate: [authGuard],
        // Route-scoped: the chapter player's #6 / #18 writes. `CourseDetail`
        // is provided one level up and supplies the chapter list, so this only
        // owns progress.
        providers: [ChapterProgress],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('./shared/pages/masterclass-chapter/masterclass-chapter').then(
            (m) => m.MasterclassChapter,
          ),
      },
      {
        path: 'final-assessment/exam',
        canActivate: [authGuard],
        // ponytail: route-scoped facade providers removed with the Django strip.
        // Re-add `providers: [YourService]` here when the new backend lands.
        canDeactivate: [canDeactivateExamGuard],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('../shared/pages/final-assessment-exam/final-assessment-exam').then(
            (m) => m.FinalAssessmentExam,
          ),
      },
      {
        path: 'final-assessment/report',
        canActivate: [authGuard],
        // ponytail: route-scoped facade providers removed with the Django strip.
        // Re-add `providers: [YourService]` here when the new backend lands.
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
        // Re-add `providers: [YourService]` here when the new backend lands.
        loadComponent: () =>
          import('../shared/pages/course-feedback/course-feedback').then((m) => m.CourseFeedback),
      },
    ],
  },
];
