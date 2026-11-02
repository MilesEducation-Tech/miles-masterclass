import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { NgpLabel } from 'ng-primitives/form-field';
import { CanDeactivateComponent } from '@core/guards/can-deactivate-exam-guard';
import { Backward } from '@shared/components/backward/backward';
// Type-only: both dialogs load with `import()` when opened (AGENTS.md §4.4).
import type { UtilsDialogData, UtilsDialogResult } from '@shared/dialogs/utils-dialog/utils-dialog';
import { Accordion } from '@shared/ui/accordion/accordion';
import { AccordionItem } from '@shared/ui/accordion/accordion-item';
import { Button } from '@shared/ui/button/button';
import { Checkbox } from '@shared/ui/checkbox/checkbox';
import { Field } from '@shared/ui/field/field';
import { PageLoading } from '@shared/ui/page-loading/page-loading';
import { Switch } from '@shared/ui/switch/switch';
import type {
  AiLabResultAction,
  AiLabResultData,
} from '@features/ai-labs/dialogs/ai-lab-result-dialog/ai-lab-result-dialog';
import {
  AiLabExamAnswer,
  AiLabExamPaper,
  AiLabExamQuestion,
  labExamReview,
  labReportReview,
} from '@features/ai-labs/models/ai-labs.model';
import {
  AiLabAssessmentFacade,
  LAB_EXAM_COPY,
} from '@features/ai-labs/services/ai-lab-assessment-facade';

/** The masterclass result dialogs' panel width, as `UtilsDialog`'s navy box. */
const DIALOG_WIDTH = '500px';

/** The masterclass report's copy, for the lab's review. */
const REVIEW_COPY = {
  title: 'Exam Report',
  retake: 'Retake Assessment',
  passed: 'Passed',
  failed: 'Not passed',
  score: 'Score',
  correctAnswers: 'Correct answers',
  passMark: 'Pass mark',
  questions: 'Exam Questions',
  wrongOnly: 'Show wrong answers only',
  noneWrong: 'Every answer was correct.',
  yourAnswer: 'Your answer',
  correctAnswer: 'Correct answer',
  explanation: 'Explanation',
  completedOn: 'Exam Completed on:',
  withheld: 'Correct answers are not shown for this attempt.',
} as const;

const REVIEW_STATUS = {
  correct: { label: 'Correct', badge: 'bg-success/15 text-success', answer: 'text-success' },
  incorrect: {
    label: 'Incorrect',
    badge: 'bg-destructive/15 text-destructive',
    answer: 'text-destructive',
  },
  skipped: { label: 'Skipped', badge: 'bg-white/10 text-gray-300', answer: 'text-gray-300' },
  // A failed attempt's key withheld: the learner's choice, with no verdict.
  withheld: { label: 'Answered', badge: 'bg-white/10 text-gray-300', answer: 'text-gray-200' },
} as const;

/**
 * The lab's final assessment: the paper, one question at a time, then the result dialog and the
 * review of every answer — the masterclass exam page and report page in one, copied rather than
 * shared (a feature may not import another).
 *
 * The review needs no read of its own: the submit's answer carries every question's verdict,
 * correct options and explanation. Leaving with answers in hand asks first, through
 * `canDeactivateExamGuard` and `beforeunload`, as the masterclass exam does.
 */
