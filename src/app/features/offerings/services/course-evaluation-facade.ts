import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { computed, effect, inject, PLATFORM_ID, Service, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
// Type-only: the dialog loads with `import()` when opened (AGENTS.md §4.4).
import type { UtilsDialogData, UtilsDialogResult } from '@shared/dialogs/utils-dialog/utils-dialog';
import {
  ASSESSMENT_DIALOG_WIDTH,
  CHAPTER_COPY,
  FEEDBACK_COPY,
} from '@features/offerings/constants/course-detail';
import { readCourseStepRefusal } from '@features/offerings/models/course-detail.model';
import {
  EvaluationForm,
  EvaluationOutcome,
  EvaluationStatus,
  parseEvaluationForm,
  parseEvaluationStatus,
} from '@features/offerings/models/course-evaluation.model';
import { CourseCertificateFacade } from '@features/offerings/services/course-certificate-facade';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';

/**
 * The course evaluation of the course on screen: the form
 * (`feedback-questions/`), its submit (`feedback-submit/`), and the date of an
 * evaluation already in (`feedback-responses/`). The server decides when the
 * learner may give it (`show_feedback`: after a pass, once), and its submit
 * closes the course: CPE, the Credly badge and the certificate.
 *
 * On the course route beside `CourseDetailFacade`, whose course it reads and
 * whose routes it calls through: the course hero and the report page open the
 * form, and the feedback page shows and submits it. Every way in passes
 * `?redirect=`, so the learner goes back to where they were afterwards.
 */
@Service({ autoProvided: false })
export class CourseEvaluationFacade {
  private readonly detail = inject(CourseDetailFacade);
  private readonly certificate = inject(CourseCertificateFacade);
  private readonly auth = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly notification = inject(NotificationService);
  private readonly logger = inject(Logger);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Signed in, and the server says the learner may give the evaluation now. */
  readonly canGiveFeedback = computed(
    () => this.auth.isAuthenticated() && !!this.detail.course()?.show_feedback,
  );

  /**
   * Signed in, and the evaluation is in. Its button stays, disabled, until the
   * read-only view lands (it needs the `feedback-responses` row shape).
   */
  readonly feedbackGiven = computed(
    () => this.auth.isAuthenticated() && !!this.detail.course()?.feedback_submitted,
  );

  /** A submit is with the server. */
  readonly submitting = signal(false);

  /** The feedback page is on screen: the form is read only then. */
  private readonly formOpen = signal(false);

  private readonly formResource = httpResource<EvaluationForm>(
    () => {
      const url = this.detail.feedbackQuestionsUrl();
      // The read needs the learner's token, which lives in the browser; the
      // boolean, never the token, so a rotation doesn't refetch.
      if (!this.isBrowser || !this.formOpen() || !url || !this.auth.isAuthenticated()) {
        return undefined;
      }
      return url;
    },
    // The trust boundary: a form that drifted from the contract lands in `error()`.
    { parse: parseEvaluationForm },
  );

  private readonly form = computed(() =>
    this.formResource.hasValue() ? (this.formResource.value() ?? null) : null,
  );

  /** The questions, in the server's `order`; empty while the form loads or isn't given. */
  readonly questions = computed(() => {
    const form = this.form();
    return form && !form.reset_required ? form.questions : [];
  });

  /** The 365-day window had expired: the server reset the learner's progress, so there is no form. */
  readonly windowReset = computed(() => this.form()?.reset_required === true);

  private readonly refusal = computed(() => {
    const error = this.formResource.error();
    return error ? readCourseStepRefusal(error) : null;
  });

  /** The evaluation is in already: it is given once and never edited. */
  readonly alreadySubmitted = computed(
    () => this.refusal()?.reason === 'feedback_already_submitted',
  );

  /** The form opens only after a pass. */
  readonly notPassed = computed(() => this.refusal()?.reason === 'assessment_not_passed');

  /** Any other failed read, a contract drift included: the server's words when it has some. */
  readonly loadError = computed(() => {
    const refusal = this.refusal();
    if (!refusal || this.alreadySubmitted() || this.notPassed()) return null;
    return refusal.message ?? FEEDBACK_COPY.loadFailed.body;
  });

  private readonly statusResource = httpResource<EvaluationStatus>(
    // Only an evaluation already in has a date to show.
    () =>
      this.alreadySubmitted() ? (this.detail.feedbackResponsesRequest() ?? undefined) : undefined,
    { parse: parseEvaluationStatus },
  );

  /** When the evaluation already in was given; `null` until known. */
  readonly submittedAt = computed(() =>
    this.statusResource.hasValue() ? (this.statusResource.value()?.submitted_at ?? null) : null,
  );

  constructor() {
    // A contract drift is a backend conversation, so it must reach the logs too.
    effect(() => {
      const error = this.formResource.error();
      if (error) this.logger.error('[CourseEvaluation] feedback-questions failed', error);
    });
    effect(() => {
      const error = this.statusResource.error();
      if (error) this.logger.error('[CourseEvaluation] feedback-responses failed', error);
    });
    // The read itself reset the learner's progress: the held course is stale.
    effect(() => {
      if (this.windowReset()) this.detail.reload();
    });
  }

  /** The feedback page turns the form's read on, and off again when it goes. */
  openForm(open: boolean): void {
    this.formOpen.set(open);
  }

  reloadForm(): void {
    this.formResource.reload();
  }

  /** The feedback page's path, once the course has loaded. */
  feedbackPath(): string | null {
    const coursePath = this.detail.coursePath();
    return coursePath ? `${coursePath}/feedback` : null;
  }

  /** The form, coming back here once it is in. */
  openFeedback(): void {
    const path = this.feedbackPath();
    if (path) {
      void this.router.navigate([path], { queryParams: { redirect: this.router.url } });
    }
  }

  /**
   * Back where the learner came from: `redirect` when it is a path in this app
   * (the way in passes one), the course page otherwise.
   */
  leave(redirect: string | undefined): void {
    if (redirect?.startsWith('/') && !redirect.startsWith('//')) {
      void this.router.navigateByUrl(redirect);
      return;
    }
    const coursePath = this.detail.coursePath();
    if (coursePath) void this.router.navigateByUrl(coursePath);
  }

  /**
   * Record the evaluation: one rating per question, and the optional comments.
   * Then the course is read again, so its flags follow (the "Submit Feedback"
   * buttons go). Resolves the outcome, or `null` when nothing went to the
   * server (the profile gate) or it was refused.
   */
  async submit(
    ratings: Record<string, number>,
    comments: string,
  ): Promise<EvaluationOutcome | null> {
    const questions = this.questions();
    if (this.submitting() || !questions.length || questions.some((q) => !ratings[q.id])) {
      return null;
    }
    // The certificate the submit triggers carries the learner's name, so a
    // profile known to be incomplete is finished first. Unknown (`null`) goes
    // through: the server has the last word.
    if (this.auth.isProfileCompleted() === false) {
      await this.askForProfile();
      return null;
    }

    this.submitting.set(true);
    try {
      const outcome = await this.detail.submitFeedback({
        responses: questions.map((question) => ({
          question_id: question.id,
          rating: ratings[question.id],
          text_response: '',
        })),
        optional_feedback_text: comments.trim(),
      });
      this.detail.reload();
      if (outcome.reset_required) {
        this.notification.info(CHAPTER_COPY.enrolmentReset.title, CHAPTER_COPY.enrolmentReset.body);
        this.leave(undefined);
      } else {
        // The submit only triggered the certificate: wait for its link.
        this.certificate.watch();
      }
      return outcome;
    } catch (error) {
      this.submitRefused(error);
      return null;
    } finally {
      this.submitting.set(false);
    }
  }

  /** A refused `feedback-submit/`, each reason in its own words. */
  private submitRefused(error: unknown): void {
    this.logger.error('[CourseEvaluation] feedback-submit refused', error);
    const refusal = readCourseStepRefusal(error);

    switch (refusal.reason) {
      case 'feedback_already_submitted':
        this.notification.info(FEEDBACK_COPY.submitted.title, FEEDBACK_COPY.submitted.body);
        this.detail.reload();
        this.reloadForm();
        return;
      case 'assessment_not_passed':
        this.notification.info(FEEDBACK_COPY.notPassed.title, FEEDBACK_COPY.notPassed.body);
        return;
    }
    this.notification.error(
      FEEDBACK_COPY.submitFailed.title,
      refusal.message ?? FEEDBACK_COPY.submitFailed.body,
    );
  }

  /** "Complete your profile" first; the profile page brings the learner back here. */
  private async askForProfile(): Promise<void> {
    const { UtilsDialog } = await import('@shared/dialogs/utils-dialog/utils-dialog');
    const ref = this.dialogs.open<UtilsDialogData, UtilsDialogResult>(UtilsDialog, {
      data: {
        containerClass: 'py-12 px-6',
        content: [
          { type: 'heading', value: FEEDBACK_COPY.profile.title, level: 3 },
          { type: 'text', value: FEEDBACK_COPY.profile.body },
        ],
        buttons: [{ label: FEEDBACK_COPY.profile.button, variant: 'default', action: 'confirm' }],
        ariaLabel: 'Complete your profile to submit feedback',
        maxWidth: ASSESSMENT_DIALOG_WIDTH,
      },
    });
    const result = await firstValueFrom(ref.afterClosed);
    if (result?.action === 'confirm') {
      await this.router.navigate(['/auth/profile'], {
        queryParams: { redirect: this.router.url },
      });
    }
  }
}
