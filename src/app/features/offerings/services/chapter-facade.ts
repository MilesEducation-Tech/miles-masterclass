import { computed, inject, Service, signal } from '@angular/core';
import { Logger } from '@core/services/logger/logger';
import { ApiClient } from '@core/services/api-client/api-client';
import { NotificationService } from '@core/services/notification/notification';
import { HttpContext } from '@angular/common/http';
import { RouteResponse, RouteRequest, SKIP_LOADING } from '@core/models/http.model';
import { MASTERCLASS_ROUTES } from '@core/models/masterclass.model';
import { courseLoad, CourseLoadParams } from '../utils/course-load';
import { catchError, of, tap } from 'rxjs';
import { Router } from '@angular/router';

type SetCpeModeRequest = RouteRequest<typeof MASTERCLASS_ROUTES.setCpeMode>;
type SetCpeModeResponse = RouteResponse<typeof MASTERCLASS_ROUTES.setCpeMode>;

type MyClassActivityRequest = RouteRequest<typeof MASTERCLASS_ROUTES.myClassActivity>;
type MyClassActivityResponse = RouteResponse<typeof MASTERCLASS_ROUTES.myClassActivity>;

@Service({ autoProvided: false })
export class ChapterFacade {
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly http = inject(ApiClient);
  private readonly router = inject(Router);

  private readonly course = courseLoad();
  readonly courseDetails = this.course.details;
  readonly courseChapters = this.course.chapters;

  /** In flight: `selectCpeMode()`'s POST, separate from the two reads. */
  private readonly opLoading = signal(false);

  readonly loading = computed(() => this.opLoading() || this.course.isLoading());
  readonly error = this.course.error;

  /** Point both reads at a course. */
  loadCourse(params: CourseLoadParams): void {
    this.course.load(params);
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
    this.course.clear();
    this.opLoading.set(false);
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

    // Sent by the player on its own clock, so it never drives the loading bar.
    const request = this.http
      .post<MyClassActivityResponse>(MASTERCLASS_ROUTES.myClassActivity.path, body, {
        context: new HttpContext().set(SKIP_LOADING, true),
      })
      .pipe(
        tap(() => {
          if (event === 'completed') this.updateLocalChapterCompletion(chapterId);
        }),
      );

    return request;
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

  selectCpeMode(cpeModeStatus: boolean) {
    const course = this.courseDetails();
    if (!course) {
      this.notification.error('Error', 'Course data not available');
      return of(null);
    }

    this.opLoading.set(true);

    const body: SetCpeModeRequest = {
      masterclass_id: course.id,
      cpe_mode_status: cpeModeStatus,
    };

    return this.http.post<SetCpeModeResponse>(MASTERCLASS_ROUTES.setCpeMode.path, body).pipe(
      tap(() => {
        this.opLoading.set(false);
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
        this.opLoading.set(false);
        this.logger.error('Failed to set CPE mode', err);
        return of(null);
      }),
    );
  }
}
