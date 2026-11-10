import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Faq } from '@shared/components/faq/faq';
import { PodcastCourseHeroSkeleton } from '@shared/components/skeleton/podcast-course-hero-skeleton/podcast-course-hero-skeleton';
import { Button } from '@shared/ui/button/button';
import { setupCourseSeo } from '@shared/utils/seo/course-seo-setup';
import { MasterclassCourseAbout } from '@features/offerings/components/masterclass-course-about/masterclass-course-about';
import { MasterclassCourseRelated } from '@features/offerings/components/masterclass-course-related/masterclass-course-related';
import { MasterclassCourseResources } from '@features/offerings/components/masterclass-course-resources/masterclass-course-resources';
import { PodcastChapterList } from '@features/offerings/podcast/components/podcast-chapter-list/podcast-chapter-list';
import { PodcastCourseHero } from '@features/offerings/podcast/components/podcast-course-hero/podcast-course-hero';
import { AppDownloadPrompt } from '@features/offerings/services/app-download-prompt';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';

/**
 * One podcast: the hero, then the chapters, Resource, About, Related and FAQ
 * sections. It points the route-scoped `CourseDetailFacade` at the route's
 * podcast and decides which sections show; each section injects the facade for
 * its own data and actions. Resource, About and Related are the masterclass
 * page's sections, as they always were for podcasts; the hero and the chapter
 * list keep the podcast look.
 */
@Component({
  selector: 'app-podcast-course',
  imports: [
    RouterLink,
    Button,
    Faq,
    PodcastCourseHero,
    PodcastCourseHeroSkeleton,
    PodcastChapterList,
    MasterclassCourseResources,
    MasterclassCourseAbout,
    MasterclassCourseRelated,
  ],
  templateUrl: './podcast-course.html',
})
export class PodcastCourse {
  /** The podcast's UUID; an old numeric id is resolved by `courseTitle` instead. */
  readonly courseId = input<string>();
  /** The podcast's slug. */
  readonly courseTitle = input<string>();

  protected readonly facade = inject(CourseDetailFacade);

  constructor() {
    inject(AppDownloadPrompt).maybePrompt();

    // SSR gate, URL-derived fallback SEO, the Supabase row, and the reset on
    // destroy all live in the helper; the course upgrades the fallback once it
    // loads.
    setupCourseSeo({
      kind: 'podcast',
      courseTitle: this.courseTitle,
      courseDetails: this.facade.course,
    });

    this.facade.connect(
      'podcast',
      computed(() => ({ courseId: this.courseId(), slug: this.courseTitle() })),
    );
  }
}
