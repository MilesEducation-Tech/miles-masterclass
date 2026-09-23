/**
 * MilesVerse performance-report domain model.
 *
 * The rubric is authored per simulation: `scores` and `marking` are keyed by
 * that scenario's own slugs and the report renders only what the response
 * carries. Titles fall back to a preset, then to the slug; icons are the
 * frontend's, since the backend's `icon` is an image URL, not an icon name.
 */

/** A competency slug exactly as the backend names it. */
export type CompetencyKey = string;

/** Fallback for a slug no preset or keyword matches. */
const DEFAULT_ICON = 'lucideTarget';

/** Titles and icons for the slugs the platform ships with. */
const COMPETENCY_PRESETS: Record<string, { label: string; icon: string }> = {
  empathy: { label: 'Empathy & Acknowledgement', icon: 'lucideHeartHandshake' },
  listening: { label: 'Active Listening', icon: 'lucideEar' },
  clarity: { label: 'Clarity & Directness', icon: 'lucideMessageSquareText' },
  composure: { label: 'Composure Under Pressure', icon: 'lucideShieldCheck' },
  resolution: { label: 'Resolution & Next Steps', icon: 'lucideFlag' },
  skepticism: { label: 'Professional Skepticism', icon: 'lucideSearchCheck' },
};

/** Slug keyword → icon, for rubrics the presets don't cover. First match wins. */
const ICON_KEYWORDS: readonly (readonly [RegExp, string])[] = [
  [/skeptic|challenge|probe|inquiry|question/, 'lucideSearchCheck'],
  [/empath|rapport|acknowledg|warmth/, 'lucideHeartHandshake'],
  [/listen|hear/, 'lucideEar'],
  [/clarity|clear|communicat|explain|articulat/, 'lucideMessageSquareText'],
  [/composure|pressure|calm|resilien/, 'lucideShieldCheck'],
  [/resolution|next.?step|closure|follow.?up|action/, 'lucideFlag'],
  [/evidence|document|workpaper|record|audit.?trail/, 'lucideClipboardCheck'],
  [/risk|fraud|control|threat/, 'lucideShieldAlert'],
  [/ethic|independen|objectiv|complian|regulat|standard/, 'lucideScale'],
  [/judg|analy|reason|critical|assess/, 'lucideBrain'],
  [/negotiat|stakeholder|client|team|collaborat|relationship/, 'lucideUsers'],
  [/knowledge|technical|concept|framework|theory/, 'lucideBookOpen'],
  [/time|deadline|schedul|planning|prioriti/, 'lucideClock'],
  [/budget|cost|financ|pricing|commercial/, 'lucideWallet'],
  [/insight|creativ|solution|idea|recommend/, 'lucideLightbulb'],
  [/confiden|assert|persuas|influenc|present/, 'lucideSpeech'],
  [/structure|process|procedure|checklist|method/, 'lucideListChecks'],
  [/accuracy|quality|detail|complete|thorough/, 'lucideFileCheck'],
];

/** Every icon `competencyIcon()` returns — report.ts registers exactly these. */
export const COMPETENCY_ICON_NAMES: readonly string[] = [
  ...new Set<string>([
    DEFAULT_ICON,
    ...Object.values(COMPETENCY_PRESETS).map((p) => p.icon),
    ...ICON_KEYWORDS.map(([, icon]) => icon),
  ]),
];

const ICON_SET = new Set(COMPETENCY_ICON_NAMES);

/** `evidence_handling` → `Evidence Handling`. */
export function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Card title: what the backend sent, else a preset, else the humanised slug. */
export function competencyLabel(key: CompetencyKey, provided?: string | null): string {
  const label = provided?.trim();
  if (label) return label;
  return COMPETENCY_PRESETS[key.toLowerCase()]?.label ?? humanizeKey(key);
}

/** The backend's icon when it is loadable as-is: absolute URL or data URI. */
export function competencyIconUrl(provided?: string | null): string | null {
  const value = provided?.trim();
  if (!value) return null;
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:')) return value;
  return null;
}

