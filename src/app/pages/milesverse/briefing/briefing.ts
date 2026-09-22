import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import {
  Component,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideArrowRight,
  lucideCheck,
  lucideChevronDown,
  lucideEar,
  lucideFileSpreadsheet,
  lucideFileText,
  lucideFlag,
  lucideFolderOpen,
  lucideGraduationCap,
  lucideHeartHandshake,
  lucideLock,
  lucideMail,
  lucideMessageSquareText,
  lucideMessagesSquare,
  lucideMic,
  lucideMicOff,
  lucidePhoneOff,
  lucideQuote,
  lucideRotateCcw,
  lucideSearchX,
  lucideShieldCheck,
  lucideSparkles,
  lucideTarget,
  lucideTimer,
  lucideUser,
  lucideX,
} from '@ng-icons/lucide';
import {
  MilesverseApiError,
  MilesverseNetworkError,
  type MarkingCriterion,
  type Scenario,
  type SimulationDetail,
} from '@milesverse/sdk';
import { Button } from '@shared/components/ui/button/button';
import { MilesVerse } from '@core/services/milesverse/milesverse';
import { Utils } from '@core/services/utils/utils';
import { personaAvatarUrl, seedHue } from '../milesverse.model';
import type { MarkingScheme, TranscriptTurn } from '../shared/report.model';
import { MilesVerseSessions } from '../shared/sessions.store';

/** Fallback rubric when a scenario ships no marking scheme. */
const COMPETENCIES = [
  { key: 'empathy', label: 'Empathy & Acknowledgement', icon: 'lucideHeartHandshake' },
  { key: 'listening', label: 'Active Listening', icon: 'lucideEar' },
  { key: 'clarity', label: 'Clarity & Directness', icon: 'lucideMessageSquareText' },
  { key: 'composure', label: 'Composure Under Pressure', icon: 'lucideShieldCheck' },
  { key: 'resolution', label: 'Resolution & Next Steps', icon: 'lucideFlag' },
] as const;

/** Session difficulty the learner picks; sent with session start. */
const DIFFICULTY_LEVELS = [
  {
    key: 'supportive',
    level: 1,
    label: 'Supportive',
    blurb: "They're more open and de-escalate readily. Best for a first attempt.",
  },
  {
    key: 'realistic',
    level: 2,
    label: 'Realistic',
    blurb: 'A true-to-life reaction, neither a pushover nor impossible.',
  },
  {
    key: 'challenging',
    level: 3,
    label: 'Challenging',
    blurb: 'Guarded and hard to move. Only genuine skill shifts them.',
  },
] as const;

type DifficultyKey = (typeof DIFFICULTY_LEVELS)[number]['key'];

/** Map legacy tier names onto the three dials. */
const TIER_TO_MODE: Record<string, DifficultyKey> = {
  foundational: 'supportive',
  intermediate: 'realistic',
  advanced: 'challenging',
};

type Artifact = Record<string, unknown>;

/** Live session lifecycle. */
type SessionPhase = 'connecting' | 'live' | 'ended' | 'error';

/** Idle time before the "Still there?" prompt shows. */
const IDLE_WARNING_MS = 30_000;
/** Unanswered prompt auto-ends the session after this. */
const IDLE_AUTO_END_MS = 20_000;

/** The advertised session length in seconds; also drives the timer ring. */
const SESSION_TARGET_SECONDS = 300;
/** Grace period past the target before the session is force-ended. */
const SESSION_GRACE_SECONDS = 60;

/** A message as delivered by the Anam SDK's MESSAGE_HISTORY_UPDATED event. */
interface AnamMessage {
  id: string;
  content: string;
  role: 'user' | 'persona';
}

/** Minimal shape of the Anam browser client (loaded from CDN at runtime). */
interface AnamClient {
  streamToVideoElement(id: string): Promise<void> | void;
  muteInputAudio(): void;
  unmuteInputAudio(): void;
  stopStreaming(): Promise<void> | void;
  addListener?(event: string, cb: (...args: unknown[]) => void): void;
  /** The engine's own session id, populated once streaming has started. */
  getActiveSessionId?(): string | null;
}

