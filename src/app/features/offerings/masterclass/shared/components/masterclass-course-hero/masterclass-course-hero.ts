import { Component, DestroyRef, computed, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { VideoPoster } from '../../../../../../shared/components/video-poster/video-poster';
import { Button } from '../../../../../../shared/components/ui/button/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matAddShoppingCartRound,
  matBookmarkBorderRound,
  matBookmarkRound,
  matPlayArrowRound,
  matRestartAltRound,
  matShoppingCartRound,
} from '@ng-icons/material-icons/round';
import { phosphorDownloadSimpleFill, phosphorShareFatFill } from '@ng-icons/phosphor-icons/fill';
import { phosphorCards } from '@ng-icons/phosphor-icons/regular';
import { DatePipe } from '@angular/common';
import { Auth } from '../../../../../../shared/core/services/auth/auth';

import { Progress } from '../../../../../../shared/components/ui/progress/progress';
import { cn } from '../../../../../../shared/utils/cn';
import { RatingStar } from '../../../../../../shared/components/rating-star/rating-star';
import { Utils } from '../../../../../../shared/core/services/utils/utils';
import { CategoriesList } from '../../../../../../shared/components/categories-list/categories-list';
import { TotalCpeCreditsPipe } from '../../../../../../shared/core/pipes/total-cpe-credits/total-cpe-credits.pipe';
import { CairaCredlyBadge } from '../../../../../../shared/components/cards/caira-credly-badge/caira-credly-badge';
import { CourseDetail } from '../../../../shared/services/course-detail/course-detail';

@Component({
  selector: 'app-masterclass-course-hero',
  imports: [
    VideoPoster,
    Button,
    NgIcon,
    DatePipe,
    Progress,
    RatingStar,
    CategoriesList,
    TotalCpeCreditsPipe,
    CairaCredlyBadge,
  ],
  templateUrl: './masterclass-course-hero.html',
  styleUrl: './masterclass-course-hero.css',
  providers: [
    provideIcons({
      matPlayArrowRound,
      matBookmarkBorderRound,
      matBookmarkRound,
      phosphorShareFatFill,
      phosphorCards,
      phosphorDownloadSimpleFill,
      matRestartAltRound,
      matAddShoppingCartRound,
      matShoppingCartRound,
    }),
  ],
})
export class MasterclassCourseHero {
  readonly auth = inject(Auth);
  /** Route-scoped — the same instance `MasterclassCourse` keys on the route id. */
  readonly masterclass = inject(CourseDetail);
  readonly utils = inject(Utils);
  private readonly destroyRef = inject(DestroyRef);
  cn = cn;

  courseId = input<string>();
  courseTitle = input<string>();

  protected readonly instructor = computed(
    () => this.masterclass.courseDetails()?.instructor_details,
  );
  protected readonly instructorNames = computed(() => {
    const lead = this.instructor();
    const others = lead?.other_instructors ?? [];
    return [lead, ...others]
      .filter((person) => person?.first_name || person?.last_name)
      .map((person) => `${person?.first_name ?? ''} ${person?.last_name ?? ''}`.trim());
  });

  openVideoDialog(source: 'trailer' | 'sample') {
    const courseDetails = this.masterclass.courseDetails();
    if (!courseDetails) return;

    const link = source === 'trailer' ? courseDetails.trailer_link : courseDetails.sample_link;
    this.utils.openVideoDialog(link, courseDetails.title);
  }

  /**
   * #15 lives on the service: it owns the writable `courseDetails`, and the
   * bookmark POST busts CAIRA's per-user cache for #4, so the patch has to land
   * on the same instance the rest of the page reads.
   */
  toggleBookmark() {
    this.masterclass.toggleBookmark();
  }

  /**
   * ponytail: `addCourseToCart` has no CAIRA endpoint — it opens the cart
   * drawer and completes empty, so the `update` never runs. The button is
   * behind `@if (can_purchase_individually || is_subscription_excluded)`, both
   * pinned `false` by the mapper, so it does not render at all today.
   */
  addToCart(courseId: string, isAddedToCart: boolean) {
    this.utils
      .addCourseToCart(courseId, isAddedToCart)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        if (response.status) {
          this.masterclass.courseDetails.update((course) =>
            course ? { ...course, is_added_to_cart: response.in_cart } : course,
          );
        }
      });
  }
}
