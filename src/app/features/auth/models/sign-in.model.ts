/** The password view's form. The password is held as typed and wiped when the page is left. */
export interface PasswordLoginModel {
  email: string;
  password: string;
}

/** Which way into the account the login card is showing. `OTP` is the existing two-step code flow. */
export type LoginView = 'PASSWORD' | 'OTP';

/** The forgot page's one field. */
export interface ForgotPasswordModel {
  email: string;
}

/**
 * The reset page. `READY` until the learner clicks — the link is spent on redemption, so nothing is
 * sent on load — then `BUSY`, and `DONE` with the new PIN or `ERROR`. `MISSING` is a link with no token.
 */
export type ResetStatus = 'MISSING' | 'READY' | 'BUSY' | 'DONE' | 'ERROR';