/** Scenario briefing: the case-file dossier plus the live Anam call overlay. */
@Component({
  selector: 'app-milesverse-briefing',
  imports: [Button, NgIcon, NgTemplateOutlet, RouterLink],
  templateUrl: './briefing.html',
  // Split across two files ONLY to stay under Angular's per-file
  // `anyComponentStyle` budget (16 kB) — one 26 kB file tripped it. Both are the
  // same component scope; see the header in briefing-session.css.
  styleUrls: ['./briefing.css', './briefing-session.css'],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideArrowRight,
      lucideCheck,
      lucideChevronDown,
      lucideEar,
      lucideFileSpreadsheet,
      lucideFileText,
      lucideFlag,
      lucideFolderOpen,
      lucideGraduationCap,
      lucideHeartHandshake,
      lucideLock,
      lucideMail,
      lucideMessageSquareText,
      lucideMessagesSquare,
      lucideMic,
      lucideMicOff,
      lucidePhoneOff,
      lucideQuote,
      lucideRotateCcw,
      lucideSearchX,
      lucideShieldCheck,
      lucideSparkles,
      lucideTarget,
      lucideTimer,
      lucideUser,
      lucideX,
    }),
  ],
  host: { class: 'block', '(document:keydown.escape)': 'onEscapeKey()' },
})
export class MilesverseBriefing implements OnInit, OnDestroy {
  readonly id = input<string>('');

