import { LogLevel } from '@core/models/log.model';
import { Environment } from '@env/environment.model';

/**
 * Local: `ng serve --configuration local`. Same backends as UAT; `SITE_URL`
 * matches the dev-server port so canonical/og:url and sitemap links resolve
 * locally.
 */
export const environment = {
  production: false,
  SITE_URL: 'http://localhost:4101',

  // ---- Core ----------------------------------------------------------------
  BASE_API_URL: 'https://uat-api.milescaira.com/',
  S3_BUCKET_URL: 'https://d1pp0977rsxmiq.cloudfront.net/',
  GCS_URL: 'https://asset.milesmasterclass.com/media/web-app/',
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
    // UAT has no 440/442 yet — see environment.development.ts.
    catalogueCourses: {
      audit: 440,
      cfoTeams: 442,
    },
    assessmentEnabled: false,
  },
  I18N: {
    // Every language, including the ones still being translated.
    enabled: true,
    languages: ['en', 'ar', 'fr', 'de', 'es'],
  },
} satisfies Environment;
