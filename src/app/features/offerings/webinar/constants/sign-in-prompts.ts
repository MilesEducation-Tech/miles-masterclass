import { SignInPrompt, SignInPromptAction } from '@features/offerings/webinar/models/webinar.model';

/**
 * What the webinar pages tell a signed-out visitor who tries an action that
 * needs an account. `WebinarFacade.promptSignIn` shows it in `UtilsDialog`, with
 * "Not now" and "Sign in" buttons; "Sign in" returns them to the same page.
 */
export const SIGN_IN_PROMPTS: Record<SignInPromptAction, SignInPrompt> = {
  register: {
    title: 'Sign in to register',
    body: 'Registering for a webinar reserves your seat and tracks your attendance for CPE credit, so we need to know who you are. Sign in and we will bring you straight back here.',
  },
  join: {
    title: 'Sign in to join',
    body: 'Joining a live webinar records your attendance for CPE credit, so we need to know who you are. Sign in and we will bring you straight back here.',
  },
};
