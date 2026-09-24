import { computed, inject, Service, signal } from '@angular/core';
import { Logger } from '@core/services/logger/logger';
import { ApiClient } from '@core/services/api-client/api-client';
import { Dialog } from '@core/services/dialog/dialog';
import { NotificationService } from '@core/services/notification/notification';
import { Analytics } from '@core/services/analytics/analytics';
import { RouteParams, RouteResponse, RouteRequest } from '@core/models/http.model';
import { MASTERCLASS_ROUTES } from '@core/models/masterclass.model';
import { ContentDetails, CourseChapter, normalizeBookmarkField } from '@core/models/course.model';
import { catchError, forkJoin, of, tap } from 'rxjs';
import { Router } from '@angular/router';

type SetCpeModeRequest = RouteRequest<typeof MASTERCLASS_ROUTES.setCpeMode>;
type SetCpeModeResponse = RouteResponse<typeof MASTERCLASS_ROUTES.setCpeMode>;

// Extract types from routes for type safety
type CourseDetailsResponse = RouteResponse<typeof MASTERCLASS_ROUTES.getCourseDetails>;
type CourseDetailsParams = RouteParams<typeof MASTERCLASS_ROUTES.getCourseDetails>;

type CourseChapterResponse = RouteResponse<typeof MASTERCLASS_ROUTES.getCourseChapter>;
type CourseChapterParams = RouteParams<typeof MASTERCLASS_ROUTES.getCourseChapter>;

type MyClassActivityRequest = RouteRequest<typeof MASTERCLASS_ROUTES.myClassActivity>;
type MyClassActivityResponse = RouteResponse<typeof MASTERCLASS_ROUTES.myClassActivity>;

type SubmitQuizAnswerRequest = RouteRequest<typeof MASTERCLASS_ROUTES.submitQuizAnswer>;
type SubmitQuizAnswerResponse = RouteResponse<typeof MASTERCLASS_ROUTES.submitQuizAnswer>;

type ChapterQuizReportResponse = RouteResponse<typeof MASTERCLASS_ROUTES.chapterQuizReport>;
type ChapterQuizReportParams = RouteParams<typeof MASTERCLASS_ROUTES.chapterQuizReport>;

@Service({ autoProvided: false })
export class ChapterFacade {
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly http = inject(ApiClient);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly analytics = inject(Analytics);

