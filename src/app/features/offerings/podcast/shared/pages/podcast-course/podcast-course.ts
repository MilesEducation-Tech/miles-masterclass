import { Component, inject, input } from '@angular/core';
import { CourseAbout } from '../../../../../../shared/components/course-about/course-about';
import { CourseRelatedSection } from '../../../../../../shared/components/course-related-section/course-related-section';
import { CourseChapterList } from '../../../../shared/components/course-chapter-list/course-chapter-list';
import { CourseResources } from '../../../../shared/components/course-resources/course-resources';
import { PodcastCourseHeroSkeleton } from '../../../../../../shared/components/skeleton/podcast-course-hero-skeleton/podcast-course-hero-skeleton';
import { Faq } from '../../../../../../pages/faq/faq';
import { AppDownloadPrompt } from '../../../../../../shared/core/services/app-download-prompt/app-download-prompt';
import { setupCourseSeo } from '../../../../../../shared/utils/seo/course-seo-setup';
// Podcast detail shares `CourseDetail` with the masterclass page on purpose: a
// podcast is a masterclass with an audio player, and CAIRA serves both from
// `Masterclass_Course_Detail` — there is no separate podcast endpoint.
import { CourseDetail } from '../../../../shared/services/course-detail/course-detail';
import { PodcastCourseHero } from '../../components/podcast-course-hero/podcast-course-hero';

@Component({
  selector: 'app-podcast-course',
  imports: [
    CourseChapterList,
    PodcastCourseHeroSkeleton,
    CourseAbout,
    CourseRelatedSection,
    Faq,
    CourseResources,
    PodcastCourseHero,
  ],
  templateUrl: './podcast-course.html',
  styleUrl: './podcast-course.css',
})
export class PodcastCourse {
  readonly courseId = input<string>();
  readonly courseTitle = input<string>();

  /** Route-scoped — provided on `:courseId/:courseTitle` in `podcastRoutes`. */
  protected readonly masterclassService = inject(CourseDetail);

  constructor() {
    inject(AppDownloadPrompt).maybePrompt();

    // SSR gate, URL-derived fallback SEO, slug signal, Supabase load,
    // error fallback, and seoManager.reset() on destroy. See helper for the
    // full SSR lifecycle.
    setupCourseSeo({
      kind: 'podcast',
      courseTitle: this.courseTitle,
      courseDetails: this.masterclassService.courseDetails,
    });
  }
}
