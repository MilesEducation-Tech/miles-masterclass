import { HttpContext, HttpErrorResponse, httpResource } from '@angular/common/http';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  linkedSignal,
  Service,
  signal,
  untracked,
} from '@angular/core';
import { NgpDialogManager, NgpDialogRef } from 'ng-primitives/dialog';
import { firstValueFrom } from 'rxjs';
import { CommonResponse, SKIP_ERROR_NOTIFICATION, SKIP_LOADING } from '@core/models/http.model';
import { ApiClient, apiUrl } from '@core/services/api-client/api-client';
import { NotificationService } from '@core/services/notification/notification';
import { AI_LABS_API } from '@features/ai-labs/constants/ai-labs-api';
import {
  AiLabQuiz,
  AiLabQuizAnswerResult,
  AiLabQuizGrade,
  gradeOfAnsweredLabQuestion,
  gradeOfLabQuizResult,
} from '@features/ai-labs/models/ai-labs.model';
import { AiLabCourseFacade } from '@features/ai-labs/services/ai-lab-course-facade';

/** Seconds the finished quiz waits before it closes itself, as the masterclass quiz does. */
export const LAB_QUIZ_AUTO_ADVANCE_SECONDS = 10;

/** The masterclass quiz's copy, for the lab's. */
export const LAB_QUIZ_COPY = {
  watchAgain: 'Watch again',
  back: 'Back',
  next: 'Next',
  submit: 'Submit answer',
  takeAssessment: 'Take Final Assessment',
  correctAnswer: 'Correct answer',
  yourAnswer: 'Your answer',
  explanation: 'Explanation',
  correct: 'Correct',
  incorrect: 'Not quite',
  complete: 'Quiz complete',
  loadFailed: {
    title: 'Quiz unavailable',
    body: "We couldn't load this lab's quiz. Please try again.",
  },
  answerFailed: {
    title: 'Answer not saved',
    body: "We couldn't save that answer. Please try again.",
  },
} as const;

const QUIET = () => new HttpContext().set(SKIP_LOADING, true).set(SKIP_ERROR_NOTIFICATION, true);

/**
 * The lab quiz, shown in the lab page's video frame while it's open — the masterclass chapter
 * quiz (`CourseChapterQuizFacade`) on the lab routes.
 *
 * Route-scoped beside `AiLabCourseFacade`, which it reads the lab id and progress from. Questions
 * are read only while the quiz is open; a resumed form brings back the grades of answers already
 * given, and the panel opens on the first unanswered question. Each answer goes to the server on
 * its own and comes back graded. The last answer completes the quiz: progress is re-read so the
 * CTA moves on to the exam, and after a 10-second countdown the panel closes.
 */
@Service({ autoProvided: false })
export class AiLabQuizFacade {
  private readonly api = inject(ApiClient);
  private readonly course = inject(AiLabCourseFacade);
  private readonly notification = inject(NotificationService);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly injector = inject(Injector);

  /** The quiz pop-up while it's open — `isOpen` and it move together. */
  private dialogRef: NgpDialogRef | null = null;

  private readonly openFor = signal<string | null>(null);
  private timer: ReturnType<typeof setInterval> | null = null;

  private readonly questionsRes = httpResource<AiLabQuiz | null>(
    () => {
      const id = this.openFor();
      return id
        ? { url: apiUrl(`${AI_LABS_API.quizQuestions}${id}/`), context: QUIET() }
        : undefined;
    },
    { defaultValue: null, parse: (raw) => (raw as CommonResponse<AiLabQuiz> | null)?.data ?? null },
  );

  readonly isOpen = computed(() => this.openFor() !== null);
  readonly isLoading = computed(() => this.questionsRes.isLoading());

  readonly questions = computed(() =>
    this.questionsRes.hasValue() ? (this.questionsRes.value()?.questions ?? []) : [],
  );

  /** Grades by question id: seeded from a resumed form, then added to as answers come back. */
  private readonly grades = linkedSignal<AiLabQuiz | null, Record<string, AiLabQuizGrade>>({
    source: () => (this.questionsRes.hasValue() ? this.questionsRes.value() : null),
    computation: (quiz) => {
      const seeded: Record<string, AiLabQuizGrade> = {};
      for (const question of quiz?.questions ?? []) {
        const grade = gradeOfAnsweredLabQuestion(question);
        if (grade) seeded[question.id] = grade;
      }
      return seeded;
    },
  });

  /** Opens on the first unanswered question — where a resumed attempt left off. */
  readonly index = linkedSignal(() => {
    const questions = this.questions();
    const first = questions.findIndex((question) => !question.is_answered);
    return first === -1 ? Math.max(questions.length - 1, 0) : first;
  });

  readonly question = computed(() => this.questions()[this.index()] ?? null);
  readonly grade = computed(() => {
    const question = this.question();
    return question ? (this.grades()[question.id] ?? null) : null;
  });
  readonly isLast = computed(() => this.index() >= this.questions().length - 1);
  readonly progressLabel = computed(
    () => `Question ${this.index() + 1} of ${this.questions().length}`,
  );

