import { LogLevel } from '@core/models/log.model';

/**
 * The shape every build's environment file must have. Each file ends
 * `satisfies Environment`, so a key missing from, misspelt in, or extra in any
 * build fails type-checking in all of them — not only in the build that uses
 * that file.
 *
 * An environment holds deployment configuration only: values that differ per
 * build, addresses and public keys of external systems, and switches flipped
 * per deploy. A value that is the same everywhere and never changes per deploy
 * is an app constant; it lives next to the code that reads it.
 *
 * Nothing here is secret: every value ships in the browser bundle. Secrets
 * (Zoom SDK secret, Supabase service-role key, …) live in their backends.
 */
export interface Environment {
  /** Production build: secure cookies on, Salesforce leads sent. */
  production: boolean;

  /**
   * Canonical public origin, no trailing slash. Drives self-referencing
   * canonical/og:url tags (`app.ts`) and the SSR sitemap/robots origin
   * (`src/seo.ts`). Override at runtime without a redeploy via the
   * `SITE_ORIGIN` env var.
   */
  SITE_URL: string;

  // ---- Core ----------------------------------------------------------------

  API: {
    /** Django REST API origin, with a trailing slash. `ApiClient` prepends it. */
    baseUrl: string;
  };

  ASSETS: {
    /** CloudFront origin for static assets, with a trailing slash. */
    s3Url: string;
    /** GCS asset base for web-app media, with a trailing slash. */
    gcsUrl: string;
  };

  LOGGER: {
    /** The lowest level `Logger` prints; `OFF` prints nothing. */
    LogLevel: LogLevel;
  };

  // ---- Features --------------------------------------------------------------

  AUTH: {
    /**
     * Digits in a one-time code. The SSO sets it server-side and no route
     * reports it, so it is configured per environment rather than in each
     * form. Drives both the `<app-otp>` boxes and the length validator.
     */
    otpLength: number;
  };

  /** The anonymous, session-free client that reads `seo_pages`. The key is RLS-scoped and public. */
  SUPABASE: {
    url: string;
    anonKey: string;
  };

  /**
   * Miles360 Salesforce lead endpoint (AWS API Gateway), fired fire-and-forget
   * when a new account is created — see `SalesforceLead`. The `/mmc` route needs
   * no API key or auth header. An empty `url` disables the integration.
   */
  SALESFORCE_LEAD: {
    url: string;
    courseId: number;
    vertical: string;
  };

  WEBINAR: {
    /**
     * Whether "Join" opens the in-app `/live` page (Zoom Meeting SDK + session
     * lease) or the registrant's own `join_url` in Zoom. `false` is the kill
     * switch: Join then opens Zoom for every webinar. With it on, each webinar
     * still needs the backend's own `registration.route_to_web_lms` switch.
     */
    liveEnabled: boolean;
  };

  /**
   * The Microsoft (Entra) sign-in that fronts Copilot Studio, through the labs
   * Supabase project's Azure provider (`AiLabAuth`). Public identifiers only:
   * the Entra client secret lives in the labs Supabase dashboard.
   */
  AI_LABS: {
    supabaseUrl: string;
    /** Publishable anon key of the labs project; RLS-scoped. */
    supabaseAnonKey: string;
    /** The labs tenant (mileslabs.ai). */
    tenantId: string;
    /** Sent as `domain_hint`, which pins the Microsoft login to the labs tenant. */
    domainHint: string;
    /** Resolved against `SITE_URL`; the labs project must allow `SITE_URL + redirectPath`. */
    redirectPath: string;
    /** Key the labs Supabase session is kept under in the browser. */
    storageKey: string;
    /**
     * The popup callback tells its opener it's done on this same-origin
     * BroadcastChannel. Named per build so two builds open on one origin
     * don't hear each other.
     */
    AI_LABS_CHANNEL: string;
    AI_LABS_CALLBACK_DONE: string;
  };

  /**
   * Languages this build may resolve a visitor to (`LanguageContext`). Anything
   * else in a cookie or `Accept-Language` is skipped, so a half-translated
   * language never reaches real users. `enabled: false` turns the feature off
   * without editing the list: every visitor gets English and no switcher renders.
   */
  I18N: {
    enabled: boolean;
    languages: readonly string[];
  };
}
