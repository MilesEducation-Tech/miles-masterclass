import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowDownTray, heroBookOpen, heroCheck } from '@ng-icons/heroicons/outline';
import { displayNameOf } from '@core/models/account.model';
import { AccountApi } from '@core/services/account-api/account-api';
import { RatingStar } from '@shared/components/rating-star/rating-star';
import { Button } from '@shared/ui/button/button';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { Field } from '@shared/ui/field/field';
import { PageLoading } from '@shared/ui/page-loading/page-loading';
import { Textarea } from '@shared/ui/textarea/textarea';
import {
  ASSESSMENT_REPORT_COPY,
  CERTIFICATE_COPY,
  CHAPTER_COPY,
  FEEDBACK_COPY,
} from '@features/offerings/constants/course-detail';
import { EvaluationQuestion } from '@features/offerings/models/course-evaluation.model';
import { CourseCertificateFacade } from '@features/offerings/services/course-certificate-facade';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';
import { CourseEvaluationFacade } from '@features/offerings/services/course-evaluation-facade';
import { FinalAssessmentFacade } from '@features/offerings/services/final-assessment-facade';

/**
 * `…/:courseId/:courseTitle/feedback`: the course evaluation, in the feedback
 * page's long-standing format (a 1–5 rating per question, then comments). The
 * form and its rules come from `CourseEvaluationFacade`; the page keeps only
 * the learner's answers until they are submitted, and the thank-you state.
 */
@Component({
  selector: 'app-course-evaluation',
  imports: [DatePipe, NgIcon, RatingStar, Button, ErrorState, Field, PageLoading, Textarea],
  templateUrl: './course-evaluation.html',
  viewProviders: [provideIcons({ heroArrowDownTray, heroBookOpen, heroCheck })],
})
export class CourseEvaluation {
  // Route and query params, bound by `withComponentInputBinding`.
  readonly courseId = input<string>();
  readonly courseTitle = input<string>();
  /** Where the learner came from; every way in passes it. */
  readonly redirect = input<string>();

  protected readonly facade = inject(CourseEvaluationFacade);
  protected readonly assessment = inject(FinalAssessmentFacade);
  protected readonly certificate = inject(CourseCertificateFacade);
  private readonly detail = inject(CourseDetailFacade);
  private readonly account = inject(AccountApi);

  protected readonly copy = FEEDBACK_COPY;
  protected readonly reportCopy = ASSESSMENT_REPORT_COPY;
  protected readonly resetCopy = CHAPTER_COPY.enrolmentReset;
  protected readonly certificateCopy = CERTIFICATE_COPY;

  protected readonly course = this.detail.course;
  protected readonly instructorNames = computed(
    () =>
      this.course()
        ?.instructors.map((instructor) => instructor.name)
        .join(', ') ?? '',
  );
  /** `hasValue()` first: reading an errored `httpResource` throws. */
  protected readonly learnerName = computed(() =>
    displayNameOf(this.account.user.hasValue() ? this.account.user.value() : null),
  );

  /** The learner's rating per question id; a new form starts empty. */
  protected readonly ratings = linkedSignal<EvaluationQuestion[], Record<string, number>>({
    source: this.facade.questions,
    computation: () => ({}),
  });
  protected readonly comments = signal('');
  protected readonly isComplete = computed(() => {
    const questions = this.facade.questions();
    const ratings = this.ratings();
    return questions.length > 0 && questions.every((question) => (ratings[question.id] ?? 0) > 0);
  });

  /** Set once the evaluation is in: the CPE the submit awarded, when it says. */
  protected readonly thanks = signal<{ cpeAwarded: number | null } | null>(null);

  constructor() {
    // A direct load (or a reload) arrives without the course page, so the course
    // is connected here too, as the exam and report pages do.
    this.detail.connect(
      'masterclass',
      computed(() => ({ courseId: this.courseId(), slug: this.courseTitle() })),
    );
    this.facade.openForm(true);
    inject(DestroyRef).onDestroy(() => this.facade.openForm(false));
  }

  protected typed(event: Event): void {
    if (event.target instanceof HTMLTextAreaElement) this.comments.set(event.target.value);
  }

  protected rate(questionId: string, value: number): void {
    this.ratings.update((ratings) => ({ ...ratings, [questionId]: value }));
  }

  protected async submit(): Promise<void> {
    if (!this.isComplete()) return;
    const outcome = await this.facade.submit(this.ratings(), this.comments());
    if (outcome && !outcome.reset_required) this.thanks.set({ cpeAwarded: outcome.cpe_awarded });
  }

  protected leave(): void {
    this.facade.leave(this.redirect());
  }
}
