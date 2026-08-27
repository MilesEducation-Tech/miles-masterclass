import { Component, computed, effect, inject, input, signal } from '@angular/core';
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

  // State
  reportData = signal<any['data'] | null>(null);
  courseDetails = signal<any | null>(null);
  showWrongOnly = signal(false);
  expandedItems = signal<Set<CairaUuid>>(new Set());
  isLoading = signal(true);

  // Computed
  filteredQuestions = computed(() => {
    const data = this.reportData();
    if (!data) return [];

    // The report questions are in `question_answers` array
    let questions = data.question_answers;

    if (this.showWrongOnly()) {
      questions = questions.filter((q: any) => !q.is_correct);
    }

    return questions;
  });

  scorePercentage = computed(() => {
    const data = this.reportData();
    if (!data) return 0;
    return Math.round(data.result_details.my_percentage);
  });

  passedCount = computed(() => {
    const data = this.reportData();
    if (!data) return 0;
    // Assuming total_correct vs total_questions
    return data.total_correct;
  });

  totalCount = computed(() => {
    const data = this.reportData();
    return data ? data.total_questions : 0;
  });

  constructor() {
    effect(() => {
      const courseId = this.courseId();
      if (courseId) this.loadReport(courseId);
    });
  }

  /**
   * ponytail: the report is a course-scoped `GET .../assessment/result/` (P5).
   * The facade stub this replaces returned `null`, so `.subscribe` on it threw
   * the moment the page opened. `reportData` stays null and the template's
   * empty state renders until the endpoint is bound.
   */
  loadReport(courseId: CairaUuid) {
    this.isLoading.set(false);
    this.logger.warn('Assessment report is not bound', { courseId });
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

  getOptionText(questionObj: any, optionKey: string): string {
    if (!questionObj || !optionKey) return '';
    const key = `option_${optionKey.toLowerCase()}`;
    return questionObj[key] || optionKey;
  }

  getExplanation(item: any): string {
    if (!item || !item.question_object) return '';
    const correctOption = item.question_object.correct_option;
    if (!correctOption) return '';
    const key = `description_option_${correctOption.toLowerCase()}`;
    return item.question_object[key] || '';
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
