import { Component, afterNextRender, effect, inject, signal } from '@angular/core';
import { Consent } from '../../core/services/consent/consent';
import { CONSENT_CATEGORIES, ConsentCategory, ConsentState } from '../../core/models/consent.model';
import { cn } from '../../utils/cn';

/**
 * Cookie-consent banner + preferences panel.
 *
 * Five tiers; `necessary` and `security` are locked on and read-only. Optional
 * tiers default off (opt-in). Rendering is deferred to `afterNextRender` and
 * gated on `consent.bannerOpen()`, so nothing is emitted during SSR and there
 * is no hydration mismatch. The user's choice is persisted by the Consent
 * service; the Analytics service reacts to it and (un)loads the vendors.
 */
@Component({
  selector: 'app-consent-banner',
  templateUrl: './consent-banner.html',
  styleUrl: './consent-banner.css',
})
export class ConsentBanner {
  protected readonly consent = inject(Consent);
  protected readonly categories = CONSENT_CATEGORIES;
  protected readonly cn = cn;

  /** Render only after hydration to keep server + client markup identical. */
  protected readonly mounted = signal(false);

  /** Editable copy backing the preference toggles. */
  protected readonly draft = signal<ConsentState>({ ...this.consent.state() });

  constructor() {
    afterNextRender(() => {
      this.draft.set({ ...this.consent.state() });
      this.mounted.set(true);
    });
    // Re-sync the draft from saved state each time the panel is (re)opened
    // (e.g. from a "Cookie settings" footer link), without clobbering edits.
    effect(() => {
      if (this.consent.preferencesOpen()) this.draft.set({ ...this.consent.state() });
    });
  }

  protected isOn(id: ConsentCategory): boolean {
    return this.draft()[id] === true;
  }

  protected toggle(id: ConsentCategory): void {
    this.draft.update((d) => {
      const next: ConsentState = { ...d };
      if (id === 'analytics') next.analytics = !d.analytics;
      else if (id === 'marketing') next.marketing = !d.marketing;
      else if (id === 'functional') next.functional = !d.functional;
      // 'necessary' / 'security' are locked — intentionally no-op.
      return next;
    });
  }

  protected acceptAll(): void {
    this.consent.acceptAll();
  }

  protected rejectNonEssential(): void {
    this.consent.rejectNonEssential();
  }

  protected saveChoices(): void {
    this.consent.save(this.draft());
  }

  protected customise(): void {
    this.draft.set({ ...this.consent.state() });
    this.consent.openPreferences();
  }
}
