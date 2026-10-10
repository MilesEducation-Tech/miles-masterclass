import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Faq } from '@shared/components/faq/faq';
import { SectionNav, SectionNavItem } from '@shared/components/section-nav/section-nav';
import { MasterclassCourseHeroSkeleton } from '@shared/components/skeleton/masterclass-course-hero-skeleton/masterclass-course-hero-skeleton';
import { Button } from '@shared/ui/button/button';
import { setupCourseSeo } from '@shared/utils/seo/course-seo-setup';
import { AppDownloadPrompt } from '@features/offerings/services/app-download-prompt';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';
import { MasterclassChapterList } from '@features/offerings/masterclass/components/masterclass-chapter-list/masterclass-chapter-list';
import { MasterclassCourseAbout } from '@features/offerings/masterclass/components/masterclass-course-about/masterclass-course-about';
import { MasterclassCourseRelated } from '@features/offerings/masterclass/components/masterclass-course-related/masterclass-course-related';
import { MasterclassCourseResources } from '@features/offerings/masterclass/components/masterclass-course-resources/masterclass-course-resources';
import { MasterclassCourseHero } from '@features/offerings/masterclass/components/masterclass-course-hero/masterclass-course-hero';
import {
  MASTERCLASS_COURSE_SECTION_IDS,
  MASTERCLASS_COURSE_SECTION_NAV,
} from '@features/offerings/masterclass/constants/masterclass-nav';

/**
 * One masterclass course: the hero, then the Masterclass (chapters), Resource,
 * About, Related and FAQ sections. It points the route-scoped
 * `CourseDetailFacade` at the route's course and decides which sections show;
 * each section injects the facade for its own data and actions.
 */
@Component({
  selector: 'app-masterclass-course',
  imports: [
    RouterLink,
    Button,
    Faq,
    SectionNav,
    MasterclassCourseHero,
    MasterclassCourseHeroSkeleton,
    MasterclassChapterList,
    MasterclassCourseResources,
    MasterclassCourseAbout,
    MasterclassCourseRelated,
  ],
  templateUrl: './masterclass-course.html',
})
export class MasterclassCourse {
  /** The course UUID; an old numeric id is resolved by `courseTitle` instead. */
  readonly courseId = input<string>();
  /** The course slug. */
  readonly courseTitle = input<string>();

  protected readonly facade = inject(CourseDetailFacade);

  protected readonly sectionIds = MASTERCLASS_COURSE_SECTION_IDS;

  protected readonly sectionNavItems = computed<SectionNavItem[]>(() => {
    const ids = MASTERCLASS_COURSE_SECTION_IDS;
    const shown: Record<string, boolean> = {
      [ids.chapters]: this.facade.chapters().length > 0,
      [ids.resources]: this.facade.hasResources(),
      [ids.about]: this.facade.course() !== null,
      [ids.related]: this.facade.relatedRails().length > 0,
    };
    return MASTERCLASS_COURSE_SECTION_NAV.map((item) =>
      item.id in shown ? { ...item, visible: shown[item.id] } : item,
    );
  });

  constructor() {
    inject(AppDownloadPrompt).maybePrompt();

    // SSR gate, URL-derived fallback SEO, the Supabase row, and the reset on
    // destroy all live in the helper; the course upgrades the fallback once it
    // loads.
    setupCourseSeo({
      kind: 'masterclass',
      courseTitle: this.courseTitle,
      courseDetails: this.facade.course,
    });

    this.facade.connect(
      'masterclass',
      computed(() => ({ courseId: this.courseId(), slug: this.courseTitle() })),
    );
  }
}
