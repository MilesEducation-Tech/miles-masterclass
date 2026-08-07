/**
 * Reel CTA state — presentation logic, not transport.
 *
 * Lifted out of the deleted `micro-learning-course.model.ts` during the Django
 * strip: the response types went, this didn't. It decides which call-to-action
 * a reel card shows, so it belongs with the design, not the backend.
 *
 * The `reel` parameters are typed loosely on purpose — retype them once the new
 * backend's reel payload exists.
 */

export enum ActionStatus {
  TAKE_QUIZ = 'TAKE_QUIZ',
  TAKE_EXAM = 'TAKE_EXAM',
  REWATCH = 'REWATCH',
  RETAKE_EXAM = 'RETAKE_EXAM',
  FEEDBACK = 'FEEDBACK',
  DOWNLOAD = 'DOWNLOAD',
}

/** A reel is considered completed once the user has watched at least this % of its duration. */
export const REEL_COMPLETION_THRESHOLD = 95;

export function isReelCompleted(reel: any): boolean {
  const duration = reel?.total_duration ?? 0;
  const watched = reel?.last_activity ?? 0;
  if (duration <= 0) return false;
  return (watched / duration) * 100 >= REEL_COMPLETION_THRESHOLD;
}

/**
 * The CTA stage for a reel. The entire post-video flow — chapter quiz, final
 * assessment, feedback, certificate — is **CPE-mode only**; in Preview mode the
 * reel just plays, so this returns `null` and the CTA stays on playback / the
 * "Watch in CPE MODE" upgrade.
 *
 * Within CPE mode, an explicit `action_status` (server-pushed, or the local
 * TAKE_QUIZ/TAKE_EXAM override set during the live quiz flow) wins. When it's
 * absent, the stage is derived from the completion + assessment + feedback
 * fields.
 */
export function deriveActionStatus(reel: any): ActionStatus | null {
  // Preview mode (or no CPE decision yet) → playback only, no CTA stages.
  if (!reel?.cpe_mode_details?.cpe_mode) return null;
  if (reel.action_status) return reel.action_status;
  // Field-derived stages only apply to a watched-complete reel — a rewatch
  // resets `last_activity`, and should show playback labels, not a stale
  // Download from a prior completion.
  if (!isReelCompleted(reel)) return null;
  if (reel.user_feedback_details?.user_feedback_submitted) return ActionStatus.DOWNLOAD;
  if (reel.user_assessment_details?.status === 'Exam_Passed') return ActionStatus.FEEDBACK;
  if (reel.user_assessment_details?.status === 'Retake') return ActionStatus.RETAKE_EXAM;
  return null;
}
