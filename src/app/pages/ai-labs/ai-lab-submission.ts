import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Observable, delay, map, of, tap } from 'rxjs';
import { SKIP_ERROR_NOTIFICATION } from '../../shared/core/models/http.model';
import { ApiClient } from '../../shared/core/services/api-client/api-client';
import { Storage } from '../../shared/core/services/storage/storage';
import {
  AI_LAB_ASSESSMENT_REPORT,
  AiLabAssessmentReport,
} from '../../shared/components/dialog/ai-lab-agent-dialog/ai-lab-agent-about/ai-lab-agent-about.model';
import {
  AI_LAB_ROUTES,
  AiLabAgentsResponse,
  AiLabApiResponse,
  AiLabAssignmentStatus,
  AiLabAssignmentSubmitRequest,
  CopilotWorkflow,
  MOCK_WORKFLOWS,
} from './ai-labs.model';

/** localStorage key for the per-chapter submission map. One key, JSON blob. */
const SUBMISSIONS_KEY = 'ai_lab.submissions';

/** A submission scoring at or above this counts as passed, matching the 70% CPE bar. */
const PASS_MARK = 70;

/**
 * The AI Lab's submission layer, in two halves:
 *
 *  • **Course page (real).** `listAgents`, `submitAssignment` and
 *    `assignmentStatus` hit `ai-lab/agents/` and `ai-lab/assignments/*` on the
 *    same Django backend as `ai-lab/account/`, so the bearer token comes from
 *    the interceptor like every other call.
 *
 *  • **Dialog era (mock).** `submissions` / `overall` / `submit` still back the
 *    legacy agent dialog and the landing hero's progress strip, both behind
 *    `environment.AI_LABS.assessmentEnabled` (off everywhere). Canned data and a
 *    client-side grade — delete with the dialog when that surface goes.
 */
@Injectable({ providedIn: 'root' })
export class AiLabSubmission {
  private readonly api = inject(ApiClient);
  private readonly storage = inject(Storage);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // ---------------------------------------------------------------------------
  // Course-page lab: the learner's agents, one submission, its evaluation.
  // ---------------------------------------------------------------------------

  /** The agents the learner has built, plus whether their lab environment exists yet. */
  listAgents(): Observable<AiLabAgentsResponse> {
    return this.api
      .get<AiLabApiResponse<AiLabAgentsResponse>>(AI_LAB_ROUTES.agents.path)
      .pipe(map((res) => ({ ...res.data, agents: res.data?.agents ?? [] })));
  }

  /** Start evaluating one agent against a course's lab. Errors toast via the interceptor. */
  submitAssignment(body: AiLabAssignmentSubmitRequest): Observable<unknown> {
    return this.api.post<AiLabApiResponse<unknown>>(AI_LAB_ROUTES.submitAssignment.path, body);
  }

  /**
   * Where the evaluation stands for a course. Silent on failure — it's polled,
   * and a toast every few seconds while the network blips helps nobody; the
   * page shows its own "check again" instead.
   */
  assignmentStatus(courseId: number): Observable<AiLabAssignmentStatus> {
    return this.api
      .get<AiLabApiResponse<AiLabAssignmentStatus>>(AI_LAB_ROUTES.assignmentStatus.path, {
        params: { course_id: courseId },
        context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
      })
      .pipe(map((res) => res.data));
  }

  // ---------------------------------------------------------------------------
  // Dialog-era mock (see class doc).
  // ---------------------------------------------------------------------------

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

  /** ponytail: mock — the dialog's workflow picker. `delay` fakes latency. */
  listPublishedWorkflows(): Observable<CopilotWorkflow[]> {
    return of(MOCK_WORKFLOWS).pipe(delay(600));
  }

  /** ponytail: mock grader for the dialog. Persists on emit so the score survives a reload. */
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
