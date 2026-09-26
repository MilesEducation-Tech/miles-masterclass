import { computed, DestroyRef, effect, inject, Service, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpContext, HttpResponse } from '@angular/common/http';
import { forkJoin, catchError, of, tap, type Observable } from 'rxjs';
import {
  fileNameFromContentDisposition,
  sanitizeFileName,
  saveBlob,
} from '@shared/utils/blob-download';
import { ActivatedRoute, Router } from '@angular/router';
import {
  RouteParams,
  RouteRequest,
  RouteResponse,
  SKIP_ERROR_NOTIFICATION,
} from '@core/models/http.model';
import {
  SelectCpeMode,
  SelectCpeModeData,
  SelectCpeModeResult,
} from '@features/offerings/dialogs/select-cpe-mode/select-cpe-mode';
import { UtilsDialog } from '@shared/dialogs/utils-dialog/utils-dialog';
import { ContentDetails, CourseChapter, normalizeBookmarkField } from '@core/models/course.model';
import { CourseContentResponse, MASTERCLASS_ROUTES } from '@core/models/masterclass.model';
import { ApiClient } from '@core/services/api-client/api-client';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { Dialog } from '@core/services/dialog/dialog';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import { Utils } from '@shared/services/utils';
import { CartStore } from '@core/services/cart/cart-store';
import { Analytics } from '@core/services/analytics/analytics';

// Extract types from routes for type safety
type CourseDetailsResponse = RouteResponse<typeof MASTERCLASS_ROUTES.getCourseDetails>;
type CourseDetailsParams = RouteParams<typeof MASTERCLASS_ROUTES.getCourseDetails>;

type CourseChapterResponse = RouteResponse<typeof MASTERCLASS_ROUTES.getCourseChapter>;
type CourseChapterParams = RouteParams<typeof MASTERCLASS_ROUTES.getCourseChapter>;

type SetCpeModeRequest = RouteRequest<typeof MASTERCLASS_ROUTES.setCpeMode>;
type SetCpeModeResponse = RouteResponse<typeof MASTERCLASS_ROUTES.setCpeMode>;

type CourseContentParams = RouteParams<typeof MASTERCLASS_ROUTES.getCourseContent>;

