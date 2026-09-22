/**
 * Cookie / tracking consent model.
 *
 * Five tiers. `necessary` and `security` are always granted and rendered
 * read-only in the UI; the other three are opt-in (default `false`) and gate
 * the corresponding vendors:
 *   - analytics  → Google Analytics 4 (via GTM) + Microsoft Clarity
 *   - marketing  → Netcore CE (web push, email/SMS journeys, identify)
 *   - functional → preference cookies / personalisation
 *
 * The Analytics service maps these onto Google Consent Mode v2 signals.
 */
export type ConsentCategory = 'necessary' | 'security' | 'analytics' | 'marketing' | 'functional';

export interface ConsentState {
  /** Essential cookies (auth/session). Always on. */
  necessary: true;
  /** Fraud prevention / security. Always on. */
  security: true;
  /** GA4 + Microsoft Clarity. */
  analytics: boolean;
  /** Netcore CE — web push, journeys, identify. */
  marketing: boolean;
  /** Preference / personalisation cookies. */
  functional: boolean;
}

/** Persisted alongside a version + timestamp so we can re-prompt on policy changes. */
export interface ConsentRecord {
  version: number;
  timestamp: string; // ISO-8601
  state: ConsentState;
}

/** Bump when the categories or policy materially change → re-prompts everyone. */
export const CONSENT_VERSION = 1;

/** Opt-in default: only the two locked tiers are granted. */
export const DEFAULT_CONSENT: ConsentState = {
  necessary: true,
  security: true,
  analytics: false,
  marketing: false,
  functional: false,
};

export const FULL_CONSENT: ConsentState = {
  necessary: true,
  security: true,
  analytics: true,
  marketing: true,
  functional: true,
};

export interface ConsentCategoryMeta {
  id: ConsentCategory;
  title: string;
  description: string;
  /** Locked tiers are always granted and read-only in the UI. */
  locked: boolean;
}

export const CONSENT_CATEGORIES: readonly ConsentCategoryMeta[] = [
  {
    id: 'necessary',
    title: 'Strictly necessary',
    description:
      'Required for the site to work — sign-in, session security and saving your cookie choices. These can’t be switched off.',
    locked: true,
  },
  {
    id: 'security',
    title: 'Security & fraud prevention',
    description:
      'Helps us detect malicious activity and keep your account and our platform safe. Always on.',
    locked: true,
  },
  {
    id: 'analytics',
    title: 'Analytics & performance',
    description:
      'Anonymous usage data and session insights (Google Analytics, Microsoft Clarity) so we can understand what’s working and improve the experience.',
    locked: false,
  },
  {
    id: 'marketing',
    title: 'Marketing & communications',
    description:
      'Lets us send relevant updates and web-push notifications and personalise offers (Netcore). Powers reminders about your courses and new releases.',
    locked: false,
  },
  {
    id: 'functional',
    title: 'Functional & preferences',
    description:
      'Remembers your choices (such as language or layout) to give you a more personalised experience.',
    locked: false,
  },
] as const;
