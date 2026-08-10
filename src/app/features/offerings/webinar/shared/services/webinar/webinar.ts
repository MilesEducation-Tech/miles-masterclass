import { httpResource } from '@angular/common/http';
import { Service, computed, inject, signal } from '@angular/core';
import { Observable, concatMap, map, of, range, switchMap, takeWhile, timer } from 'rxjs';
import { ApiClient } from '../../../../../../shared/core/services/api-client/api-client';
import { CAIRA } from '../../../../../../shared/core/http/caira.endpoints';
import { cairaError } from '../../../../../../shared/core/http/caira-error';
import { WebinarId } from '../../../../../../shared/core/models/caira/envelope.model';
import {
  AllWebinarsResponse,
  WebinarCard,
  WebinarDetailResponse,
  WebinarDetailView,
  WebinarFeedbackAnswer,
  WebinarFeedbackQuestion,
  WebinarFeedbackQuestionsResponse,
  WebinarRegisterResponse,
  WebinarRegisterStatusResponse,
  isRegistrationAccepted,
  toRegistrationStatus,
  toWebinarCards,
  toWebinarDetail,
  toWebinarFeedbackBody,
  toWebinarFeedbackQuestions,
} from '../../../../../../shared/core/models/caira/webinar.model';

/**
 * Poll cadence for an async registration attempt, copied from the shipped LMS:
 * 12 attempts, 2 s apart, then give up and show the learner as registered.
 *
 * The optimistic ending is deliberate — registration completes server-side
 * whether or not the browser is still watching, and the LMS decided a false
 * "registered" beats a false "failed" on a request that was already accepted.
 */
const POLL_INTERVAL_MS = 2000;
const POLL_ATTEMPTS = 12;

/** What `register()` resolves to. `accepted` is the optimistic timeout ending. */
export type WebinarRegistrationOutcome = 'registered' | 'accepted' | 'failed';

/**
 * Webinars — #20 list, #21 detail, #31/#32 feedback, and L3/L4 registration.
 *
 * App-wide `@Service()`: #20 returns every active webinar in one unpaginated
 * call, so a single instance serves the listing, the hero and the schedule
 * drawer without three copies of the same payload.
 *
 * Registration closes **G-23**. The gap register recorded it as having no
 * binding target because the API reference omits `registerV4/`; the shipped LMS
 * has been calling it all along.
 */
@Service()
export class Webinars {
  private readonly api = inject(ApiClient);

  /** The reactive root for the detail read. `null` means no webinar selected. */
  private readonly selectedId = signal<WebinarId | null>(null);

  private readonly list = httpResource<AllWebinarsResponse | undefined>(
    () => this.api.absoluteUrl(CAIRA.allWebinarsWeb),
    { defaultValue: undefined },
  );

  private readonly detailResource = httpResource<WebinarDetailResponse | undefined>(
    () => {
      const id = this.selectedId();
      return id === null ? undefined : this.api.absoluteUrl(CAIRA.webinarDetail(id));
    },
    { defaultValue: undefined },
  );

  private readonly feedbackResource = httpResource<WebinarFeedbackQuestionsResponse | undefined>(
    () => {
      const id = this.selectedId();
      return id === null
        ? undefined
        : `${this.api.absoluteUrl(CAIRA.webinarFeedbackQuestions)}?webinar_id=${id}`;
    },
    { defaultValue: undefined },
  );

  readonly isLoading = this.list.isLoading;
  readonly isLoadingDetail = this.detailResource.isLoading;

  readonly error = computed(() => {
    const err = this.list.error();
    return err ? cairaError(err) : null;
  });

  /**
   * `error()` before `value()` throughout — `value()` throws
   * `ResourceValueError` on a failed resource, which would turn one bad request
   * into a render failure in every consumer.
   */
  readonly webinars = computed<WebinarCard[]>(() =>
    this.list.error() ? [] : toWebinarCards(this.list.value()),
  );

