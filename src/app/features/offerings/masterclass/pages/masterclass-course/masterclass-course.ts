import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Faq } from '@shared/components/faq/faq';
import { SectionNav, SectionNavItem } from '@shared/components/section-nav/section-nav';
import { MasterclassCourseHeroSkeleton } from '@shared/components/skeleton/masterclass-course-hero-skeleton/masterclass-course-hero-skeleton';
import { Button } from '@shared/ui/button/button';
import { setupCourseSeo } from '@shared/utils/seo/course-seo-setup';
import { AppDownloadPrompt } from '@features/offerings/services/app-download-prompt';
import { MasterclassCourseAbout } from '@features/offerings/masterclass/components/masterclass-course-about/masterclass-course-about';
import { MasterclassCourseHero } from '@features/offerings/masterclass/components/masterclass-course-hero/masterclass-course-hero';
import {
  MASTERCLASS_COURSE_ABOUT_SECTION_ID,
  MASTERCLASS_COURSE_SECTION_NAV,
} from '@features/offerings/masterclass/constants/masterclass-nav';
import { MasterclassCourseFacade } from '@features/offerings/masterclass/services/masterclass-course-facade';

/**
 * One masterclass course: the hero, About and the FAQ. Data and actions come
 * from the route-scoped `MasterclassCourseFacade`; this page only lays them out.
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
    MasterclassCourseAbout,
  ],
  templateUrl: './masterclass-course.html',
})
export class MasterclassCourse {
  /** The course UUID; an old numeric id is resolved by `courseTitle` instead. */
  readonly courseId = input<string>();
  /** The course slug. */
  readonly courseTitle = input<string>();

  protected readonly facade = inject(MasterclassCourseFacade);

  protected readonly sectionNavItems = computed<SectionNavItem[]>(() =>
    MASTERCLASS_COURSE_SECTION_NAV.map((item) =>
      item.id === MASTERCLASS_COURSE_ABOUT_SECTION_ID
        ? { ...item, visible: this.facade.course() !== null }
        : item,
    ),
  );

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

    this.facade.connect(computed(() => ({ courseId: this.courseId(), slug: this.courseTitle() })));
  }
}
