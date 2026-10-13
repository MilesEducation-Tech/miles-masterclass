import { Component, computed, DestroyRef, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MasterclassFacade } from '@features/offerings/services/masterclass-facade';
import { Utils } from '@shared/services/utils';
import { cn } from '@shared/utils/cn';
import { Button } from '@shared/ui/button/button';
import { Progress } from '@shared/ui/progress/progress';
import { RatingStar } from '@shared/components/rating-star/rating-star';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { DatePipe, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  matAddShoppingCartRound,
  matBookmarkBorderRound,
  matBookmarkRound,
  matPlayArrowRound,
  matRestartAltRound,
} from '@ng-icons/material-icons/round';
import { phosphorShareFatFill, phosphorDownloadSimpleFill } from '@ng-icons/phosphor-icons/fill';
import { phosphorCards } from '@ng-icons/phosphor-icons/regular';
import { RecordDisk } from '@shared/components/record-disk/record-disk';
import { CategoriesList } from '@shared/components/categories-list/categories-list';
import { TotalCpeCreditsPipe } from '@shared/pipes/total-cpe-credits/total-cpe-credits-pipe';
import { CairaCredlyBadge } from '@shared/components/cards/caira-credly-badge/caira-credly-badge';

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
    RouterLink,
  ],
  templateUrl: './podcast-course-hero.html',
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
    }),
  ],
})
export class PodcastCourseHero {
  readonly masterclass = inject(MasterclassFacade);
  private readonly utils = inject(Utils);
  private readonly destroyRef = inject(DestroyRef);
  cn = cn;

  courseId = input<string>();
  courseTitle = input<string>();

  /** Only subscriptions are sold: a course's buy button opens the plan page. */
  protected readonly planRoute = computed(
    () => `/${this.utils.country()}/${this.utils.profession()}/payment/plan`,
  );

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
   * Toggle the podcast bookmark via the shared util. Patches the local
   * `courseDetails` signal on success so the icon flips immediately — the
   * server is the source of truth via `response.is_bookmarked`. Login gate
   * and toast are handled centrally by `Utils.toggleBookmarkCourse`.
   */
  toggleBookmark() {
    const id = this.courseId();
    if (!id) return;
    this.utils
      .toggleBookmarkCourse(+id, { course_type: 'podcast' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        if (response.status) {
          this.masterclass.courseDetails.update((course) =>
            course ? { ...course, added_bookmark: response.is_bookmarked } : course,
          );
        }
      });
  }
}
