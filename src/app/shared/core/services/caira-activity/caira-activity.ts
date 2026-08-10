import { HttpContext } from '@angular/common/http';
import { DestroyRef, Service, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiClient } from '../api-client/api-client';
import { Logger } from '../logger/logger';
import { CAIRA } from '../../http/caira.endpoints';
import { SKIP_ERROR_NOTIFICATION } from '../../models/caira/envelope.model';
import { CairaActivityEvent } from '../../models/caira/activity.model';
import { catchError, of } from 'rxjs';

/**
 * L5 · `POST milesone-activity` — the Salesforce activity relay.
 *
 * Separate from `Analytics` on purpose: different destination, different
 * failure policy, and a fixed four-event vocabulary rather than an open one.
 * Folding them together would mean one consumer's retry or sampling rule
 * silently applied to the other.
 *
 * Every method is **fire-and-forget**. `SKIP_ERROR_NOTIFICATION` keeps a failure
 * off the user's screen, `catchError` keeps it off the console as an unhandled
 * rejection, and the response is `unknown` because no caller in the shipped LMS
 * reads it. A dropped analytics event must never block a login, a chapter
 * completion or a badge claim.
 */
@Service()
export class CairaActivity {
  private readonly api = inject(ApiClient);
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);

  /** After a successful login, on both the OTP and QR paths. */
  login(): void {
    this.send({ activity_type: 'login' });
  }

  videoCompleted(params: { videoName: string; coursePlaylistName: string }): void {
    this.send({
      activity_type: 'video_completed',
      event_parameters: {
        video_name: params.videoName,
        video_type: 'Course Video',
        course_playlist_name: params.coursePlaylistName,
      },
    });
  }

  courseCompleted(params: {
    creditAmount: number;
    courseName: string;
    courseInstructor: string;
  }): void {
    this.send({
      activity_type: 'course_completed',
      event_parameters: {
        credit_amount: params.creditAmount,
        credit_type: 'CPE',
        course_name: params.courseName,
        course_instructor: params.courseInstructor,
      },
    });
  }

  /**
   * `webinarName` and `courseName` are mutually exclusive in the LMS — a webinar
   * badge sets one and blanks the other. Both default to `''` rather than being
   * omitted, because the relay reads the keys unconditionally.
   */
  badgeClaimed(params: {
    badgeName: string;
    creditAmount: number;
    webinarName?: string;
    courseName?: string;
  }): void {
    this.send({
      activity_type: 'badges_claim',
      event_parameters: {
        badge_type: 'Level',
        badge_name: params.badgeName,
        credit_amount: params.creditAmount,
        credit_type: 'CPE',
        webinar_name: params.webinarName ?? '',
        course_name: params.courseName ?? '',
      },
    });
  }

  private send(event: CairaActivityEvent): void {
    const context = new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);
    this.api
      .post<unknown>(CAIRA.activityEvent, event, { context })
      .pipe(
        catchError((error: unknown) => {
          // Swallowed on purpose. The learner is mid-flow and this is telemetry.
          this.logger.warn('Activity event dropped', event.activity_type, error);
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
