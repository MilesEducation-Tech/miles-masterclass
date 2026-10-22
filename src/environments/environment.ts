import { LogLevel } from '@core/models/log.model';

export const environment = {
  production: true,

  /**
   * Canonical public origin (no trailing slash). Drives self-referencing
   * canonical/og:url tags (see app.ts) and the SSR sitemap/robots origin
   * (src/seo.ts). Production points at the live `.com` domain; the UAT build
   * (environment.development.ts) points at the `.us` test domain. Override at
   * runtime without a redeploy via the `SITE_ORIGIN` env var.
   */
  SITE_URL: 'https://www.milesmasterclass.com',

  // why: the live API isn't up yet, so production points at UAT for now.
  // Switch back to 'https://api.milescaira.com/' once it is.
  BASE_API_URL: 'https://uat-api.milescaira.com/',

  /**
   * Dev-only key for the Miles SSO support OTP-reveal endpoint, used by the
   * hidden QA login route (`DEV_LOGIN_PATH`).
   *
   * EMPTY ON PRODUCTION, AND IT MUST STAY EMPTY. It authenticates an endpoint
   * that returns the login OTP for *any* identifier, so a value here ships in
   * the JS bundle and hands every visitor a way into any account. With it empty
   * the hidden route is inert and behaves like an ordinary login page.
   */
  SSO_SUPPORT_API_KEY: '',

  /**
   * Webinar module tuning. None of these are secrets — the Zoom SDK Secret
   * lives in Django and the signature is minted there (see AGENTS.md §7); the
   * client only ever receives a short-lived signature plus the `sdk_key` that
   * accompanies it.
   */
  WEBINAR: {
    /**
     * How long before the start the Join button appears.
     *
     * Fallback only IN PRINCIPLE: `joinOpensAt()` prefers a server-sent
     * `join_opens_at`, but that field appears NOWHERE in
     * `EVENTS_API_CONTRACT_V1`, so today this value is the whole rule and it is
     * computed in the browser. A skewed clock can therefore show Join early and
     * have the server refuse it — `ServerClock` syncs off the feed's
     * `server_time` to bound that. Ask the backend for `join_opens_at`.
     */
    joinWindowMinutes: 15,
    /**
     * Whether "Join" opens the in-app `/live` page (Zoom Meeting SDK + session
     * lease) or the registrant's own `join_url` in Zoom.
     *
     * OFF in production until QA signs off on a preview (MIL-43). The backend
     * routes exist (`attendance-session/*`, `meeting-sdk-signature/`) and the
     * development and local builds turn this on. Flipping it to `true` here is
     * the whole production cutover; each webinar still needs the backend's own
     * `registration.route_to_web_lms` switch.
     */
    liveEnabled: false,
    /** Custom (non-Zoom) poll surface. Flip on once the poll API ships. */
    pollsEnabled: false,
    /** Lease heartbeat cadence. Server TTL is 45s — three misses before eviction. */
    leaseHeartbeatSeconds: 15,
    /**
     * Ceiling on the registration status poll. `ZOOM_PENDING_APPROVAL` is
     * terminal but reports as `PENDING`, so an uncapped loop spins forever.
     */
    registrationPollCapSeconds: 45,
  },

  /**
   * Miles360 Salesforce lead endpoint (AWS API Gateway). Fired fire-and-forget
   * when a new account is created — see `SalesforceLead`. `courseId` and
   * `vertical` are fixed per environment; the rest of the payload comes from
   * the form.
   *
   * The `/mmc` route needs no API key and no auth header, so nothing secret
   * ships in the bundle. An empty `url` disables the integration — `create()`
   * no-ops rather than posting.
   */
  SALESFORCE_LEAD: {
    url: 'https://hn19ywvvng.execute-api.ap-south-1.amazonaws.com/Miles360/create-net-enquiry/mmc',
    courseId: 1,
    vertical: 'US Accounting',
  },

  /**
   * Miles360 activity endpoint, where `MilesActivity` posts behavioural events
   * so Salesforce sees them (no caller until analytics returns). Like the keys above,
   * this one ships in the client bundle; prefer a server-side proxy for a
   * hardened deploy.
   */
  MILES_ACTIVITY: {
    url: 'https://hn19ywvvng.execute-api.ap-south-1.amazonaws.com/Miles360/masterclass-activity',
    apiKey: 'AWqdnzaOrP86BUGsbjQFl6piZFOaBOQzaqaJ8b6b',
  },

  S3_BUCKET_URL: 'https://d1pp0977rsxmiq.cloudfront.net/',
  GCS_URL: 'https://asset.milesmasterclass.com/media/web-app/',

  appType: 'WA',
  platform: 'masterclass',

  LOGGER: {
    LogLevel: LogLevel.DEBUG,
  },

  AUTH: {
    accessToken: 'ACCESS_TOKEN',
    refreshToken: 'REFRESH_TOKEN',
    /**
     * Caches `profile_status` so `onboardingGuard` can answer synchronously on
     * a hard refresh, and during SSR, without waiting on `user-details/`.
     * Only the status string — never the user record.
     */
    profileStatus: 'PROFILE_STATUS',
    /**
     * The pre-rename name of the `profileStatus` cookie. Never read; deleted on
     * load, write and sign-out so an older build's copy can't linger.
     * ponytail: drop once the longest-lived pre-rename session has expired.
     */
    legacyProfileStatus: 'USER_DATA',
    /**
     * Digits in a one-time code. The SSO sets it server-side and no route
     * reports it, so it lives here — per environment — rather than in each
     * form. Drives both the `<app-otp>` boxes and the length validator.
     */
    otpLength: 6,
    browserSessionId: 'BROWSER_SESSION_ID',
  },

  SUPABASE: {
    SupabaseUser: 'PRODUCTION_SUPABASE_USER',
    url: 'https://lodzktvnxuprpogelodm.supabase.co',
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZHprdHZueHVwcnBvZ2Vsb2RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0MzE1NDYsImV4cCI6MjA3ODAwNzU0Nn0.ychDwrqAURLnKyAkP4MHGwpcH7VwE4WcRt2E7oHoEL4',
  },

  /**
   * Miles AI Labs — the Microsoft (Entra) sign-in that fronts Copilot Studio, via the LABS Supabase
   * project's Azure provider (`AiLabAuth`).
   *
   * Everything here is a PUBLIC identifier and safe in the browser bundle: the tenant id is public by
   * design and the anon key is RLS-scoped. The Entra **client secret** is NOT here and must never be
   * — it lives in the labs Supabase dashboard (Auth → Providers → Azure), which does the token
   * exchange server-side.
   *
   * `redirectPath` is resolved against SITE_URL, so the OAuth allowlist is a fixed, per-environment
   * value. The labs project must allow `SITE_URL + redirectPath`.
   */
  AI_LABS: {
    supabaseUrl: 'https://nhohkxpcoeyerzsybipo.supabase.co',
    supabaseAnonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ob2hreHBjb2V5ZXJ6c3liaXBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMzYxMDYsImV4cCI6MjEwMDgxMjEwNn0.Dk5XMoNG3oBVXhlUbh_zqzbJX3uMbf8h2kjNwjGXJ2c',
    /** The labs tenant (mileslabs.ai). Also the `domain_hint`, which pins the Microsoft login to it. */
    tenantId: 'f133522a-779a-4a85-bebb-e72cd0daaa1d',
    domainHint: 'f133522a-779a-4a85-bebb-e72cd0daaa1d',
    redirectPath: '/auth/ai-labs-callback',
    /** localStorage key — kept distinct from the admin client's session. */
    storageKey: 'AI_LABS_SUPABASE_SESSION',
    /** The popup callback tells the opener it's done on this same-origin BroadcastChannel. */
    AI_LABS_CHANNEL: 'AI_LAB_AUTH',
    AI_LABS_CALLBACK_DONE: 'CALLBACK_DONE',
  },

  // WordPress blog (headless via WP REST API).
  WP_BLOG: {
    // Browser calls a same-origin path that the `/blog-api` reverse proxy
    // (proxy.conf.json in dev, Express handler in src/server.ts in prod)
    // forwards to WordPress. Same-origin avoids CORS + mixed-content and keeps
    // the X-WP-Total pagination headers readable.
    apiBaseUrlBrowser: '/blog-api/wp/v2',
    // SSR runs server-side (no mixed-content/CORS constraint), so it hits the
    // WordPress HTTPS host directly.
    apiBaseUrlSsr: 'https://wp.milesmasterclass.com/blog/wp-json/wp/v2',
  },

  PAYMENT_TEST_SSN: '207646057',

  /**
   * Languages this build may resolve a visitor to (`LanguageContext`). Anything else in a cookie or
   * `Accept-Language` is skipped, so a half-translated language never reaches real users.
   * Production lists a language only once it is fully translated (prompts/language-i18n.md).
   * `enabled: false` turns the feature off without editing the list: every visitor gets English
   * and no switcher renders, exactly as with `languages: ['en']`.
   */
  I18N: {
    enabled: false, // master switch for this environment
    languages: ['en'],
  },
};
