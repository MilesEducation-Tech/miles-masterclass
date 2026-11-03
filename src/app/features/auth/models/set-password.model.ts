/** The set-password form. Lives only as long as the page, and is wiped once a password is set. */
export interface SetPasswordModel {
  /** The profile's change form proves it is the learner with this. */
  currentPassword: string;
  newPassword: string;
  /** Checked here, never sent. */
  confirmPassword: string;
  /** The emailed code, once the server asks for one. */
  emailCode: string;
}

/**
 * What `password/` is sent as proof. `NONE` is a first password within 15 minutes of a code sign-in;
 * `EMAIL_CODE` follows `verification_required` (or "Forgot your current password?");
 * `CURRENT_PASSWORD` is the profile's change form.
 */
export type PasswordProof = 'NONE' | 'EMAIL_CODE' | 'CURRENT_PASSWORD';

/** The profile's Password section: `CHANGE` once the account is known to have a password. */
export type PasswordMode = 'SET' | 'CHANGE';

/** Onboarding on `/auth/profile`: set a password (skippable), then the questionnaire. */
export type OnboardingStep = 'PASSWORD' | 'QUESTIONS';

/** What the profile page shows: `DECIDING` while it can't yet tell whether to offer a password. */
export type ProfileStage = OnboardingStep | 'DECIDING';

/** Which part of the stated password policy a new password misses. */
export type PasswordPolicyBreach = 'short' | 'long' | 'letter' | 'digit';
