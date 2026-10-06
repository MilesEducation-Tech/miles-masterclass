import {
  MasterclassCourse,
  MasterclassTrack,
} from '@features/offerings/masterclass/models/masterclass-home.model';

/**
 * Keys live UAT sends on every course that the page does not read. Spread into
 * the mock so a spec flushing it also proves extra keys pass the parse.
 */
const UNREAD_COURSE_KEYS = {
  description: 'In ‘Microsoft Copilot: Dawn of the Intelligent System’, the course…',
  web_background_video_url: null,
  total_duration: '2 hour 20 minutes',
  delivery_method: 'QAS Self Study',
  program_level: null,
  subject: { id: '18db6300-ad7e-46c3-a226-30bfe5fdddb8', name: 'CAIRA' },
  has_additional_resources: {
    has_exercise_files: false,
    has_ai_kit: false,
    has_ai_labs: false,
    has_tools: true,
  },
  is_bookmarked: false,
  bookmark_id: null,
  first_chapter: {
    id: '7b9ded52-72e5-4012-bde2-25215b3622e1',
    slug: 'microsoft-365-copilot-origins',
    name: 'Microsoft 365 Copilot: Origins',
  },
};

/** A course card as live UAT sent it on 2026-10-05, trimmed to one field of study. */
export function mockMasterclassCourse(
  id: string,
  overrides: Record<string, unknown> = {},
): MasterclassCourse {
  return {
    ...UNREAD_COURSE_KEYS,
    id,
    slug: `course-${id}`,
    title: 'Microsoft Copilot: Dawn of the Intelligent System',
    short_description: 'Explore how Microsoft 365 Copilot boosts productivity for accountants.',
    thumbnails: {
      horizontal: 'https://example.test/h.png',
      vertical: 'https://example.test/v.png',
      square: 'https://example.test/s.png',
    },
    trailer_url: 'https://example.test/trailer.mp4',
    fields_of_study: [
      { id: '0c199ae8-74c7-4f03-ba25-6474685901e2', name: 'Information Technology', cpe_credit: 2 },
    ],
    total_cpe_credits: 2,
    has_individual_badge: false,
    included_for_caira: true,
    ...overrides,
  };
}

export function mockMasterclassTrack(
  id: string,
  courses: MasterclassCourse[],
  overrides: Partial<MasterclassTrack> = {},
): MasterclassTrack {
  return {
    id,
    slug: `track-${id}`,
    name: `Track ${id}`,
    description: `About track ${id}`,
    priority: 1,
    courses,
    ...overrides,
  };
}

/**
 * The paginated block the API wraps every list in (live UAT since 2026-10-06):
 * the tracks, each track's courses, and `coming_soon`.
 */
export function mockPage<T>(results: T[], slug: string) {
  return {
    slug,
    count: results.length,
    page: 1,
    page_size: 100,
    total_pages: results.length ? 1 : 0,
    has_next: false,
    has_previous: false,
    next: null,
    previous: null,
    results,
  };
}

/**
 * The `home-page/` body, in the live `{ success, message, data }` envelope,
 * with the tracks and each track's courses wrapped the way the API sends them.
 */
export function mockHomePageBody(
  tracks: MasterclassTrack[],
  loginType: 'pre_login' | 'post_login' = 'pre_login',
) {
  return {
    success: true,
    message: 'Home page loaded.',
    data: {
      login_type: loginType,
      tracks: mockPage(
        tracks.map((track) => ({
          ...track,
          courses: mockPage(track.courses, 'home_track_courses_web'),
        })),
        'home_tracks_web',
      ),
      coming_soon: mockPage([], 'home_coming_soon_web'),
    },
  };
}
