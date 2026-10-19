import { HttpContext } from '@angular/common/http';
import { computed, DestroyRef, DOCUMENT, inject, Service, signal } from '@angular/core';
import { Router } from '@angular/router';
import { exhaustMap, map, Subscription, take, takeWhile, timer } from 'rxjs';
import { SKIP_LOADING } from '@core/models/http.model';
import { ApiClient } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import {
  CERTIFICATE_COPY,
  CERTIFICATE_POLL_ATTEMPTS,
  CERTIFICATE_POLL_SECONDS,
} from '@features/offerings/constants/course-detail';
import { parseCertificateLink } from '@features/offerings/models/course-detail.model';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';

/**
 * The course certificate: a PDF the server generates once the course
 * evaluation is in, whose link (`masterclass_certificate_url`) arrives on the
 * course reads some time after. There is no certificate API to call.
 *
 * On the course route beside `CourseDetailFacade`, for the hero, the report and
 * the evaluation's thank-you view. The button is disabled until the feedback is
 * in. Right after it, `watch()` asks `course-progress/` quietly until the link
 * shows up, so the button can open the PDF without a reload.
 */
@Service({ autoProvided: false })
export class CourseCertificateFacade {
  private readonly detail = inject(CourseDetailFacade);
  private readonly auth = inject(AuthSession);
  private readonly api = inject(ApiClient);
  private readonly notification = inject(NotificationService);
  private readonly logger = inject(Logger);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  /** Signed in, and the course evaluation is in: the certificate is the learner's to download. */
  readonly canDownload = computed(
    () => this.auth.isAuthenticated() && !!this.detail.course()?.feedback_submitted,
  );

  /** A link the wait found before the held course has it, for that course only. */
  private readonly found = signal<{ courseId: string; url: string } | null>(null);

  /** The PDF's link: the course's own, or the one the wait found; `null` until it exists. */
  readonly link = computed(() => {
    const course = this.detail.course();
    if (!course) return null;
    const found = this.found();
    return course.masterclass_certificate_url ?? (found?.courseId === course.id ? found.url : null);
  });

  private readonly checking = signal(false);

  /** The wait is on and no link is in yet: the buttons say "Preparing". */
  readonly waiting = computed(() => this.checking() && !this.link());

  private watcher: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.watcher?.unsubscribe());
  }

  /**
   * Ask `course-progress/` every few seconds, for a while, until the link is
   * in. One wait at a time; it stops early when the learner leaves the course's
   * pages (the route's services outlive them, so the URL is the signal) or signs
   * out. Polling stays on RxJS (AGENTS.md §4.2), and off the loading bar: nobody
   * asked for these requests.
   */
  watch(): void {
    const course = this.detail.course();
    const url = this.detail.courseProgressUrl();
    if (!course || !url || this.link() || this.checking()) return;

    // `/:country/:profession/masterclass/:courseId/:courseTitle` as the address
    // bar has it now: an old numeric link's id stays numeric there.
    const coursePrefix = this.router.url.split(/[?#]/)[0].split('/').slice(0, 6).join('/');
    this.checking.set(true);
    this.watcher = timer(0, CERTIFICATE_POLL_SECONDS * 1000)
      .pipe(
        take(CERTIFICATE_POLL_ATTEMPTS),
        takeWhile(() => this.router.url.startsWith(coursePrefix) && this.auth.isAuthenticated()),
        exhaustMap(() =>
          this.api.get<unknown>(url, { context: new HttpContext().set(SKIP_LOADING, true) }),
        ),
        map(parseCertificateLink),
        takeWhile((link) => !link, true),
      )
      .subscribe({
        next: (link) => {
          if (link) this.found.set({ courseId: course.id, url: link });
        },
        error: (error: unknown) => {
          // A drift or a failed read ends the wait; a click starts another.
          this.logger.error('[CourseCertificate] course-progress failed', error);
          this.checking.set(false);
        },
        complete: () => this.checking.set(false),
      });
  }

  /**
   * Open the PDF in a new tab, inside the click so no popup blocker stops it.
   * Before its link is in, say so and wait for it.
   */
  download(): void {
    const link = this.link();
    if (link) {
      this.document.defaultView?.open(link, '_blank', 'noopener');
      return;
    }
    if (!this.canDownload()) return;
    this.notification.info(CERTIFICATE_COPY.notReady.title, CERTIFICATE_COPY.notReady.body);
    this.watch();
  }
}
