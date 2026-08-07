import { Component, computed, DestroyRef, effect, inject, input } from '@angular/core';
import { CourseAbout } from '../../../../../../shared/components/course-about/course-about';
import { CourseRelatedSection } from '../../../../../../shared/components/course-related-section/course-related-section';
import { CourseChapterList } from '../../../../shared/components/course-chapter-list/course-chapter-list';
import { CourseResources } from '../../../../shared/components/course-resources/course-resources';
import {
  SectionNav,
  SectionNavItem,
} from '../../../../../../shared/components/section-nav/section-nav';
import { MasterclassCourseHeroSkeleton } from '../../../../../../shared/components/skeleton/masterclass-course-hero-skeleton/masterclass-course-hero-skeleton';
import { Faq } from '../../../../../../pages/faq/faq';
import { Auth } from '../../../../../../shared/core/services/auth/auth';
import { AppDownloadPrompt } from '../../../../../../shared/core/services/app-download-prompt/app-download-prompt';
import { setupCourseSeo } from '../../../../../../shared/utils/seo/course-seo-setup';
import { MasterclassFacade } from '../../../../shared/services/masterclass-facade/masterclass-facade';
import { MasterclassCourseHero } from '../../components/masterclass-course-hero/masterclass-course-hero';

@Component({
  selector: 'app-masterclass-course',
  imports: [
    MasterclassCourseHero,
    CourseChapterList,
    MasterclassCourseHeroSkeleton,
    SectionNav,
    CourseAbout,
    CourseRelatedSection,
    Faq,
    CourseResources,
  ],
  templateUrl: './masterclass-course.html',
  styleUrl: './masterclass-course.css',
})
export class MasterclassCourse {
  readonly courseId = input<string>();
  readonly courseTitle = input<string>();

  protected readonly masterclassService = inject(MasterclassFacade);
  private readonly auth = inject(Auth);

  /** Dynamic navigation items based on available data */
  protected readonly sectionNavItems = computed<SectionNavItem[]>(() => {
    const course = this.masterclassService.courseDetails();
    const chapters = this.masterclassService.courseChapters();

    return [
      { id: 'masterclass', label: 'Masterclass', visible: chapters.length > 0 },
      { id: 'resource', label: 'Resource', visible: true },
      { id: 'about', label: 'About', visible: course !== null },
      { id: 'related', label: 'Related', visible: course !== null },
      { id: 'faq', label: 'FAQ', visible: true },
    ];
  });

  constructor() {
    inject(AppDownloadPrompt).maybePrompt();

    // SSR gate, URL-derived fallback SEO, slug signal, Supabase load,
    // error fallback, and seoManager.reset() on destroy. See helper for the
    // full SSR lifecycle. Component handles its own facade load + cleanup.
    setupCourseSeo({
      kind: 'masterclass',
      courseTitle: this.courseTitle,
      courseDetails: this.masterclassService.courseDetails,
    });

    // Load the course as soon as the id input is set; re-fetch on auth state
    // change so the API picks up the new auth context.
    effect(() => {
      const id = this.courseId();
      this.auth.isAuthenticated();
      if (id) {
        this.masterclassService.loadCourse({ id: Number(id), course_type: 'masterclass' });
      }
    });

    inject(DestroyRef).onDestroy(() => this.masterclassService.clear());
  }
}
