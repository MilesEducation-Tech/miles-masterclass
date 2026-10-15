import { isPlatformBrowser } from '@angular/common';
import { HttpContext, httpResource } from '@angular/common/http';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  PLATFORM_ID,
  Service,
  signal,
  untracked,
} from '@angular/core';
import { SKIP_LOADING } from '@core/models/http.model';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import {
  CHAPTER_COPY,
  QUIZ_AUTO_ADVANCE_SECONDS,
  QUIZ_COPY,
} from '@features/offerings/constants/course-detail';
import {
  ChapterQuiz,
  gradeOfAnswered,
  gradeOfResult,
  parseChapterQuiz,
  QuizGrade,
} from '@features/offerings/models/chapter-quiz.model';
import {
  MasterclassChapterLink,
  readCourseStepRefusal,
} from '@features/offerings/models/course-detail.model';
import { CourseChapterFacade } from '@features/offerings/services/course-chapter-facade';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';

/**
 * The chapter quiz on the chapter page: `quiz-questions/` and `quiz-submit/`.
 *
 * Page-scoped beside `CourseChapterFacade`, which it reads and calls (that one
 * never knows about the quiz). CPE mode only: the quiz opens by itself when a
 * chapter's video is done and its quiz isn't, and again when the video ends;
 * "Take the quiz" opens it by hand. The server grades every answer. After the
 * last one the course is re-read, which opens the next chapter, and the quiz
 * moves on to it after `QUIZ_AUTO_ADVANCE_SECONDS`.
 */
@Service({ autoProvided: false })
export class CourseChapterQuizFacade {
  private readonly chapters = inject(CourseChapterFacade);
  private readonly detail = inject(CourseDetailFacade);
  private readonly notification = inject(NotificationService);
  private readonly logger = inject(Logger);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** The chapter whose quiz is open; `null` while the video shows. */
  private readonly openFor = signal<string | null>(null);
  /** The chapter on screen, to tell a chapter change from a re-read of the same one. */
  private shownChapterId: string | null = null;
  /**
   * The chapter whose quiz already opened by itself on this visit, so "Watch
   * again" isn't overruled. A chapter change clears it: coming back to a chapter
   * (a locked one redirects here) opens its pending quiz again.
   */
  private autoOpenedFor: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  private readonly questionsResource = httpResource<ChapterQuiz>(
    () => {
      const chapterId = this.openFor();
      const url = chapterId ? this.detail.quizQuestionsUrl(chapterId) : null;
      // The panel shows its own loading state.
      return url ? { url, context: new HttpContext().set(SKIP_LOADING, true) } : undefined;
    },
    { parse: parseChapterQuiz },
  );

  /** CPE mode, and the chapter on screen has a quiz still to pass. */
  readonly isPending = computed(() => {
    const chapter = this.chapters.current();
    return (
      !!chapter &&
      this.chapters.isCpeMode() &&
      chapter.show_quiz &&
      !chapter.user_chapter_progress.is_mcq_completed
    );
  });

  readonly isOpen = computed(() => {
    const open = this.openFor();
    return open !== null && open === this.chapters.current()?.id;
  });

  readonly isLoading = computed(() => this.questionsResource.isLoading());

  readonly questions = computed(() =>
    this.questionsResource.hasValue() ? (this.questionsResource.value()?.questions ?? []) : [],
  );

  /** Graded answers by question id: a resumed attempt's, then each submit's. */
  private readonly grades = linkedSignal<ChapterQuiz | undefined, Record<string, QuizGrade>>({
    source: () => (this.questionsResource.hasValue() ? this.questionsResource.value() : undefined),
    computation: (quiz) => {
      const seeded: Record<string, QuizGrade> = {};
      for (const question of quiz?.questions ?? []) {
        const grade = gradeOfAnswered(question);
        if (grade) seeded[question.id] = grade;
      }
      return seeded;
    },
  });

  /** The question on screen. A fresh read starts at the first one not yet answered. */
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