@Service({ autoProvided: false })
export class MasterclassFacade {
  // ... dependencies ...
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly http = inject(ApiClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(Dialog);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly utils = inject(Utils);
  // Only the cart-removal signal is needed here, and it lives in core so this
  // feature does not have to import the payment feature (PROMPT.md §3).
  private readonly cart = inject(CartStore);
  private readonly analytics = inject(Analytics);
  private readonly destroyRef = inject(DestroyRef);

  // Status signals ...
  readonly courseDetails = signal<ContentDetails | null>(null);
  readonly courseChapters = signal<CourseChapter[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** True while an exercise-file download is in flight (drives the resource-row spinner). */
  readonly downloadingExerciseFiles = signal(false);

  private readonly cartItemRemovedEffect = effect(() => {
    const removedCourseId = this.cart.cartItemRemoved();
    untracked(() => {
      if (removedCourseId && this.courseDetails()?.id === removedCourseId) {
        this.courseDetails.update((course) =>
          course ? { ...course, is_added_to_cart: false } : course,
        );
      }
    });
  });

  // ... (currentProgress computed) ...
  /**
   * Calculate overall course progress based on play_history data.
   * Returns percentage (0-100) of total course watched.
   */
  readonly currentProgress = computed(() => {
    const chapters = this.courseChapters();

    if (chapters.length === 0) {
      return 0;
    }

    let totalDuration = 0;
    let totalWatched = 0;

    chapters.forEach((chapter) => {
      const duration = chapter.video_duration || 0;
      totalDuration += duration;

      if (chapter.play_history?.is_completed) {
        // If chapter is completed, count full duration as watched
        totalWatched += duration;
      } else if (chapter.play_history?.time_status) {
        // Otherwise, use the time_status (watched seconds)
        totalWatched += Math.min(chapter.play_history.time_status, duration);
      }
    });

    if (totalDuration === 0) {
      return 0;
    }

    return Math.round((totalWatched / totalDuration) * 100);
  });

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
            this.analytics.trackEvent('view_item', {
              course_id: details.data.id,
              course_name: details.data.title,
              course_type: params.course_type,
            });
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

  // ... (launchCourse, navigateToChapter, isChapterComplete, getBlockingChapter, findInProgressChapter, selectCpeModeDialog methods unchanged) ...
  launchCourse() {
    // ponytail: bounced guests to `/auth/login` first. No session layer now.
    if (!this.courseDetails()?.cpe_mode_details) {
      this.selectCpeModeDialog();
      return;
    }
    this.analytics.trackEvent('start_course', {
      course_id: this.courseDetails()?.id,
      course_type: this.courseDetails()?.course_type,
    });
    this.navigateToChapter();
  }

  /**
   * Navigate to a specific chapter or find the in-progress chapter if no ID provided.
   *
   * @param chapterId - Optional chapter ID. If not provided, finds the in-progress chapter.
   */
  navigateToChapter(chapterId?: number): void {
    // ponytail: bounced guests to `/auth/login` first. No session layer now.
    const course = this.courseDetails();
    const chapters = this.courseChapters();

    if (!course || chapters.length === 0) {
      this.notification.error('Error', 'Course data not available');
      return;
    }

    // Resuming is gated too, not just the first-time picker. A course that
    // already has `cpe_mode_details` skips `selectCpeModeDialog` entirely, so
    // without this a lapsed subscriber could keep watching an in-progress
    // course. This is the single choke point for entering a chapter from the
    // UI — hero "Watch Now"/continue and every chapter row land here.
    if (!this.utils.requireCpeModeAccess(course)) return;

    if (!this.courseDetails()?.cpe_mode_details) {
      this.selectCpeModeDialog();
      return;
    }

    let targetChapter: (typeof chapters)[0] | undefined;

    if (chapterId !== undefined) {
      // Specific chapter requested - validate access
      const chapterIndex = chapters.findIndex((ch) => ch.id === chapterId);
      if (chapterIndex === -1) {
        this.notification.error('Error', 'Chapter not found');
        return;
      }

      targetChapter = chapters[chapterIndex];

      // Check if navigation is allowed
      const blockedBy = this.getBlockingChapter(chapterIndex);
      if (blockedBy) {
        this.notification.info(
          'Chapter Locked',
          `Please complete "${blockedBy.chapter_name}" before accessing this chapter.`,
        );
        return;
      }
    } else {
      // No specific chapter - find in-progress chapter
      targetChapter = this.findInProgressChapter();
    }

    if (!targetChapter) {
      targetChapter = chapters[0];
    }
    const titleSlug = this.utils.slugify(targetChapter.chapter_name);
    const currentRoute = this.router.url.split('/');
    this.router.navigate([...currentRoute, 'chapter', targetChapter.id, titleSlug]);

    // TODO: Navigate to the chapter player page
    // this.router.navigate([...currentRoute, 'watch', targetChapter.id]);
  }

  /**
   * Check if a chapter is completed based on play_history and chapter_wise_details.
   */
  private isChapterComplete(chapterId: number): boolean {
    const course = this.courseDetails();
    const chapters = this.courseChapters();
    const chapter = chapters.find((ch) => ch.id === chapterId);

    if (!chapter || !course) return false;

    const playHistoryComplete = !!chapter.play_history?.is_completed;
    const chapterDetails = course.chapter_wise_details?.find(
      (detail) => detail.chapter_id === chapterId,
    );
    const chapterDetailsComplete = chapterDetails ? chapterDetails.status : false;

    const isCpeMode = !!course.cpe_mode_details?.cpe_mode;

    // In CPE mode, both must be complete; otherwise just play_history
    return isCpeMode ? playHistoryComplete && chapterDetailsComplete : playHistoryComplete;
  }

  /**
   * Find the first incomplete chapter that blocks navigation to the target chapter.
   * Returns undefined if navigation is allowed.
   */
  private getBlockingChapter(targetIndex: number): CourseChapter | undefined {
    const course = this.courseDetails();
    const chapters = this.courseChapters();
    const isCpeMode = !!course?.cpe_mode_details?.cpe_mode;

    if (!isCpeMode) return undefined; // Non-CPE mode allows any chapter

    for (let i = 0; i < targetIndex; i++) {
      if (!this.isChapterComplete(chapters[i].id)) {
        return chapters[i];
      }
    }

    return undefined;
  }

  /**
   * Find the chapter the user should continue from.
   */
  private findInProgressChapter(): CourseChapter | undefined {
    const course = this.courseDetails();
    const chapters = this.courseChapters();

    if (!course || chapters.length === 0) return undefined;

    const isCpeMode = !!course.cpe_mode_details?.cpe_mode;

    if (isCpeMode) {
      // CPE Mode: Find first incomplete chapter
      return chapters.find((chapter) => !this.isChapterComplete(chapter.id));
    } else {
      // Non-CPE Mode: Find most recently watched incomplete chapter
      const incompleteChapters = chapters.filter((chapter) => !chapter.play_history?.is_completed);

      if (incompleteChapters.length === 0) return undefined;

      // Sort by updated_at descending
      const recentlyWatched = incompleteChapters
        .filter((ch) => ch.play_history?.updated_at)
        .sort((a, b) => {
          const dateA = new Date(a.play_history?.updated_at || 0).getTime();
          const dateB = new Date(b.play_history?.updated_at || 0).getTime();
          return dateB - dateA;
        })[0];

      return recentlyWatched || incompleteChapters[0];
    }
  }

  selectCpeModeDialog() {
    const course = this.courseDetails();
    if (!course) return;

    // CPE mode is the paid tier, so the picker itself is gated — an
    // unsubscribed learner gets the upsell instead of a choice they can't
    // act on. Guarded here rather than in each caller: `launchCourse` and
    // `navigateToChapter` (hero "Watch Now", podcast hero, every chapter row)
    // all reach the picker through this one method.
    if (!this.utils.requireCpeModeAccess(course)) return;

    const dialogRef = this.dialogs.open<SelectCpeModeData, SelectCpeModeResult>(SelectCpeMode, {
      data: {
        type: 'Masterclass',
        format: 'video',
        isFree: course.is_free,
        activePlan: course.active_plan,
      },
    });
    dialogRef.afterClosed.subscribe((result) => {
      if (result) {
        this.selectCpeMode(result.cpe_mode_status);
      }
    });
  }

  /**
   * Set the CPE mode for the current course via API.
   * On success and if navigate is true, reloads course data and navigates to the first chapter.
   */
  selectCpeMode(cpeModeStatus: boolean, navigate = true): void {
    const course = this.courseDetails();
    if (!course) {
      this.notification.error('Error', 'Course data not available');
      return;
    }

    this.loading.set(true);

    const body: SetCpeModeRequest = {
      masterclass_id: course.id,
      cpe_mode_status: cpeModeStatus,
    };

    this.http
      .post<SetCpeModeResponse>(MASTERCLASS_ROUTES.setCpeMode.path, body)
      .pipe(
        tap(() => {
          this.loading.set(false);
          this.notification.success(
            'Mode Selected',
            cpeModeStatus ? 'CPE Certification Mode enabled' : 'Preview Mode enabled',
          );
          // Update course details with new cpe_mode_details
          const date = new Date().toISOString();
          this.courseDetails.update((currentCourse) => {
            if (!currentCourse) return currentCourse;
            return {
              ...currentCourse,
              cpe_mode_details: {
                cpe_mode: cpeModeStatus,
                class_started: date,
                class_ends_on: date,
              },
              chapter_wise_details: currentCourse.chapter_wise_details.map((detail) => ({
                ...detail,
                status: false,
              })),
            };
          });
          this.courseChapters.update((currentChapters) => {
            return currentChapters.map((chapter) => ({
              ...chapter,
              play_history: null,
            }));
          });
          // Navigate to the first chapter after a brief delay for data to load
          if (navigate) setTimeout(() => this.navigateToChapter(), 500);
        }),
        catchError((err) => {
          this.loading.set(false);
          this.logger.error('Failed to set CPE mode', err);
          return of(null);
        }),
      )
      .subscribe();
  }

  toggleCpeMode(cpeModeStatus: boolean) {
    const isSwitchingToCpe = cpeModeStatus === true;

    // Only the upgrade needs a subscription. Switching *down* to Preview must
    // stay available to everyone — including a lapsed subscriber who needs a
    // way out of CPE mode.
    if (isSwitchingToCpe) {
      const course = this.courseDetails();
      if (!course) return;
      if (!this.utils.requireCpeModeAccess(course)) return;
    }

    const title = isSwitchingToCpe ? 'Switching to CPE Mode?' : 'Switching to Preview Mode?';
    const description = isSwitchingToCpe
      ? 'Heads up! Switching means starting fresh - your current progress will reset. Step into CPE Mode to earn your certificate and level up your learning journey.'
      : 'Heads up! Switching to Preview Mode means you can explore freely without CPE tracking. Your CPE progress will be paused.';

    const dialogRef = this.dialog.open<UtilsDialog>(UtilsDialog, {
      maxWidth: '100%',
      enterAnimationDuration: '300ms',
      exitAnimationDuration: '300ms',
      disableClose: false,
      data: {
        title,
        content: [{ type: 'text', value: description }],
        buttons: [{ label: 'Switch', variant: 'default', action: 'confirm' }],
      },
    });
    dialogRef.afterClosed$.subscribe((result) => {
      if (result) {
        this.selectCpeMode(cpeModeStatus, false);
      }
    });
  }

  clear() {
    this.courseDetails.set(null);
    this.courseChapters.set([]);
    this.loading.set(false);
    this.error.set(null);
  }

  /**
   * Fetch glossary or per-chapter transcript text from the course-content
   * endpoint. Pass a `chapter_id` to get that chapter's transcript;
   * omit it to get the course-level glossary. Caller is responsible for
   * subscription cleanup (`takeUntilDestroyed`).
   */
  fetchCourseContent(
    params: CourseContentParams,
    options: { skipErrorNotification?: boolean } = {},
  ): Observable<CourseContentResponse> {
    const requestOptions: { params: CourseContentParams; context?: HttpContext } = { params };
    if (options.skipErrorNotification) {
      requestOptions.context = new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);
    }
    return this.http.get<CourseContentResponse>(
      MASTERCLASS_ROUTES.getCourseContent.path,
      requestOptions,
    );
  }

  startFinalAssessment(courseId: string, courseTitle: string, courseType: string) {
    this.utils.startFinalAssessment(
      courseId,
      courseTitle,
      courseType,
      this.courseDetails()?.exam_rules!,
    );
  }

  openCertificateDownloadDialog() {
    const courseDetails = this.courseDetails();
    if (!courseDetails) return;

    this.utils.openCertificateDownloadDialog(courseDetails);
  }

  submitFeedback() {
    const courseDetails = this.courseDetails();
    if (!courseDetails) return;

    const url = this.router.url.split('?')[0];
    this.router.navigate([url, 'feedback'], { queryParams: { redirect: this.router.url } });
  }

  openShareDialog() {
    const courseDetails = this.courseDetails();
    if (!courseDetails) return;

    this.utils.openShareDialog();
  }

  /**
   * Open the AI Kit / additional-resources dialog for the current course.
   * Same flow the horizontal card uses — delegates to the shared Utils handler.
   */
  openAdditionalResources(): void {
    const courseDetails = this.courseDetails();
    if (!courseDetails) return;

    this.utils.openAdditionalResources(courseDetails.id);
  }

  /**
   * Download the exercise files for the current course as a single blob.
   * The endpoint streams the file directly, so we read it as a blob, derive the
   * filename from `Content-Disposition` (falling back to the course title), and
   * hand it to the shared `saveBlob` anchor-click path. Errors are surfaced here
   * (interceptor toast suppressed) to avoid a generic blob-parse double toast.
   */
  downloadExerciseFiles(courseType: string): void {
    const course = this.courseDetails();
    if (!course || this.downloadingExerciseFiles()) return;

    this.downloadingExerciseFiles.set(true);
    const path = MASTERCLASS_ROUTES.downloadExerciseFile.path.replace(':id', course.id.toString());

    this.http
      .get<HttpResponse<Blob>>(path, {
        params: { course_type: courseType },
        responseType: 'blob',
        observe: 'response',
        context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const blob = response.body;
          if (blob) {
            const fallback = `${sanitizeFileName(course.title) || 'Exercise Files'}.zip`;
            saveBlob(
              blob,
              fileNameFromContentDisposition(response.headers.get('content-disposition'), fallback),
            );
          }
          this.downloadingExerciseFiles.set(false);
        },
        error: (err) => {
          this.downloadingExerciseFiles.set(false);
          this.logger.error('Failed to download exercise files', err);
          this.notification.error(
            'Download Failed',
            'Could not download the exercise files. Please try again later.',
          );
        },
      });
  }
}
