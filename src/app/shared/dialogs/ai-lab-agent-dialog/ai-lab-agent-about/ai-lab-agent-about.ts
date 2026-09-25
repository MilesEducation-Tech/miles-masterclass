import { Component, computed, input, signal } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import {
  NgpCollapsible,
  NgpCollapsibleContent,
  NgpCollapsibleTrigger,
} from 'ng-primitives/collapsible';
import { NgpSwitch, NgpSwitchThumb } from 'ng-primitives/switch';
import { heroChevronRight } from '@ng-icons/heroicons/outline';
import { logo } from '@core/constants/icon';
import { ContentAbout, ContentDetails } from '@core/models/course.model';
import { AiLabAssessmentReport } from '@core/models/ai-lab-assessment.model';

/**
 * The "about" block for the AI Lab agent dialog — a clone of
 * `app-course-about`, kept as its own component so the AI Lab design can be
 * changed without touching the course dialog that every offering uses.
 *
 * It is a clone, not a subclass or a wrapper: the point is that the two are
 * free to diverge. If you find yourself syncing a change across both, that's
 * the signal to reunify them, not to keep copying.
 *
 * Diverged from the original so far:
 *   - the `type === 'webinar'` branches are gone (an AI Lab section is always a
 *     masterclass course);
 *   - the bento stats grid is replaced by the assessment report, which is
 *     currently static — see `AI_LAB_ASSESSMENT_REPORT` for the wiring notes.
 */
@Component({
  selector: 'app-ai-lab-agent-about',
  imports: [
    NgIcon,
    NgpCollapsible,
    NgpCollapsibleContent,
    NgpCollapsibleTrigger,
    NgpSwitch,
    NgpSwitchThumb,
  ],
  templateUrl: './ai-lab-agent-about.html',
})
export class AiLabAgentAbout {
  card = input.required<ContentAbout | ContentDetails>();

  /**
   * The graded submission to show. Null (the default) hides the whole assessment
   * section — that's the not-yet-submitted state, where the dialog shows the
   * submit panel instead. Once a workflow is submitted the dialog feeds the
   * report here and the section reveals.
   */
  report = input<AiLabAssessmentReport | null>(null);

  icons = signal({ logo, chevron: heroChevronRight });

  /** Filter toggle, mirroring the exam report page's "Show wrong only".
   *  Scoped to the MCQ half — the flow checks are few and always all shown. */
  protected readonly showWrongOnly = signal(false);

  protected readonly visibleQuestions = computed(() => {
    const report = this.report();
    if (!report) return [];
    return this.showWrongOnly()
      ? report.mcq.questions.filter((q) => !q.isCorrect)
      : report.mcq.questions;
  });

  /**
   * Keys of the expanded rows. Keyed by string, not id, because the two halves
   * number their rows independently — flow check 1 and an MCQ id would
   * otherwise be able to collide and expand each other.
   *
   * A Set in a signal, replaced rather than mutated so the signal notifies.
   */
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  protected isExpanded(key: string): boolean {
    return this.expanded().has(key);
  }

  protected toggleExpand(key: string): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  protected toggleWrongOnly(): void {
    this.showWrongOnly.update((v) => !v);
  }
}
