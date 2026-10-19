import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { CanDeactivateComponent } from '@core/guards/can-deactivate-exam-guard';
import { NotificationService } from '@core/services/notification/notification';
import { Backward } from '@shared/components/backward/backward';
// Type-only: both dialogs load with `import()` when opened (AGENTS.md §4.4).
import type { UtilsDialogData, UtilsDialogResult } from '@shared/dialogs/utils-dialog/utils-dialog';
import { Button } from '@shared/ui/button/button';
import { Checkbox } from '@shared/ui/checkbox/checkbox';
import { PageLoading } from '@shared/ui/page-loading/page-loading';
import {
  ASSESSMENT_COPY,
  ASSESSMENT_DIALOG_WIDTH,
  CHAPTER_COPY,
} from '@features/offerings/constants/course-detail';
import type {
  AssessmentResultAction,
  AssessmentResultData,
} from '@features/offerings/dialogs/assessment-result-dialog/assessment-result-dialog';
import {
  AssessmentAnswer,
  AssessmentPaper,
  AssessmentQuestion,
} from '@features/offerings/models/final-assessment.model';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';
import { FinalAssessmentFacade } from '@features/offerings/services/final-assessment-facade';

/**
 * `…/:courseId/:courseTitle/final-assessment/:sessionId/exam`: one sitting of
 * the final assessment, one question at a time. The paper comes from
 * `FinalAssessmentFacade` (`assessment-questions/`), so a reload shows the same
 * questions; the answers live here until they are submitted together, which is
 * how the API takes them. Leaving before that asks first, and loses them.
 */
