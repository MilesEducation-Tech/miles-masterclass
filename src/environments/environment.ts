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
  // why: the live API isn't up yet, so production points at UAT for now.
  // Switch back to 'https://api.milescaira.com/' once it is.
  BASE_API_URL: 'https://uat-api.milescaira.com/',
  S3_BUCKET_URL: 'https://d1pp0977rsxmiq.cloudfront.net/',
  GCS_URL: 'https://asset.milesmasterclass.com/media/web-app/',
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
  AI_LABS: {
    catalogueCourses: {
      audit: 440,
      cfoTeams: 442,
    },
    assessmentEnabled: false,
  },
  I18N: {
    // A language is listed only once it is fully translated (prompts/language-i18n.md).
    enabled: false,
    languages: ['en'],
  },
} satisfies Environment;
