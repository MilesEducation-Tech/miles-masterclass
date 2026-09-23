import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideBookOpen,
  lucideBrain,
  lucideCheck,
  lucideChevronDown,
  lucideClipboardCheck,
  lucideClock,
  lucideEar,
  lucideFileCheck,
  lucideFileQuestion,
  lucideFlag,
  lucideHeartHandshake,
  lucideLightbulb,
  lucideListChecks,
  lucideMessageSquareText,
  lucideMicOff,
  lucideMinus,
  lucideRotateCcw,
  lucideScale,
  lucideSearchCheck,
  lucideShieldAlert,
  lucideShieldCheck,
  lucideSpeech,
  lucideTarget,
  lucideTrendingUp,
  lucideUsers,
  lucideWallet,
  lucideX,
} from '@ng-icons/lucide';
import type { AssessmentScore, SessionAssessment } from '@milesverse/sdk';
import { Button } from '@shared/ui/button/button';
import { MilesVerse } from '../../services/milesverse';
import { Utils } from '@shared/services/utils';
import {
  type CompetencyKey,
  type CompetencyScore,
  type CriterionResult,
  type CriterionVerdict,
  type DeliveryReport,
  type SessionRecord,
  type SessionReport,
  competencyIcon,
  competencyIconUrl,
  competencyLabel,
  deliveryLabel,
  difficultyColor,
  scoreColor,
} from '../../models/report.model';
import { MilesVerseSessions, type PendingSession } from '../../services/sessions.store';

const VERDICT_META: Record<CriterionVerdict, { icon: string; label: string; color: string }> = {
  met: { icon: 'lucideCheck', label: 'Met', color: '#27ae60' },
  partial: { icon: 'lucideMinus', label: 'Partial', color: '#f6bc53' },
  missed: { icon: 'lucideX', label: 'Missed', color: '#ef4444' },
};

const RADAR_SIZE = 300;
/** Below three axes a radar polygon is degenerate, so the chart is dropped. */
const RADAR_MIN_AXES = 3;

/** Poll interval while the assessment is processing. */
const ASSESSMENT_POLL_INTERVAL_MS = 2500;
/** Consecutive request failures to tolerate before giving up on a session. */
const ASSESSMENT_MAX_CONSECUTIVE_ERRORS = 5;

/** One competency as the report renders it, resolved from the response. */
interface CompetencyCard {
  key: CompetencyKey;
  label: string;
  /** Registered ng-icon name — drawn whenever `iconUrl` is null. */
  icon: string;
  /** The backend's icon image (S3), when it sent a loadable URL. */
  iconUrl: string | null;
  score: number;
  evidence: string;
  met: number;
  total: number;
}

/** One competency's criteria, as the marking-scheme audit renders them. */
interface MarkingGroup {
  key: CompetencyKey;
  label: string;
  /** Null when marking carries a key that `scores` doesn't. */
  score: number | null;
  met: number;
  results: CriterionResult[];
}

/** The wire score, plus the display fields the backend may send. */
type ScoreWire = AssessmentScore & { label?: string | null; icon?: string | null };

/** Verdicts drive an icon + colour lookup — an unknown one can't pass through. */
function toVerdict(raw: string | null | undefined): CriterionVerdict {
  const verdict = (raw ?? '').toLowerCase();
  if (verdict === 'met' || verdict === 'pass' || verdict === 'yes') return 'met';
  if (verdict === 'partial' || verdict === 'part') return 'partial';
  return 'missed';
}

function toScore(raw: ScoreWire | undefined): CompetencyScore {
  return {
    score: raw?.score ?? 0,
    evidence: raw?.evidence ?? '',
    label: raw?.label ?? undefined,
    icon: raw?.icon ?? undefined,
  };
}

/** Map the backend's assessment onto the report model, keys and all. */
function assessmentToReport(assessment: SessionAssessment): SessionReport {
  const scores: SessionReport['scores'] = {};
  for (const [key, raw] of Object.entries(assessment.scores ?? {})) {
    scores[key] = toScore(raw);
  }

  let marking: SessionReport['marking'];
  const markingEntries = Object.entries(assessment.marking ?? {});
  if (markingEntries.length) {
    marking = {};
    for (const [key, criteria] of markingEntries) {
      marking[key] = (criteria ?? []).map((c) => ({
        id: c.id,
        text: c.text || undefined,
        verdict: toVerdict(c.verdict),
        evidence: c.evidence,
        turn: c.turn ?? undefined,
      }));
    }
  }

  let delivery: DeliveryReport | undefined;
  if (assessment.delivery) {
    const signals: DeliveryReport['signals'] = {};
    for (const [key, raw] of Object.entries(assessment.delivery.signals ?? {})) {
      signals[key] = toScore(raw);
    }
    delivery = {
      overall: assessment.delivery.overall,
      signals,
      styleSummary: assessment.delivery.style_summary,
    };
  }

  return {
    overall: assessment.overall ?? 0,
    scores,
    strengths: assessment.strengths ?? [],
    growthAreas: assessment.growth_areas ?? [],
    keyMoment: assessment.key_moment
      ? { quote: assessment.key_moment.quote, note: assessment.key_moment.note }
      : { quote: '', note: '' },
    summary: assessment.summary ?? '',
    delivery,
    marking,
  };
}

