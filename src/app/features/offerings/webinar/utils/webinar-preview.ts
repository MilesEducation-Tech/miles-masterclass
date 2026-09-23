import { WebinarCard, WebinarMainPageData } from '../models/webinar.model';

/**
 * Stand-in feed for building the UI — **development builds only**.
 *
 * The page is bound to the live API. This is the opt-in escape hatch for
 * looking at sections UAT cannot currently populate: it has no future-dated
 * webinar, so `highlight_webinars` and `upcoming_webinars` come back empty and
 * the hero and the CAIRA rail render nothing.
 *
 * It returns a complete five-bucket feed of its own, shaped exactly like
 * `webinar-main-page` and typed against the same `WebinarMainPageData`.
 *
 * Entirely self-contained: it does NOT read the live response, so the API being
 * empty, slow or down changes nothing while the UI is being built.
 *
 * Delete this file once UAT carries a live schedule.
 */

/** Opt IN with `?preview=design`. The page is bound to the live API otherwise. */
export const PREVIEW_PARAM = 'preview';
export const PREVIEW_ON = 'design';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Real UAT artwork, so the crops and the blurred backdrop stay honest. */
const ART =
  'https://milesone-backend-assets.s3.ap-south-1.amazonaws.com/MilesOne/Files/Documents/Homepage_Upcoming_Events-_296_x_1703x_jtOsQSO_XVR6kim_N3cJz2n_SpHHJQ4_1_xHwDPDZ.png';
const SQUARE =
  'https://milesone-backend-assets.s3.ap-south-1.amazonaws.com/MilesOne/Files/Documents/Square-dont_put_any_title_in_banner3x_1_MbfiNfW_bVAOoex_e9qhWb4_1.png';
/** A real Credly badge, so the round overlap on the row is reviewable. */
const BADGE =
  'https://milesmasterclass-assets.s3.us-west-1.amazonaws.com/static-assests/credly-badges/AI+Prompting+Essentials+for+Accountants.png';

/** Stands in for `webinar_what_will_you_learn_points` on every seeded row. */
const OBJECTIVES = [
  'Utilize empathy as a key tool in fraud',
  'Determine the key elements that contribute to fraudulent behavior, including perceived opportunity, pressure, rationalization, and the role of personal circumstances.',
  'Compare the limitations of compliance-focused frameworks versus principle-based ethical considerations in guiding professional behavior.',
  'Discuss the potential pitfalls of using utilitarian principles as a sole basis for ethical decision-making.',
  'Identify the limitations of deontological ethics when dealing with complex, real-world issues.',
];

const FIELDS = [
  { id: 'fos-1', name: 'FOS-1', cpe_credit: 2 },
  { id: 'fos-2', name: 'FOS-2', cpe_credit: 1.5 },
];

/**
 * One row's worth of editorial.
 *
 * Levels are spread deliberately: Level 1 keeps more rows than the rail's page
 * size so "Show more" appears, and all three tabs are populated. The first
 * offset puts that row inside the 50-minute join window, so the Join state is
 * reachable without editing anything.
 */
interface Seed {
  name: string;
  description: string;
  level: number | null;
  subject: string | null;
  offsetMs: number;
}

const UPCOMING_SEEDS: Seed[] = [
  {
    name: 'AI in Accounting 101: Build your 1st AI Agent in 2 hrs',
    description:
      'Reimagine accounting with AI, automate the grind, close books in real time, and turn financial data into instant business insights.',
    level: 1,
    subject: 'CAIRA',
    offsetMs: 30 * MINUTE,
  },
  {
    name: 'Advanced Power BI: Mastering DAX & Data Modeling',
    description:
      'Learn how to build robust data models and write efficient DAX formulas to unlock deeper insights in your reports.',
    level: 1,
    subject: 'CAIRA',
    offsetMs: 6 * HOUR,
  },
  {
    name: 'Visual Analytics & Insights with Power BI in Microsoft Fabric',
    description:
      'Turn raw ledgers into dashboards your partners will actually read, without leaving the Microsoft stack.',
    level: 1,
    subject: 'CAIRA',
    offsetMs: 2 * DAY,
  },
  {
    name: 'Business Intelligence with Power BI',
    description:
      'From the first import to a published workspace: the reporting workflow a finance team can maintain.',
    level: 1,
    subject: 'CAIRA',
    offsetMs: 4 * DAY,
  },
  {
    name: 'Workflow Automation for Close and Reconciliation',
    description:
      'Cut the manual steps out of month-end with automations that leave an audit trail behind them.',
    level: 1,
    subject: 'CAIRA',
    offsetMs: 7 * DAY,
  },
  {
    name: 'Applied AI in Audit',
    description:
      'Audit has more repeatable work in it than almost any other part of the profession. Here is where the models help, and where they must not.',
    level: 2,
    subject: 'CAIRA',
    offsetMs: 9 * DAY,
  },
  {
    name: 'Prompt Engineering for Accounting Workpapers',
    description:
      'Write prompts that produce reviewable, referenced output instead of confident prose.',
    level: 2,
    subject: 'CAIRA',
    offsetMs: 12 * DAY,
  },
  {
    name: 'Governing AI Use Under Firm Independence Rules',
    description:
      'What a firm has to document, restrict and disclose before an AI tool touches client data.',
    level: 3,
    subject: 'CAIRA',
    offsetMs: 16 * DAY,
  },
  {
    name: 'Building an AI-Ready Data Layer for Finance',
    description:
      'The plumbing that has to exist before any of the clever parts are worth attempting.',
    level: 3,
    subject: 'CAIRA',
    offsetMs: 21 * DAY,
  },
  {
    // No subject, so no CAIRA mark and no level tab — the same fallback the
    // real feed produces for a non-CAIRA session.
    name: 'Kaun Banega CPA, with Varun Jain',
    description: 'The US CPA route for Indian accountants, start to licence, in one sitting.',
    level: null,
    subject: null,
    offsetMs: 25 * DAY,
  },
];

