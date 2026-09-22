import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Backward } from '@shared/components/backward/backward';
import { Button } from '@shared/ui/button/button';
import { FinalAssessmentFacade } from '../../services/final-assessment-facade/final-assessment-facade';
import { ContentDetails, QuizQuestion } from '@core/models/course.model';
import { Dialog } from '@core/services/dialog/dialog';
import { UtilsDialog, DialogButton } from '@shared/dialogs/utils-dialog/utils-dialog';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CanDeactivateComponent } from '@core/guards/can-deactivate-exam-guard';
import {
  AssessmentResultDialog,
  AssessmentResultAction,
  AssessmentResultData,
} from '@features/offerings/dialogs/assessment-result-dialog/assessment-result-dialog';
import { Utils } from '@shared/services/utils';
import { Logger } from '@core/services/logger/logger';
import { ActivatedRoute, Router } from '@angular/router';
import { PageLoading } from '@shared/ui/page-loading/page-loading';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroCheckCircle,
  heroXCircle,
  heroArrowRight,
  heroArrowPath,
} from '@ng-icons/heroicons/outline';

@Component({
  selector: 'app-final-assessment-exam',
  imports: [Backward, NgIconComponent, Button, PageLoading],
  templateUrl: './final-assessment-exam.html',
  styleUrl: './final-assessment-exam.css',
  viewProviders: [provideIcons({ heroCheckCircle, heroXCircle, heroArrowRight, heroArrowPath })],
  host: {
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class FinalAssessmentExam implements CanDeactivateComponent {
  courseId = input<string>();
  sessionId = input<string>();

  private readonly facade = inject(FinalAssessmentFacade);
  private readonly dialog = inject(Dialog);
  private readonly utils = inject(Utils);
  private readonly logger = inject(Logger);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  courseNavigation = signal<string>('../../..');

  // Expose facade signal
  isAssessmentPassed = this.facade.isAssessmentPassed;

  // State
  questions = signal<QuizQuestion[]>([]);
  courseDetails = signal<ContentDetails | null>(null);
  currentQuestionIndex = signal(0);
  isSubmitted = signal(false);
  isLoading = signal(false);

  // Computed
  currentQuestion = computed(() => {
    const questions = this.questions();
    const index = this.currentQuestionIndex();
    return questions[index];
  });

  isLastQuestion = computed(() => {
    return this.currentQuestionIndex() === this.questions().length - 1;
  });

  progressText = computed(() => {
    return `Question ${this.currentQuestionIndex() + 1} of ${this.questions().length}`;
  });

  answers = computed(() => {
    const questions = this.questions();
    const map: Record<number, string> = {};
    questions.forEach((q) => {
      if (q.user_selected_option) {
        map[q.id] = q.user_selected_option;
      }
    });
    return map;
  });

  selectedOption = computed(() => {
    // Check if currentQuestion exists to avoid errors when questions array is empty (e.g. passed state)
    return this.currentQuestion()?.user_selected_option || null;
  });

  constructor() {
    effect(() => {
      const courseId = this.courseId();
      const sessionId = this.sessionId();
      if (courseId && sessionId) {
        this.facade.courseId.set(courseId);
        this.facade.sessionId.set(sessionId);
        this.currentQuestionIndex.set(0);
        this.questions.set([]);
        this.isSubmitted.set(false);
        this.loadQuestions();
      } else {
        this.logger.warn('FinalAssessmentExam: Missing inputs', { courseId, sessionId });
      }
    });
  }

  onBeforeUnload(event: Event) {
    if (!this.isSubmitted() && !this.isAssessmentPassed()) {
      event.preventDefault();
    }
  }

  canDeactivate(): Observable<boolean> | boolean {
    if (this.isSubmitted() || this.isAssessmentPassed()) {
      return true;
    }

    const dialogRef = this.dialog.open<
      UtilsDialog,
      { action?: DialogButton['action']; result: boolean }
    >(UtilsDialog, {
      data: {
        title: 'Exit Assessment?',
        content: [
          {
            type: 'text',
            value:
              'Are you sure you want to leave the assessment? Your progress will currently be lost if you leave without submitting.',
          },
        ],
        buttons: [
          { label: 'Cancel', variant: 'outline', action: 'close' },
          { label: 'Exit', variant: 'destructive', action: 'confirm' }, // using submit to mean 'confirm exit' since mapped to result: true
        ],
      },
    });

    return dialogRef.afterClosed$.pipe(
      map((result) => {
        if (result?.action === 'confirm') {
          this.facade.clearAssessmentData();
          return true;
        }
        return false;
      }),
    );
  }

  loadQuestions() {
    this.isLoading.set(true);
    this.facade.loadAssessmentData().subscribe({
      next: (data) => {
        // If passed, questions might be empty, but details are there.
        this.questions.set(data.questions || []);
        this.courseDetails.set(data.details);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  selectOption(optionKey: string) {
    if (this.isSubmitted() || this.isLoading()) return;

    // Update local storage via facade
    const question = this.currentQuestion();
    if (!question) return;

    this.facade.updateQuestion(question.id, optionKey);

    // Update local state
    this.questions.update((questions) => {
      return questions.map((q) => {
        if (q.id === question.id) {
          return { ...q, user_selected_option: optionKey };
        }
        return q;
      });
    });
  }

  nextQuestion() {
    if (this.isLastQuestion()) {
      return;
    }
    this.currentQuestionIndex.update((i) => i + 1);
  }

  skipQuestion() {
    if (!this.isLastQuestion()) {
      this.currentQuestionIndex.update((i) => i + 1);
    }
  }

  prevQuestion() {
    if (this.currentQuestionIndex() > 0) {
      this.currentQuestionIndex.update((i) => i - 1);
    }
  }

  getOptionText(question: QuizQuestion, option: string): string {
    return (question as any)[`option_${option}`] || '';
  }

  submit() {
    // Validate if all questions have answers
    const questions = this.questions();
    const unanswered = questions.filter((q) => !q.user_selected_option);

    if (unanswered.length > 0) {
      // Show dialog if options are missing
      const dialogRef = this.dialog.open<
        UtilsDialog,
        { action?: DialogButton['action']; result: boolean; data?: any }
      >(UtilsDialog, {
        data: {
          title: 'Assessment Incomplete',
          content: [
            { type: 'text', value: 'Please answer the following questions before submitting:' },
            {
              type: 'clickable-list',
              items: unanswered.map((q) => ({
                label: `Question ${this.questions().indexOf(q) + 1}: ${q.question}`,
                value: this.questions().indexOf(q),
              })),
            },
          ],
          buttons: [{ label: 'Close', variant: 'default', action: 'close' }],
        },
      });

      dialogRef.afterClosed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
        if (result && result.data !== undefined) {
          this.currentQuestionIndex.set(result.data);
        }
      });
    } else {
      this.isLoading.set(true);
      const answersRecord: Record<number, string> = {};
      questions.forEach((q) => {
        if (q.user_selected_option) answersRecord[q.id] = q.user_selected_option;
      });

      this.facade.submitAssessment(answersRecord).subscribe({
        next: (response) => {
          this.isLoading.set(false);
          this.isSubmitted.set(true);
          this.facade.clearAssessmentData();

          if (response.status_code) {
            const data = response.data;
            const isPassed = data.is_passed;
            const score = data.result_details.my_percentage;
            const passingScore = data.result_details.pass_percentage;

            // Construct message
            let message: string;
            if (isPassed) {
              message = `You have successfully passed the assessment with a score of ${score}%.`;
            } else {
              message = `You scored ${score}%. Don't give up! Review the material and try again to achieve the passing score of ${passingScore}%.`;
            }

            this.openResultDialog({
              isPassed,
              score,
              message,
              passingScore,
            });
          }
        },
        error: () => {
          this.isLoading.set(false);
        },
      });
    }
  }

  private openResultDialog(data: AssessmentResultData) {
    const dialogRef = this.dialog.open<AssessmentResultDialog, AssessmentResultAction>(
      AssessmentResultDialog,
      {
        data,
        disableClose: true,
        maxWidth: '500px',
      },
    );

    dialogRef.afterClosed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((action) => {
      this.handleDialogAction(action);
    });
  }

  handleDialogAction(action: AssessmentResultAction | undefined) {
    if (!action) return;

    if (action === 'report') {
      this.router.navigate(['../report'], { relativeTo: this.route });
    } else if (action === 'course') {
      this.router.navigate(['../../..'], { relativeTo: this.route });
    } else if (action === 'retake') {
      const details = this.courseDetails();
      if (details) {
        this.utils.startFinalAssessment(
          String(details.id),
          details.title,
          details.course_type,
          details.exam_rules,
        );
      }
    }
  }
}
