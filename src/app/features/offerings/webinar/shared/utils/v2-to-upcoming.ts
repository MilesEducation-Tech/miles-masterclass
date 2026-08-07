/**
 * The v2 webinar wire format, and the adapters that turn it into the
 * `UpcomingPremiere` model every webinar surface already renders.
 *
 * Types and adapters live together on purpose: this file is the ONLY place that
 * knows v2's shape. `WebinarHero`, `PremiereListItem`, `Horizontal`,
 * `WebinarDetailsDialog`, `ctaFor`, `nextSessionOf` and `upcomingToContent` all
 * keep reading `UpcomingPremiere` unchanged — adding a v2 branch to each of them
 * instead would be six parallel code paths for the same cards. Only
 * `WebinarFacade` imports the wire types, and only to type its own requests.
 *
 * v2 is deliberately lean: the list payloads omit the rich fields
 * (`instructor_details`, `course_overview`, `topics`, `banner`,
 * `video_recording`), so those default to empty. `v2DetailsToUpcoming` supplies
 * the instructor, and `applyV2About` layers the long-form content on top.
 *
 * Reference: `docs/Webinar_V2_API.md`.
 */

import { FieldOfStudy, InstructorDetails } from '../../../../../shared/core/models/course.model';
import {
  RegisteredWebinar,
  UpcomingPremiere,
  UserBadge,
  WebinarAttendanceStatus,
  WebinarDate,
  WebinarEnrollment,
} from '../../../../../shared/core/models/feature.model';
import { hasAttended } from './webinar-status';

// ---- wire types ------------------------------------------------------------

/**
 * v2 pagination block. Declared here rather than reusing a shared type: the one
 * in `feature.model.ts` uses different field names (`current_page` /
 * `total_pages`), and the one in `http.model.ts` matches the names but types
 * `previous_page` as non-nullable `string` — v2 sends `null` on page 1.
 */
export interface WebinarV2Pagination {
  total_count: number;
  current_page_number: number;
  /** Full URL (`…?page=2&type=this_month`) or `null` on the last page. */
  next_page: string | null;
  previous_page: string | null;
}

/**
 * v2 envelope. `FeatureApiResponse` can't be reused — it has no `status_code`
 * and declares an incompatible `pagination_data`. Same "type it inline" call
 * `SectionFiltersEnvelope` makes for the other `status_code` endpoint.
 */
export interface WebinarV2Response<T> {
  data: T;
  pagination_data?: WebinarV2Pagination;
  status_code: number;
  message?: string;
}

/** A single webinar session. `next_session` on cards, `session` on enrollments. */
export interface WebinarV2Session {
  id: number;
  /** Nullable on enrollment rows — `WebinarDate.session_title` isn't, so coerce. */
  session_title: string | null;
  start_date: string;
  end_date: string;
  /** Polls configured on the session. Optional — older rows omit it. */
  total_polls?: number;
}

/**
 * Credly badge mapped to the webinar. `null` when none.
 *
 * This is the shape `docs/Webinar_V2_API.md` documents, but the live API has
 * since moved to a flat `has_individual_badge` + `caira_level` pair instead
 * (verified on UAT — the object was there early on, then disappeared). Both
 * are tolerated by the adapter; treat this as the legacy form.
 */
export interface WebinarV2Badge {
  name: string;
  icon_url: string;
}

/**
 * Badge / CAiRA credentialing fields shared by card and enrollment payloads.
 * Every field is optional because which pair the API sends has changed once
 * already; the adapter normalises whichever arrives.
 */
export interface WebinarV2Credentialing {
  /** Current form: flat boolean. Maps straight to `UpcomingPremiere`. */
  has_individual_badge?: boolean;
  /** Current form: CAiRA programme level, `null` when not part of it. */
  caira_level?: number | null;
  /** Documented (legacy) form: nested object, absent on the live payload. */
  badge?: WebinarV2Badge | null;
}

