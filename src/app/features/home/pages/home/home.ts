import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { swiperConfigEven } from '@core/config/swiper.config';
import {
  MasterclassCourse,
  MasterclassCourseInfoDialogData,
} from '@core/models/masterclass-home.model';
import { MASTERCLASS_COURSE_INFO_DIALOG } from '@core/services/dialog/feature-dialog-tokens';
import { MasterclassHomeFacade } from '@core/services/masterclass-home-facade/masterclass-home-facade';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { AppDownload } from '@shared/components/app-download/app-download';
import { CairaLevelStack } from '@shared/components/caira-level-stack/caira-level-stack';
import { MasterclassCourseCard } from '@shared/components/cards/masterclass-course-card/masterclass-course-card';
import { Carousel } from '@shared/components/carousel/carousel';
import { Faq } from '@shared/components/faq/faq';
import { SectionNav, SectionNavItem } from '@shared/components/section-nav/section-nav';
import { SurroundCarousel } from '@shared/components/surround-carousel/surround-carousel';
import { Utils } from '@shared/services/utils';
import { Button } from '@shared/ui/button/button';
import { HomeHero } from '../../components/home-hero/home-hero';
import { HomePricing } from '../../components/home-pricing/home-pricing';
import { HomeWebinarTicket } from '../../components/home-webinar-ticket/home-webinar-ticket';
import { HomeWebinar } from '../../models/home-sections.model';
import { HomeFacade } from '../../services/home-facade';

/**
 * The home page, in the v3 section order: hero, the masterclass track rails,
 * the live-webinar ticket, the AI Labs ring, the CAIRA levels, the pricing card,
 * the app download and the FAQ.
 * The rails come from the root `MasterclassHomeFacade`, the same read `/masterclass`
 * renders, so moving between the two pages never refetches. The webinar ticket
 * and the CAIRA levels come from `HomeFacade`, and each section (with its
 * sidenav entry) shows only once its read has rows.
 *
 * The pricing card still shows no figures until the plan-price source is
 * confirmed (see prompts/home-redesign.md). Flagged, not v2.
 */
@Component({
  selector: 'app-home',
  imports: [
    AppDownload,
    Button,
    CairaLevelStack,
    Carousel,
    Faq,
    HomeHero,
    HomePricing,
    HomeWebinarTicket,
    MasterclassCourseCard,
    SectionNav,
    SurroundCarousel,
  ],
  templateUrl: './home.html',
})
export class Home {
  private readonly utils = inject(Utils);
  private readonly router = inject(Router);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly courseInfoDialog = inject(MASTERCLASS_COURSE_INFO_DIALOG);

  protected readonly home = inject(MasterclassHomeFacade);
  protected readonly facade = inject(HomeFacade);

  // Every rail is horizontal cards, so one swiper preset serves them all.
  protected readonly swiperConfigEven = swiperConfigEven;

  /** The sidenav; "Live Webinar" and "CAIRA" show only with a section to jump to. */
  protected readonly sectionNavItems = computed<SectionNavItem[]>(() => [
    { id: 'home-hero', label: 'Home', visible: true, icon: 'lucideHome' },
    { id: 'home-masterclasses', label: 'Master Classes', visible: true, icon: 'lucidePlay' },
    {
      id: 'webinar',
      label: 'Live Webinar',
      visible: this.facade.webinar() !== null,
      icon: 'lucideCalendarClock',
    },
    { id: 'model-carousel', label: 'AI Labs', visible: true, icon: 'lucideLayers' },
    {
      id: 'caira-levels',
      label: 'CAIRA',
      visible: this.facade.cairaLevels().length > 0,
      icon: 'lucideGraduationCap',
    },
    { id: 'plan', label: 'Pricing', visible: true, icon: 'lucideStar' },
    { id: 'app-download', label: 'Download App', visible: true, icon: 'lucideLink' },
    { id: 'faq', label: 'FAQ', visible: true, icon: 'lucideHelpCircle' },
  ]);

  /**
   * Both ticket actions go to the webinar's page for now: registration lives
   * there, and the registration dialog belongs to the offerings feature, which
   * home may not import (its promotion to `shared/dialogs` is follow-up F5).
   */
  protected openWebinar(webinar: HomeWebinar): void {
    void this.router.navigate([
      '/',
      this.utils.country(),
      this.utils.profession(),
      'webinar',
      webinar.id,
    ]);
  }

  /** The shared video dialog; it toasts "Trailer Not Found" for a course with none. */
  protected openTrailer(course: MasterclassCourse): void {
    void this.utils.openVideoDialog(course.trailer_url, course.title);
  }

  /**
   * The "i" dialog `/masterclass` opens: the course's About, read when it
   * opens. It belongs to the offerings feature, so it comes through the token
   * `app.config.ts` binds, and loads on first use.
   */
  protected async openCourseInfo(course: MasterclassCourse): Promise<void> {
    this.dialogs.open<MasterclassCourseInfoDialogData>(await this.courseInfoDialog(), {
      data: { course },
    });
  }
}