/** Runs that couldn't be scored carry the reason and nothing else — no card
 *  is invented for a competency the backend never scored. */
function unscoredReport(abandoned: boolean): SessionReport {
  return {
    overall: 0,
    scores: {},
    strengths: [],
    growthAreas: [],
    keyMoment: { quote: '', note: '' },
    summary: abandoned
      ? 'The call ended before a conversation could be scored.'
      : "This session's conversation could not be scored.",
  };
}

/** Performance report: the scored debrief after a session. */
@Component({
  selector: 'app-milesverse-report',
  imports: [Button, NgIcon, RouterLink],
  templateUrl: './report.html',
  styleUrl: './report.css',
  providers: [
    // Must cover COMPETENCY_ICON_NAMES in report.model.ts.
    provideIcons({
      lucideArrowRight,
      lucideBookOpen,
      lucideBrain,
      lucideCheck,
      lucideChevronDown,
      lucideClipboardCheck,
      lucideClock,
      lucideEar,
      lucideFileCheck,
      lucideFileQuestion,
      lucideFlag,
      lucideHeartHandshake,
      lucideLightbulb,
      lucideListChecks,
      lucideMessageSquareText,
      lucideMicOff,
      lucideMinus,
      lucideRotateCcw,
      lucideScale,
      lucideSearchCheck,
      lucideShieldAlert,
      lucideShieldCheck,
      lucideSpeech,
      lucideTarget,
      lucideTrendingUp,
      lucideUsers,
      lucideWallet,
      lucideX,
    }),
  ],
  host: { class: 'milesverse block' },
})
export class MilesverseReport implements OnInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(MilesVerseSessions);
  private readonly milesverse = inject(MilesVerse);
  protected readonly utils = inject(Utils);

  protected readonly verdictMeta = VERDICT_META;

  protected readonly status = signal<'loading' | 'ready' | 'empty'>('loading');
  protected readonly record = signal<SessionRecord | null>(null);
  protected readonly isHistory = signal(false);
  protected readonly showTranscript = signal(false);

  protected readonly report = computed<SessionReport | null>(() => this.record()?.report ?? null);
  /** True when the transcript has no user turns. */
  protected readonly noParticipation = computed(
    () => !(this.record()?.transcript ?? []).some((t) => t.role === 'user'),
  );

  /** Competency keys whose backend icon image failed to load. */
  private readonly brokenIcons = signal<ReadonlySet<CompetencyKey>>(new Set());

  /** The competency cards, straight from the response's `scores` keys. */
  protected readonly competencies = computed<CompetencyCard[]>(() => {
    const rep = this.report();
    if (!rep) return [];
    const broken = this.brokenIcons();
    return Object.entries(rep.scores).map(([key, value]) => {
      const label = competencyLabel(key, value.label);
      const results = rep.marking?.[key] ?? [];
      return {
        key,
        label,
        icon: competencyIcon(key, value.icon, label),
        iconUrl: broken.has(key) ? null : competencyIconUrl(value.icon),
        score: value.score,
        evidence: value.evidence,
        met: results.filter((r) => r.verdict === 'met').length,
        total: results.length,
      };
    });
  });

  /** A dead S3 icon drops the card back to the built-in icon. */
  protected onIconError(key: CompetencyKey): void {
    this.brokenIcons.update((broken) => new Set(broken).add(key));
  }

  /** Marking groups in card order, with any marking-only keys appended. */
  protected readonly markingGroups = computed<MarkingGroup[]>(() => {
    const marking = this.report()?.marking;
    if (!marking) return [];

    const groups: MarkingGroup[] = [];
    const seen = new Set<CompetencyKey>();
    for (const card of this.competencies()) {
      const results = marking[card.key] ?? [];
      if (!results.length) continue;
      seen.add(card.key);
      groups.push({
        key: card.key,
        label: card.label,
        score: card.score,
        met: card.met,
        results,
      });
    }
    for (const [key, results] of Object.entries(marking)) {
      if (seen.has(key) || !results.length) continue;
      groups.push({
        key,
        label: competencyLabel(key),
        score: null,
        met: results.filter((r) => r.verdict === 'met').length,
        results,
      });
    }
    return groups;
  });

  /** One marking group open at a time; the first opens by default. */
  protected readonly expandedMarking = linkedSignal<CompetencyKey | null>(
    () => this.markingGroups()[0]?.key ?? null,
  );

  /** Delivery signals, likewise keyed by whatever the response sends. */
  protected readonly deliverySignals = computed(() => {
    const delivery = this.report()?.delivery;
    if (!delivery) return [];
    return Object.entries(delivery.signals).map(([key, value]) => ({
      key,
      label: deliveryLabel(key, value.label),
      score: value.score,
      evidence: value.evidence,
    }));
  });

  /** Progress messages shown while the evaluator runs. */
  private static readonly ANALYZE_MESSAGES = [
    'Reading the full transcript…',
    'Judging each marking criterion against your words…',
    'Scoring this scenario’s competencies…',
    'Assessing delivery and communication style…',
    'Writing your strengths and growth areas…',
    'Almost there — assembling your report…',
  ];
  protected readonly analyzeStep = signal(0);
  protected readonly analyzingMessage = computed(
    () => MilesverseReport.ANALYZE_MESSAGES[this.analyzeStep()],
  );
  private analyzeTimer: ReturnType<typeof setInterval> | undefined;

  /** Overall score shown in the dial; counts up from 0 on reveal. */
  protected readonly displayedOverall = signal(0);
  protected readonly overallTier = computed(() => {
    const score = this.report()?.overall ?? 0;
    if (score >= 80) return 'Excellent';
    if (score >= 65) return 'Strong';
    if (score >= 50) return 'Developing';
    return 'Needs work';
  });

  /** Stops the poll after the component is destroyed. */
  private destroyed = false;

  protected readonly cataloguePath = this.utils.localePath('simulation');
  protected readonly tryAgainPath = computed(() =>
    this.utils.localePath(`simulation/briefing/${this.record()?.simulationId ?? ''}`),
  );

  protected readonly durationLabel = computed(() => {
    const s = this.record()?.durationSec ?? 0;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  });
  protected readonly diffColor = computed(() => difficultyColor(this.record()?.difficulty ?? ''));
  protected readonly startedLabel = computed(() => {
    const iso = this.record()?.startedAt;
    return iso ? new Date(iso).toLocaleString() : '';
  });

  protected readonly overallColor = computed(() => scoreColor(this.report()?.overall ?? 0));
  protected color(v: number): string {
    return scoreColor(v);
  }

  // -- overall dial geometry -------------------------------------------------
  private readonly dialR = 81; // (176 - 14) / 2
  protected readonly dialC = 2 * Math.PI * this.dialR;
  protected readonly dialOffset = computed(
    () => this.dialC * (1 - Math.max(0, Math.min(100, this.displayedOverall())) / 100),
  );

  // -- radar geometry (one axis per scored competency) -----------------------
  protected readonly radarSize = RADAR_SIZE;
  /** Below a triangle the dial stands alone. */
  protected readonly showRadar = computed(() => this.competencies().length >= RADAR_MIN_AXES);
  protected readonly headlineGridClass = computed(() =>
    this.showRadar() ? 'mt-8 grid gap-5 lg:grid-cols-2' : 'mt-8 grid gap-5',
  );

  private point(i: number, value: number, axes: number): [number, number] {
    const cx = RADAR_SIZE / 2;
    const cy = RADAR_SIZE / 2;
    const radius = RADAR_SIZE * 0.34;
    const angle = (Math.PI * 2 * i) / Math.max(1, axes) - Math.PI / 2;
    const r = radius * (Math.max(0, Math.min(100, value)) / 100);
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }
  protected readonly radarRings = computed(() => {
    const axes = this.competencies().length;
    return [0.25, 0.5, 0.75, 1].map((ring) =>
      Array.from({ length: axes }, (_, i) =>
        this.point(i, ring * 100, axes)
          .map((n) => n.toFixed(1))
          .join(','),
      ).join(' '),
    );
  });
  protected readonly radarSpokes = computed(() => {
    const axes = this.competencies().length;
    return Array.from({ length: axes }, (_, i) => {
      const [x, y] = this.point(i, 100, axes);
      return { x1: RADAR_SIZE / 2, y1: RADAR_SIZE / 2, x2: x, y2: y };
    });
  });
  protected readonly radarPath = computed(() => {
    const cards = this.competencies();
    if (!cards.length) return '';
    const pts = cards.map((c, i) => this.point(i, c.score, cards.length));
    return (
      pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ') +
      ' Z'
    );
  });
  protected readonly radarDots = computed(() => {
    const cards = this.competencies();
    return cards.map((c, i) => {
      const [x, y] = this.point(i, c.score, cards.length);
      return { x, y };
    });
  });
  protected readonly radarLabels = computed(() => {
    const cards = this.competencies();
    return cards.map((c, i) => {
      const [x, y] = this.point(i, 122, cards.length);
      return { x, y, text: MilesverseReport.axisLabel(c.label) };
    });
  });

  /** One short word per axis — full titles collide at this radius. */
  private static axisLabel(label: string): string {
    const word = label.split(/[\s&·—-]+/).filter(Boolean)[0] ?? label;
    return word.length > 13 ? `${word.slice(0, 12)}…` : word;
  }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const sessionId = this.route.snapshot.queryParamMap.get('session');
    if (sessionId) {
      const rec = this.store.getSession(sessionId);
      if (rec) {
        this.record.set(rec);
        this.isHistory.set(true);
        this.status.set('ready');
        this.animateOverall(rec.report.overall);
      } else {
        this.status.set('empty');
      }
      return;
    }

    const pending = this.store.getPending();
    if (!pending?.sessionId) {
      // No backend session to fetch an assessment for.
      this.status.set('empty');
      return;
    }

    this.startAnalyzeTicker();
    void this.pollAssessment(pending, pending.sessionId);
  }

  private startAnalyzeTicker(): void {
    this.stopAnalyzeTicker();
    this.analyzeTimer = setInterval(() => {
      this.analyzeStep.update((step) =>
        Math.min(step + 1, MilesverseReport.ANALYZE_MESSAGES.length - 1),
      );
    }, 4000);
  }

  private stopAnalyzeTicker(): void {
    if (this.analyzeTimer) clearInterval(this.analyzeTimer);
    this.analyzeTimer = undefined;
  }

  /** Poll the real evaluator until it has a verdict. */
  private async pollAssessment(pending: PendingSession, sessionId: string): Promise<void> {
    let consecutiveErrors = 0;
    while (!this.destroyed) {
      let assessment: SessionAssessment;
      try {
        assessment = await this.milesverse.assessment(sessionId);
        consecutiveErrors = 0;
      } catch {
        consecutiveErrors += 1;
        if (consecutiveErrors >= ASSESSMENT_MAX_CONSECUTIVE_ERRORS) {
          this.stopAnalyzeTicker();
          this.status.set('empty');
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, ASSESSMENT_POLL_INTERVAL_MS));
        continue;
      }
      if (this.destroyed) return;

      if (assessment.status === 'ready') {
        // Prefer the backend's transcript and timings once scored.
        this.finish(
          {
            ...pending,
            transcript: assessment.transcript.length ? assessment.transcript : pending.transcript,
            durationSec: assessment.duration_seconds ?? pending.durationSec,
            startedAt: assessment.started_at ?? pending.startedAt,
          },
          assessmentToReport(assessment),
        );
        return;
      }
      if (assessment.status === 'failed' || assessment.status === 'abandoned') {
        this.finish(pending, unscoredReport(assessment.status === 'abandoned'));
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, ASSESSMENT_POLL_INTERVAL_MS));
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopAnalyzeTicker();
  }

  private finish(pending: PendingSession, report: SessionReport): void {
    this.stopAnalyzeTicker();
    const rec: SessionRecord = {
      id: pending.id,
      sessionId: pending.sessionId,
      simulationId: pending.simulationId,
      scenarioTitle: pending.scenarioTitle,
      personaName: pending.personaName,
      difficulty: pending.difficulty,
      startedAt: pending.startedAt,
      durationSec: pending.durationSec,
      report,
      transcript: pending.transcript,
      markingScheme: pending.markingScheme,
      schemaVersion: 1,
    };
    this.store.saveSession(rec);
    this.store.clearPending();
    this.record.set(rec);
    this.status.set('ready');
    this.animateOverall(report.overall);
  }

  /** Animate the dial from 0 to the score. */
  private animateOverall(target: number): void {
    const clamped = Math.max(0, Math.min(100, target));
    if (
      !isPlatformBrowser(this.platformId) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      this.displayedOverall.set(clamped);
      return;
    }
    const start = performance.now();
    const duration = 1100;
    const tick = (now: number): void => {
      if (this.destroyed) return;
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      this.displayedOverall.set(Math.round(clamped * eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /** The criterion wording: from the assessment, else the authored scheme. */
  protected criterionText(key: CompetencyKey, result: CriterionResult): string {
    return (
      result.text ??
      this.record()?.markingScheme?.[key]?.find((m) => m.id === result.id)?.text ??
      result.id
    );
  }

  /** One competency's criteria open at a time — clicking the open one closes it. */
  protected toggleMarkingGroup(key: CompetencyKey): void {
    this.expandedMarking.update((cur) => (cur === key ? null : key));
  }

  /** Expand a competency's marking group and scroll to it. */
  protected focusMarking(key: CompetencyKey): void {
    if (!this.markingGroups().some((g) => g.key === key)) return;
    this.expandedMarking.set(key);
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        document
          .getElementById('mv-marking-' + key)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
    }
  }
}
