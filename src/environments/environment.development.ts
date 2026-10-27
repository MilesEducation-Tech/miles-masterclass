import { LogLevel } from '@core/models/log.model';
import { Environment } from '@env/environment.model';

/** UAT: the `development` build, served at the test domain and on every Vercel preview. */
export const environment = {
  production: false,
  SITE_URL: 'https://uat.milesmasterclass.com',

  // ---- Core ----------------------------------------------------------------
  API: {
    baseUrl: 'https://uat-api.milescaira.com/',
  },
  ASSETS: {
    s3Url: 'https://d1pp0977rsxmiq.cloudfront.net/',
    gcsUrl: 'https://asset.milesmasterclass.com/media/web-app/',
  },
  LOGGER: {
    LogLevel: LogLevel.DEBUG,
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
  AI_LABS: {
    // TODO(content): UAT has no equivalent of the production courses (440/442),
    // so the Audit and CFO Teams sections render empty here. Swap in the UAT ids
    // once they are published.
    catalogueCourses: {
      audit: 440,
      cfoTeams: 442,
    },
    assessmentEnabled: false,
  },
  I18N: {
    // Every language, so translations can be reviewed before production lists them.
    enabled: true,
    languages: ['en', 'ar', 'fr', 'de', 'es'],
  },
} satisfies Environment;
