import { Component, computed, inject, input } from '@angular/core';
import { VideoPoster } from '@shared/components/video-poster/video-poster';
import { Button } from '@shared/ui/button/button';
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

import { Progress } from '@shared/ui/progress/progress';
import { cn } from '@shared/utils/cn';
import { MasterclassFacade } from '../../../services/masterclass-facade';
import { RatingStar } from '@shared/components/rating-star/rating-star';
import { Utils } from '@shared/services/utils';
import { CategoriesList } from '@shared/components/categories-list/categories-list';
import { TotalCpeCreditsPipe } from '@shared/pipes/total-cpe-credits/total-cpe-credits-pipe';
import { CairaCredlyBadge } from '@shared/components/cards/caira-credly-badge/caira-credly-badge';

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
  readonly masterclass = inject(MasterclassFacade);
  readonly utils = inject(Utils);
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

  toggleBookmark() {
    const id = this.courseId();
    if (!id) return;

    this.utils.toggleBookmarkCourse(+id).subscribe((response) => {
      if (response.status) {
        this.masterclass.courseDetails.update((course) =>
          course ? { ...course, added_bookmark: response.is_bookmarked } : course,
        );
      }
    });
  }

  addToCart(courseId: number, isAddedToCart: boolean) {
    this.utils.addCourseToCart(courseId, isAddedToCart).subscribe((response) => {
      if (response.status) {
        this.masterclass.courseDetails.update((course) =>
          course ? { ...course, is_added_to_cart: response.in_cart } : course,
        );
      }
    });
  }
}