  private readonly milesverse = inject(MilesVerse);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);
  private readonly store = inject(MilesVerseSessions);
  protected readonly utils = inject(Utils);

  protected readonly competencies = COMPETENCIES;
  protected readonly modes = DIFFICULTY_LEVELS;

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly detail = signal<SimulationDetail | null>(null);
  protected readonly starting = signal(false);
  protected readonly launchError = signal<string | null>(null);
  protected readonly heroBroken = signal(false);
  protected readonly selectedMode = signal<DifficultyKey>('realistic');
  protected readonly showMarking = signal(false);

  // -- live session state ----------------------------------------------------
  protected readonly sessionOpen = signal(false);
  protected readonly sessionPhase = signal<SessionPhase>('connecting');
  protected readonly sessionMessage = signal<string | null>(null);
  protected readonly micMuted = signal(false);
  protected readonly briefOpen = signal(false);
  protected readonly caseFileOpen = signal(false);
  protected readonly caseFileArtifact = signal<number | null>(null);
  protected readonly elapsed = signal(0);
  protected readonly idlePromptOpen = signal(false);
  protected readonly durationWarningOpen = signal(false);

  private anamClient: AnamClient | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private idleWarnTimer: ReturnType<typeof setTimeout> | undefined;
  private idleEndTimer: ReturnType<typeof setTimeout> | undefined;
  /** Latest full transcript from the conversation, replaced each history event. */
  private transcript: TranscriptTurn[] = [];
  private backendSessionId: string | undefined;
  private startedAtIso = '';
  /** Latches the duration warning so a dismissal isn't re-opened by the next tick. */
  private durationWarned = false;
  /** Latches the one-time hand-off so a self-triggered close doesn't double-fire. */
  private completing = false;

  /** The rich authoring doc, when the API resolved one. */
  protected readonly scenario = computed<Scenario | null>(() => this.detail()?.scenario ?? null);

  /** Display fields, never empty. */
  protected readonly title = computed(
    () =>
      this.detail()?.name?.trim() ||
      this.detail()?.title?.trim() ||
      this.scenario()?.title?.trim() ||
      'Untitled scenario',
  );
  protected readonly tagline = computed(
    () => this.scenario()?.tagline?.trim() || this.detail()?.tagline?.trim() || null,
  );
  protected readonly subjectName = computed(() => this.scenario()?.subject?.trim() || null);

  protected readonly situation = computed(
    () => this.scenario()?.situation?.trim() || this.scenario()?.practice?.trim() || null,
  );
  protected readonly objective = computed(
    () => this.scenario()?.objective?.trim() || this.detail()?.objective?.trim() || null,
  );
  /** Split a semicolon-separated objective into goals; empty if one sentence. */
  protected readonly objectiveGoals = computed<string[]>(() => {
    const parts = (this.objective() ?? '')
      .split(';')
      .map((part) => part.trim().replace(/^and\s+/i, ''))
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
    return parts.length >= 2 ? parts : [];
  });
  protected readonly openingLine = computed(() => this.scenario()?.openingLine?.trim() || null);
  protected readonly concepts = computed(() =>
    (this.scenario()?.concepts ?? []).filter(
      (c): c is string => typeof c === 'string' && !!c.trim(),
    ),
  );

  protected readonly personaName = computed(
    () => this.scenario()?.personaName?.trim() || this.detail()?.name?.trim() || 'AI persona',
  );
  protected readonly personaRole = computed(
    () =>
      this.scenario()?.personaRole?.trim() || this.detail()?.role?.trim() || 'Conversation partner',
  );
  protected readonly personaInitial = computed(() =>
    (this.personaName().charAt(0) || 'M').toUpperCase(),
  );
  /** Persona portrait for the session brief. */
  protected readonly portraitBroken = signal(false);
  protected readonly personaPortrait = computed(() =>
    personaAvatarUrl(this.personaName() || this.title() || 'milesverse', 96),
  );

  /** Scenario art, or a generated persona-portrait fallback. */
  protected readonly image = computed(
    () =>
      this.milesverse.resolveMedia(this.detail()?.thumbnail_url) ||
      personaAvatarUrl(this.personaName() || this.title() || 'milesverse', 640),
  );
  protected readonly hue = computed(() =>
    seedHue(this.subjectName() || this.title() || 'milesverse'),
  );

  protected readonly artifacts = computed<Artifact[]>(() => this.scenario()?.artifacts ?? []);

  /** Marking scheme as displayable groups, present only when the API exposes it. */
  protected readonly markingGroups = computed<{ label: string; items: MarkingCriterion[] }[]>(
    () => {
      const raw = this.scenario()?.marking;
      if (!raw || typeof raw !== 'object') return [];
      return Object.entries(raw)
        .filter(([, items]) => Array.isArray(items) && items.length)
        .map(([key, items]) => ({ label: this.humanize(key), items: items as MarkingCriterion[] }));
    },
  );
  protected readonly markingCount = computed(() =>
    this.markingGroups().reduce((n, g) => n + g.items.length, 0),
  );
  /** Rubric list: real marking groups when present, else the five competencies. */
  protected readonly scoredOn = computed<{ label: string; icon: string; count?: number }[]>(() => {
    const groups = this.markingGroups();
    return groups.length
      ? groups.map((g) => ({ label: g.label, icon: 'lucideTarget', count: g.items.length }))
      : COMPETENCIES.map((c) => ({ label: c.label, icon: c.icon }));
  });

  protected readonly backPath = computed(() => this.utils.localePath('simulation'));

  protected readonly elapsedLabel = computed(() => {
    const s = this.elapsed();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });

  /** 2πr for the 22px timer ring (r = 9). */
  protected readonly timerRingCircumference = 56.55;
  protected readonly timerRingOffset = computed(() => {
    const progress = Math.min(1, this.elapsed() / SESSION_TARGET_SECONDS);
    return this.timerRingCircumference * (1 - progress);
  });
  /** White while comfortable, gold in the final minute, red in the last 15s. */
  protected readonly timerColor = computed(() => {
    const s = this.elapsed();
    if (s >= SESSION_TARGET_SECONDS - 15) return '#ef4444';
    if (s >= SESSION_TARGET_SECONDS - 60) return '#f6bc53';
    return '#ffffff';
  });

  constructor() {
    effect(() => {
      const raw = (this.scenario()?.difficulty || '').toLowerCase();
      const direct = this.modes.find((m) => m.key === raw);
      if (direct) this.selectedMode.set(direct.key);
      else if (TIER_TO_MODE[raw]) this.selectedMode.set(TIER_TO_MODE[raw]);
    });

    // Hard cap on session length: warn at the advertised target, force-end
    // one grace minute later regardless of in-call activity.
    effect(() => {
      const s = this.elapsed();
      if (s >= SESSION_TARGET_SECONDS + SESSION_GRACE_SECONDS) {
        this.completeAndReport();
      } else if (s >= SESSION_TARGET_SECONDS && !this.durationWarned) {
        this.durationWarned = true;
        this.durationWarningOpen.set(true);
      }
    });
  }

  ngOnInit(): void {
    // Route params land after construction, so read id() here.
    if (isPlatformBrowser(this.platformId) && this.milesverse.enabled) {
      void this.load();
    }
  }

  ngOnDestroy(): void {
    this.teardownSession();
  }

  private humanize(key: string): string {
    return key
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // -- artifact helpers (export schema: email/document/spreadsheet/chat) -----
  protected artifactType(a: Artifact): string {
    const t = a['type'];
    return typeof t === 'string' ? t : 'document';
  }
  protected artifactTitle(a: Artifact): string {
    const t = a['title'] ?? a['name'] ?? a['type'];
    return typeof t === 'string' && t ? t : 'Document';
  }
  protected artifactNote(a: Artifact): string | null {
    return typeof a['note'] === 'string' && a['note'] ? (a['note'] as string) : null;
  }
  /** Type class driving the icon tint (blue/gold/neutral — Masterclass palette). */
  protected artifactClass(a: Artifact): string {
    return 'mv-a-' + this.artifactType(a);
  }
  protected artifactIcon(a: Artifact): string {
    switch (this.artifactType(a)) {
      case 'email':
        return 'lucideMail';
      case 'spreadsheet':
        return 'lucideFileSpreadsheet';
      case 'chat':
        return 'lucideMessagesSquare';
      default:
        return 'lucideFileText';
    }
  }
  protected artifactKind(a: Artifact): string {
    switch (this.artifactType(a)) {
      case 'email':
        return 'Email thread';
      case 'spreadsheet':
        return 'Spreadsheet';
      case 'chat':
        return 'Chat log';
      default:
        return 'Document';
    }
  }
  protected isConfidential(a: Artifact | null): boolean {
    return !!a && a['audience'] === 'candidate';
  }

  protected emails(a: Artifact | null): Artifact[] {
    if (!a) return [];
    const list = a['emails'] ?? a['thread'];
    return Array.isArray(list) ? (list as Artifact[]) : [];
  }
  protected chatMessages(a: Artifact | null): Artifact[] {
    return a && Array.isArray(a['messages']) ? (a['messages'] as Artifact[]) : [];
  }
  protected chatChannel(a: Artifact | null): string {
    return a && typeof a['channel'] === 'string' ? (a['channel'] as string) : '';
  }
  /** Document body split into paragraph vs bullet lines (a leading "• "). */
  protected docLines(a: Artifact | null): { bullet: boolean; text: string }[] {
    if (!a || !Array.isArray(a['body'])) return [];
    return (a['body'] as unknown[])
      .filter((l): l is string => typeof l === 'string')
      .map((l) =>
        l.startsWith('• ') ? { bullet: true, text: l.slice(2) } : { bullet: false, text: l },
      );
  }
  protected docKind(a: Artifact | null): string {
    return a && typeof a['docKind'] === 'string' && a['docKind']
      ? (a['docKind'] as string)
      : 'Document';
  }
  protected docHeading(a: Artifact | null): string | null {
    return a && typeof a['heading'] === 'string' && a['heading'] ? (a['heading'] as string) : null;
  }
  protected docMeta(a: Artifact | null): string | null {
    return a && typeof a['meta'] === 'string' && a['meta'] ? (a['meta'] as string) : null;
  }
  protected sheetName(a: Artifact | null): string {
    return a && typeof a['sheetName'] === 'string' ? (a['sheetName'] as string) : 'Sheet';
  }
  protected sheetColumns(a: Artifact | null): string[] {
    if (!a || !Array.isArray(a['columns'])) return [];
    return (a['columns'] as unknown[]).map((c) => String(c));
  }
  protected sheetRows(a: Artifact | null): string[][] {
    if (!a || !Array.isArray(a['rows'])) return [];
    return (a['rows'] as unknown[]).map((r) =>
      Array.isArray(r) ? (r as unknown[]).map((c) => String(c)) : [String(r)],
    );
  }
  protected sheetCaption(a: Artifact | null): string | null {
    return a && typeof a['caption'] === 'string' && a['caption'] ? (a['caption'] as string) : null;
  }

  // -- case-file viewer modal -------------------------------------------------
  /** Artifact shown in the case-file viewer; null = closed. */
  protected readonly viewerIndex = signal<number | null>(null);
  protected readonly viewerArtifact = computed<Artifact | null>(() => {
    const index = this.viewerIndex();
    return index === null ? null : (this.artifacts()[index] ?? null);
  });

  protected openViewer(index: number): void {
    this.viewerIndex.set(index);
  }
  /** For contexts that hold the artifact, not its index (the shared template). */
  protected openViewerFor(a: Artifact): void {
    const index = this.artifacts().indexOf(a);
    if (index >= 0) this.viewerIndex.set(index);
  }
  protected closeViewer(): void {
    this.viewerIndex.set(null);
  }
  protected onEscapeKey(): void {
    if (this.viewerIndex() !== null) this.closeViewer();
  }
  protected str(m: Artifact, key: string): string {
    const v = m[key];
    return typeof v === 'string' ? v : '';
  }
  protected initials(name: string): string {
    return name
      .replace(/\(.*?\)/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.heroBroken.set(false);
    this.viewerIndex.set(null);
    this.showMarking.set(false);
    try {
      this.detail.set(await this.milesverse.simulation(this.id()));
    } catch {
      this.error.set('This scenario could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  // -- live session ----------------------------------------------------------

  protected async start(): Promise<void> {
    if (this.starting() || this.sessionOpen()) return;
    this.launchError.set(null);
    this.starting.set(true);
    try {
      const started = await this.milesverse.startSession(this.id(), this.selectedMode());
      this.backendSessionId = started.session?.id;
      this.openSession();
      await this.connectAnam(started.session_token);
    } catch (error) {
      const message = this.describeStartError(error);
      if (this.sessionOpen()) {
        this.sessionPhase.set('error');
        this.sessionMessage.set(message);
      } else {
        this.launchError.set(message);
      }
    } finally {
      this.starting.set(false);
    }
  }

  /** Human-readable message for each way a session start can fail. */
  private describeStartError(error: unknown): string {
    if (error instanceof MilesverseApiError) {
      if (error.status === 401) {
        return 'Your sign-in expired and could not be renewed. Refresh the page and try again.';
      }
      if (error.status === 503) {
        return 'The conversation engine is temporarily unavailable. Please try again in a moment.';
      }
      return `The session could not be started (${error.code}). Please try again.`;
    }
    if (error instanceof MilesverseNetworkError) {
      return 'The simulation service is unreachable. Check your connection and try again.';
    }
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        return 'Microphone access was blocked. Allow the microphone for this site, then try again.';
      }
      if (error.name === 'NotFoundError') {
        return 'No microphone was found. Connect one and try again.';
      }
    }
    if (error instanceof TypeError && /import|module|fetch/i.test(error.message)) {
      return 'The conversation engine failed to load. Check your connection and try again.';
    }
    // Unknown failure: show the underlying message.
    if (error instanceof Error && error.message) {
      return `The session could not be connected: ${error.message.slice(0, 200)}`;
    }
    return 'The session could not be connected. Please try again.';
  }

  /** From the error overlay: tear the failed attempt down and start fresh. */
  protected retryFromError(): void {
    this.closeSession();
    void this.start();
  }

  private openSession(): void {
    this.sessionOpen.set(true);
    this.sessionPhase.set('connecting');
    this.sessionMessage.set('Connecting to your AI persona…');
    this.micMuted.set(false);
    this.briefOpen.set(false);
    this.caseFileOpen.set(false);
    this.caseFileArtifact.set(null);
    this.idlePromptOpen.set(false);
    this.durationWarningOpen.set(false);
    this.durationWarned = false;
    this.elapsed.set(0);
    this.transcript = [];
    this.completing = false;
    this.startedAtIso = new Date().toISOString();
  }

  /** Load the Anam SDK from CDN and stream the avatar into the overlay video. */
  private async connectAnam(sessionToken: string): Promise<void> {
    this.teardownSession();
    this.completing = false;
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    const importEsm = new Function('u', 'return import(u)') as (
      u: string,
    ) => Promise<Record<string, unknown>>;
    const mod = await importEsm('https://esm.sh/@anam-ai/js-sdk@4');
    const createClient = mod['createClient'] as (token: string, options?: unknown) => AnamClient;
    const events = (mod['AnamEvent'] ?? {}) as Record<string, string>;

    // Disable the SDK's client telemetry (POST /v1/metrics/client) — pure noise.
    const client = createClient(sessionToken, { metrics: { disableClientMetrics: true } });
    this.anamClient = client;

    client.addListener?.(events['VIDEO_PLAY_STARTED'] ?? 'VIDEO_PLAY_STARTED', () => {
      this.sessionPhase.set('live');
      this.sessionMessage.set(null);
      this.startTimer();
      this.resetIdleTimer();
    });
    // Capture the running transcript so the report grades what was actually said.
    client.addListener?.(
      events['MESSAGE_HISTORY_UPDATED'] ?? 'MESSAGE_HISTORY_UPDATED',
      (payload) => {
        const messages = (Array.isArray(payload) ? payload : []) as AnamMessage[];
        this.transcript = messages
          .filter((m) => m && typeof m.content === 'string')
          .map((m) => ({ role: m.role === 'user' ? 'user' : 'persona', content: m.content }));
        this.resetIdleTimer();
      },
    );
    client.addListener?.(events['CONNECTION_CLOSED'] ?? 'CONNECTION_CLOSED', () => {
      this.completeAndReport();
    });
    // A blocked microphone otherwise surfaces as an opaque connect failure.
    client.addListener?.(events['MIC_PERMISSION_DENIED'] ?? 'MIC_PERMISSION_DENIED', () => {
      this.sessionPhase.set('error');
      this.sessionMessage.set(
        'Microphone access was blocked. Allow the microphone for this site, then try again.',
      );
    });

    await client.streamToVideoElement('mv-anam-video');

    // Report Anam's session id so ingestion can join this run later.
    const anamSessionId = client.getActiveSessionId?.();
    if (anamSessionId && this.backendSessionId) {
      this.milesverse.bindAnamSession(this.backendSessionId, anamSessionId).catch(() => {
        // Non-fatal: the live call still works, ingestion just won't be able to join later.
      });
    }
  }

  protected toggleMic(): void {
    if (!this.anamClient) return;
    const next = !this.micMuted();
    this.micMuted.set(next);
    if (next) this.anamClient.muteInputAudio();
    else this.anamClient.unmuteInputAudio();
  }

  /** Brief and case file are separate panels; opening one closes the other. */
  protected toggleBrief(): void {
    this.briefOpen.update((v) => !v);
    if (this.briefOpen()) this.caseFileOpen.set(false);
  }

  protected toggleCaseFile(): void {
    this.caseFileOpen.update((v) => !v);
    if (this.caseFileOpen()) this.briefOpen.set(false);
  }

  /** Expand/collapse a case-file artifact inside the in-call case-file panel. */
  protected toggleCaseFileArtifact(index: number): void {
    this.caseFileArtifact.update((cur) => (cur === index ? null : index));
  }

  /** Learner ended the call → go score it. */
  protected endSession(): void {
    this.completeAndReport();
  }

  /** Learner confirmed they're still here — dismiss the idle prompt and keep waiting. */
  protected continueSession(): void {
    this.idlePromptOpen.set(false);
    this.resetIdleTimer();
  }

  /** Learner chose to end the call from the idle prompt. */
  protected endFromIdlePrompt(): void {
    this.completeAndReport();
  }

  /** Dismiss the "wrapping up" notice; the hard end still fires on schedule. */
  protected acknowledgeDurationWarning(): void {
    this.durationWarningOpen.set(false);
  }

  /** Dismiss the overlay without scoring (used only from the error state). */
  protected closeSession(): void {
    this.teardownSession();
    this.completing = true;
    this.sessionOpen.set(false);
  }

  /** End the run and go to the report. Latched so it can't double-fire. */
  private completeAndReport(): void {
    if (this.completing) return;
    this.completing = true;
    this.stopTimer();
    this.clearIdleTimers();
    this.idlePromptOpen.set(false);
    void this.anamClient?.stopStreaming();
    this.anamClient = null;

    // Fire-and-forget: the report page polls for the scored result.
    if (this.backendSessionId) {
      void this.milesverse.endSession(this.backendSessionId).catch(() => {
        // Non-fatal: the reconciler confirms the end with the engine either way.
      });
    }

    const scenario = this.scenario();
    this.store.setPending({
      id: this.store.newId(),
      sessionId: this.backendSessionId,
      simulationId: this.id(),
      scenarioTitle: this.title(),
      personaName: this.personaName(),
      difficulty: scenario?.difficulty || 'Intermediate',
      startedAt: this.startedAtIso || new Date().toISOString(),
      durationSec: this.elapsed(),
      transcript: this.transcript,
      markingScheme: (scenario?.marking as MarkingScheme | undefined) ?? undefined,
    });
    void this.router.navigateByUrl(this.utils.localePath('simulation/report'));
  }

  private teardownSession(): void {
    this.stopTimer();
    this.clearIdleTimers();
    void this.anamClient?.stopStreaming();
    this.anamClient = null;
  }

  private startTimer(): void {
    this.stopTimer();
    this.timer = setInterval(() => this.elapsed.update((s) => s + 1), 1000);
  }
  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Restart the idle clock; when it runs out the "Still there?" prompt shows. */
  private resetIdleTimer(): void {
    this.clearIdleTimers();
    this.idlePromptOpen.set(false);
    this.idleWarnTimer = setTimeout(() => {
      this.idlePromptOpen.set(true);
      this.idleEndTimer = setTimeout(() => this.completeAndReport(), IDLE_AUTO_END_MS);
    }, IDLE_WARNING_MS);
  }

  private clearIdleTimers(): void {
    if (this.idleWarnTimer) clearTimeout(this.idleWarnTimer);
    if (this.idleEndTimer) clearTimeout(this.idleEndTimer);
    this.idleWarnTimer = undefined;
    this.idleEndTimer = undefined;
  }
}