/** Card icon, always one the report registers — the frontend owns this. */
export function competencyIcon(
  key: CompetencyKey,
  provided?: string | null,
  label?: string | null,
): string {
  const wanted = provided?.trim();
  if (wanted && ICON_SET.has(wanted)) return wanted;

  const slug = key.toLowerCase();
  const preset = COMPETENCY_PRESETS[slug];
  if (preset) return preset.icon;

  const haystack = `${slug} ${(label ?? '').toLowerCase()}`;
  return ICON_KEYWORDS.find(([pattern]) => pattern.test(haystack))?.[1] ?? DEFAULT_ICON;
}

/** "Delivery" lens — how the candidate communicates. Also response-keyed. */
const DELIVERY_PRESETS: Record<string, string> = {
  tone: 'Tone & Warmth',
  assertiveness: 'Assertiveness',
  concision: 'Concision',
  curiosity: 'Curiosity',
};

export function deliveryLabel(key: string, provided?: string | null): string {
  const label = provided?.trim();
  if (label) return label;
  return DELIVERY_PRESETS[key.toLowerCase()] ?? humanizeKey(key);
}

export type CriterionVerdict = 'met' | 'partial' | 'missed';

export interface MarkingCriterion {
  id: string;
  text: string;
}

/** The authored rubric, grouped by competency slug. */
export type MarkingScheme = Record<CompetencyKey, MarkingCriterion[]>;

export interface CriterionResult {
  id: string;
  /** The criterion wording, when the assessment echoes it back. */
  text?: string;
  verdict: CriterionVerdict;
  /** A quote from the candidate's lines, or why it's missing. */
  evidence: string;
  /** 1-based turn number in the transcript, when quotable. */
  turn?: number;
}

export interface CompetencyScore {
  score: number; // 0-100
  evidence: string;
  /** Card title from the backend; falls back to a preset or the slug. */
  label?: string;
  /** Icon slug from the backend; honoured only if the report registers it. */
  icon?: string;
}

export interface DeliveryReport {
  overall: number;
  signals: Record<string, CompetencyScore>;
  styleSummary: string;
}

export interface SessionReport {
  overall: number;
  /** Keyed by the scenario's own competency slugs, in response order. */
  scores: Record<CompetencyKey, CompetencyScore>;
  strengths: string[];
  growthAreas: string[];
  keyMoment: { quote: string; note: string };
  summary: string;
  delivery?: DeliveryReport;
  /** Per-criterion verdicts, keyed the same way as `scores`. */
  marking?: Record<CompetencyKey, CriterionResult[]>;
}

export interface TranscriptTurn {
  role: 'user' | 'persona';
  content: string;
}

/** One completed run, persisted locally (until the backend evaluator lands). */
export interface SessionRecord {
  id: string;
  /** The backend session id from POST /sessions, when available. */
  sessionId?: string;
  simulationId: string;
  scenarioTitle: string;
  personaName: string;
  /** Authored difficulty tier (Foundational | Intermediate | Advanced). */
  difficulty: string;
  startedAt: string; // ISO
  durationSec: number;
  report: SessionReport;
  transcript: TranscriptTurn[];
  /** Criteria text by competency, so the report renders without a refetch. */
  markingScheme?: MarkingScheme;
  schemaVersion: number;
}

/** Score → traffic-light colour. Literals, not tokens: these feed inline
 *  [style] bindings that concatenate alpha suffixes. */
export function scoreColor(v: number): string {
  if (v >= 80) return '#27ae60';
  if (v >= 65) return '#2a85ff';
  if (v >= 50) return '#f6bc53';
  return '#ef4444';
}

/** Authored-difficulty tier → chip colour. */
export function difficultyColor(tier: string): string {
  switch (tier) {
    case 'Foundational':
      return '#27ae60';
    case 'Advanced':
      return '#f6bc53';
    default:
      return '#2a85ff'; // Intermediate / unknown
  }
}
