import { UtilsDialogData } from '../../components/dialog/utils-dialog/utils-dialog';
import { LmsUserType } from '../models/auth.model';

/**
 * LMS-migration prompts shown when a user with blocked LMS access attempts to
 * sign in. Each entry uses the `UtilsDialog` app-download layout (set by
 * `subtitle` + `footer`) — the dialog renders the Miles One promo with store
 * badges, QR code, and phone mockup. `content[]` is left empty since the
 * app-download layout supersedes the typed content list when subtitle/footer
 * are present.
 */
export const CONTENT_MAP: Record<LmsUserType, UtilsDialogData> = {
  caira: {
    containerClass: '',
    title: 'CAIRA Has a New Home!',
    content: [],
    subtitle:
      'CAIRA content is now available on the Miles One app, and your progress has been seamlessly migrated.',
    footer:
      'Head over to Miles One to continue your learning journey, or scan the QR code to download the app.',
  },
  lms_enrolled: {
    containerClass: '',
    title: 'CAIRA Has a New Home!',
    content: [],
    subtitle:
      'Your free CAIRA content (complimentary with your Miles enrollment) is now available on the Miles One app.',
    footer: 'Head over to Miles One to continue your learning journey or scan to download the app.',
  },
  cpa_alumni: {
    containerClass: '',
    title: 'CAIRA Has a New Home!',
    content: [],
    subtitle:
      'Your free CAIRA content (complimentary with your Miles enrollment) is now available on the Miles One app.',
    footer: 'Head over to Miles One to continue your learning journey or scan to download the app.',
  },
  cma_alumni: {
    containerClass: '',
    title: 'CAIRA Has a New Home!',
    content: [],
    subtitle:
      'Your free CAIRA content (complimentary with your Miles enrollment) is now available on the Miles One app.',
    footer: 'Head over to Miles One to continue your learning journey or scan to download the app.',
  },
  non_lms: {
    containerClass: '',
    title: 'Content Has Moved!',
    content: [],
    subtitle:
      "The content you're looking for is now available on the Miles One app. Download it to get started.",
    footer:
      'Head over to Miles One to start your learning journey, or scan the QR code to download the app.',
  },
};

// The hidden dev-login route was removed with the SSO migration. Its mechanism
// (`communication_method: 5`, returning the code as `otp_dev`) has no
// equivalent in Miles SSO: dev codes there are keyed off a server-side address
// allowlist and are being withdrawn. QA uses a real inbox.
