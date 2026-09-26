import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpContext } from '@angular/common/http';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matPlayArrowRound } from '@ng-icons/material-icons/round';
import { NgpRadioGroup, NgpRadioIndicator, NgpRadioItem } from 'ng-primitives/radio';
import { injectDialogRef } from 'ng-primitives/dialog';
import { DialogShell } from '@shared/ui/dialog-shell/dialog-shell';
import { DurationPipe } from '@shared/pipes/duration/duration-pipe';
import { ApiClient } from '@core/services/api-client/api-client';
import { ContentDetails } from '@core/models/course.model';
import { CommonResponse, SKIP_ERROR_NOTIFICATION } from '@core/models/http.model';
import { MASTERCLASS_ROUTES } from '@core/models/masterclass.model';
import { AiLabAgentAbout } from './ai-lab-agent-about/ai-lab-agent-about';
import { AiLabAssessmentReport } from '@core/models/ai-lab-assessment.model';
import { CopilotWorkflow } from '@core/models/ai-lab.model';
import { AiLabSubmission } from '@core/services/ai-lab-submission/ai-lab-submission';
import { MilesSlug } from '../../components/miles-slug/miles-slug';
import { Button } from '../../ui/button/button';
import { environment } from '@env/environment';

/**
 * One catalogue tile, flattened from either a masterclass chapter or a static
 * `AiLabAgent`. The optional fields are the ones only a chapter can supply, so
 * the dialog renders the same for both and simply shows less for the static
 * entries.
 */
export interface AiLabAgentCard {
  name: string;
  /** Muted suffix after the name — " Agent" on the static tiles, absent on
   * chapters, whose titles already read as titles. */
  nameSuffix?: string;
  description: string;
  thumbnail?: string | null;
  thumbnailAlt?: string;
  /** Runtime in seconds, from the chapter's `video_duration`. */
  durationSeconds?: number;
  questionCount?: number;
  /**
   * Masterclass course this tile came from. Drives the `app-course-about` block:
   * the "about" data is course-level (overview, objectives, instructor, NASBA
   * credits), so it's the same for every tile in a section. Absent on the static
   * tiles, which have no course behind them — those render the hero only.
   */
  courseId?: number;
  /**
   * The chapter behind this tile. Present only on chapter-backed tiles, and the
   * key the workflow submission is scored and stored against. Absent on static
   * tiles, which have no exercise to submit — those render without the submit
   * panel.
   */
  chapterId?: number;
}

/** Closes with `'launch'` when the user wants to go on to the lab. */
export type AiLabAgentDialogResult = 'launch';

/**
 * Detail view for a catalogue tile, built on the same design as `CourseInfo` —
 * full-bleed hero, bottom fade, content overlaid bottom-left.
 *
 * Read-only: the Launch button hands back to the page, which owns the login /
 * plan / agreement gate, so the dialog can't drift out of step with it. That is
 * also why the bookmark and share actions from `CourseInfo` are absent — an
 * agent tile isn't a course you can save.
 */
@Component({
  selector: 'app-ai-lab-agent-dialog',
  imports: [
    Button,
    MilesSlug,
    NgIcon,
    DurationPipe,
    AiLabAgentAbout,
    NgpRadioGroup,
    NgpRadioIndicator,
    NgpRadioItem,
    DialogShell,
  ],
  templateUrl: './ai-lab-agent-dialog.html',
  providers: [provideIcons({ matPlayArrowRound })],
})
export class AiLabAgentDialog implements OnInit {
  private readonly dialogRef = injectDialogRef<AiLabAgentCard, AiLabAgentDialogResult>();
  protected readonly data = this.dialogRef.data;

  private readonly apiClient = inject(ApiClient);
  private readonly submission = inject(AiLabSubmission);
  private readonly destroyRef = inject(DestroyRef);

  /** Course-level "about" payload. Null until it lands, or if there's no course. */
  protected readonly details = signal<ContentDetails | null>(null);
  protected readonly loadingDetails = signal(false);

  // ---- Workflow submission (chapter-backed tiles only) ----
  /** Env gate for the evaluation/assessment layer — hides the submit panel and
   *  the graded report until the grading backend is ready. */
  protected readonly assessmentEnabled = environment.AI_LABS.assessmentEnabled;
  /** The learner's published Copilot workflows. Null while loading. */
  protected readonly workflows = signal<CopilotWorkflow[] | null>(null);
  protected readonly loadingWorkflows = signal(false);
  protected readonly selectedWorkflowId = signal<string | null>(null);
  protected readonly submittingWorkflow = signal(false);
  /** The graded report — from a past submission (shown on open) or a fresh one. */
  protected readonly report = signal<AiLabAssessmentReport | null>(null);

  /**
   * Fetched here rather than on the page: the "about" block is only ever seen
   * inside this dialog, so loading it on demand keeps two extra requests off
   * every AI Labs page load — including SSR, where nothing would consume them.
   */
  ngOnInit(): void {
    this.initSubmission();

    const courseId = this.data?.courseId;
    if (courseId === undefined) return;

    this.loadingDetails.set(true);
    this.apiClient
      .get<CommonResponse<ContentDetails>>(
        MASTERCLASS_ROUTES.getCourseDetails.path.replace(':course_type', 'masterclass'),
        {
          params: { id: courseId },
          context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
        },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const d = res?.data;
          if (d) {
            // Same normalisation every other caller does: the wire field is one
            // CRLF-delimited string, `CourseAbout` renders a list.
            d.learning_objective_list = (d.learning_objectives ?? '').split('\r\n').filter(Boolean);
            this.details.set(d);
          }
          this.loadingDetails.set(false);
        },
        // Errors are silent by design — the hero already carries the blurb, so a
        // missing "about" block degrades rather than breaks.
        error: () => this.loadingDetails.set(false),
      });
  }

  /**
   * Chapter-backed tiles carry an exercise. If it was already submitted, show
   * the stored score straight away; otherwise load the picker of published
   * workflows. Static tiles (no `chapterId`) skip this entirely.
   */
  private initSubmission(): void {
    if (!this.assessmentEnabled) return;
    const chapterId = this.data?.chapterId;
    if (chapterId === undefined) return;

    const existing = this.submission.getReport(chapterId);
    if (existing) {
      this.report.set(existing);
      return;
    }

    this.loadWorkflows();
  }

  private loadWorkflows(): void {
    if (this.workflows() !== null || this.loadingWorkflows()) return;
    this.loadingWorkflows.set(true);
    this.submission
      .listPublishedWorkflows()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => {
        this.workflows.set(list);
        this.loadingWorkflows.set(false);
      });
  }

  /** Submit the picked workflow as this chapter's exercise and show the score. */
  protected submitWorkflow(): void {
    const chapterId = this.data?.chapterId;
    const workflow = this.workflows()?.find((w) => w.id === this.selectedWorkflowId());
    if (chapterId === undefined || !workflow) return;

    this.submittingWorkflow.set(true);
    this.submission
      .submit(chapterId, workflow)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((report) => {
        this.report.set(report);
        this.submittingWorkflow.set(false);
      });
  }

  /** Back to the picker to try a different workflow (report stays persisted). */
  protected resubmit(): void {
    this.report.set(null);
    this.selectedWorkflowId.set(null);
    this.loadWorkflows();
  }

  close(): void {
    this.dialogRef.close();
  }

  protected launch(): void {
    this.dialogRef.close('launch');
  }
}