@Component({
  selector: 'app-ai-lab-exam',
  imports: [
    Accordion,
    AccordionItem,
    Backward,
    Button,
    Checkbox,
    DatePipe,
    DecimalPipe,
    Field,
    NgpLabel,
    PageLoading,
    Switch,
  ],
  templateUrl: './ai-lab-exam.html',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class AiLabExam implements CanDeactivateComponent {
  /** The `:courseId` route param, bound by `withComponentInputBinding`. */
  readonly courseId = input.required<string>();

  protected readonly facade = inject(AiLabAssessmentFacade);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly router = inject(Router);

  protected readonly copy = LAB_EXAM_COPY;
  protected readonly reviewCopy = REVIEW_COPY;
  protected readonly statuses = REVIEW_STATUS;

  /**
   * The lab page: this page's own URL without `/final-assessment`. Absolute, because this route
   * is three segments deep and a relative `..` would overshoot the lab page.
   */
  protected readonly labPath = this.router.url.split(/[?#]/)[0].replace(/\/final-assessment$/, '');

  protected readonly questions = computed(() => this.facade.paper()?.questions ?? []);

  protected readonly answers = linkedSignal<AiLabExamPaper | null, Record<string, string[]>>({
    source: this.facade.paper,
    computation: () => ({}),
  });
  protected readonly index = linkedSignal<AiLabExamPaper | null, number>({
    source: this.facade.paper,
    computation: () => 0,
  });
  protected readonly submitting = signal(false);

  protected readonly question = computed(() => this.questions()[this.index()] ?? null);
  protected readonly selected = computed(() => {
    const question = this.question();
    return question ? (this.answers()[question.id] ?? []) : [];
  });
  protected readonly isLast = computed(() => this.index() >= this.questions().length - 1);

  // ---- The review ------------------------------------------------------------

  protected readonly wrongOnly = signal(false);

  /** The submit just made, or — with no paper to sit — the latest attempt read back. */
  protected readonly review = computed(() => {
    const paper = this.facade.paper();
    const result = this.facade.result();
    if (paper && result) return labExamReview(paper, this.facade.sent(), result);
    const report = this.facade.report();
    return report ? labReportReview(report) : [];
  });

  /** The review's header line, from whichever of the two it is. `live` is this visit's submit. */
  protected readonly summary = computed(() => {
    const result = this.facade.result();
    if (result) {
      return {
        live: true,
        passed: result.passed,
        score: result.score_percent,
        passMark: result.pass_threshold_percent as number | null,
        correct: this.review().filter((item) => item.status === 'correct').length,
        total: this.review().length,
        at: null as string | null,
        withheld: false,
      };
    }
    const report = this.facade.report();
    return report
      ? {
          live: false,
          passed: report.status === 'passed',
          score: report.score_percent ?? 0,
          passMark: report.pass_threshold_percent,
          correct: report.correct_count,
          total: report.total_questions,
          at: report.attempted_at,
          withheld: report.feedback_withheld,
        }
      : null;
  });

  protected readonly items = computed(() =>
    this.wrongOnly() ? this.review().filter((item) => item.status !== 'correct') : this.review(),
  );

  constructor() {
    effect(() => this.facade.open(this.courseId()));
  }

  protected onBeforeUnload(event: Event): void {
    if (this.isInProgress()) event.preventDefault();
  }

  canDeactivate(): Promise<boolean> | boolean {
    return this.isInProgress() ? this.confirmExit() : true;
  }

  protected choose(optionId: string): void {
    const question = this.question();
    if (question && !this.submitting()) this.setAnswer(question, [optionId]);
  }

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

  /** Every answer must carry a selection — the API refuses a blank one — so list any first. */
  protected async submit(): Promise<void> {
    if (this.submitting()) return;
    const questions = this.questions();
    const unanswered = questions.filter((question) => !this.answers()[question.id]?.length);
    if (unanswered.length) {
      await this.listUnanswered(unanswered);
      return;
    }

    const answers: AiLabExamAnswer[] = questions.map((question) => ({
      question_id: question.id,
      selected_option_ids: this.answers()[question.id],
    }));
    this.submitting.set(true);
    const result = await this.facade.submit(answers);
    this.submitting.set(false);
    if (!result) return;

    const score = result.score_percent;
    const passMark = result.pass_threshold_percent;
    const retakeAfter = this.facade.retakeAfter();
    await this.showResult({
      isPassed: result.passed,
      score,
      passingScore: passMark,
      retakeAfter,
      message: result.passed
        ? LAB_EXAM_COPY.passed(score)
        : retakeAfter
          ? `${LAB_EXAM_COPY.failed(score, passMark)} ${LAB_EXAM_COPY.coolOff(retakeAfter)}`
          : LAB_EXAM_COPY.failed(score, passMark),
    });
  }

  protected backToLab(): void {
    void this.router.navigateByUrl(this.labPath);
  }

  /** A paper is on screen and hasn't been submitted. */
  private isInProgress(): boolean {
    return !!this.facade.paper() && !this.facade.result();
  }

  private setAnswer(question: AiLabExamQuestion, optionIds: string[]): void {
    this.answers.update((answers) => ({ ...answers, [question.id]: optionIds }));
  }

  private async confirmExit(): Promise<boolean> {
    const { UtilsDialog } = await import('@shared/dialogs/utils-dialog/utils-dialog');
    const ref = this.dialogs.open<UtilsDialogData, UtilsDialogResult>(UtilsDialog, {
      data: {
        title: LAB_EXAM_COPY.exit.title,
        content: [{ type: 'text', value: LAB_EXAM_COPY.exit.body }],
        buttons: [
          { label: 'Cancel', variant: 'outline', action: 'close' },
          { label: 'Exit', variant: 'destructive', action: 'confirm' },
        ],
        maxWidth: DIALOG_WIDTH,
      },
    });
    const result = await firstValueFrom(ref.afterClosed);
    return result?.action === 'confirm';
  }

  private async listUnanswered(unanswered: AiLabExamQuestion[]): Promise<void> {
    const questions = this.questions();
    const { UtilsDialog } = await import('@shared/dialogs/utils-dialog/utils-dialog');
    const ref = this.dialogs.open<UtilsDialogData, UtilsDialogResult>(UtilsDialog, {
      data: {
        title: LAB_EXAM_COPY.incomplete.title,
        content: [
          { type: 'text', value: LAB_EXAM_COPY.incomplete.body },
          {
            type: 'clickable-list',
            items: unanswered.map((question) => {
              const position = questions.indexOf(question);
              return {
                label: `Question ${position + 1}: ${stripTags(question.question_text)}`,
                value: position,
              };
            }),
          },
        ],
        buttons: [{ label: 'Close', variant: 'default', action: 'close' }],
        maxWidth: DIALOG_WIDTH,
      },
    });
    const result = await firstValueFrom(ref.afterClosed);
    if (typeof result?.data === 'number') this.index.set(result.data);
  }

  private async showResult(data: AiLabResultData): Promise<void> {
    const { AiLabResultDialog } =
      await import('@features/ai-labs/dialogs/ai-lab-result-dialog/ai-lab-result-dialog');
    const ref = this.dialogs.open<AiLabResultData, AiLabResultAction>(AiLabResultDialog, { data });
    const action = await firstValueFrom(ref.afterClosed);
    if (action === 'retake') this.facade.retake();
    else if (action === 'lab') this.backToLab();
    // 'report': the review is already on the page beneath the dialog.
  }
}

/** Question text may carry HTML; the unanswered list is plain text. */
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}