  /** An answer is with the server. */
  readonly submitting = signal(false);
  /** The last answer is in and the chapter's quiz is done. */
  readonly completed = signal(false);
  /** Seconds left before moving on; `null` while not counting. */
  readonly countdown = signal<number | null>(null);
  /** The course re-read that follows the last answer: moving on waits for its locks. */
  readonly refreshing = computed(() => this.completed() && this.detail.isLoading());
  readonly hasNextChapter = computed(() => !!this.chapters.navigation().next);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopCountdown());

    // One effect, so the order is fixed: a chapter change first closes the
    // previous chapter's quiz, then a chapter whose video is done and quiz isn't
    // opens on its quiz, once per visit.
    effect(() => {
      const chapter = this.chapters.current();
      const due = this.isPending() && !!chapter?.user_chapter_progress.is_video_completed;
      untracked(() => {
        const id = chapter?.id ?? null;
        if (id !== this.shownChapterId) {
          this.shownChapterId = id;
          this.autoOpenedFor = null;
          if (this.openFor() !== null && this.openFor() !== id) this.reset();
        }
        if (!chapter || !due || !this.isBrowser || this.autoOpenedFor === chapter.id) return;
        this.autoOpenedFor = chapter.id;
        this.open();
      });
    });

    // A refused read: the same answers as the chapter steps, plus the quiz's own.
    effect(() => {
      const error = this.questionsResource.error();
      if (!error) return;
      untracked(() => this.readFailed(error));
    });

    // Count down once the re-read after the last answer has landed.
    effect(() => {
      if (this.completed() && !this.detail.isLoading() && this.countdown() === null) {
        untracked(() => this.startCountdown());
      }
    });
  }

  /** "Take the quiz", or the video's end: open the chapter on screen's quiz. */
  open(): void {
    const chapter = this.chapters.current();
    if (!chapter || !this.isPending()) return;
    this.completed.set(false);
    this.stopCountdown();
    if (this.openFor() === chapter.id) this.questionsResource.reload();
    else this.openFor.set(chapter.id);
  }

  /**
   * The video ended: its quiz comes next, if it is still to pass. Also after
   * "Watch again", which the once-per-chapter opening above doesn't cover.
   */
  videoEnded(): void {
    const chapter = this.chapters.current();
    if (chapter) this.autoOpenedFor = chapter.id;
    if (!this.isOpen()) this.open();
  }

  /** "Watch again": back to the video; the quiz keeps its answers on the server. */
  close(): void {
    this.reset();
  }

  /** Send one answer; the server grades it. */
  async answer(optionIds: string[]): Promise<void> {
    const chapterId = this.openFor();
    const question = this.question();
    if (!chapterId || !question || this.grade() || this.submitting() || !optionIds.length) return;

    this.submitting.set(true);
    try {
      const outcome = await this.detail.submitQuizAnswer(chapterId, {
        question_id: question.id,
        selected_option_ids: optionIds,
      });
      if (this.openFor() !== chapterId) return;
      if (outcome.reset_required) {
        this.notification.info(CHAPTER_COPY.enrolmentReset.title, CHAPTER_COPY.enrolmentReset.body);
        this.reset();
        this.detail.reload();
        return;
      }
      this.grades.update((grades) => ({
        ...grades,
        [question.id]: gradeOfResult(optionIds, outcome),
      }));
      if (outcome.is_mcq_completed) {
        this.completed.set(true);
        // The submit doesn't carry the lock ladder; the course re-read does.
        this.detail.reload();
      }
    } catch (error) {
      this.logger.error('[CourseChapterQuiz] quiz-submit failed', error);
      this.answerFailed(error);
    } finally {
      this.submitting.set(false);
    }
  }

  /** Up Next: a next chapter this chapter's quiz still holds opens the quiz instead. */
  goTo(chapter: MasterclassChapterLink): void {
    if (chapter.is_locked && this.isPending()) this.open();
    else this.chapters.goTo(chapter);
  }

  next(): void {
    if (!this.isLast()) this.index.update((index) => index + 1);
  }

  previous(): void {
    if (this.index() > 0) this.index.update((index) => index - 1);
  }

  /** On to the next chapter, or back to the course page after the last one. */
  proceed(): void {
    if (this.refreshing()) return;
    const next = this.chapters.navigation().next;
    this.reset();
    if (next) this.chapters.goTo(next);
    else this.chapters.backToCourse();
  }

  private reset(): void {
    this.stopCountdown();
    this.completed.set(false);
    this.openFor.set(null);
  }

  private startCountdown(): void {
    this.stopCountdown();
    this.countdown.set(QUIZ_AUTO_ADVANCE_SECONDS);
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

  /** A refused `quiz-questions/` read. */
  private readFailed(error: unknown): void {
    const refusal = readCourseStepRefusal(error);
    this.logger.error('[CourseChapterQuiz] quiz-questions failed', error);
    this.reset();
    if (refusal.reason === 'already_completed') {
      this.detail.reload();
    } else if (refusal.status === 404) {
      this.notification.info(QUIZ_COPY.noQuiz.title, QUIZ_COPY.noQuiz.body);
    } else if (refusal.reason === 'preview_mode') {
      this.notification.info(
        QUIZ_COPY.loadFailed.title,
        refusal.message ?? QUIZ_COPY.loadFailed.body,
      );
    } else if (refusal.status === 403 || refusal.status === 409) {
      this.chapters.refuse(error);
    } else {
      this.notification.error(QUIZ_COPY.loadFailed.title, QUIZ_COPY.loadFailed.body);
    }
  }

  /**
   * A refused answer. A `400` is a question this attempt already answered or no
   * longer holds (another tab, say), so the questions are re-read rather than
   * failing; the ladder's refusals leave as the chapter steps do.
   */
  private answerFailed(error: unknown): void {
    const refusal = readCourseStepRefusal(error);
    if (refusal.reason === 'already_completed') {
      this.reset();
      this.detail.reload();
    } else if (refusal.status === 400) {
      this.questionsResource.reload();
    } else if (refusal.status === 403 || refusal.status === 409) {
      this.reset();
      this.chapters.refuse(error);
    } else {
      this.notification.error(QUIZ_COPY.answerFailed.title, QUIZ_COPY.answerFailed.body);
    }
  }
}
