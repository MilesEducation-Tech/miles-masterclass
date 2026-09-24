import { isPlatformBrowser } from '@angular/common';
import { Service, PLATFORM_ID, inject } from '@angular/core';
import type { MarkingScheme, SessionRecord, TranscriptTurn } from '../models/report.model';

/** The just-finished run handed from the briefing to the report page. */
export interface PendingSession {
  id: string;
  sessionId?: string;
  simulationId: string;
  scenarioTitle: string;
  personaName: string;
  difficulty: string;
  startedAt: string;
  durationSec: number;
  transcript: TranscriptTurn[];
  markingScheme?: MarkingScheme;
}

const SESSIONS_KEY = 'mv_sessions';
const PENDING_KEY = 'mv_pending';
const SCHEMA_VERSION = 1;

/**
 * Local persistence for MilesVerse performance reports.
 *
 * Interim store while the backend has no evaluator: completed runs and their
 * mock-scored reports live in localStorage so the report + progress screens
 * work end-to-end. When the backend evaluator lands, the report page will read
 * GET /sessions/{id}/report instead and this becomes a cache/fallback.
 */
@Service()
export class MilesVerseSessions {
  private readonly platformId = inject(PLATFORM_ID);

  private get storage(): Storage | null {
    return isPlatformBrowser(this.platformId) ? window.localStorage : null;
  }

  newId(): string {
    if (isPlatformBrowser(this.platformId) && 'randomUUID' in crypto) return crypto.randomUUID();
    return `mv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  // --- pending handoff -----------------------------------------------------
  setPending(pending: PendingSession): void {
    this.storage?.setItem(PENDING_KEY, JSON.stringify(pending));
  }
  getPending(): PendingSession | null {
    return this.read<PendingSession>(PENDING_KEY);
  }
  clearPending(): void {
    this.storage?.removeItem(PENDING_KEY);
  }

  // --- saved sessions ------------------------------------------------------
  getSessions(): SessionRecord[] {
    return this.read<SessionRecord[]>(SESSIONS_KEY) ?? [];
  }
  getSession(id: string): SessionRecord | null {
    return this.getSessions().find((s) => s.id === id) ?? null;
  }
  saveSession(record: SessionRecord): void {
    const all = this.getSessions().filter((s) => s.id !== record.id);
    all.push({ ...record, schemaVersion: SCHEMA_VERSION });
    this.storage?.setItem(SESSIONS_KEY, JSON.stringify(all));
  }
  clearSessions(): void {
    this.storage?.removeItem(SESSIONS_KEY);
  }

  private read<T>(key: string): T | null {
    const raw = this.storage?.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}
