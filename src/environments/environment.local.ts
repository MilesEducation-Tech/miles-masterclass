import { LogLevel } from '../app/shared/core/models/log.model';

export const environment = {
  production: false,

  /**
   * Canonical public origin (no trailing slash) for local dev. Matches the
   * `ng serve` port so canonical/og:url + sitemap links resolve locally. See
   * app.ts + src/seo.ts.
   */
  SITE_URL: 'http://localhost:4100',

  BASE_API_URL: 'https://uat-api.milesmasterclass.com/api/',

  // MilesVerse API origin. Empty = MilesVerse pages show not-connected.
  MILESVERSE_API_URL: 'https://uat.milesverse.ai',
  // MilesVerse SSO login. Token: local fixture from backend
  MILESVERSE_SSO: {
    token: '',
    orgId: '809b6004-675f-4650-9845-315ccd9e1cd8',
    applicationId: '01780b77-1c09-4a85-ab33-6aaa33353505',
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
   * Miles360 activity mirror — see `MilesActivity`. Same endpoint in every
   * environment; the gate is `environment.production`, so this build never
   * posts regardless of what is configured here.
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
    accessToken: 'LOCAL_ACCESS_TOKEN',
    refreshToken: 'LOCAL_REFRESH_TOKEN',
    userData: 'LOCAL_USER_DATA',
    browserSessionId: 'LOCAL_BROWSER_SESSION_ID',
    // Cached active-plan flag. Persisted so synchronous route guards
    // (activePlanGuard) can answer on a hard refresh before the async
    // current-plan API resolves.
    activePlan: 'LOCAL_ACTIVE_PLAN',
    // TransferState keys for SSR
    transferUserData: 'auth_user_data',
    transferAuthStatus: 'auth_status',
  },

  SUPABASE: {
    SupabaseUser: 'LOCAL_SUPABASE_USER',
    url: 'https://lodzktvnxuprpogelodm.supabase.co',
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZHprdHZueHVwcnBvZ2Vsb2RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0MzE1NDYsImV4cCI6MjA3ODAwNzU0Nn0.ychDwrqAURLnKyAkP4MHGwpcH7VwE4WcRt2E7oHoEL4',
  },

  /**
   * MilesAI Labs — Entra sign-in + Copilot Studio deep link.
   *
   * Everything here is a PUBLIC identifier and safe in the browser bundle:
   * tenant/client IDs are public by design, and the anon key is RLS-scoped.
   * The Entra **client secret** is NOT here and must never be — it lives in
   * the Supabase dashboard (Auth → Providers → Azure), which performs the
   * token exchange server-side. Same for the service-role key, DirectLine
   * secret, and the provisioning secret: those belong to the lab backend.
   *
   * `redirectPath` is resolved against SITE_URL rather than
   * `window.location.origin` so the OAuth allowlist is a fixed, per-environment
   * value that SSR can also produce.
   */
  AI_LABS: {
    supabaseUrl: 'https://nhohkxpcoeyerzsybipo.supabase.co',
    // TODO: paste the anon key for the nhohkxpcoeyerzsybipo project. Sign-in
    // is disabled (button shows a config error) until this is set.
    supabaseAnonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ob2hreHBjb2V5ZXJ6c3liaXBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMzYxMDYsImV4cCI6MjEwMDgxMjEwNn0.Dk5XMoNG3oBVXhlUbh_zqzbJX3uMbf8h2kjNwjGXJ2c',

    tenantId: 'f133522a-779a-4a85-bebb-e72cd0daaa1d',
    clientId: 'b717025f-1163-4efb-a3f2-a6336d4fee07',
    /**
     * Home realm hint for lab accounts (`domain_hint`, forwarded verbatim to
     * Entra by Supabase). Entra accepts either a verified domain or the tenant
     * id; this is the tenant id of the directory that owns the app registration
     * behind Supabase's Azure provider — mileslabs.ai. Pointing it at any other
     * tenant sends users to the wrong home realm, where they can only sign in
     * as a guest of that app rather than as the account the labs backend
     * provisioned.
     */
    domainHint: 'f133522a-779a-4a85-bebb-e72cd0daaa1d',
    copilotUrl: 'https://copilotstudio.microsoft.com/',
    redirectPath: '/auth/ai-labs-callback',
    /** localStorage key — kept distinct from the admin client's session. */
    storageKey: 'AI_LABS_SUPABASE_SESSION',

    /**
     * Tracks whose `course_type=ai_lab` courses are the catalogue on /ai-labs
     * (`v2/tracks/:id/courses/`). Track ids differ per environment, so they
     * live here rather than in the section list. Add `tax` / `cfoTeams` as
     * those tracks are published.
     */
    catalogueTracks: {
      audit: 7,
      tax: 6,
      cfo: 8,
    },

    /** Gates the /ai-labs evaluation/assessment layer — see environment.ts. On
     *  in local so the (mocked) submission + scoring flow is visible to evaluate. */
    assessmentEnabled: false,
    AI_LABS_CHANNEL: 'AI_LAB_AUTH_LOCAL',
    AI_LABS_CALLBACK_DONE: 'CALLBACK_DONE_LOCAL',
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

  // Same shape as environment.ts so the Analytics service type-checks.
  ANALYTICS: {
    enabled: false, // off on local machine; flip to true to test locally
    debug: true, // verbose analytics logging when enabled locally
    // Each vendor is self-contained: `enabled` toggle + its own keys.
    ga4: {
      enabled: true, // GA4 tag via the GTM container
      gtmId: '',
      measurementId: '',
    },
    clarity: {
      enabled: false, // Microsoft Clarity — OFF
      projectId: '',
    },
    netcore: {
      enabled: true, // Netcore Smartech
      scriptUrl: '//cdnt.netcoresmartech.com/smartechclient.js',
      siteKey: '',
      appId: '',
      listId: '',
      swPath: '/sw.js', // SSR server generates this per-build (see src/service-worker.ts)
      webPush: false, // no push on localhost
      // FCM web-push credentials baked into the dynamically-served /sw.js.
      push: {
        apiKey: 'AIzaSyAO_n0F8wZc6tCabFNfVSZs5yKOR77Lfvw',
        messagingSenderId: '861360152370',
        appId: '1:861360152370:web:10c1f04bae627da2fc812b',
        projectId: 'miles-masterclass',
      },
    },
  },
};