/**
 * Present on card payloads for logged-in users; `{ is_registered: false }` otherwise.
 *
 * The attendance trio is only sent by `details/` (and only once the session has
 * run) — the list endpoints stop at `join_url`. All optional for that reason;
 * the adapter falls back to `'Pending'` / `0` when they're absent.
 */
export interface WebinarV2Registration {
  is_registered: boolean;
  enrollment_id?: number;
  webinar_date_id?: number;
  join_url?: string | null;
  attendance_status?: WebinarAttendanceStatus;
  attended_minutes?: number;
  polls_answered?: number;
}

/** Per-session CPE eligibility. Not rendered yet — carried through for the redesign. */
export interface WebinarV2Eligibility {
  attended_minutes: number;
  total_minutes: number;
  polls_answered: number;
  polls_required: number;
  /**
   * Polls actually run in the session. Distinct from `polls_required`, which is
   * the threshold for credit — a session can require 7 and have run 0.
   */
  total_polls?: number;
  is_eligible: boolean;
  /** Can be `false` even when `is_eligible` — series dedup. */
  cpe_awarded: boolean;
  /** User already earned CPE from a different webinar in the same series. */
  series_already_awarded: boolean;
}

/**
 * `GET v2/webinar/filter/` and `GET v2/webinar/home_section/` — verified to
 * return an identical row shape, so one type covers both.
 *
 * Thumbnails are typed nullable against the doc: nothing guarantees a webinar
 * has been given artwork, and an empty `src` renders a broken-image icon.
 */
export interface WebinarV2Card extends WebinarV2Credentialing {
  id: number;
  webinar_title: string;
  short_course_overview: string;
  horizontal_thumbnail: string | null;
  vertical_thumbnail: string | null;
  square_thumbnail: string | null;
  webinar_credits: number;
  awards_cpe: boolean;
  is_free: boolean;
  /** Non-null means the webinar belongs to a recurring series. */
  series: string | null;
  series_name: string | null;
  /**
   * Polls the learner must answer live to earn credit. Sent by every payload —
   * `filter/`, `home_section/`, `details/` and `about/` — so it's bound once in
   * `v2CardToUpcoming` and inherited by the rest.
   */
  no_question_answered?: number;
  fields_of_study: FieldOfStudy[];
  /** Soonest upcoming session; `null` if none. Doubles as the `webinar_date_id` to register with. */
  next_session: WebinarV2Session | null;
  registration: WebinarV2Registration;
}

/** Instructor as v2 sends it. Note `linkedin_link`, not `linkedin`. */
export interface WebinarV2Instructor {
  id: number;
  first_name: string;
  last_name: string;
  designation?: string;
  profile_image?: string;
  horizontal_thumbnail?: string | null;
  linkedin_link?: string | null;
  other_instructors?: WebinarV2Instructor[];
}

/**
 * `GET v2/webinar/:id/about/` — the editorial content behind the More Info
 * dialog. Content only: it carries NO `registration` or other user state, so
 * merging it must never overwrite the CTA's view of the world.
 */
export interface WebinarV2About extends WebinarV2Credentialing {
  id: number;
  webinar_title: string;
  course_overview: string;
  short_course_overview: string;
  learning_objectives: string;
  topics: string[];
  horizontal_thumbnail: string | null;
  vertical_thumbnail: string | null;
  square_thumbnail: string | null;
  int_delivery_method: string;
  program_level: string;
  prerequisite_education: string;
  advance_preparation: string;
  webinar_credits: number;
  /** Seconds. 900 = a 15-minute session. */
  webinar_duration: number;
  awards_cpe: boolean;
  certificate_type?: string;
  is_free: boolean;
  series: string | null;
  series_name: string | null;
  no_question_answered?: number;
  /**
   * The ONLY payload that sends this — cards and details carry `caira_level`
   * alone, and a live CAiRA webinar can have `caira_level: null` with
   * `included_for_caira: true`, so the rails' derived value is a best guess
   * until the about payload lands.
   */
  included_for_caira?: boolean;
  instructor_details: WebinarV2Instructor | null;
  fields_of_study: FieldOfStudy[];
  next_session: WebinarV2Session | null;
}

