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
};
