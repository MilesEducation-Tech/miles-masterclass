import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { NgpLabel } from 'ng-primitives/form-field';
import { Backward } from '@shared/components/backward/backward';
import { Accordion } from '@shared/ui/accordion/accordion';
import { AccordionItem } from '@shared/ui/accordion/accordion-item';
import { Button } from '@shared/ui/button/button';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { Field } from '@shared/ui/field/field';
import { PageLoading } from '@shared/ui/page-loading/page-loading';
import { Switch } from '@shared/ui/switch/switch';
import {
  ASSESSMENT_COPY,
  ASSESSMENT_REPORT_COPY,
  ASSESSMENT_REVIEW_STATUS,
  FEEDBACK_COPY,
} from '@features/offerings/constants/course-detail';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';
import { CourseEvaluationFacade } from '@features/offerings/services/course-evaluation-facade';
import { FinalAssessmentFacade } from '@features/offerings/services/final-assessment-facade';

/**
 * `…/:courseId/:courseTitle/final-assessment/report`: the learner's latest
 * final assessment, from `FinalAssessmentFacade`. The summary comes from
 * `assessment-report/`, which always answers; the question review from
 * `assessment-result/`, read only once there is an attempt. Both are keyed by
 * course, so the URL carries no session.
 *
 * The page keeps only its view state, the "wrong answers only" filter. After a
 * pass, "Submit Feedback" opens the course evaluation (`CourseEvaluationFacade`).
 */
@Component({
  selector: 'app-final-assessment-report',
  imports: [
    DatePipe,
    DecimalPipe,
    NgpLabel,
    Backward,
    Accordion,
    AccordionItem,
    Button,
    ErrorState,
    Field,
    PageLoading,
    Switch,
  ],
  templateUrl: './final-assessment-report.html',
})
export class FinalAssessmentReport {
  // Route params, bound by `withComponentInputBinding`.
  readonly courseId = input<string>();
  readonly courseTitle = input<string>();

  protected readonly facade = inject(FinalAssessmentFacade);
  protected readonly evaluation = inject(CourseEvaluationFacade);

  protected readonly copy = ASSESSMENT_REPORT_COPY;
  protected readonly assessmentCopy = ASSESSMENT_COPY;
  protected readonly statuses = ASSESSMENT_REVIEW_STATUS;
  protected readonly submitFeedback = FEEDBACK_COPY.submitFeedback;
  protected readonly feedbackSubmitted = FEEDBACK_COPY.feedbackSubmitted;

  protected readonly wrongOnly = signal(false);
  protected readonly items = computed(() => {
    const review = this.facade.review();
    return this.wrongOnly() ? review.filter((item) => item.status !== 'correct') : review;
  });

  constructor() {
    // A direct load (or a reload) arrives without the course page, so the course
    // is connected here too, as the exam page does.
    inject(CourseDetailFacade).connect(
      'masterclass',
      computed(() => ({ courseId: this.courseId(), slug: this.courseTitle() })),
    );
    this.facade.openReport(true);
    inject(DestroyRef).onDestroy(() => this.facade.openReport(false));
  }
}