  readonly submitting = signal(false);
  readonly completed = signal(false);
  readonly countdown = signal<number | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopCountdown());

    effect(() => {
      const error = this.questionsRes.error();
      if (error) untracked(() => this.readFailed(error));
    });

    effect(() => {
      if (this.completed() && this.countdown() === null) untracked(() => this.startCountdown());
    });
  }

  /** The CTA's Take Quiz, and the video's end. Re-reads when it's already open on this lab. */
  open(): void {
    const id = this.course.id();
    if (!id) return;
    this.completed.set(false);
    this.stopCountdown();
    if (this.openFor() === id) this.questionsRes.reload();
    else this.openFor.set(id);
    void this.showDialog();
  }

  /** "Watch again", the pop-up's own close, and on to the assessment. */
  close(): void {
    this.stopCountdown();
    this.completed.set(false);
    this.openFor.set(null);
    const ref = this.dialogRef;
    this.dialogRef = null;
    ref?.close();
  }

  /**
   * The quiz in a pop-up, as micro-learning shows it. Loaded on demand; opened with this facade's
   * injector so the dialog's `AiLabQuiz` reads this instance. Closed from inside (backdrop, Esc, ×),
   * it closes the quiz too.
   */
  private async showDialog(): Promise<void> {
    if (this.dialogRef) return;
    const { AiLabQuizDialog } =
      await import('@features/ai-labs/dialogs/ai-lab-quiz-dialog/ai-lab-quiz-dialog');
    if (!this.isOpen() || this.dialogRef) return;
    const ref = this.dialogs.open(AiLabQuizDialog, { injector: this.injector });
    this.dialogRef = ref;
    ref.afterClosed.subscribe(() => {
      if (this.dialogRef !== ref) return;
      this.dialogRef = null;
      this.close();
    });
  }

  async answer(optionIds: string[]): Promise<void> {
    const id = this.openFor();
    const question = this.question();
    if (!id || !question || this.grade() || this.submitting() || !optionIds.length) return;

    this.submitting.set(true);
    try {
      const res = await firstValueFrom(
        this.api.call(
          AI_LABS_API.quizSubmit,
          { ai_lab_course_id: id, question_id: question.id, selected_option_ids: optionIds },
          { context: QUIET() },
        ),
      );
      if (this.openFor() !== id) return;
      const result = res.data as AiLabQuizAnswerResult;
      this.grades.update((grades) => ({
        ...grades,
        [question.id]: gradeOfLabQuizResult(optionIds, result),
      }));
      if (result.is_quiz_completed) {
        this.completed.set(true);
        this.course.refreshProgress();
      }
    } catch (error) {
      this.answerFailed(error);
    } finally {
      this.submitting.set(false);
    }
  }

  next(): void {
    if (!this.isLast()) this.index.update((index) => index + 1);
  }

  previous(): void {
    if (this.index() > 0) this.index.update((index) => index - 1);
  }

  /**
   * The completed quiz's button and the countdown's end: on to the final assessment, as the
   * masterclass quiz does after the last chapter — through the same rules pop-up the CTA opens.
   */
  proceed(): void {
    this.close();
    void this.course.startExam();
  }

  private startCountdown(): void {
    this.stopCountdown();
    this.countdown.set(LAB_QUIZ_AUTO_ADVANCE_SECONDS);
    this.timer = setInterval(() => {
      const left = (this.countdown() ?? 1) - 1;
      if (left > 0) this.countdown.set(left);
      else this.proceed();
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.countdown.set(null);
  }

  /**
   * A refusal on the read. `already_completed` just means progress is behind — re-read it. The
   * other refusals (`video_not_complete`, `no_quiz_config`) carry a sentence for the learner.
   */
  private readFailed(error: unknown): void {
    const { reason, message } = refusalOf(error);
    this.close();
    if (reason === 'already_completed') {
      this.course.refreshProgress();
      return;
    }
    this.notification.info(
      LAB_QUIZ_COPY.loadFailed.title,
      message ?? LAB_QUIZ_COPY.loadFailed.body,
    );
  }

  /**
   * A refusal on an answer. `already_answered` means the form is stale — re-read it, which brings
   * the grade back; `already_completed` means progress is.
   */
  private answerFailed(error: unknown): void {
    const { reason, message } = refusalOf(error);
    if (reason === 'already_answered') {
      this.questionsRes.reload();
    } else if (reason === 'already_completed') {
      this.close();
      this.course.refreshProgress();
    } else {
      this.notification.error(
        LAB_QUIZ_COPY.answerFailed.title,
        message ?? LAB_QUIZ_COPY.answerFailed.body,
      );
    }
  }
}

/** `data.reason` and the envelope's sentence off an error. */
function refusalOf(error: unknown): { reason: string | null; message: string | null } {
  const body = error instanceof HttpErrorResponse ? (error.error as CommonResponse<unknown>) : null;
  const data = body?.data as { reason?: unknown } | null | undefined;
  return {
    reason: typeof data?.reason === 'string' ? data.reason : null,
    message: body?.message || null,
  };
}
