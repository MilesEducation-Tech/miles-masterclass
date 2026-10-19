import { formatDate, isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { computed, effect, inject, LOCALE_ID, PLATFORM_ID, Service, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
// Type-only: the dialog loads with `import()` when opened (AGENTS.md §4.4).
import type { UtilsDialogData, UtilsDialogResult } from '@shared/dialogs/utils-dialog/utils-dialog';
import {
  ASSESSMENT_COPY,
  ASSESSMENT_DIALOG_WIDTH,
  ASSESSMENT_ENDED_SITTING,
  ASSESSMENT_REPORT_COPY,
} from '@features/offerings/constants/course-detail';
import { readCourseStepRefusal } from '@features/offerings/models/course-detail.model';
import {
  AssessmentAnswer,
  AssessmentAttempt,
  AssessmentOutcome,
  AssessmentPaper,
  AssessmentReport,
  parseAssessmentAttempt,
  parseAssessmentPaper,
  parseAssessmentReport,
  readCoolOffEndsAt,
  toExamRules,
  toReviewItems,
} from '@features/offerings/models/final-assessment.model';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';

/**
 * The final assessment of the course on screen: the rules, the start
 * (`assessment-start/`), the sitting's paper (`assessment-questions/`), the
 * submit (`assessment-submit/`), and afterwards the report
 * (`assessment-report/` + `assessment-result/`). The server draws the paper,
 * grades it, and decides when the learner may sit it (`show_final_assessment`).
 *
 * On the course route beside `CourseDetailFacade`, whose course it reads and
 * whose routes it calls through: the course page's hero and the last chapter's
 * quiz start a sitting, the exam page shows and submits it, and the report page
 * reviews the latest attempt. Nothing is kept in storage: a reload asks the
 * server again.
 */
@Service({ autoProvided: false })
export class FinalAssessmentFacade {
  private readonly detail = inject(CourseDetailFacade);
  private readonly auth = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly notification = inject(NotificationService);
  private readonly logger = inject(Logger);
  private readonly locale = inject(LOCALE_ID);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Signed in, and the server says the learner may sit the assessment now. */
  readonly canStart = computed(
    () => this.auth.isAuthenticated() && !!this.detail.course()?.show_final_assessment,
  );

  /** A start is with the server: whatever calls `start()` waits for it. */
  readonly starting = signal(false);

  /** The sitting the exam page shows; `null` everywhere else. */
  private readonly sessionId = signal<string | null>(null);

  private readonly paperResource = httpResource<AssessmentPaper>(
    () => {
      const sessionId = this.sessionId();
      const url = this.detail.assessmentQuestionsUrl();
      // The exam renders in the browser only, and the read needs the learner's
      // token; the boolean, never the token, so a rotation doesn't refetch.
      if (!this.isBrowser || !sessionId || !url || !this.auth.isAuthenticated()) {
        return undefined;
      }
      return { url, params: { session_id: sessionId } };
    },
    // The trust boundary: a paper that drifted from the contract lands in `error()`.
    { parse: parseAssessmentPaper },
  );

  /** The sitting's paper; `null` while it loads, on a refusal, or off the exam page. */
  readonly paper = computed(() =>
    this.paperResource.hasValue() ? (this.paperResource.value() ?? null) : null,
  );

  readonly isLoading = computed(() => this.paperResource.isLoading());

  private readonly refusal = computed(() => {
    const error = this.paperResource.error();
    return error ? readCourseStepRefusal(error) : null;
  });

  /** The sitting is over (submitted, aged out, or not this learner's): only a new start helps. */
  readonly sittingEnded = computed(() => {
    const reason = this.refusal()?.reason;
    return !!reason && ASSESSMENT_ENDED_SITTING.includes(reason);
  });

  /** Any other failed read, a contract mismatch included: the server's words when it has some. */
  readonly loadError = computed(() => {
    const refusal = this.refusal();
    if (!refusal || this.sittingEnded()) return null;
    return refusal.message ?? ASSESSMENT_COPY.loadFailed.body;
  });

  /** Signed in, with a scored assessment for the report to show. */
  readonly canViewReport = computed(
    () => this.auth.isAuthenticated() && !!this.detail.course()?.final_assessment_submitted,
  );

  /** The report page is on screen: its reads run only then. */
  private readonly reportOpen = signal(false);

  private readonly reportResource = httpResource<AssessmentReport>(
    () => {
      const url = this.detail.assessmentReportUrl();
      if (!this.isBrowser || !this.reportOpen() || !url || !this.auth.isAuthenticated()) {
        return undefined;
      }
      return url;
    },
    { parse: parseAssessmentReport },
  );

  /** The learner's state and latest score; `null` while it loads, on a failure, or off the report page. */
  readonly report = computed(() =>
    this.reportResource.hasValue() ? (this.reportResource.value() ?? null) : null,
  );

  private readonly attemptResource = httpResource<AssessmentAttempt>(
    () => {
      const report = this.report();
      const url = this.detail.assessmentResultUrl();
      // `assessment-result/` 404s until there is an attempt, so the report,
      // which always answers, says first whether there is one.
      if (!report?.has_final_assessment || report.status === 'not_attempted' || !url) {
        return undefined;
      }
      return url;
    },
    { parse: parseAssessmentAttempt },
  );

  /**
   * The latest attempt, question by question, as the report lists it; empty
   * until it loads or when there is none. The report's `feedback_withheld`
   * decides whether correct answers show, not what the read happened to carry.
   */
  readonly review = computed(() => {
    const report = this.report();
    const attempt = this.attemptResource.hasValue() ? this.attemptResource.value() : undefined;
    return report && attempt ? toReviewItems(attempt, report.feedback_withheld) : [];
  });

  /** Either read is with the server: the page shows the two together. */
  readonly isReportLoading = computed(
    () => this.reportResource.isLoading() || this.attemptResource.isLoading(),
  );

  /** The report read failed: the server's words when it has some. */
  readonly reportError = computed(() => {
    const error = this.reportResource.error();
    if (!error) return null;
    return readCourseStepRefusal(error).message ?? ASSESSMENT_REPORT_COPY.loadFailed.body;
  });

  /** The review read failed (`409` AI Lab lock, `403`, a drift): the summary still shows. */
  readonly attemptError = computed(() => {
    const error = this.attemptResource.error();
    if (!error) return null;
    return readCourseStepRefusal(error).message ?? ASSESSMENT_REPORT_COPY.reviewFailed.body;
  });

  constructor() {
    // A contract drift is a backend conversation, so it must reach the logs too.
    effect(() => {
      const error = this.paperResource.error();
      if (error) this.logger.error('[FinalAssessment] assessment-questions failed', error);
    });
    effect(() => {
      const error = this.reportResource.error();
      if (error) this.logger.error('[FinalAssessment] assessment-report failed', error);
    });
    effect(() => {
      const error = this.attemptResource.error();
      if (error) this.logger.error('[FinalAssessment] assessment-result failed', error);
    });
  }

  /** The exam page's sitting, from its route; `null` when the page goes. */
  openSitting(sessionId: string | null): void {
    this.sessionId.set(sessionId);
  }

  reloadPaper(): void {
    this.paperResource.reload();
  }

  /** The report page turns its reads on, and off again when it goes. */
  openReport(open: boolean): void {
    this.reportOpen.set(open);
  }

  /** Read the report again; a new report reads the attempt again too. */
  reloadReport(): void {
    this.reportResource.reload();
  }

  reloadAttempt(): void {
    this.attemptResource.reload();
  }

  /** The report page's path, once the course has loaded. */
  reportPath(): string | null {
    const coursePath = this.detail.coursePath();
    return coursePath ? `${coursePath}/final-assessment/report` : null;
  }

  viewReport(): void {
    const path = this.reportPath();
    if (path) void this.router.navigateByUrl(path);
  }

  /**
   * The rules, then a sitting: drawn, or the open one resumed, so a learner who
   * left mid-exam gets the same questions back. Then the exam page.
   */
  async start(): Promise<void> {
    const course = this.detail.course();
    const coursePath = this.detail.coursePath();
    if (!course || !coursePath || this.starting() || !this.auth.isAuthenticated()) return;
    if (!(await this.confirmRules(course.exam_rules))) return;

    this.starting.set(true);
    try {
      const sitting = await this.detail.startAssessment();
      await this.router.navigateByUrl(`${coursePath}/final-assessment/${sitting.session_id}/exam`);
    } catch (error) {
      this.startRefused(error);
    } finally {
      this.starting.set(false);
    }
  }

  /**
   * Score the open sitting. Every question must be answered: the server takes
   * the whole paper at once. Then the course is read again, so its flags follow
   * (a pass hides the hero's button). Resolves `null` when it was refused.
   */
  async submit(answers: AssessmentAnswer[]): Promise<AssessmentOutcome | null> {
    const sessionId = this.sessionId();
    if (!sessionId) return null;

    try {
      const outcome = await this.detail.submitAssessment({ session_id: sessionId, answers });
      this.detail.reload();
      return outcome;
    } catch (error) {
      this.logger.error('[FinalAssessment] assessment-submit refused', error);
      const refusal = readCourseStepRefusal(error);
      if (refusal.reason && ASSESSMENT_ENDED_SITTING.includes(refusal.reason)) {
        this.notification.error(
          ASSESSMENT_COPY.sittingEnded.title,
          ASSESSMENT_COPY.sittingEnded.body,
        );
      } else {
        this.notification.error(
          ASSESSMENT_COPY.submitFailed.title,
          ASSESSMENT_COPY.submitFailed.body,
        );
      }
      return null;
    }
  }

  /**
   * The QAS rules, one whole rule per item, before anything is drawn; the text's
   * own title, when it has one, introduces them. Resolves `true` on "Start Exam".
   */
  private async confirmRules(text: string): Promise<boolean> {
    const { heading, rules } = toExamRules(text);
    const { UtilsDialog } = await import('@shared/dialogs/utils-dialog/utils-dialog');
    const ref = this.dialogs.open<UtilsDialogData, UtilsDialogResult>(UtilsDialog, {
      data: {
        title: ASSESSMENT_COPY.rulesTitle,
        // The support address is one long word: it wraps rather than leave a phone's panel.
        containerClass: 'flex flex-col space-y-4 text-start wrap-break-word',
        content: [
          { type: 'text', value: heading ?? ASSESSMENT_COPY.rulesIntro },
          { type: 'list', items: rules, ordered: true },
        ],
        buttons: [{ label: ASSESSMENT_COPY.startExam, variant: 'default', action: 'confirm' }],
        maxWidth: ASSESSMENT_DIALOG_WIDTH,
      },
    });
    const result = await firstValueFrom(ref.afterClosed);
    return !!result?.result && result.action === 'confirm';
  }

  /** A refused `assessment-start/`, each reason in its own words. */
  private startRefused(error: unknown): void {
    this.logger.error('[FinalAssessment] assessment-start refused', error);
    const refusal = readCourseStepRefusal(error);

    switch (refusal.reason) {
      case 'chapters_not_complete':
        this.notification.info(ASSESSMENT_COPY.notReady.title, ASSESSMENT_COPY.notReady.body);
        this.detail.reload();
        return;
      case 'already_passed':
        this.notification.info(
          ASSESSMENT_COPY.alreadyPassed.title,
          ASSESSMENT_COPY.alreadyPassed.body,
        );
        this.detail.reload();
        return;
      case 'cool_off_active': {
        const endsAt = readCoolOffEndsAt(error);
        this.notification.info(
          ASSESSMENT_COPY.coolOff.title,
          endsAt
            ? ASSESSMENT_COPY.coolOff.until(formatDate(endsAt, 'MMM d, h:mm a', this.locale))
            : ASSESSMENT_COPY.coolOff.body,
        );
        return;
      }
      case 'preview_mode':
        this.notification.info(ASSESSMENT_COPY.previewMode.title, ASSESSMENT_COPY.previewMode.body);
        return;
    }

    if (refusal.status === 404) {
      this.notification.info(ASSESSMENT_COPY.noAssessment.title, ASSESSMENT_COPY.noAssessment.body);
    } else {
      // An AI Lab lock (409) explains itself; the generic refusals don't.
      this.notification.error(
        ASSESSMENT_COPY.cannotStart.title,
        (refusal.status === 409 && refusal.message) || ASSESSMENT_COPY.cannotStart.body,
      );
    }
  }
}
