import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CourseRouter } from './shared/services/course-router/course-router';
import { TrackerTableRow } from './shared/mappers/report-to-table';
import { getCourseId } from './shared/utils/course.util';
import { toSlug } from './shared/utils/slug.util';
import { BadgeSwiper } from './shared/components/badge-swiper/badge-swiper';
import { TrackerToolbar } from './shared/components/tracker-toolbar/tracker-toolbar';
import { TrackerTable } from './shared/components/tracker-table/tracker-table';
import { Utils } from '../../shared/core/services/utils/utils';

/**
 * Maps the raw `course_details.type` discriminator to the v3 route segment.
 * Owned in the cpe-tracker feature so title-click routing stays explicit
 * here, independent of the row-action flows the global `CourseRouter` handles.
 *
 * Premiere rows collapse to `webinar` because there is no standalone
 * `/premiere/...` route in `features/offerings/offerings.ts` today; flip the
 * value here if that ever changes.
 */
const COURSE_TYPE_TO_URL_SEGMENT: Record<any, string> = {
  masterclass: 'masterclass',
  podcast: 'podcast',
  nano_learning: 'micro-learning',
  webinar: 'webinar',
  premiere: 'webinar',
};

@Component({
  selector: 'app-cpe-tracker',
  imports: [BadgeSwiper, TrackerToolbar, TrackerTable],
  templateUrl: './cpe-tracker.html',
  styleUrl: './cpe-tracker.css',
})
export class CpeTracker {
  // ponytail: CpeTrackerFacade was deleted with the Django strip. This placeholder
  // keeps the template bindings compiling and renders the empty state.
  // Swap in the new backend's service — the template needs no changes.
  protected readonly facade: any = {
    badges: signal<any[]>([]),
    claimBadge: (..._args: any[]): any => null,
    credits: signal<any[]>([]),
    currentPage: signal<any>(null),
    downloadAllCertificates: signal<any[]>([]),
    downloadCertificateForRow: (..._args: any[]): any => null,
    downloadNasba: signal<any>(null),
    isLoadingReport: signal<any>(null),
    loadAll: signal<any>(null),
    nextPage: signal<any>(null),
    openBadgeInfo: signal<any>(null),
    openCompliance: signal<any>(null),
    pagedTableRows: signal<any[]>([]),
    pageWindow: signal<any>(null),
    prevPage: signal<any>(null),
    selectedYear: signal<any>(null),
    setStudyFilter: (..._args: any[]): any => null,
    setYear: (..._args: any[]): any => null,
    shareBadge: (..._args: any[]): any => null,
    studyFilter: signal<any>(null),
    totalPages: signal<any[]>([]),
    yearOptions: signal<any[]>([]),
  };
  private readonly courseRouter = inject(CourseRouter);
  private readonly router = inject(Router);
  private readonly utils = inject(Utils);

  constructor() {
    this.facade.loadAll();
  }

  /**
   * Title-cell click → navigate to the course detail page.
   * Route segment is derived from the raw `course_details.type`, not from
   * the normalized `transaction_type`, so premiere/webinar routing stays
   * editable in one place ({@link COURSE_TYPE_TO_URL_SEGMENT}).
   */
  protected onTitleClick(row: TrackerTableRow): void {
    const courseId = getCourseId(row.raw);
    if (courseId === null) return;

    const segment = COURSE_TYPE_TO_URL_SEGMENT[row.raw.course_type];
    if (!segment) return;

    this.router.navigate([
      '/',
      this.utils.country(),
      this.utils.profession(),
      segment,
      courseId,
      toSlug(row.raw.course_name),
    ]);
  }

  protected onRowAction(row: TrackerTableRow): void {
    switch (row.actionKind) {
      case 'registered':
        this.courseRouter.navigateToRegistered(row.raw);
        return;
      case 'resume':
        this.courseRouter.navigateToResume(row.raw);
        return;
      case 'exam':
      case 'retake':
        // Both kinds share the exam flow — the dialog + start-assessment
        // logic in `Utils.startFinalAssessment` is identical, only the
        // button label differs.
        this.courseRouter.navigateToExam(row.raw);
        return;
      case 'feedback':
        this.courseRouter.navigateToFeedback(row.raw);
        return;
      case 'download':
        // Per-course download — hits `user-assessment/download_certificate/`
        // with the row's id + transaction_type. The bulk endpoint
        // (`downloadAllCertificates`) is only triggered from the toolbar's
        // "Download All" button.
        this.facade.downloadCertificateForRow(row.raw);
        return;
      case 'view-details':
        this.courseRouter.navigateToCourseDetail(row.raw);
        return;
      case 'none':
      default:
        return;
    }
  }
}
