import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from '../../../../../shared/components/ui/button/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroChevronRight,
  heroChevronDown,
  heroCheckCircle,
  heroXCircle,
  heroArrowDownTray,
} from '@ng-icons/heroicons/outline';
import { ActivatedRoute, Router } from '@angular/router';
import { Utils } from '../../../../../shared/core/services/utils/utils';
import { Logger } from '../../../../../shared/core/services/logger/logger';
import { DatePipe } from '@angular/common';
import { PageLoading } from '../../../../../shared/components/ui/page-loading/page-loading';
import { CairaUuid } from '../../../../../shared/core/models/caira/envelope.model';
import {
  AssessmentReport,
  AssessmentReportQuestion,
  AssessmentResultResponse,
  toAssessmentReport,
} from '../../../../../shared/core/models/caira/assessment.model';
import { ApiClient } from '../../../../../shared/core/services/api-client/api-client';
import { CAIRA } from '../../../../../shared/core/http/caira.endpoints';
import { cairaError } from '../../../../../shared/core/http/caira-error';

@Component({
  selector: 'app-final-assessment-report',
  imports: [Button, NgIcon, DatePipe, PageLoading],
  templateUrl: './final-assessment-report.html',
  styleUrl: './final-assessment-report.css',
  viewProviders: [
    provideIcons({
      heroChevronRight,
      heroChevronDown,
      heroCheckCircle,
      heroXCircle,
      heroArrowDownTray,
    }),
  ],
})
export class FinalAssessmentReport {
  /**
   * The course is the whole key. CAIRA has no assessment session — an attempt
   * is `(user, course, attempt_number)` — so the report is course-scoped and
   * the route no longer carries a `:sessionId`.
   */
  courseId = input<string>();

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly utils = inject(Utils);
  private readonly logger = inject(Logger);
  private readonly api = inject(ApiClient);
  private readonly destroyRef = inject(DestroyRef);

  // State
  reportData = signal<AssessmentReport | null>(null);
  courseDetails = signal<any | null>(null);
  showWrongOnly = signal(false);
  expandedItems = signal<Set<CairaUuid>>(new Set());
  isLoading = signal(true);

  // Computed
  filteredQuestions = computed<AssessmentReportQuestion[]>(() => {
    const questions = this.reportData()?.questions ?? [];
    return this.showWrongOnly() ? questions.filter((q) => !q.isCorrect) : questions;
  });

  scorePercentage = computed(() => this.reportData()?.scorePercent ?? 0);
  passedCount = computed(() => this.reportData()?.correctCount ?? 0);
  totalCount = computed(() => this.reportData()?.totalCount ?? 0);

  constructor() {
    effect(() => {
      const courseId = this.courseId();
      if (courseId) this.loadReport(courseId);
    });
  }

  /**
   * #11 · `GET .../assessment/result/` — the latest active attempt.
   *
   * Course-scoped: CAIRA identifies an attempt by `(user, course,
   * attempt_number)`, so there is no id to pass. A learner with no attempt gets
   * a `null` report and the template's empty state, which is not an error.
   */
  loadReport(courseId: CairaUuid) {
    this.isLoading.set(true);
    this.api
      .get<AssessmentResultResponse>(CAIRA.assessmentResult(courseId))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.reportData.set(toAssessmentReport(response));
          this.isLoading.set(false);
        },
        error: (error: unknown) => {
          this.isLoading.set(false);
          this.logger.error('Assessment report failed', cairaError(error));
        },
      });
  }

  toggleWrongOnly() {
    this.showWrongOnly.update((v) => !v);
  }

  toggleExpand(id: CairaUuid) {
    this.expandedItems.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }

  isExpanded(id: CairaUuid) {
    return this.expandedItems().has(id);
  }

  backToCourse() {
    // Navigate back to course root
    this.router.navigate(['../..'], { relativeTo: this.route });
  }

  downloadCertificate() {
    const courseDetails = this.courseDetails();
    if (!courseDetails) return;

    this.utils.openCertificateDownloadDialog(courseDetails);
  }

  submitFeedback() {
    const courseDetails = this.courseDetails();
    if (!courseDetails) return;

    this.router.navigate(['../..', 'feedback'], {
      relativeTo: this.route,
      queryParams: { redirect: this.router.url },
    });
  }
}
