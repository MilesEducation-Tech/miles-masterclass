import { DatePipe, NgOptimizedImage } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matBookmarkBorderRound,
  matBookmarkRound,
  matPlayArrowRound,
} from '@ng-icons/material-icons/round';
import { phosphorDownloadSimpleFill, phosphorShareFatFill } from '@ng-icons/phosphor-icons/fill';
import { phosphorCards } from '@ng-icons/phosphor-icons/regular';
import { CairaCredlyBadge } from '@shared/components/cards/caira-credly-badge/caira-credly-badge';
import { CategoriesList } from '@shared/components/categories-list/categories-list';
import { RecordDisk, RecordDiskConfig } from '@shared/components/record-disk/record-disk';
import { Button } from '@shared/ui/button/button';
import {
  ASSESSMENT_COPY,
  ASSESSMENT_REPORT_COPY,
  FEEDBACK_COPY,
} from '@features/offerings/constants/course-detail';
import { PODCAST_RECORD_DISK } from '@features/offerings/podcast/constants/podcast';
import { CourseCertificateFacade } from '@features/offerings/services/course-certificate-facade';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';
import { CourseEvaluationFacade } from '@features/offerings/services/course-evaluation-facade';
import { FinalAssessmentFacade } from '@features/offerings/services/final-assessment-facade';

/**
 * The podcast course page's hero, in the podcast look: the blurred artwork
 * behind, the details on one side and the spinning record disk on the other.
 * It reads the course from `CourseDetailFacade` and calls it for every action,
 * as the masterclass hero does: Watch Now (or Take Final Assessment once the
 * server allows it, through `FinalAssessmentFacade`), View Report, Submit
 * Feedback (`CourseEvaluationFacade`), Trailer, Sample, Bookmark, Share and the
 * certificate (`CourseCertificateFacade`).
 *
 * The CPE / Preview mode is chosen when a chapter starts, as on masterclass, so
 * the hero no longer has its own switch. Like the masterclass hero, it holds
 * back the price, Add To Cart and the course's progress until the web API
 * covers them; the chapter list shows each chapter's progress.
 */
@Component({
  selector: 'app-podcast-course-hero',
  imports: [
    DatePipe,
    NgOptimizedImage,
    NgIcon,
    Button,
    RecordDisk,
    CategoriesList,
    CairaCredlyBadge,
  ],
  templateUrl: './podcast-course-hero.html',
  providers: [
    provideIcons({
      matPlayArrowRound,
      matBookmarkRound,
      matBookmarkBorderRound,
      phosphorCards,
      phosphorShareFatFill,
      phosphorDownloadSimpleFill,
    }),
  ],
})
export class PodcastCourseHero {
  protected readonly facade = inject(CourseDetailFacade);
  protected readonly assessment = inject(FinalAssessmentFacade);
  protected readonly evaluation = inject(CourseEvaluationFacade);
  protected readonly certificate = inject(CourseCertificateFacade);
  protected readonly course = this.facade.course;

  protected readonly takeAssessment = ASSESSMENT_COPY.take;
  protected readonly viewReport = ASSESSMENT_REPORT_COPY.viewReport;
  protected readonly submitFeedback = FEEDBACK_COPY.submitFeedback;
  protected readonly feedbackSubmitted = FEEDBACK_COPY.feedbackSubmitted;

  /** The record disk spins for as long as the hero is on screen. */
  protected readonly disk: RecordDiskConfig = {
    ...PODCAST_RECORD_DISK,
    animate: true,
    direction: 'left',
  };

  /** The blurred background: the landscape artwork. */
  protected readonly background = computed(() => this.course()?.horizontal_thumbnail_url ?? null);

  /** The record disk: the square artwork, else the landscape one. */
  protected readonly artwork = computed(() => {
    const course = this.course();
    return course ? (course.square_thumbnail_url ?? course.horizontal_thumbnail_url) : null;
  });

  protected readonly instructorNames = computed(
    () =>
      this.course()
        ?.instructors.map((instructor) => instructor.name)
        .join(', ') ?? '',
  );

  /** Every UAT course sits in one CAIRA level; the badge shows its number. */
  protected readonly cairaLevel = computed(() => this.course()?.level[0]?.level_number ?? null);
}
