import { inject, Service } from '@angular/core';
import { Router } from '@angular/router';
import { Utils } from '../../../../../shared/core/services/utils/utils';
import { getCourseId, getCourseName, getUrlSegment } from '../../utils/course.util';
import { toSlug } from '../../utils/slug.util';

/**
 * Route dispatch for tracker rows. Wraps `Router.navigate` with the
 * context-aware `/:country/:profession_type` prefix derived from `Utils`.
 */
@Service()
export class CourseRouter {
  private readonly router = inject(Router);
  private readonly utils = inject(Utils);

  navigateToCourse(row: any): void {
    const id = getCourseId(row);
    if (id === null) return;
    const segment = getUrlSegment(row);
    const slug = toSlug(getCourseName(row));
    this.router.navigate([
      `/${this.utils.country()}/${this.utils.profession()}`,
      segment,
      id,
      slug,
    ]);
  }

  /**
   * Premiere/webinar "Registered" CTA. Per spec, this lands on the premiere
   * detail page — which collapses to the `/webinar/:id/:slug` route in v3
   * (`getUrlSegment` already maps `'webinar'` correctly, and `'premiere'`
   * upstream is normalized to `'webinar'` in `api-adapters`).
   */
  navigateToRegistered(row: any): void {
    this.navigateToCourse(row);
  }

  navigateToResume(row: any): void {
    this.navigateToCourse(row);
  }

  /**
   * Fallback CTA target — same destination as Resume, distinct label
   * (`View Details`) reflects that the row isn't in an actionable state
   * (e.g. completed exam in upcoming mode, no feedback object in completed
   * mode).
   */
  navigateToCourseDetail(row: any): void {
    this.navigateToCourse(row);
  }

  navigateToFeedback(row: any): void {
    const id = getCourseId(row);
    if (id === null) return;
    const segment = getUrlSegment(row);
    const slug = toSlug(getCourseName(row));
    // `redirect` defaults to the current URL so the feedback page can route
    // back here (e.g. /cpe-tracker) after submission.
    this.router.navigate(
      [`/${this.utils.country()}/${this.utils.profession()}`, segment, id, slug, 'feedback'],
      { queryParams: { redirect: this.router.url } },
    );
  }

  /**
   * Take Exam / Retake Exam CTA. Delegates to `Utils.startFinalAssessment`,
   * which opens the shared "QAS Self-Study Qualified Assessment Rules" dialog
   * and, on confirm, either reuses a cached session or hits the start-exam
   * API before navigating to `/{segment}/:id/:slug/final-assessment/:session/exam`.
   *
   * Notes:
   * - `Utils.startFinalAssessment` expects `'micro_learning'` (snake) for nano
   *   rows; the report's `transaction_type` is `'nano_learning'`, so we
   *   translate at the boundary.
   * - Webinar rows have no exam path; we fall back to the course detail page
   *   so the CTA stays well-behaved if it's ever reached for a webinar.
   */
  navigateToExam(row: any): void {
    const id = getCourseId(row);
    if (id === null) {
      this.navigateToCourse(row);
      return;
    }

    if (row.transaction_type === 'webinar') {
      this.navigateToCourse(row);
      return;
    }

    const courseType =
      row.transaction_type === 'nano_learning' ? 'micro_learning' : row.transaction_type;

    this.utils.startFinalAssessment(
      String(id),
      getCourseName(row),
      courseType,
      row.exam_rules ?? '',
    );
  }
}
