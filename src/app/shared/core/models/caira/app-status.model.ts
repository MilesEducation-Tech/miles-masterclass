/**
 * L2 · `GET web/app-status/` — the post-login gate.
 *
 * A bare response: no envelope, no `status` key, four booleans at the top level.
 *
 * **Every field is optional, and that is load-bearing.** The backend omits keys
 * rather than nulling them, and the polarity is inverted from what the names
 * suggest — confirmed with the backend, an all-true response is the *happy*
 * learner: pathway selected, profile complete, no maintenance window. So a
 * missing key must read as permissive. A naive `!status.is_pathway` would lock
 * every learner out the moment the backend dropped a field.
 */
export interface AppStatusResponse {
  /**
   * The **mobile app's** maintenance window. Never read this on web — it is
   * true during app-store releases that do not affect the browser at all.
   */
  is_maintenance?: boolean;
  /** The web LMS maintenance window. This is the one that gates the browser. */
  is_web_maintenance?: boolean;
  /** `true` = the learner has an active pathway selected. */
  is_pathway?: boolean;
  /** `true` = the learner finished profile onboarding. */
  is_onboarding_completed?: boolean;
}

/**
 * What the app should do about it. Exactly one applies, and the order below is
 * the precedence: maintenance outranks everything, because a learner cannot fix
 * their pathway or profile while the LMS is down.
 */
export type AppStatusVerdict = 'ok' | 'maintenance' | 'needs-pathway' | 'needs-onboarding';

/**
 * Reduce the four flags to one verdict.
 *
 * Compares against `true` / `false` explicitly rather than testing truthiness,
 * so an absent key falls through to `'ok'` instead of blocking. See the note on
 * `AppStatusResponse`.
 */
export function appStatusVerdict(status: AppStatusResponse | undefined): AppStatusVerdict {
  if (!status) return 'ok';
  if (status.is_web_maintenance === true) return 'maintenance';
  if (status.is_pathway === false) return 'needs-pathway';
  if (status.is_onboarding_completed === false) return 'needs-onboarding';
  return 'ok';
}
