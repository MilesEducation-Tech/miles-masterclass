import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { CourseAbout } from '../../../../../../shared/components/course-about/course-about';
import { CourseRelatedSection } from '../../../../../../shared/components/course-related-section/course-related-section';
import { CourseChapterList } from '../../../../shared/components/course-chapter-list/course-chapter-list';
import { CourseResources } from '../../../../shared/components/course-resources/course-resources';
import { PodcastCourseHeroSkeleton } from '../../../../../../shared/components/skeleton/podcast-course-hero-skeleton/podcast-course-hero-skeleton';
import { Faq } from '../../../../../../pages/faq/faq';
import { Auth } from '../../../../../../shared/core/services/auth/auth';
import { AppDownloadPrompt } from '../../../../../../shared/core/services/app-download-prompt/app-download-prompt';
import { setupCourseSeo } from '../../../../../../shared/utils/seo/course-seo-setup';
// NOTE: Podcast detail currently shares MasterclassFacade with the masterclass
// page. That cross-feature reuse is pre-existing — see code-review notes; out
// of scope for this SEO pass.
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

  // ponytail: MasterclassFacade was deleted with the Django strip. This placeholder

  // keeps the template bindings compiling and renders the empty state.

  // Swap in the new backend's service — the template needs no changes.

  protected readonly masterclassService: any = {

    clear: signal<any>(null),

    courseChapters: signal<any[]>([]),

    courseDetails: signal<any[]>([]),

    loadCourse: (..._args: any[]): any => null,

  };
  private readonly auth = inject(Auth);

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
      this.auth.isAuthenticated();
      if (id) {
        this.masterclassService.loadCourse({ id: Number(id), course_type: 'podcast' });
      }
    });

    inject(DestroyRef).onDestroy(() => this.masterclassService.clear());
  }
}