/**
 * `GET v2/webinar/details/?id=` — the detail page's payload. Card fields plus
 * per-user state (`registration`, `user_badge`, `user_feedback_details`).
 *
 * Deliberately does NOT include `course_overview` / `topics` /
 * `learning_objectives`; those live on the about endpoint, so a page that
 * renders the full write-up needs both.
 */
export interface WebinarV2Details extends WebinarV2Credentialing {
  id: number;
  webinar_title: string;
  short_course_overview: string;
  horizontal_thumbnail: string | null;
  vertical_thumbnail: string | null;
  square_thumbnail: string | null;
  webinar_credits: number;
  /** Seconds. Drives the `start + duration` end-of-session rule. */
  webinar_duration: number;
  awards_cpe: boolean;
  certificate_type?: string;
  is_free: boolean;
  series: string | null;
  series_name: string | null;
  /** Polls the learner must answer live to earn credit. Renders in CourseAbout. */
  no_question_answered?: number;
  fields_of_study: FieldOfStudy[];
  next_session: WebinarV2Session | null;
  registration: WebinarV2Registration;
  instructor_details: WebinarV2Instructor | null;
  user_feedback_details: {
    user_feedback_submitted: boolean;
    user_rating?: number | null;
    [key: string]: unknown;
  } | null;
  user_badge: UserBadge | null;
  active_plan: unknown | null;
}

/** The `webinar` sub-object on an enrollment row — a subset of `WebinarV2Card`. */
export interface WebinarV2EnrollmentWebinar extends WebinarV2Credentialing {
  id: number;
  webinar_title: string;
  /** Optional: absent from the earlier payload, added later. */
  short_course_overview?: string;
  horizontal_thumbnail: string | null;
  vertical_thumbnail: string | null;
  square_thumbnail: string | null;
  webinar_credits: number;
  awards_cpe: boolean;
  series: string | null;
  series_name: string | null;
  /** Drives the credits badge and category chips on the enrollment cards. */
  fields_of_study?: FieldOfStudy[];
}

/** `GET v2/webinar/enrollments/`. Enrollment-centric, not webinar-centric. */
export interface WebinarV2Enrollment {
  /** Enrollment id, NOT the webinar id — the webinar id lives on `webinar.id`. */
  id: number;
  attendance_status: WebinarAttendanceStatus;
  join_url: string | null;
  webinar: WebinarV2EnrollmentWebinar;
  session: WebinarV2Session;
  eligibility: WebinarV2Eligibility;
  /** Minted Credly badge, `null` until earned. Feeds the certificate dialog. */
  user_badge?: UserBadge | null;
  feedback_submitted: boolean;
  /** Row-level, NOT under `webinar` — unlike `details/`, which nests it. */
  instructor_details?: WebinarV2Instructor | null;
}

// ---- adapters --------------------------------------------------------------

/** v2 fields with no `UpcomingPremiere` equivalent, carried along for later use. */
export type WebinarV2Adapted = UpcomingPremiere & {
  series?: string | null;
  series_name?: string | null;
  eligibility?: WebinarV2Eligibility;
};

/**
 * Empty instructor. Deliberately an object, never `undefined`:
 * `premiere-list-item.html` and `upcomingToContent` both dereference
 * `instructor_details.*` without a guard, so a nullish value throws at render.
 * `instructorNames()` filters out the blank names, so the byline stays hidden
 * rather than rendering a stray "By".
 */
function emptyInstructor(): InstructorDetails {
  return { id: 0, first_name: '', last_name: '', other_instructors: [] };
}

/**
 * Widen a v2 session into a full `WebinarDate`. `is_webinar_ended` is left
 * `false` rather than derived — `liveStateOf` already resolves live/ended from
 * `start_date`/`end_date` against the wall clock, and the flag exists only so
 * the backend can force-end a session early (which v2 doesn't report).
 */
