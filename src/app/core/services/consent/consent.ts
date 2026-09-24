import { Service, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '@env/environment';
import { Storage } from '../storage/storage';
import {
  ConsentRecord,
  ConsentState,
  CONSENT_VERSION,
  DEFAULT_CONSENT,
  FULL_CONSENT,
} from '../../models/consent.model';

/**
 * Source of truth for tracking consent. Holds the current {@link ConsentState},
 * persists the user's decision, and drives the consent banner's visibility.
 *
 * Deliberately has NO dependency on the Analytics service — Analytics reads
 * this service's signals via an `effect`, so there is no circular dependency.
 * SSR-safe: on the server it simply reports the opt-in defaults and never shows
 * the banner (the banner component is browser-only anyway).
 */
@Service()
export class Consent {
  private readonly storage = inject(Storage);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private static readonly STORAGE_KEY = 'mm_consent';

  /**
   * Consent is only relevant where analytics actually runs — mirrors the
   * Analytics master switch (`ANALYTICS.enabled`) per environment. When off,
   * the banner never shows and the footer link is hidden.
   */
  readonly enabled = environment.ANALYTICS.enabled;

  /** Current consent. Defaults to opt-in (only locked tiers granted). */
  readonly state = signal<ConsentState>(DEFAULT_CONSENT);

  /** True once the user has made (or previously saved) an explicit choice. */
  readonly hasDecision = signal(false);

  /** Banner is shown until a decision exists; can be reopened from the footer. */
  readonly bannerOpen = signal(false);

  /** Whether the detailed preferences panel is expanded. */
  readonly preferencesOpen = signal(false);

  constructor() {
    if (!this.isBrowser || !this.enabled) return; // browser + production only
    const saved = this.storage.getLocal<ConsentRecord>(Consent.STORAGE_KEY);
    if (saved && saved.version === CONSENT_VERSION) {
      // Re-assert locked tiers in case an old record was tampered with.
      this.state.set({ ...saved.state, necessary: true, security: true });
      this.hasDecision.set(true);
    } else {
      // First visit or policy version bump → prompt.
      this.bannerOpen.set(true);
    }
  }

  /** Accept every tier. */
  acceptAll(): void {
    this.persist(FULL_CONSENT);
  }

  /** Reject everything optional (keep only the locked tiers). */
  rejectNonEssential(): void {
    this.persist(DEFAULT_CONSENT);
  }

  /** Save a custom selection from the preferences panel (locked tiers forced on). */
  save(selection: Partial<ConsentState>): void {
    this.persist({ ...this.state(), ...selection, necessary: true, security: true });
  }

  /** Reopen the banner + preferences (e.g. from a "Cookie settings" footer link). */
  openPreferences(): void {
    if (!this.enabled) return;
    this.preferencesOpen.set(true);
    this.bannerOpen.set(true);
  }

  closePreferences(): void {
    this.preferencesOpen.set(false);
  }

  private persist(state: ConsentState): void {
    this.state.set(state);
    this.hasDecision.set(true);
    this.preferencesOpen.set(false);
    this.bannerOpen.set(false);
    if (this.isBrowser) {
      this.storage.setLocal<ConsentRecord>(Consent.STORAGE_KEY, {
        version: CONSENT_VERSION,
        timestamp: new Date().toISOString(),
        state,
      });
    }
  }
}
