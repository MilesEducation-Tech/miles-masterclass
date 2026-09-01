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

  /** UAT CAIRA origin. See the note in `environment.ts`. No `/api/` prefix. */
  BASE_API_URL: 'https://uat-api.milescaira.com/',

  S3_BUCKET_URL: 'https://d1pp0977rsxmiq.cloudfront.net/',
  GCS_URL: 'https://asset.milesmasterclass.com/media/web-app/',

  appType: 'WA',
  platform: 'masterclass',

  /** Dev-channel OTP (`OtpChannel.DEV`, 5). See the note in `environment.ts`. */
  OTP_DEV_CHANNEL: true,

  LOGGER: {
    LogLevel: LogLevel.DEBUG,
  },

  AUTH: {
    accessToken: 'DEVELOPMENT_ACCESS_TOKEN',
    refreshToken: 'DEVELOPMENT_REFRESH_TOKEN',
    userData: 'DEVELOPMENT_USER_DATA',
    browserSessionId: 'DEVELOPMENT_BROWSER_SESSION_ID',
    // Cached active-plan flag. Persisted so synchronous route guards
    // (activePlanGuard) can answer on a hard refresh before the async
    // current-plan API resolves.
    activePlan: 'DEVELOPMENT_ACTIVE_PLAN',
    // TransferState keys for SSR
    transferUserData: 'auth_user_data',
    transferAuthStatus: 'auth_status',
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
    tenantId: 'ebe14113-0d9f-4dff-9d17-ff83f82303aa',
    clientId: '4f5a099c-5c29-4fa2-ab37-58634b32bfd4',
    copilotUrl: 'https://copilotstudio.microsoft.com/',
    redirectPath: '/auth/ai-labs-callback',
    /** localStorage key — kept distinct from the admin client's session. */
    storageKey: 'AI_LABS_SUPABASE_SESSION',
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