function toWebinarDate(session: WebinarV2Session, joinUrl: string | null): WebinarDate {
  return {
    id: session.id,
    session_title: session.session_title ?? '',
    start_date: session.start_date,
    end_date: session.end_date,
    ordering: null,
    is_active: true,
    meeting_id: null,
    is_attendance_synced: false,
    is_poll_updated: false,
    video_recording: null,
    join_url: joinUrl,
    created_at: session.start_date,
    updated_at: session.start_date,
    is_webinar_ended: false,
  };
}

/**
 * Normalise the badge / CAiRA pair. The live API sends flat
 * `has_individual_badge` + `caira_level`; `docs/Webinar_V2_API.md` documents a
 * nested `badge` object instead. The payload has already switched once, so
 * accept either rather than silently dropping the Credly mark when it flips.
 */
function credentialing(src: WebinarV2Credentialing): {
  has_individual_badge: boolean;
  badge_icon_url: string | null;
  caira_level: number | null;
  included_for_caira: boolean;
} {
  return {
    has_individual_badge: src.has_individual_badge ?? !!src.badge,
    badge_icon_url: src.badge?.icon_url ?? null,
    caira_level: src.caira_level ?? null,
    included_for_caira: src.caira_level != null,
  };
}

/** Defaults for every `UpcomingPremiere` field v2 does not send. */
function baseDefaults(): Omit<
  UpcomingPremiere,
  | 'id'
  | 'webinar_title'
  | 'webinar_dates'
  | 'registered_webinar'
  | 'horizontal_thumbnail'
  | 'vertical_thumbnail'
  | 'square_thumbnail'
  | 'webinar_credits'
  | 'has_individual_badge'
  | 'badge_icon_url'
  | 'caira_level'
  | 'included_for_caira'
  | 'created_at'
> {
  return {
    fields_of_study: [],
    instructor_details: emptyInstructor(),
    is_added_to_cart: false,
    user_feedback_details: null,
    is_certificate_eligible: false,
    active_plan: null,
    additional_resource: [],
    user_badge: null,
    banner: null,
    video_recording: null,
    course_overview: '',
    short_course_overview: '',
    learning_objectives: '',
    topics: [],
    int_delivery_method: '',
    program_level: '',
    prerequisite_education: '',
    advance_preparation: '',
    webinar_duration: 0,
    no_question_answered: 0,
    mark_duration: 0,
    Course_material: null,
    priority_order: 0,
    is_free: false,
    is_subscription_excluded: false,
    status: true,
    mobile_thumbnail: null,
    thumbnail_gif: null,
    home_front_thumbnail: null,
    home_back_thumbnail: null,
  };
}

/** `GET v2/webinar/filter/` (and `home_section/`) row → `UpcomingPremiere`. */
export function v2CardToUpcoming(card: WebinarV2Card): WebinarV2Adapted {
  const joinUrl = card.registration?.join_url ?? null;
  const session = card.next_session;

  // `registration` only reports THAT the user is registered, not the full
  // enrollment row. `ctaFor` keys off the presence of `user_enrollments`, so
  // synthesize just enough of one for the CTA to flip to Booked / Join Live.
  // `details/` reports the real post-session outcome here; the list endpoints
  // don't send it at all, so an absent value stays 'Pending'.
  const attendance = card.registration?.attendance_status ?? 'Pending';
  const registered: RegisteredWebinar = card.registration?.is_registered
    ? {
        added: true,
        user_enrollments: {
          id: card.registration.enrollment_id ?? -1,
          webinar_dates: session
            ? toWebinarDate(session, joinUrl)
            : ({} as WebinarEnrollment['webinar_dates']),
          feedback_submitted: false,
          attendance_status: attendance,
          active_plan: null,
          zoom_class_details: null,
          has_attended_class: hasAttended(attendance),
          is_active: true,
          join_url: joinUrl,
          joined_time: null,
          leave_time: null,
          time_durations: card.registration.attended_minutes ?? 0,
          created_at: session?.start_date ?? '',
          webinar: card.id,
          webinar_date: card.registration.webinar_date_id ?? session?.id ?? 0,
          user: -1,
          updated_by: null,
        },
      }
    : { added: false };

  return {
    ...baseDefaults(),
    id: card.id,
    webinar_title: card.webinar_title,
    short_course_overview: card.short_course_overview ?? '',
    horizontal_thumbnail: card.horizontal_thumbnail ?? '',
    vertical_thumbnail: card.vertical_thumbnail ?? '',
    square_thumbnail: card.square_thumbnail ?? '',
    webinar_credits: card.webinar_credits,
    awards_cpe: card.awards_cpe,
    is_free: card.is_free,
    no_question_answered: card.no_question_answered ?? 0,
    fields_of_study: card.fields_of_study ?? [],
    ...credentialing(card),
    created_at: session?.start_date ?? '',
    webinar_dates: session ? [toWebinarDate(session, joinUrl)] : [],
    registered_webinar: registered,
    series: card.series,
    series_name: card.series_name,
  };
}

