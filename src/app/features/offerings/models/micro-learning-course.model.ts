import {
  CPEModeDetails,
  Content,
  FieldOfStudy,
  QuizDetails,
  UserAssessmentDetails,
  UserFeedbackDetails,
} from '@core/models/course.model';

export enum ActionStatus {
  TAKE_QUIZ = 'TAKE_QUIZ',
  TAKE_EXAM = 'TAKE_EXAM',
  REWATCH = 'REWATCH',
  RETAKE_EXAM = 'RETAKE_EXAM',
  FEEDBACK = 'FEEDBACK',
  DOWNLOAD = 'DOWNLOAD',
}

export interface MicroLearningFieldOfStudy extends FieldOfStudy {
  cpe_credits: number;
}

import { CommonResponse, RouteConfig } from '@core/models/http.model';

/** Cursor pagination envelope for the nano-learning feed. The opaque `next_cursor` already encodes the seed + page. */
export interface NanoLearningCursorPagination {
  next_cursor: string | null;
  seed: number;
  page_size: number;
}

/** Nano-learning list/detail response — carries the cursor pagination shape. */
export type NanoLearningListResponse = CommonResponse<MicroLearningReel[]> & {
  pagination_data?: NanoLearningCursorPagination;
};

/** A parsed page of the nano-learning feed — reels plus the cursor for the next page. */
export interface NanoLearningPage {
  reels: MicroLearningReel[];
  nextCursor: string | null;
}

/** Router navigation-state key the hero uses to hand its first page to the course page. */
export const NANO_LEARNING_HANDOFF_KEY = 'microLearningPage';

/** Playback position reported by a player, keyed by the chapter it tracks against. */
export interface ReelActivityPayload {
  chapterId: number;
  currentTime: number;
  duration: number;
}

export const NANO_LEARNING_ROUTES = {
  getCourseList: {
    path: 'v2/nano-learning/',
    method: 'GET',
  } as RouteConfig<
    void,
    NanoLearningListResponse,
    Record<string, string | string[]>,
    { cursor?: string }
  >,

  getCourseDetails: {
    path: 'v2/nano-learning/:id',
    method: 'GET',
  } as RouteConfig<
    void,
    NanoLearningListResponse,
    Record<string, string | string[]>,
    { id: number; cursor?: string }
  >,
} as const;

export interface MicroLearningReel extends Content {
  video_url: string;
  /** Backing chapter id — sent as `chapter_id` to /v2/user/myclassactivity/. */
  chapter_id: number;
  has_exercise_files: boolean;
  is_downloadable: boolean;
  additional_resource: unknown[];
  fields_of_study: MicroLearningFieldOfStudy[];
  learning_objectives?: string;
  topics?: string[];
  prerequisite_education?: string;
  advance_preparation?: string;
  exam_rules?: string;
  trailer_thumbnail?: string | null;
  horizontal_trailer_thumbnail?: string | null;
  start_date?: string;
  total_duration?: number;
  course_duration?: number;
  is_subscription_excluded?: boolean;
  /** When true, the reel can be purchased standalone — drives cart-CTA visibility. */
  can_purchase_individually?: boolean;
  is_free?: boolean;
  priority_order?: number;

  /** CPE / tracking fields — present on authenticated CPE-aware responses. */
  cpe_mode_details?: CPEModeDetails | null;
  /** Chapter quiz data — populated when `action_status === TAKE_QUIZ` or completion is reached. */
  quiz_details?: QuizDetails;

  /** Authenticated-only fields returned by /v2/nano-learning when a user is logged in. */
  is_added_to_cart?: boolean;
  added_bookmark?: boolean;
  /**
   * Alternate bookmark field — some reel-list responses ship this name
   * instead of `added_bookmark`. Reel UI falls back to it via
   * `?? is_bookmarked`.
   */
  is_bookmarked?: boolean;
  user_feedback_details?: UserFeedbackDetails;
  user_assessment_details?: UserAssessmentDetails;
  /** Seconds watched (analogous to `play_history.time_status` on chapters). */
  last_activity?: number | null;
  action_status?: ActionStatus | null;
}

/** A reel is considered completed once the user has watched at least this % of its duration. */
export const REEL_COMPLETION_THRESHOLD = 95;

export function isReelCompleted(
  reel: Pick<MicroLearningReel, 'last_activity' | 'total_duration'>,
): boolean {
  const duration = reel.total_duration ?? 0;
  const watched = reel.last_activity ?? 0;
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
 * absent — the case after the exam and after feedback, since the server does
 * NOT stamp `action_status` for those stages — fall back to the reel's own
 * assessment/feedback fields, mirroring the masterclass course hero
 * (`user_assessment_details.status` + `user_feedback_details.user_feedback_submitted`).
 */
export function deriveActionStatus(
  reel: Pick<
    MicroLearningReel,
    | 'action_status'
    | 'cpe_mode_details'
    | 'user_assessment_details'
    | 'user_feedback_details'
    | 'last_activity'
    | 'total_duration'
  >,
): ActionStatus | null {
  // Preview mode (or no CPE decision yet) → playback only, no CTA stages.
  if (!reel.cpe_mode_details?.cpe_mode) return null;
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

export interface MicroLearningFilterOption {
  id: string;
  label: string;
  selected: boolean;
}

/** Option keys exposed by the inline reel-card `[ngMenu]`. */
export type MicroLearningOptionId = 'about' | 'transcript' | 'glossary';