@Component({
  selector: 'app-final-assessment-exam',
  imports: [Backward, Button, Checkbox, PageLoading],
  templateUrl: './final-assessment-exam.html',
  host: {
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class FinalAssessmentExam implements CanDeactivateComponent {
  // Route params, bound by `withComponentInputBinding`.
  readonly courseId = input<string>();
  readonly courseTitle = input<string>();
  /** The sitting `assessment-start/` returned. */
  readonly sessionId = input<string>();

  protected readonly facade = inject(FinalAssessmentFacade);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly copy = ASSESSMENT_COPY;
  protected readonly questions = computed(() => this.facade.paper()?.questions ?? []);

  /** The learner's choices by question id. A new paper (a retake) starts empty. */
  protected readonly answers = linkedSignal<AssessmentPaper | null, Record<string, string[]>>({
    source: this.facade.paper,
    computation: () => ({}),
  });
  protected readonly index = linkedSignal<AssessmentPaper | null, number>({
    source: this.facade.paper,
    computation: () => 0,
  });
  /** Scored: leaving no longer asks. */
  private readonly submitted = linkedSignal<AssessmentPaper | null, boolean>({
    source: this.facade.paper,
    computation: () => false,
  });
  protected readonly submitting = signal(false);

  protected readonly question = computed(() => this.questions()[this.index()] ?? null);
  protected readonly selected = computed(() => {
    const question = this.question();
    return question ? (this.answers()[question.id] ?? []) : [];
  });
  protected readonly isLast = computed(() => this.index() >= this.questions().length - 1);

  constructor() {
    // A direct load (or a reload) arrives without the course page, so the course
    // is connected here too, as the chapter page does.
    inject(CourseDetailFacade).connect(
      'masterclass',
      computed(() => ({ courseId: this.courseId(), slug: this.courseTitle() })),
    );
    effect(() => this.facade.openSitting(this.sessionId() ?? null));
    inject(DestroyRef).onDestroy(() => this.facade.openSitting(null));
  }

  protected onBeforeUnload(event: Event): void {
    if (this.isInProgress()) event.preventDefault();
  }

  canDeactivate(): Promise<boolean> | boolean {
    return this.isInProgress() ? this.confirmExit() : true;
  }

  /** A `single` question: one option, replacing any earlier pick. */
  protected choose(optionId: string): void {
    const question = this.question();
    if (question && !this.submitting()) this.setAnswer(question, [optionId]);
  }

  /** Any other type: options tick on and off. */
  protected toggle(optionId: string, checked: boolean): void {
    const question = this.question();
    if (!question || this.submitting()) return;
    const ids = this.answers()[question.id] ?? [];
    this.setAnswer(question, checked ? [...ids, optionId] : ids.filter((id) => id !== optionId));
  }

  protected next(): void {
    if (!this.isLast()) this.index.update((index) => index + 1);
  }

  protected previous(): void {
    if (this.index() > 0) this.index.update((index) => index - 1);
  }

  /**
   * Every question needs an answer (the API scores the whole paper), so the
   * unanswered ones are listed first, each a jump back to it.
   */
  protected async submit(): Promise<void> {
    if (this.submitting()) return;
    const questions = this.questions();
    const unanswered = questions.filter((question) => !this.answers()[question.id]?.length);
    if (unanswered.length) {
      await this.listUnanswered(unanswered);
      return;
    }

    const answers: AssessmentAnswer[] = questions.map((question) => ({
      question_id: question.id,
      selected_option_ids: this.answers()[question.id],
    }));
    this.submitting.set(true);
    const outcome = await this.facade.submit(answers);
    this.submitting.set(false);
    if (!outcome) return;

    this.submitted.set(true);
    if (outcome.reset_required) {
      this.notification.info(CHAPTER_COPY.enrolmentReset.title, CHAPTER_COPY.enrolmentReset.body);
      this.backToCourse();
      return;
    }

    const passMark = this.facade.paper()?.pass_threshold_percent ?? 0;
    const score = outcome.score_percent;
    await this.showResult({
      isPassed: outcome.passed,
      score,
      passingScore: passMark,
      message: outcome.passed
        ? ASSESSMENT_COPY.passed(score)
        : ASSESSMENT_COPY.failed(score, passMark),
    });
  }

  protected backToCourse(): void {
    void this.router.navigate(['../../..'], { relativeTo: this.route });
  }

  private isInProgress(): boolean {
    return !!this.facade.paper() && !this.submitted();
  }

  private setAnswer(question: AssessmentQuestion, optionIds: string[]): void {
    this.answers.update((answers) => ({ ...answers, [question.id]: optionIds }));
  }

  private async confirmExit(): Promise<boolean> {
    const { UtilsDialog } = await import('@shared/dialogs/utils-dialog/utils-dialog');
    const ref = this.dialogs.open<UtilsDialogData, UtilsDialogResult>(UtilsDialog, {
      data: {
        title: ASSESSMENT_COPY.exit.title,
        content: [{ type: 'text', value: ASSESSMENT_COPY.exit.body }],
        buttons: [
          { label: 'Cancel', variant: 'outline', action: 'close' },
          { label: 'Exit', variant: 'destructive', action: 'confirm' },
        ],
        maxWidth: ASSESSMENT_DIALOG_WIDTH,
      },
    });
    const result = await firstValueFrom(ref.afterClosed);
    return result?.action === 'confirm';
  }

  private async listUnanswered(unanswered: AssessmentQuestion[]): Promise<void> {
    const questions = this.questions();
    const { UtilsDialog } = await import('@shared/dialogs/utils-dialog/utils-dialog');
    const ref = this.dialogs.open<UtilsDialogData, UtilsDialogResult>(UtilsDialog, {
      data: {
        title: ASSESSMENT_COPY.incomplete.title,
        content: [
          { type: 'text', value: ASSESSMENT_COPY.incomplete.body },
          {
            type: 'clickable-list',
            items: unanswered.map((question) => {
              const position = questions.indexOf(question);
              return {
                label: `Question ${position + 1}: ${question.question_text}`,
                value: position,
              };
            }),
          },
        ],
        buttons: [{ label: 'Close', variant: 'default', action: 'close' }],
        maxWidth: ASSESSMENT_DIALOG_WIDTH,
      },
    });
    const result = await firstValueFrom(ref.afterClosed);
    if (typeof result?.data === 'number') this.index.set(result.data);
  }

  private async showResult(data: AssessmentResultData): Promise<void> {
    const { AssessmentResultDialog } =
      await import('@features/offerings/dialogs/assessment-result-dialog/assessment-result-dialog');
    const ref = this.dialogs.open<AssessmentResultData, AssessmentResultAction>(
      AssessmentResultDialog,
      { data },
    );
    const action = await firstValueFrom(ref.afterClosed);
    if (action === 'retake') void this.facade.start();
    else if (action === 'report') this.facade.viewReport();
    else if (action === 'course') this.backToCourse();
  }
}