/**
 * v2 instructor → the `course.model` `InstructorDetails` the cards and hero
 * read. Field names differ (`linkedin_link` vs `linkedin`), and
 * `other_instructors` is required downstream so it always gets an array.
 */
function toInstructor(src: WebinarV2Instructor | null | undefined): InstructorDetails {
  if (!src) return emptyInstructor();
  return {
    id: src.id,
    first_name: src.first_name ?? '',
    last_name: src.last_name ?? '',
    designation: src.designation,
    profile_image: src.profile_image,
    horizontal_thumbnail: src.horizontal_thumbnail ?? src.profile_image,
    linkedin: src.linkedin_link ?? undefined,
    other_instructors: (src.other_instructors ?? []).map((o) => ({
      id: o.id,
      first_name: o.first_name ?? '',
      last_name: o.last_name ?? '',
      designation: o.designation,
      profile_image: o.profile_image,
      horizontal_thumbnail: o.horizontal_thumbnail ?? o.profile_image,
      linkedin: o.linkedin_link ?? undefined,
    })),
  };
}

/**
 * `GET v2/webinar/details/?id=` → `UpcomingPremiere`. The detail page's base
 * record: card fields plus per-user state.
 *
 * Still missing the long-form content (`course_overview`, `topics`,
 * `learning_objectives`) — that only exists on the about endpoint, so layer
 * `applyV2About` on top when rendering the full write-up.
 */
export function v2DetailsToUpcoming(d: WebinarV2Details): WebinarV2Adapted {
  const base = v2CardToUpcoming({
    ...d,
    // `details` has no `registration` for anonymous users in some responses;
    // normalise so the CTA logic sees a consistent shape.
    registration: d.registration ?? { is_registered: false },
  } as unknown as WebinarV2Card);

  // Feedback state lives on `user_feedback_details` here, not on the
  // registration block — but `ctaFor` reads the enrollment's flag, so mirror it
  // across or the post-webinar CTA never advances past Submit Feedback.
  const feedbackSubmitted = d.user_feedback_details?.user_feedback_submitted ?? false;
  const enrollment = base.registered_webinar.user_enrollments;

  return {
    ...base,
    registered_webinar: enrollment
      ? {
          ...base.registered_webinar,
          user_enrollments: { ...enrollment, feedback_submitted: feedbackSubmitted },
        }
      : base.registered_webinar,
    instructor_details: toInstructor(d.instructor_details),
    webinar_duration: d.webinar_duration ?? 0,
    certificate_type: d.certificate_type,
    user_feedback_details: d.user_feedback_details ?? null,
    user_badge: d.user_badge ?? null,
    active_plan: d.active_plan ?? null,
  };
}

/**
 * Layer `GET v2/webinar/:id/about/` over an existing record.
 *
 * A merge, not a replacement: the about payload has no `registration`, so
 * spreading it wholesale would wipe the booking state and reset every CTA to
 * "Book Now". Only the content fields are taken, and `webinar_dates` /
 * `registered_webinar` are explicitly preserved from `base`.
 */
