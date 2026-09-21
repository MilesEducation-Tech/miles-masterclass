import { LogLevel } from '../app/shared/core/models/log.model';

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

  BASE_API_URL: 'https://api.milesmasterclass.com/api/',

  /**
   * Dev-only key for the Miles SSO support OTP-reveal endpoint, used by the
   * hidden QA login route (`DEV_LOGIN_PATH`).
   *
   * EMPTY ON PRODUCTION, AND IT MUST STAY EMPTY. It authenticates an endpoint
   * that returns the login OTP for *any* identifier, so a value here ships in
   * the JS bundle and hands every visitor a way into any account. With it empty
   * the hidden route is inert and behaves like an ordinary login page.
   */
  SSO_SUPPORT_API_KEY: 'gP9GY-LsLPuvtEZLd_XyGKJTFxb4zNBKH_x4uxiONpM',

  // MilesVerse API origin. Empty = MilesVerse pages show not-connected.
  MILESVERSE_API_URL: 'https://api.milesverse.ai',

  MILESVERSE_SSO: {
    token: '',
    orgId: 'daad80f2-95ee-47db-b65c-6e029b4f710d',
    applicationId: 'f701288a-f040-471f-bd83-8d33e8f15f3c',
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
    userData: 'USER_DATA',
    browserSessionId: 'BROWSER_SESSION_ID',
    // Cached active-plan flag. Persisted so synchronous route guards
    // (activePlanGuard) can answer on a hard refresh before the async
    // current-plan API resolves.
    activePlan: 'ACTIVE_PLAN',
    // TransferState keys for SSR
    transferUserData: 'auth_user_data',
    transferAuthStatus: 'auth_status',
  },

  /**
   * B2B single sign-on — the learner's own employer authenticates them.
   *
   * A separate Supabase project from SUPABASE and AI_LABS: the B2B companies,
   * their verified domains, their SAML connections and their licences all live
   * on the Miles SSO project, and this is the only client that talks to it.
   * Its own `storageKey` for the same reason — three clients sharing one would
   * overwrite each other's sessions.
   *
   * Everything here is public by design: the URL, and an anon key that is
   * RLS-scoped. Nothing secret belongs in the browser bundle.
   *
   * This is the one auth call the browser makes directly instead of through the
   * Masterclass backend, because a SAML redirect has to happen in the browser.
   * `redirectPath` resolves against SITE_URL so the allowlisted value is fixed
   * per environment and SSR can produce it too — it must match, character for
   * character, what SSO has registered for this application.
   */
  B2B_SSO: {
    /**
     * The Supabase project, NOT the Miles SSO API.
     *
     * supabase-js talks to GoTrue here (`/auth/v1/...`), so this has to be the
     * host that serves those paths. `auth.mileseducation.com` and
     * `auth-uat.mileseducation.com` are the NestJS API and answer 404 to every
     * one of them — pointing this there breaks sign-in entirely.
     *
     * It does not vary by environment: there is one Supabase project behind
     * both UAT and production. Which SSO *API* is called is the backend's
     * business (MILES_SSO_V2_BASE_URL, a Django setting), never the browser's.
     */
    supabaseUrl: 'https://sso.mileseducation.com',
    supabaseAnonKey: 'sb_publishable_cMf4e8dd6DaCgsPLJ6Px5w_3e14QeA_',
    redirectPath: '/auth/sso-callback',
    /** localStorage key — kept distinct from the other two Supabase clients. */
    storageKey: 'B2B_SSO_SUPABASE_SESSION',
  },

  SUPABASE: {
    SupabaseUser: 'PRODUCTION_SUPABASE_USER',
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
     * Masterclass courses whose chapters are the agent catalogue on /ai-labs.
     * Per-environment because course ids are not portable: these exist on
     * production only, and UAT answers "MasterClass not found" for them — so a
     * shared constant would silently empty the catalogue on every lower
     * environment. Point these at the UAT equivalents once they're published.
     */
    catalogueCourses: {
      audit: 440,
      cfoTeams: 442,
    },

    /**
     * Gates the evaluation/assessment layer on /ai-labs: the workflow-submission
     * panel in the agent dialog, the per-card score badge, and the hero "your
     * progress" strip. Off until the grading backend is ready — flip to true to
     * make the (currently mocked) flow visible for evaluation.
     */
    assessmentEnabled: false,
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

  /**
   * Analytics & engagement (PRODUCTION ONLY). The Analytics service is a no-op
   * unless `production === true` AND `ANALYTICS.enabled` is true, so UAT/local
   * traffic never reaches GA4 / Clarity / Netcore. Everything is consent-gated
   * (Consent Mode v2, opt-in) and fully disabled on `/admin/**`.
   */
  ANALYTICS: {
    enabled: true, // master switch for this environment (browser-only at runtime)
    debug: false, // verbose analytics logging (dev only)
    // Each vendor is self-contained: `enabled` toggle + its own keys.
    ga4: {
      enabled: true, // GA4 tag via the GTM container
      gtmId: 'GTM-TLGXMQSQ', // Google Tag Manager container (hosts the GA4 tag)
      measurementId: 'G-F08HZV0NQ3', // GA4 measurement id (configure inside the GTM container)
    },
    clarity: {
      enabled: true, // Microsoft Clarity
      projectId: 'wltd1dk7wp', // Microsoft Clarity project id
    },
    netcore: {
      enabled: true, // Netcore Smartech
      scriptUrl: '//cdnt.netcoresmartech.com/smartechclient.js', // default DC
      siteKey: 'ADGMOT35CHFLVDHBJNIG50K96976B8VTENB58JOU9LNN0KVISGIG', // smartech('create', …) panel id (same across envs)
      appId: '6c3aae6d023e873fc9bf2863a30bb9e5', // smartech('register', …) Netcore website id (siteid, prod)
      listId: '', // blank = global list (0): GA4 user properties sync to every contact. Attributes must exist in the panel.
      swPath: '/sw.js', // SSR server generates this per-build (see src/service-worker.ts)
      webPush: true,
      // FCM web-push credentials baked into the dynamically-served /sw.js.
      push: {
        apiKey: 'AIzaSyDCJ4wb1HBACCWRzJUGSKjo1YRBFDVJBuw',
        messagingSenderId: '861360152370',
        appId: '1:861360152370:web:49927e6471b699b7fc812b', // FCM web app id (≠ netcore siteid above)
        projectId: 'miles-masterclass',
      },
    },
  },

  PAYMENT_TEST_SSN: '207646057',
};
