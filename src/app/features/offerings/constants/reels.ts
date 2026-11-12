import { environment } from '@env/environment';
import { ReelCourseType } from '@features/offerings/models/reel.model';

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
