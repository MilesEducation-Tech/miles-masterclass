import { isPlatformBrowser } from '@angular/common';
import { Service, PLATFORM_ID, inject } from '@angular/core';
import {
  createMilesverse,
  MilesverseApiError,
  type DifficultyLevel,
  type GroupedSimulations,
  type ListParams,
  type Milesverse,
  type Page,
  type SessionAssessment,
  type SessionRow,
  type SessionStarted,
  type Simulation,
  type SimulationDetail,
  type Subject,
} from '@milesverse/sdk';
import { environment } from '@env/environment';

/** MilesVerse SDK facade: catalogue, sessions, and SSO auth. Browser-only. */
@Service()
export class MilesVerse {
  private readonly platformId = inject(PLATFORM_ID);
  private client: Milesverse | null = null;
  private authPromise: Promise<void> | null = null;

  /** Whether this environment is wired to a MilesVerse backend at all. */
  readonly enabled = !!environment.MILESVERSE_API_URL;

  /** Pass through absolute media URLs; anything else → null (UI shows placeholder). */
  resolveMedia(key: string | null | undefined): string | null {
    if (!key) return null;
    if (/^(https?:)?\/\//i.test(key) || key.startsWith('data:')) return key;
    return null;
  }

  private sdk(): Milesverse {
    if (!this.enabled || !isPlatformBrowser(this.platformId)) {
      throw new Error('MilesVerse is not available in this environment.');
    }
    this.client ??= createMilesverse({ baseUrl: environment.MILESVERSE_API_URL });
    return this.client;
  }

  /**
   * Login once via POST /auth/sso/token. The user's own Masterclass session
   * token (platform cookie) is tried first; the MILESVERSE_SSO env token is
   * the dev-fixture fallback for environments without a platform login.
   */
  private ensureAuth(): Promise<void> {
    const sdk = this.sdk();
    if (sdk.token) return Promise.resolve();
    this.authPromise ??= (async () => {
      const env = environment as {
        MILESVERSE_SSO: { token?: string; orgId: string; applicationId: string };
      };
      const { orgId, applicationId } = env.MILESVERSE_SSO ?? {};
      // ponytail: the platform access token came from the removed session
      // service, so only the env dev-fixture token is left. Re-read the user's
      // own token here to restore real per-user SSO.
      const candidates = env.MILESVERSE_SSO?.token;
      if (!orgId || !candidates) {
        throw new Error('MilesVerse auth is not configured for this environment.');
      }
      let lastError: unknown;
      // for (const token of candidates) {
      try {
        await sdk.auth.ssoToken(candidates, orgId, applicationId);
        return;
      } catch (error) {
        lastError = error;
      }
      // }
      throw lastError;
    })().catch((error) => {
      this.authPromise = null;
      throw error;
    });
    return this.authPromise;
  }

  /** Run an API call; on 401 re-login once and retry. */
  private async withAuth<T>(run: () => Promise<T>): Promise<T> {
    await this.ensureAuth();
    try {
      return await run();
    } catch (error) {
      if (error instanceof MilesverseApiError && error.status === 401) {
        this.sdk().setToken(null);
        this.authPromise = null;
        await this.ensureAuth();
        return run();
      }
      throw error;
    }
  }

  async subjects(): Promise<Subject[]> {
    return this.withAuth(() => this.sdk().catalog.subjects());
  }

  async difficultyLevels(): Promise<DifficultyLevel[]> {
    return this.withAuth(() => this.sdk().catalog.difficultyLevels());
  }

  /** One page of simulations. */
  async simulations(params: ListParams = {}): Promise<Page<Simulation>> {
    return this.withAuth(() =>
      this.sdk().catalog.simulations({ page: 1, page_size: 100, ...params }),
    );
  }

  /** Catalogue grouped by subject. */
  async simulationsBySubject(): Promise<GroupedSimulations> {
    return this.withAuth(() => this.sdk().catalog.simulationsBySubject());
  }

  /** One simulation with its full scenario. */
  async simulation(id: string): Promise<SimulationDetail> {
    return this.withAuth(() => this.sdk().catalog.simulation(id));
  }

  /** Start a session; returns the Anam token to stream with. */
  async startSession(id: string, difficulty?: string): Promise<SessionStarted> {
    return this.withAuth(() => this.sdk().sessions.start(id, difficulty));
  }

  /** Report Anam's own session id back to the backend. */
  async bindAnamSession(sessionId: string, anamSessionId: string): Promise<SessionRow> {
    return this.withAuth(() => this.sdk().sessions.bindAnamSession(sessionId, anamSessionId));
  }

  /** Tell the backend the conversation ended. Idempotent. */
  async endSession(sessionId: string): Promise<SessionRow> {
    return this.withAuth(() => this.sdk().sessions.end(sessionId));
  }

  /** The session's scored report (poll while status is processing). */
  async assessment(sessionId: string): Promise<SessionAssessment> {
    return this.withAuth(() => this.sdk().sessions.assessment(sessionId));
  }
}