const PAST_SEEDS: Seed[] = [
  {
    name: 'Visual Analytics & Insights with Power BI',
    description: 'Completed session — attended in full and eligible for CPE.',
    level: 1,
    subject: 'CAIRA',
    offsetMs: -3 * DAY,
  },
  {
    name: 'Manage Communication and Nonverbal Cues',
    description: 'Completed session — attendance fell short of the CPE threshold.',
    level: 1,
    subject: 'CAIRA',
    offsetMs: -9 * DAY,
  },
  {
    name: 'Entrepreneurial Finance Tools for CPAs',
    description: 'Completed session — attended in full and eligible for CPE.',
    level: 2,
    subject: 'CAIRA',
    offsetMs: -14 * DAY,
  },
  {
    name: 'Data Storytelling for Finance Leaders',
    description: 'Booked and not attended.',
    level: 1,
    subject: 'CAIRA',
    offsetMs: -20 * DAY,
  },
  {
    name: 'Excel to Power Query: Retiring the Manual Refresh',
    description: 'Ran while you were not registered.',
    level: 1,
    subject: 'CAIRA',
    offsetMs: -26 * DAY,
  },
];

function toCard(seed: Seed, index: number, baseTime: number, idPrefix: string): WebinarCard {
  const start = baseTime + seed.offsetMs;
  const durationMinutes = 120;
  return {
    id: `${idPrefix}-${index}`,
    slug: null,
    name: seed.name,
    type: 'webinar',
    short_description: seed.description,
    start_date_time: new Date(start).toISOString(),
    end_date_time: new Date(start + durationMinutes * MINUTE).toISOString(),
    duration_minutes: durationMinutes,
    webinar_zoom_id: null,
    is_test_webinar: false,
    webinar_why_attend_points: null,
    webinar_what_will_you_learn_points: OBJECTIVES,
    subject: seed.subject,
    level_details:
      seed.level === null
        ? null
        : { level_number: seed.level, level_name: `Level ${seed.level}`, level_actual_name: null },
    horizontal_thumbnail: ART,
    vertical_thumbnail: ART,
    square_image: SQUARE,
    badge_icon_url: BADGE,
    fields_of_study: FIELDS,
    cpe_credits: 3.5,

    // The NASBA disclosure block. Real values for a LIVE webinar — the design
    // mock shows "QAS Self Study", which is the self-paced method and wrong
    // for a scheduled session; NASBA's term for a live online course is
    // "Group Internet Based".
    description: seed.description,
    int_delivery_method: 'Group Internet Based',
    program_level: 'Basic',
    prerequisite_education: 'There are no prerequisites for this course.',
    advance_preparation: 'There is no advance preparation required for this course.',
    course_created_date: new Date(baseTime - 120 * DAY).toISOString(),
    course_reviewed_date: new Date(baseTime - 60 * DAY).toISOString(),
    course_updated_date: new Date(baseTime - 14 * DAY).toISOString(),
    no_question_answered: 3,
    attendance_threshold: 75,
  };
}

/**
 * The whole feed, built from scratch.
 *
 * `baseTime` is captured once per page load rather than read from the ticking
 * clock — dates that drift every second are not a stable thing to design
 * against.
 */
export function buildPreviewFeed(baseTime: number): WebinarMainPageData {
  const upcoming = UPCOMING_SEEDS.map((seed, i) => toCard(seed, i, baseTime, 'preview-upcoming'));
  const past = PAST_SEEDS.map((seed, i) => toCard(seed, i, baseTime, 'preview-past'));

  return {
    login_type: 'pre_login',
    highlight_webinars: upcoming.slice(0, 1),
    upcoming_webinars: upcoming,
    // `eligible` covers both completed states — "CPE earned" and the
    // present-but-not-eligible one, which are different rows in the design.
    completed_webinar: past.slice(0, 3).map((card, i) => ({ ...card, eligible: i !== 1 })),
    absent_webinar: past.slice(3, 4),
    missed_webinar: past.slice(4),
    server_time: new Date(baseTime).toISOString(),
  };
}
