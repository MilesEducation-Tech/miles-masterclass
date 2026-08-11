import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Backward } from '../../../../../shared/components/backward/backward';
import { Button } from '../../../../../shared/components/ui/button/button';
import { Dialog } from '../../../../../shared/core/services/dialog/dialog';
import {
  UtilsDialog,
  DialogButton,
} from '../../../../../shared/components/dialog/utils-dialog/utils-dialog';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CanDeactivateComponent } from '../../../../../shared/core/guards/can-deactivate-exam-guard';
import {
  AssessmentResultDialog,
  AssessmentResultAction,
  AssessmentResultData,
} from '../../../../../shared/components/dialog/assessment-result-dialog/assessment-result-dialog';
import { Utils } from '../../../../../shared/core/services/utils/utils';
import { Logger } from '../../../../../shared/core/services/logger/logger';
import { ActivatedRoute, Router } from '@angular/router';
import { PageLoading } from '../../../../../shared/components/ui/page-loading/page-loading';
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
  /**
   * CAIRA identifies an attempt by `(user, course, attempt_number)`. There is
   * no session id, so the route no longer carries one — the course is the whole
   * key.
   */
  courseId = input<string>();

  private readonly dialog = inject(Dialog);
  private readonly utils = inject(Utils);
  private readonly logger = inject(Logger);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  courseNavigation = signal<string>('../../..');

  /**
   * ponytail: the whole exam is #9/#10 (P5) and nothing is bound yet. The
   * facade stub this replaces held `null` for every member, so `isAssessmentPassed()`
   * threw on `beforeunload` and `loadAssessmentData().subscribe` threw on open.
   * Local signals keep the page renderable; each seam below names its endpoint.
   */
  isAssessmentPassed = signal(false);

  // State
  questions = signal<any[]>([]);
  courseDetails = signal<any | null>(null);
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
      if (!courseId) return;
      // ponytail: the question set is #9/#10 (P5) and nothing fetches it yet.
      // The facade this replaces held `courseId: null`, so `.set()` on it threw
      // before the empty state could render. Resetting local state and letting
      // the template show "no questions" is the honest stand-in.
      this.currentQuestionIndex.set(0);
      this.questions.set([]);
      this.isSubmitted.set(false);
      this.loadQuestions();
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
          this.questions.set([]);
          return true;
        }
        return false;
      }),
    );
  }

  /** ponytail: #9 `GET .../assessment/questions/` fills `questions` here. */
  loadQuestions() {
    this.isLoading.set(false);
    this.questions.set([]);
    this.logger.warn('Final assessment questions are not bound', { courseId: this.courseId() });
  }

  selectOption(optionKey: string) {
    if (this.isSubmitted() || this.isLoading()) return;

    // Update local storage via facade
    const question = this.currentQuestion();
    if (!question) return;

    // Answers stay in memory by design — the route is client-rendered and #10
    // takes the whole set in one submit.
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

  getOptionText(question: any, option: string): string {
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

      // ponytail: #10 `POST .../assessment/submit/` takes exactly
      // `questions_to_show` answers and decides pass/fail server-side — never
      // compare a threshold here. Its 403 `cool_off_active` carries
      // `cool_off_minutes_remaining` and must render as a countdown, not a
      // toast. Until it is bound there is nothing to submit to.
      this.isLoading.set(false);
      this.logger.warn('Final assessment submit is not bound', {
        courseId: this.courseId(),
        answers: Object.keys(answersRecord).length,
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