export function applyV2About(base: UpcomingPremiere, about: WebinarV2About): WebinarV2Adapted {
  return {
    ...base,
    course_overview: about.course_overview ?? '',
    short_course_overview: about.short_course_overview || base.short_course_overview,
    learning_objectives: about.learning_objectives ?? '',
    topics: about.topics ?? [],
    int_delivery_method: about.int_delivery_method ?? '',
    program_level: about.program_level ?? '',
    prerequisite_education: about.prerequisite_education ?? '',
    advance_preparation: about.advance_preparation ?? '',
    webinar_duration: about.webinar_duration ?? base.webinar_duration,
    no_question_answered: about.no_question_answered ?? base.no_question_answered,
    certificate_type: about.certificate_type ?? base.certificate_type,
    webinar_credits: about.webinar_credits ?? base.webinar_credits,
    fields_of_study: about.fields_of_study?.length ? about.fields_of_study : base.fields_of_study,
    instructor_details: about.instructor_details
      ? toInstructor(about.instructor_details)
      : base.instructor_details,
    included_for_caira: about.included_for_caira ?? base.included_for_caira,
    ...(about.has_individual_badge != null
      ? { has_individual_badge: about.has_individual_badge }
      : {}),
    ...(about.caira_level !== undefined ? { caira_level: about.caira_level } : {}),
    horizontal_thumbnail: about.horizontal_thumbnail || base.horizontal_thumbnail,
    vertical_thumbnail: about.vertical_thumbnail || base.vertical_thumbnail,
    square_thumbnail: about.square_thumbnail || base.square_thumbnail,
    series: about.series ?? (base as WebinarV2Adapted).series,
    series_name: about.series_name ?? (base as WebinarV2Adapted).series_name,
  };
}

/** `GET v2/webinar/enrollments/` row → `UpcomingPremiere`. */
export function v2EnrollmentToUpcoming(row: WebinarV2Enrollment): WebinarV2Adapted {
  const w = row.webinar;
  const session = toWebinarDate(row.session, row.join_url);

  const enrollment: WebinarEnrollment = {
    id: row.id,
    webinar_dates: session,
    feedback_submitted: row.feedback_submitted,
    attendance_status: row.attendance_status,
    active_plan: null,
    zoom_class_details: null,
    has_attended_class: hasAttended(row.attendance_status),
    is_active: true,
    join_url: row.join_url,
    joined_time: null,
    leave_time: null,
    time_durations: row.eligibility?.attended_minutes ?? 0,
    created_at: row.session.start_date,
    webinar: w.id,
    webinar_date: row.session.id,
    user: -1,
    updated_by: null,
  };

  return {
    ...baseDefaults(),
    id: w.id,
    webinar_title: w.webinar_title,
    short_course_overview: w.short_course_overview ?? '',
    // Rails render the credits badge and category chips off this; an empty
    // array reads as "0 Credits" on an attended card.
    fields_of_study: w.fields_of_study ?? [],
    instructor_details: toInstructor(row.instructor_details),
    horizontal_thumbnail: w.horizontal_thumbnail ?? '',
    vertical_thumbnail: w.vertical_thumbnail ?? '',
    square_thumbnail: w.square_thumbnail ?? '',
    webinar_credits: w.webinar_credits,
    awards_cpe: w.awards_cpe,
    ...credentialing(w),
    created_at: row.session.start_date,
    webinar_dates: [session],
    registered_webinar: { added: true, user_enrollments: enrollment },
    // The floating claim card reads `user_feedback_details.user_feedback_submitted`
    // rather than the enrollment flag — mirror it so the Give Feedback nudge
    // keeps working off the v2 payload.
    user_feedback_details: { user_feedback_submitted: row.feedback_submitted },
    // Certificate dialog claims the Credly badge off this row; dropping it left
    // every attended card unable to offer the badge.
    user_badge: row.user_badge ?? null,
    is_certificate_eligible: row.eligibility?.is_eligible ?? false,
    series: w.series,
    series_name: w.series_name,
    eligibility: row.eligibility,
  };
}
