import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChartNoAxesColumn,
  lucideCircleCheck,
  lucideGauge,
  lucideLayers,
  lucideZap,
} from '@ng-icons/lucide';
import { InViewDirective, HoverSpringDirective } from '@code_with_sachin/ngx-motion';
import {
  AiLabPracticalAssignment,
  AiLabPracticalProgress,
  AiLabTokenBalance,
} from '@features/ai-labs/models/ai-labs.model';
import { hasStatValue, labCompletionPercent } from '@features/ai-labs/utils/progress-stats';
import { tokenMeterVariant, tokenUsedPercent } from '@features/ai-labs/utils/token-usage';
import { Button } from '@shared/ui/button/button';
import { Progress } from '@shared/ui/progress/progress';

/**
 * Label + pill treatment for one assignment status.
 *
 * A lookup with a fallback rather than a `@switch`: only a handful of values are evidenced, so one
 * the backend adds later has to render as itself instead of vanishing.
 */
const STATUS_UI: Record<string, { label: string; class: string }> = {
  not_started: { label: 'Not started', class: 'border-border bg-white/5 text-muted-foreground' },
  draft: { label: 'Draft', class: 'border-border bg-white/5 text-muted-foreground' },
  submitted: { label: 'Submitted', class: 'border-accent/40 bg-accent/10 text-accent' },
  grading: { label: 'Grading', class: 'border-accent/40 bg-accent/10 text-accent' },
  graded: { label: 'Graded', class: 'border-success/40 bg-success-bg text-success' },
  failed: {
    label: 'Needs attention',
    class: 'border-destructive/40 bg-destructive/10 text-destructive',
  },
};

const STATUS_FALLBACK = { class: 'border-border bg-white/5 text-muted-foreground' };

/** One stat tile of the header row. */
interface ProgressStat {
  icon: string;
  value: string;
  label: string;
}

/** `needs_review` → `Needs review`, for a status this build hasn't been told about. */
function humanise(status: string): string {
  const text = status.replace(/[_-]+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Unknown';
}

/**
 * "Where your labs stand" — the learner's own dashboard, meant to sit under the marketing
 * "How it works" rail on the AI Labs landing page.
 *
 * **Presentational, and not yet mounted anywhere.** The source design injects a progress store and
 * a token service; here everything arrives as inputs. `progress` is the `progress` object of
 * `web-api/v1/ai-labs/practical-progress/` and `balance` the `tokens` object of `tokens/`, both as
 * sent, so binding is passing them through. Nothing fabricated is shown to a learner in the
 * meantime — `*.stories.ts` is where the design is reviewed, with sample data from `@testing/`.
 *
 * Self-gating, like `AiLabTokenMeter`: with no totals it renders nothing, so a host page drops it
 * in without an `@if`. A failed read should render nothing too — this is supplementary content on
 * a public marketing page, and costing a section beats showing an error state to someone who is
 * just reading.
 *
 * Section chrome (eyebrow pill, `ai-metal-text` heading, reveal + hover-spring) is copied from the
 * neighbouring sections so it reads as part of the page rather than a widget bolted onto it.
 * `ai-metal-text` is defined in the landing page's own stylesheet, so the heading renders plain
 * until this is mounted there.
 */
@Component({
  selector: 'app-ai-lab-progress-panel',
  imports: [Button, DatePipe, DecimalPipe, NgIcon, Progress, InViewDirective, HoverSpringDirective],
  templateUrl: './ai-lab-progress-panel.html',
  host: { class: 'block' },
  providers: [
    provideIcons({
      lucideChartNoAxesColumn,
      lucideCircleCheck,
      lucideGauge,
      lucideLayers,
      lucideZap,
    }),
  ],
})
export class AiLabProgressPanel {
  /** Totals and rows. `null` renders the section as absent. */
  readonly progress = input<AiLabPracticalProgress | null>(null);

  /** Copilot Credits. `null` means no allotment — the card is dropped, not zeroed. */
  readonly balance = input<AiLabTokenBalance | null>(null);

  readonly isLoading = input(false);

  /** A top-up request is in flight. */
  readonly submitting = input(false);

  readonly topUp = output<void>();
  readonly openAssignment = output<AiLabPracticalAssignment>();

  protected readonly assignments = computed(() => this.progress()?.assignments ?? []);

  /**
   * The header tiles.
   *
   * A tile whose figure came back null / undefined / NaN / 0 is dropped rather than rendered —
   * "0 submissions" beside "0% average" reads as a scored dashboard when the truth is that the
   * backend sent nothing. `figure` is what the tile is judged on; for "Labs completed" that's the
   * denominator, since a catalogue of 0 makes the whole ratio meaningless.
   */
  protected readonly stats = computed<ProgressStat[]>(() => {
    const p = this.progress();
    if (!p) return [];
    return [
      {
        icon: 'lucideCircleCheck',
        value: `${p.assignments_completed} / ${p.assignments_available}`,
        label: 'Labs completed',
        figure: p.assignments_available,
      },
      {
        icon: 'lucideLayers',
        value: `${p.assignments_attempted}`,
        label: 'Labs attempted',
        figure: p.assignments_attempted,
      },
      {
        icon: 'lucideChartNoAxesColumn',
        value: `${p.total_submissions}`,
        label: 'Submissions',
        figure: p.total_submissions,
      },
      {
        icon: 'lucideGauge',
        // A decimal string ("49.00"); `Number` drops the trailing zeros, as the old numeric field read.
        value: `${Number(p.average_percentage)}%`,
        label: 'Average score',
        figure: p.average_percentage,
      },
    ]
      .filter((stat) => hasStatValue(stat.figure))
      .map(({ icon, value, label }) => ({ icon, value, label }));
  });

  protected readonly completionPercent = computed(() => {
    const p = this.progress();
    return p ? labCompletionPercent(p.assignments_completed, p.assignments_available) : 0;
  });

  protected readonly usedPercent = computed(() => {
    const b = this.balance();
    return b ? tokenUsedPercent(b.cap, b.used) : 0;
  });

  protected readonly meterVariant = computed(() => tokenMeterVariant(this.usedPercent()));

  /** The same guard, for the blocks the template gates directly. */
  protected readonly hasStat = hasStatValue;

  protected statusUi(status: string): { label: string; class: string } {
    return STATUS_UI[status] ?? { label: humanise(status), ...STATUS_FALLBACK };
  }

  /**
   * The lab's square crop, the only art the payload stamps on a row. The tile stays 9:16 as
   * designed, so `object-cover` trims its sides. Empty strings count as missing.
   */
  protected thumbnail(row: AiLabPracticalAssignment): string | null {
    return row.ai_lab_square_thumbnail_url || null;
  }

  /**
   * The lab's name when the row matches a lab in this catalogue; otherwise the assignment's slug,
   * humanised, because the payload carries no other title for it.
   */
  protected title(row: AiLabPracticalAssignment): string {
    return row.ai_lab_course_name || humanise(row.slug);
  }

  /** A lab with no attempts has nothing to continue. */
  protected ctaLabel(row: AiLabPracticalAssignment): string {
    return row.attempts > 0 ? 'Continue' : 'Start lab';
  }
}
