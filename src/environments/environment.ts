import { LogLevel } from '@core/models/log.model';
import { Environment } from '@env/environment.model';

/**
 * Production. Every key is documented on `Environment`; comments here only say
 * why a value is what it is.
 */
export const environment = {
  production: true,
  SITE_URL: 'https://www.milesmasterclass.com',

  // ---- Core ----------------------------------------------------------------
  API: {
    // why: the live API isn't up yet, so production points at UAT for now.
    // Switch back to 'https://api.milescaira.com/' once it is.
    baseUrl: 'https://uat-api.milescaira.com/',
  },
  ASSETS: {
    s3Url: 'https://d1pp0977rsxmiq.cloudfront.net/',
    gcsUrl: 'https://asset.milesmasterclass.com/media/web-app/',
  },
  LOGGER: {
    // why: learners' consoles get warnings and errors only; debug and info
    // output stays on UAT and local.
    LogLevel: LogLevel.WARN,
  },

  // ---- Features --------------------------------------------------------------
  AUTH: {
    otpLength: 6,
  },
  SUPABASE: {
    url: 'https://lodzktvnxuprpogelodm.supabase.co',
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZHprdHZueHVwcnBvZ2Vsb2RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0MzE1NDYsImV4cCI6MjA3ODAwNzU0Nn0.ychDwrqAURLnKyAkP4MHGwpcH7VwE4WcRt2E7oHoEL4',
  },
  SALESFORCE_LEAD: {
    url: 'https://hn19ywvvng.execute-api.ap-south-1.amazonaws.com/Miles360/create-net-enquiry/mmc',
    courseId: 1,
    vertical: 'US Accounting',
  },
  WEBINAR: {
    liveEnabled: true,
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
    /** localStorage key for the AI Labs Supabase session. */
    storageKey: 'AI_LABS_SUPABASE_SESSION',
    /** The popup callback tells the opener it's done on this same-origin BroadcastChannel. */
    AI_LABS_CHANNEL: 'AI_LAB_AUTH',
    AI_LABS_CALLBACK_DONE: 'CALLBACK_DONE',
  },
  I18N: {
    // A language is listed only once it is fully translated (prompts/language-i18n.md).
    enabled: false,
    languages: ['en'],
  },
} satisfies Environment;
