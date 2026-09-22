import { LogLevel } from '../app/shared/core/models/log.model';

export const environment = {
  production: false,

  /**
   * Canonical public origin (no trailing slash) for the UAT/test deploy. Today
   * the build is served at the `.us` test domain; production
   * (environment.ts) uses the live `.com` domain. Override at runtime without a
   * redeploy via the `SITE_ORIGIN` env var. See app.ts + src/seo.ts.
   */
  SITE_URL: 'https://uat.milesmasterclass.com',

  BASE_API_URL: 'https://uat-api.milescaira.com/',

  /**
   * Dev-only key for the Miles SSO support OTP-reveal endpoint, used by the
   * hidden QA login route (`DEV_LOGIN_PATH`).
   *
   * Never copy this into `environment.ts`: the endpoint returns the login OTP
   * for ANY identifier, so a production bundle carrying it would hand every
   * visitor a way into any account. Non-prod builds only.
   */
  SSO_SUPPORT_API_KEY: '',

  // MilesVerse API origin. Empty = MilesVerse pages show not-connected.
  MILESVERSE_API_URL: 'https://uat.milesverse.ai',

  MILESVERSE_SSO: {
    token: '',
    orgId: '809b6004-675f-4650-9845-315ccd9e1cd8',
    applicationId: '01780b77-1c09-4a85-ab33-6aaa33353505',
  },
  // MilesVerse SSO login (UAT org/application registered on the MilesVerse
  // backend). The token must be minted by the Masterclass backend with the
  // shared SSO secret — empty until that endpoint exists, so MilesVerse pages
  // will show their error state rather than silently using a wrong identity.

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
   * Miles360 activity mirror — every GA4 event is also posted here so Salesforce
   * sees the same behavioural signal (see `MilesActivity`). Like the keys above,
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
     * a hard refresh, and during SSR, without waiting on `user_details/`.
     * Named `USER_DATA` for continuity with the pre-strip cookie.
     */
    userData: 'USER_DATA',
    browserSessionId: 'BROWSER_SESSION_ID',
  },

  SUPABASE: {
    SupabaseUser: 'DEVELOPMENT_SUPABASE_USER',
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
     * TODO(content): UAT has no equivalent of the production courses (440/442) —
     * it answers "MasterClass not found or inaccessible" for both — so the Audit
     * and CFO Teams sections render empty here until they're published. Swap in
     * the UAT ids when they exist.
     */
    catalogueCourses: {
      audit: 440,
      cfoTeams: 442,
    },

    /** Gates the /ai-labs evaluation/assessment layer — see environment.ts. */
    assessmentEnabled: false,
    AI_LABS_CHANNEL: 'AI_LAB_AUTH_DEV',
    AI_LABS_CALLBACK_DONE: 'CALLBACK_DONE_DEV',
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
    enabled: true, // dev build runs analytics for testing
    debug: true, // verbose analytics logging in dev
    // Each vendor is self-contained: `enabled` toggle + its own keys.
    ga4: {
      enabled: true, // GA4 tag via the GTM container
      gtmId: 'GTM-53VZ4GW2', // dev GTM container
      measurementId: 'G-CDJF28ZGXT', // dev GA4 measurement id
    },
    clarity: {
      enabled: false, // Microsoft Clarity — OFF in dev (key present but not loaded)
      projectId: 'wltd1dk7wp',
    },
    netcore: {
      enabled: true, // Netcore Smartech
      scriptUrl: '//cdnt.netcoresmartech.com/smartechclient.js',
      siteKey: 'ADGMOT35CHFLVDHBJNIG50K96976B8VTENB58JOU9LNN0KVISGIG', // same across envs
      appId: 'ef86e2c70627d3e863c7fe3381488e05', // UAT Netcore website id (siteid)
      listId: '', // blank = global list (0): GA4 user properties sync to every contact
      swPath: '/sw.js', // SSR server generates this per-build (see src/service-worker.ts)
      webPush: true, // on for UAT push testing
      // FCM web-push credentials baked into the dynamically-served /sw.js (UAT).
      push: {
        apiKey: 'AIzaSyAO_n0F8wZc6tCabFNfVSZs5yKOR77Lfvw',
        messagingSenderId: '861360152370',
        appId: '1:861360152370:web:10c1f04bae627da2fc812b', // FCM web app id (≠ netcore siteid above)
        projectId: 'miles-masterclass',
      },
    },
  },
};