  // State signals with proper types
  readonly courseDetails = signal<ContentDetails | null>(null);
  readonly courseChapters = signal<CourseChapter[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /**
   * Load course details and chapters in parallel.
   * HTTP responses are automatically cached by Angular's HTTP transfer cache.
   * @param params - Course ID and type parameters
   */
  loadCourse(params: CourseDetailsParams & Pick<CourseChapterParams, 'course_type'>): void {
    this.loading.set(true);
    this.error.set(null);

    const courseDetailsParams: CourseDetailsParams = { id: params.id };
    const courseChapterParams: CourseChapterParams = {
      id: params.id,
      course_type: params.course_type,
    };

    forkJoin({
      details: this.http.get<CourseDetailsResponse>(
        MASTERCLASS_ROUTES.getCourseDetails.path.replace(':course_type', params.course_type),
        {
          params: courseDetailsParams,
        },
      ),
      chapters: this.http.get<CourseChapterResponse>(MASTERCLASS_ROUTES.getCourseChapter.path, {
        params: courseChapterParams,
      }),
    })
      .pipe(
        tap(({ details, chapters }) => {
          if (details?.data) {
            details.data.learning_objective_list = details.data.learning_objectives.split('\r\n');
            this.courseDetails.set(normalizeBookmarkField(details.data));
          }
          if (chapters?.data) {
            this.courseChapters.set(chapters.data);
          }
          this.loading.set(false);
        }),
        catchError((err) => {
          this.loading.set(false);
          this.error.set(err?.error?.message || 'Failed to load course data');
          this.logger.error('Failed to load course', err);
          return of(null);
        }),
      )
      .subscribe();
  }

  readonly selectedChapterId = signal<number | null>(null);

  readonly chapterNavigation = computed(() => {
    const chapters = this.courseChapters();
    const chapterId = this.selectedChapterId();

    if (!chapterId) {
      return { prev: null, current: null, next: null, currentIndex: -1 };
    }

    const currentIndex = chapters.findIndex((c) => c.id === chapterId);

    if (currentIndex === -1) {
      return { prev: null, current: null, next: null, currentIndex: -1 };
    }

    return {
      prev: currentIndex > 0 ? chapters[currentIndex - 1] : null,
      current: chapters[currentIndex],
      next: currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null,
      currentIndex,
    };
  });

  clear() {
    this.courseDetails.set(null);
    this.courseChapters.set([]);
    this.loading.set(false);
    this.error.set(null);
    this.selectedChapterId.set(null);
  }

  /**
   * Track user activity for CPE mode.
   *
   * ponytail: had a (already dead) guest short-circuit on `auth.isLoggedIn()`.
   */
  trackActivity(chapterId: number, timeStatus: number, event: 'heartbeat' | 'completed' | 'exit') {
    const body: MyClassActivityRequest = {
      chapter_id: chapterId,
      time_status: timeStatus,
      event,
    };

    const request = this.http
      .post<MyClassActivityResponse>(MASTERCLASS_ROUTES.myClassActivity.path, body)
      .pipe(
        tap(() => {
          if (event === 'completed') {
            const before = this.courseChapters();
            const wasAllComplete =
              before.length > 0 && before.every((ch) => ch.play_history?.is_completed);
            this.updateLocalChapterCompletion(chapterId);
            const course = this.courseDetails();
            this.analytics.trackEvent('chapter_complete', {
              course_id: course?.id,
              chapter_id: chapterId,
              course_type: course?.course_type,
            });
            // Course completes the moment the final outstanding chapter does.
            const after = this.courseChapters();
            const nowAllComplete =
              after.length > 0 && after.every((ch) => ch.play_history?.is_completed);
            if (!wasAllComplete && nowAllComplete) {
              this.analytics.trackEvent('course_complete', {
                course_id: course?.id,
                course_type: course?.course_type,
              });
            }
          }
        }),
      );

    return request;
  }

  /**
   * Submit quiz answer
   */
  submitQuizAnswer(answer: string, quizQuestionId: number) {
    const body: SubmitQuizAnswerRequest = {
      answer,
      quiz_question: quizQuestionId,
    };

    return this.http.post<SubmitQuizAnswerResponse>(MASTERCLASS_ROUTES.submitQuizAnswer.path, body);
  }

  private updateLocalChapterCompletion(chapterId: number) {
    this.courseChapters.update((chapters) =>
      chapters.map((chapter) => {
        if (chapter.id === chapterId) {
          const existingHistory = chapter.play_history || {
            id: 0,
            time_status: 0,
            app_type: 'WA',
            updated_at: new Date().toISOString(),
            master_class: null,
            nano_learning: 0,
            chapter: chapterId,
            user: 0,
            doc_page: null,
            updated_by: null,
            is_completed: false,
          };

          return {
            ...chapter,
            play_history: {
              ...existingHistory,
              is_completed: true,
            },
          };
        }
        return chapter;
      }),
    );

    if (!this.courseDetails()?.cpe_mode_details?.cpe_mode) {
      this.updateChapterStatus(chapterId);
    }
  }

  updateChapterStatus(chapterId: number) {
    this.courseDetails.update((details) => {
      if (!details) return null;
      return {
        ...details,
        chapter_wise_details: details.chapter_wise_details.map((cd) =>
          cd.chapter_id === chapterId ? { ...cd, status: true } : cd,
        ),
      };
    });
  }

  fetchQuizReport(chapterId: number) {
    const details = this.courseDetails();
    const chapters = this.courseChapters();

    if (!details || !chapters.length) return;

    const chapter = chapters.find((c) => c.id === chapterId);
    if (!chapter) return;

    // Identify eligible chapter: completed (play_history) AND unlocked (chapter_wise_details)
    const isCompleted = chapter.play_history?.is_completed;
    const statusDetail = details.chapter_wise_details.find((cd) => cd.chapter_id === chapterId);

    if (isCompleted && statusDetail?.status) {
      const params: ChapterQuizReportParams = { chapter_id: chapterId };
      this.http
        .get<ChapterQuizReportResponse>(MASTERCLASS_ROUTES.chapterQuizReport.path, {
          params,
        })
        .pipe(
          catchError(() => of(null)),
          tap((response) => {
            if (response && response.data) {
              this.updateChapterQuestions(chapterId, response.data);
            }
          }),
        )
        .subscribe();
    }
  }

  private updateChapterQuestions(chapterId: number, reportItems: any[]) {
    this.courseChapters.update((currentChapters) => {
      return currentChapters.map((chapter) => {
        if (chapter.id !== chapterId) return chapter;

        const newQuestions = reportItems.map((item) => ({
          id: 0,
          updated_at: '',
          question: item.question,
          user_selected_option: item.user_selected_option,
          option_a: item.option_a,
          description_option_a: item.option_description_a,
          option_b: item.option_b,
          description_option_b: item.option_description_b,
          option_c: item.option_c,
          description_option_c: item.option_description_c,
          option_d: item.option_d,
          description_option_d: item.option_description_d,
          correct_option: item.correct_option,
          status: true,
          updated_by: null,
          chapter: item.chapter_id,
        }));

        return {
          ...chapter,
          quiz_details: {
            ...chapter.quiz_details,
            questions: newQuestions,
            total_questions: newQuestions.length,
            overall_chapter_questions: newQuestions.length,
          },
        };
      });
    });
  }
  selectCpeMode(cpeModeStatus: boolean) {
    const course = this.courseDetails();
    if (!course) {
      this.notification.error('Error', 'Course data not available');
      return of(null);
    }

    this.loading.set(true);

    const body: SetCpeModeRequest = {
      masterclass_id: course.id,
      cpe_mode_status: cpeModeStatus,
    };

    return this.http.post<SetCpeModeResponse>(MASTERCLASS_ROUTES.setCpeMode.path, body).pipe(
      tap(() => {
        this.loading.set(false);
        this.notification.success(
          'Mode Selected',
          cpeModeStatus ? 'CPE Certification Mode enabled' : 'Preview Mode enabled',
        );
        const date = new Date().toISOString();
        this.courseDetails.update((current) => {
          if (!current) return current;
          return {
            ...current,
            cpe_mode_details: {
              cpe_mode: cpeModeStatus,
              class_started: date,
              class_ends_on: date,
            },
            chapter_wise_details: current.chapter_wise_details.map((detail) => ({
              ...detail,
              status: false,
            })),
          };
        });
        this.courseChapters.update((chapters) =>
          chapters.map((chapter) => ({
            ...chapter,
            play_history: null,
          })),
        );
      }),
      catchError((err) => {
        this.loading.set(false);
        this.logger.error('Failed to set CPE mode', err);
        return of(null);
      }),
    );
  }

  updateUserSelectedOption(chapterId: number, questionId: number, selectedOption: string) {
    this.courseChapters.update((chapters) =>
      chapters.map((chapter) => {
        if (chapter.id !== chapterId) return chapter;

        const updatedQuestions = chapter.quiz_details.questions.map((q) =>
          q.id === questionId ? { ...q, user_selected_option: selectedOption } : q,
        );

        return {
          ...chapter,
          quiz_details: {
            ...chapter.quiz_details,
            questions: updatedQuestions,
          },
        };
      }),
    );
  }
}
