import { Component, computed, DestroyRef, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Auth } from '../../../../../../shared/core/services/auth/auth';
import { Utils } from '../../../../../../shared/core/services/utils/utils';
import { cn } from '../../../../../../shared/utils/cn';
import { Button } from '../../../../../../shared/components/ui/button/button';
import { Progress } from '../../../../../../shared/components/ui/progress/progress';
import { RatingStar } from '../../../../../../shared/components/rating-star/rating-star';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { DatePipe, NgOptimizedImage } from '@angular/common';
import {
  matAddShoppingCartRound,
  matBookmarkBorderRound,
  matBookmarkRound,
  matPlayArrowRound,
  matRestartAltRound,
  matShoppingCartRound,
} from '@ng-icons/material-icons/round';
import { phosphorShareFatFill, phosphorDownloadSimpleFill } from '@ng-icons/phosphor-icons/fill';
import { phosphorCards } from '@ng-icons/phosphor-icons/regular';
import { RecordDisk } from '../../../../../../shared/components/record-disk/record-disk';
import { CategoriesList } from '../../../../../../shared/components/categories-list/categories-list';
import { TotalCpeCreditsPipe } from '../../../../../../shared/core/pipes/total-cpe-credits/total-cpe-credits.pipe';
import { CairaCredlyBadge } from '../../../../../../shared/components/cards/caira-credly-badge/caira-credly-badge';
import { CourseDetail } from '../../../../shared/services/course-detail/course-detail';

@Component({
  selector: 'app-podcast-course-hero',
  imports: [
    Button,
    Progress,
    RatingStar,
    NgIconComponent,
    DatePipe,
    NgOptimizedImage,
    RecordDisk,
    CategoriesList,
    TotalCpeCreditsPipe,
    CairaCredlyBadge,
  ],
  templateUrl: './podcast-course-hero.html',
  styleUrl: './podcast-course-hero.css',
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
export class PodcastCourseHero {
  readonly auth = inject(Auth);
  /** Route-scoped — the same instance `PodcastCourse` keys on the route id. */
  readonly masterclass = inject(CourseDetail);
  private readonly utils = inject(Utils);
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
   * #15 lives on the service — see `MasterclassCourseHero.toggleBookmark`.
   * CAIRA has one bookmark endpoint and it takes a masterclass course id, so
   * there is no podcast variant to pass through any more.
   */
  toggleBookmark() {
    this.masterclass.toggleBookmark();
  }

  /**
   * Mirrors `MasterclassCourseHero.addToCart`. `Utils.addCourseToCart` handles
   * the API call, the "already in cart" short-circuit + cart-drawer open, and
   * toasts; we just patch the local `courseDetails` signal so the icon flips
   * without re-fetching the whole course payload.
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