  /** #20 carries no per-item status — the grouping is the status. */
  readonly upcoming = computed(() => this.webinars().filter((w) => w.group === 'upcoming'));
  readonly expired = computed(() => this.webinars().filter((w) => w.group === 'expired'));
  readonly completed = computed(() => this.webinars().filter((w) => w.group === 'completed'));

  readonly detail = computed<WebinarDetailView | null>(() =>
    this.detailResource.error() ? null : toWebinarDetail(this.detailResource.value()),
  );

  readonly feedbackQuestions = computed<WebinarFeedbackQuestion[]>(() =>
    this.feedbackResource.error() ? [] : toWebinarFeedbackQuestions(this.feedbackResource.value()),
  );

  select(id: WebinarId | null): void {
    this.selectedId.set(id);
  }

  reload(): void {
    this.list.reload();
  }

  /**
   * L3 → L4 · register, then watch the async attempt to completion.
   *
   * Emits once. `'registered'` when a poll confirms it, `'failed'` when the
   * server refuses or a poll reports an error, and `'accepted'` when the
   * attempt is still pending after 12 polls — see `POLL_ATTEMPTS`.
   *
   * The POST carries **no body**; `webinar_id` and `event_type` are query
   * params. Sending a body here is what the LMS does wrong on two other
   * endpoints, so it is spelled out: the second argument is `null`, not `{}`.
   */
  register(id: WebinarId, eventType = 'webinar'): Observable<WebinarRegistrationOutcome> {
    return this.api
      .post<WebinarRegisterResponse>(CAIRA.webinarRegister, null, {
        params: { webinar_id: String(id), event_type: eventType },
      })
      .pipe(
        switchMap((response) => {
          if (!isRegistrationAccepted(response)) return of<WebinarRegistrationOutcome>('failed');
          if (response.registration_status?.toUpperCase() === 'REGISTERED') {
            return of<WebinarRegistrationOutcome>('registered');
          }
          const attemptId = response.attempt_id;
          // Accepted but no attempt id to watch: the LMS marks it registered
          // optimistically rather than leaving the card spinning forever.
          if (!attemptId) return of<WebinarRegistrationOutcome>('accepted');
          return this.pollRegistration(attemptId);
        }),
      );
  }

  /**
   * Poll one attempt on a fixed cadence.
   *
   * `concatMap` over a `range` rather than a recursive `setTimeout`: the
   * subscription owns the timer, so a component that unsubscribes stops the
   * poll, and there is no timer handle to leak. `takeWhile(inclusive)` emits
   * the terminal answer and completes.
   */
  private pollRegistration(attemptId: string): Observable<WebinarRegistrationOutcome> {
    return range(0, POLL_ATTEMPTS).pipe(
      concatMap((attempt) =>
        timer(attempt === 0 ? 0 : POLL_INTERVAL_MS).pipe(
          switchMap(() =>
            this.api.get<WebinarRegisterStatusResponse>(CAIRA.webinarRegisterStatus(attemptId)),
          ),
          // A poll that errors is not a failed registration — the attempt is
          // still running server-side. Keep polling.
          map((response) => toRegistrationStatus(response)),
        ),
      ),
      takeWhile((status) => status === 'PENDING', true),
      map((status): WebinarRegistrationOutcome => {
        if (status === 'REGISTERED') return 'registered';
        if (status === 'FAILED') return 'failed';
        // Still pending after the last attempt.
        return 'accepted';
      }),
    );
  }

  /**
   * #32 · `POST caira/webinar_feedback_submit/?webinar_id=` — 201 on success.
   *
   * `webinar_id` stays a **query param on the POST**, and the answers key is
   * `feedback_id`, not `question_id`. Both are called out in the model.
   */
  submitFeedback(
    id: WebinarId,
    answers: WebinarFeedbackAnswer[],
    comment?: string,
  ): Observable<unknown> {
    return this.api.post<unknown>(
      CAIRA.webinarFeedbackSubmit,
      toWebinarFeedbackBody(answers, comment),
      { params: { webinar_id: String(id) } },
    );
  }
}
