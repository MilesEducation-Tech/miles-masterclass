import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, delay, of, tap } from 'rxjs';
import { Storage } from '@core/services/storage/storage';
import {
  AI_LAB_ASSESSMENT_REPORT,
  AiLabAssessmentReport,
} from '@core/models/ai-lab-assessment.model';
import { CopilotWorkflow, MOCK_WORKFLOWS } from '@core/models/ai-lab.model';

/** localStorage key for the per-chapter submission map. One key, JSON blob. */
const SUBMISSIONS_KEY = 'ai_lab.submissions';

/** A submission scoring at or above this counts as passed, matching the 70% CPE bar. */
const PASS_MARK = 70;

/**
 * Owns the workflow-submission → scoring flow: the learner picks a workflow they
 * published in Copilot Studio, submits it as a chapter's exercise, and gets a
 * graded {@link AiLabAssessmentReport} back. Submissions persist per chapter so a
 * reload still shows the score (per-card badge + hero overall).
 *
 * ponytail: this is the ENTIRE mock. No backend endpoint exists yet for listing
 * a learner's Copilot workflows or grading a submission, so the two network
 * methods return canned data and the grade is computed client-side. When the
 * backend lands, only `listPublishedWorkflows` and `submit` change — everything
 * downstream (persistence, `overall`, the dialog, the hero) already speaks the
 * final `AiLabAssessmentReport` shape.
 */
@Injectable({ providedIn: 'root' })
export class AiLabSubmission {
  private readonly storage = inject(Storage);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Chapter id → its latest graded report. Seeded from localStorage on the
   * browser (empty on the server, where there's no storage and nothing reads it).
   */
  private readonly _submissions = signal<Record<number, AiLabAssessmentReport>>(
    this.isBrowser
      ? (this.storage.getLocal<Record<number, AiLabAssessmentReport>>(SUBMISSIONS_KEY) ?? {})
      : {},
  );

  readonly submissions = this._submissions.asReadonly();

  /** The learner's own aggregate across every submitted chapter — drives the hero. */
  readonly overall = computed(() => {
    const reports = Object.values(this._submissions());
    const submitted = reports.length;
    if (!submitted) return { submitted: 0, avgScore: 0, passed: 0 };
    const avgScore = Math.round(reports.reduce((sum, r) => sum + r.scorePercent, 0) / submitted);
    const passed = reports.filter((r) => r.scorePercent >= PASS_MARK).length;
    return { submitted, avgScore, passed };
  });

  /** The persisted report for a chapter, or null if it was never submitted. */
  getReport(chapterId: number): AiLabAssessmentReport | null {
    return this._submissions()[chapterId] ?? null;
  }

  /**
   * The learner's published Copilot workflows.
   * ponytail: mock — swap for the real GET when the Copilot-workflows endpoint
   * lands. The `delay` fakes network latency so the loading state is exercised.
   */
  listPublishedWorkflows(): Observable<CopilotWorkflow[]> {
    return of(MOCK_WORKFLOWS).pipe(delay(600));
  }

  /**
   * Submit a workflow as `chapterId`'s exercise and get it scored.
   * ponytail: mock grader — swap for `POST ai-lab/submission/` returning the
   * graded report. Persists on emit so the score survives a reload.
   */
  submit(chapterId: number, workflow: CopilotWorkflow): Observable<AiLabAssessmentReport> {
    const report = this.grade(chapterId, workflow);
    return of(report).pipe(
      delay(900),
      tap(() => this.persist(chapterId, report)),
    );
  }

  private persist(chapterId: number, report: AiLabAssessmentReport): void {
    this._submissions.update((map) => ({ ...map, [chapterId]: report }));
    this.storage.setLocal(SUBMISSIONS_KEY, this._submissions());
  }

  /**
   * ponytail: mock grade. Derives a deterministic outcome from the chapter +
   * workflow so the same submission always scores the same, but different ones
   * vary (not everyone gets 78%). Clones the placeholder report and flips the
   * last N flow checks / MCQs to failing per the seed, then recomputes totals.
   */
  private grade(chapterId: number, workflow: CopilotWorkflow): AiLabAssessmentReport {
    const seed = chapterId + hash(workflow.id);
    const flowFail = seed % 3 === 0 ? 0 : 1; // 0 or 1 failing flow step
    const mcqWrong = seed % 2 === 0 ? 0 : 1; // 0 or 1 wrong answer

    const base = AI_LAB_ASSESSMENT_REPORT;
    const checks = base.flow.checks.map((c, i, arr) => ({
      ...c,
      passed: i < arr.length - flowFail,
    }));
    const questions = base.mcq.questions.map((q, i, arr) => ({
      ...q,
      isCorrect: i < arr.length - mcqWrong,
    }));

    const flowPassed = checks.filter((c) => c.passed).length;
    const mcqCorrect = questions.filter((q) => q.isCorrect).length;
    const scorePercent = Math.round(
      ((flowPassed + mcqCorrect) / (checks.length + questions.length)) * 100,
    );

    return {
      completedOn: today(),
      scorePercent,
      flow: {
        agentName: workflow.name,
        passed: flowPassed,
        total: checks.length,
        checks,
      },
      mcq: {
        correct: mcqCorrect,
        total: questions.length,
        questions,
      },
    };
  }
}

/** Tiny stable string hash — enough to vary the mock score per workflow. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** "12 Aug 2026" — matches the `completedOn` format in the placeholder report. */
function today(): string {
  return new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
