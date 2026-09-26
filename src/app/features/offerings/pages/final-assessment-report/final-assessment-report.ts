import {
  NgpCollapsible,
  NgpCollapsibleContent,
  NgpCollapsibleTrigger,
} from 'ng-primitives/collapsible';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FinalAssessmentFacade } from '../../services/final-assessment-facade';
import { Button } from '@shared/ui/button/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroChevronRight,
  heroChevronDown,
  heroCheckCircle,
  heroXCircle,
  heroArrowDownTray,
} from '@ng-icons/heroicons/outline';
import { ActivatedRoute, Router } from '@angular/router';
import { SubmitFinalAssessmentResponse } from '@features/offerings/models/assessment.model';
import { Utils } from '@shared/services/utils';
import { Logger } from '@core/services/logger/logger';
import { DatePipe } from '@angular/common';
import { PageLoading } from '@shared/ui/page-loading/page-loading';

@Component({
  selector: 'app-final-assessment-report',
  imports: [
    Button,
    NgIcon,
    DatePipe,
    PageLoading,
    NgpCollapsible,
    NgpCollapsibleContent,
    NgpCollapsibleTrigger,
  ],
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
  // Route params inputs (from withComponentInputBinding)
  courseId = input<string>();
  sessionId = input<string>();

  private readonly facade = inject(FinalAssessmentFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly utils = inject(Utils);
  private readonly logger = inject(Logger);

  // State
  reportData = signal<SubmitFinalAssessmentResponse['data'] | null>(null);
  courseDetails = this.facade.courseDetails;
  showWrongOnly = signal(false);
  expandedItems = signal<Set<number>>(new Set());
  isLoading = signal(true);

  // Computed
  filteredQuestions = computed(() => {
    const data = this.reportData();
    if (!data) return [];

    // The report questions are in `question_answers` array
    let questions = data.question_answers;

    if (this.showWrongOnly()) {
      questions = questions.filter((q) => !q.is_correct);
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
      const sessionId = this.sessionId();
      const courseId = this.courseId();

      if (sessionId) {
        this.loadReport(Number(sessionId));
      }

      if (courseId) {
        this.facade.courseId.set(courseId);
      }
    });
  }

  loadReport(sessionId: number) {
    this.isLoading.set(true);
    this.facade.getAssessmentReport(sessionId).subscribe({
      next: (data) => {
        this.reportData.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.logger.error('Error loading report', err);
        this.isLoading.set(false);
      },
    });
  }

  toggleWrongOnly() {
    this.showWrongOnly.update((v) => !v);
  }

  toggleExpand(id: number) {
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

  isExpanded(id: number) {
    return this.expandedItems().has(id);
  }

  backToCourse() {
    // Navigate back to course root
    this.router.navigate(['../../..'], { relativeTo: this.route });
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

    this.router.navigate(['../../..', 'feedback'], {
      relativeTo: this.route,
      queryParams: { redirect: this.router.url },
    });
  }
}
