import { Component, DestroyRef, effect, inject, input } from '@angular/core';
import { CourseAbout } from '@shared/components/course-about/course-about';
import { CourseRelatedSection } from '@shared/components/course-related-section/course-related-section';
import { CourseChapterList } from '../../../components/course-chapter-list/course-chapter-list';
import { CourseResources } from '../../../components/course-resources/course-resources';
import { PodcastCourseHeroSkeleton } from '@shared/components/skeleton/podcast-course-hero-skeleton/podcast-course-hero-skeleton';
import { Faq } from '@shared/components/faq/faq';
import { AppDownloadPrompt } from '@features/offerings/services/app-download-prompt';
import { setupCourseSeo } from '@shared/utils/seo/course-seo-setup';
// NOTE: Podcast detail currently shares MasterclassFacade with the masterclass
// page. That cross-feature reuse is pre-existing — see code-review notes; out
// of scope for this SEO pass.
import { MasterclassFacade } from '../../../services/masterclass-facade';
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
})
export class PodcastCourse {
  readonly courseId = input<string>();
  readonly courseTitle = input<string>();

  protected readonly masterclassService = inject(MasterclassFacade);

  constructor() {
    inject(AppDownloadPrompt).maybePrompt();

    // SSR gate, URL-derived fallback SEO, slug signal, Supabase load,
    // error fallback, and seoManager.reset() on destroy. See helper for the
    // full SSR lifecycle. Component handles its own facade load + cleanup.
    setupCourseSeo({
      kind: 'podcast',
      courseTitle: this.courseTitle,
      courseDetails: this.masterclassService.courseDetails,
    });

    effect(() => {
      const id = this.courseId();
      // ponytail: also re-ran on auth-state change so the API picked up the
      // new auth context. Nothing to depend on now.
      if (id) {
        this.masterclassService.loadCourse({ id: Number(id), course_type: 'podcast' });
      }
    });

    inject(DestroyRef).onDestroy(() => this.masterclassService.clear());
  }
}
