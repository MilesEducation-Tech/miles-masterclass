import { environment } from '@env/environment';
import { RouteConfig } from '@core/models/http.model';
import { CourseMode } from '@features/offerings/models/course-detail.model';
import {
  ReelActionStatus,
  ReelCourseType,
  ReelUserState,
} from '@features/offerings/models/reel.model';

/**
 * A reel is a course of either type, and every reel read takes both at once,
 * comma-joined (UAT, 2026-11-12). `reels-feed/` refuses `course` and `podcast`.
 */
export const REEL_COURSE_TYPES: readonly ReelCourseType[] = ['nano_learning', 'micro_learning'];

/**
 * The reel feed, page by page; append `<uuid>/` to open it on one reel (its
 * `anchor`, then the feed without it). Public with `login_type`: `pre_login`
 * is served anonymously with every reel locked, `post_login` is a 401 without
 * a token. Postman `web-masterclass-reels-feed-v1` / `-reels-feed-anchor-v1`.
 */
export const REELS_FEED_URL = `${environment.API.baseUrl}web-api/v1/masterclass/reels-feed/`;

/** Reels per feed page: the API's default, about two screens of swiping. */
export const REELS_FEED_PAGE_SIZE = 6;

/**
 * `IsAuthenticated`, `{mode}`: set the learner's mode on one course (`:id`, its
 * UUID). A real change hard-deletes the learner's progress on it
 * (`progress_reset`); asking for the mode in force is a no-op; with no
 * enrolment yet it creates one in that mode. Refusals: `403
 * caira_enrollment_required` for CPE on a reel outside CAIRA (Preview stays
 * open), `409 course_mode_locked` once the final assessment has been attempted.
 * Postman `web-masterclass-course-mode-v1`.
 */
export const REEL_COURSE_MODE_ROUTE = {
  path: `${environment.API.baseUrl}web-api/v1/masterclass/course-mode/:id/`,
  method: 'POST',
} as RouteConfig<{ mode: CourseMode }, unknown>;

/** The reel's button for each next step the server decides. */
export const REEL_STEP_LABELS: Readonly<Record<ReelActionStatus, string>> = {
  WATCH_IN_CPE_MODE: 'Watch in CPE mode',
  TAKE_QUIZ: 'Take Quiz',
  TAKE_EXAM: 'Take Final Assessment',
  RETAKE_EXAM: 'Retake Final Assessment',
  REWATCH: 'Rewatch',
  FEEDBACK: 'Submit Feedback',
  DOWNLOAD: 'Download Certificate',
};

/** A step whose `course-detail/` read failed, so the quiz or the exam couldn't open. */
export const REEL_STEP_COPY = {
  unavailable: { title: "Couldn't open this step", body: 'Please try again.' },
} as const;

/** A reel's state after a mode switch that erased its progress (`progress_reset`). */
export const REEL_PROGRESS_CLEARED: Partial<ReelUserState> = {
  last_watched_position_seconds: 0,
  max_watched_duration_seconds: 0,
  is_video_completed: false,
  is_chapter_completed: false,
  action_status: null,
};

/** The mode switch's toast. */
export const REEL_MODE_COPY = {
  cpe: {
    title: 'CPE Mode',
    body: 'CPE Certification Mode is on. The reel starts again from the beginning.',
  },
} as const;

/** What the player says, by the learner's access to the reel on screen. */
export const REEL_ACCESS_COPY = {
  guest: {
    title: 'Sign in to watch this reel',
    body: 'This is the trailer. Sign in to watch the full reel and earn CPE credit.',
    button: 'Sign in to watch',
  },
  locked: {
    title: 'Subscribe to watch this reel',
    body: 'This is the trailer. Subscribe to watch the full reel and earn CPE credit.',
    button: 'Subscribe to watch',
  },
} as const;

/** The player's empty and error states. */
export const REEL_PLAYER_COPY = {
  notFound: "We couldn't find this reel.",
  loadError: "We couldn't load the reels.",
  noTranscript: { title: 'Transcript', body: 'No transcript is available for this reel.' },
  noGlossary: { title: 'Glossary', body: 'No glossary is available for this reel.' },
  readFailed: { title: 'Something went wrong', body: 'Please try again.' },
} as const;
