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

/**
 * The toast a signed-in learner sees when registration needs a complete
 * profile first; `WebinarFacade` then opens `/auth/profile` with a `redirect`
 * back to the page they were on. Used when the profile is known to be
 * incomplete before any call. When the API refuses instead, its own `detail`
 * (which names the missing field) replaces `body`.
 */
export const PROFILE_REQUIRED_PROMPT: SignInPrompt = {
  title: 'Complete your profile first',
  body: "We need a few details, including your name, before we can book your seat. We'll bring you straight back here.",
};
