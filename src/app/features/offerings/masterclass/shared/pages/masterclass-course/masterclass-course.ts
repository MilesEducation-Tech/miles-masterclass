import { Component, computed, inject, input } from '@angular/core';
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
import { CourseDetail } from '../../../../shared/services/course-detail/course-detail';
import { AppDownloadPrompt } from '../../../../../../shared/core/services/app-download-prompt/app-download-prompt';
import { setupCourseSeo } from '../../../../../../shared/utils/seo/course-seo-setup';
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

  /** Route-scoped — provided on `:courseId/:courseTitle` in `masterclassRoutes`. */
  protected readonly masterclassService = inject(CourseDetail);

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
    // full SSR lifecycle.
    setupCourseSeo({
      kind: 'masterclass',
      courseTitle: this.courseTitle,
      courseDetails: this.masterclassService.courseDetails,
    });
  }
}
