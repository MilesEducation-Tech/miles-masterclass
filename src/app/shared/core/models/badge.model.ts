import { FieldOfStudy } from './course.model';

export interface BadgeRef {
  id: number;
  name: string;
  sub_text: string | null;
  description: string;
  level_name: string | null;
  level_rank: number;
  icon_url: string;
  required_credits: string;
  is_coming_soon: boolean;
}

/** Single instructor as nested under a badge course/webinar payload. */
export interface BadgeInstructor {
  id: number;
  first_name: string;
  last_name: string;
}

/** Lead instructor + co-presenters (mirrors the course-about serializer). */
export interface BadgeInstructorDetails extends BadgeInstructor {
  other_instructors?: BadgeInstructor[];
}

export interface BadgeCourseRef {
  id: number;
  title: string;
  course_category: string;
  fields_of_study: FieldOfStudy[];
  host_instructor: BadgeInstructor;
  /** Full presenter block including `other_instructors` — source for multi-instructor display. */
  instructor_details?: BadgeInstructorDetails | null;
  course_short_overview: string;
  horizontal_thumbnail: string;
  class_credits: number;
  user_assessment_details: { status: string; session_id?: number; exam_passes_date?: string };
}

/**
 * Webinar payload nested under a course-tied badge item. Distinct from
 * `BadgeCourseRef` because the webinar API uses different field names
 * (`webinar_title` / `short_course_overview` / `webinar_credits`) and has no
 * `host_instructor`/`course_category`/`user_assessment_details` keys — the
 * presenter comes via `instructor_details` instead.
 */
export interface BadgeWebinarRef {
  id: number;
  webinar_title: string;
  short_course_overview: string;
  course_overview?: string;
  horizontal_thumbnail: string;
  fields_of_study: FieldOfStudy[];
  webinar_credits: number;
  webinar_date: string;
  attendance_status?: string;
  instructor_details?: BadgeInstructorDetails | null;
}

export interface UserBadgeRef {
  id: number;
  status: string;
  awarded_at: string | null;
  /**
   * Credly acceptance URL. Populated by the server after the badge is claimed
   * via `user-badges/:id/claim/`; `null` until then. The badge library uses
   * this to decide between firing the claim API vs. routing the user straight
   * to Credly when they click "Download Certificate".
   */
  accept_url?: string | null;
}

/** Caira-flavored badge item (level/progress shape). */
export interface BadgeLevelItem {
  id: number;
  badge: BadgeRef;
  status: string;
  awarded_at: string | null;
  current_progress: { earned: number; required: number };
  progress_percentage: number;
}

/** Course-tied badge item (master_class / nano_learning / webinar shape). */
export interface BadgeCourseItem {
  id: number;
  badge: BadgeRef;
  master_class: BadgeCourseRef | null;
  nano_learning: BadgeCourseRef | null;
  webinar: BadgeWebinarRef | null;
  user_badges: UserBadgeRef[];
  user_feedback_details: {
    user_feedback_submitted: boolean;
    user_rating: number | null;
    /**
     * NASBA-issued completion certificate URL. Populated by the backend once
     * the user has both attended (or passed) and submitted feedback; absent
     * otherwise. Drives the "Download Certificate" button on the badge card.
     */
    nasba_certificate_url?: string | null;
  };
}

export type BadgeItem = BadgeLevelItem | BadgeCourseItem;

export const isBadgeLevelItem = (b: BadgeItem): b is BadgeLevelItem => 'progress_percentage' in b;

/**
 * Joins a badge's lead instructor + `other_instructors` into one "By …"
 * display name; null when empty. Mirrors the course-about instructor list.
 */
export function badgeInstructorName(
  details: BadgeInstructorDetails | null | undefined,
): string | null {
  if (!details) return null;
  return (
    [details, ...(details.other_instructors ?? [])]
      .map((i) => `${i.first_name ?? ''} ${i.last_name ?? ''}`.trim())
      .filter(Boolean)
      .join(', ') || null
  );
}

/** Course identity for the `badge_claim` analytics event (null for level badges). */
export function badgeClaimCourse(item: BadgeItem): {
  course_id: number | null;
  course_name: string | null;
  course_type: string | null;
} {
  if (isBadgeLevelItem(item)) return { course_id: null, course_name: null, course_type: null };
  if (item.webinar)
    return {
      course_id: item.webinar.id,
      course_name: item.webinar.webinar_title,
      course_type: 'webinar',
    };
  const course = item.master_class ?? item.nano_learning;
  return {
    course_id: course?.id ?? null,
    course_name: course?.title ?? null,
    course_type: item.master_class ? 'masterclass' : 'nano_learning',
  };
}

export interface BadgePaginationData {
  total_count: number;
  current_page_number: number;
  next_page: string | number | null;
  previous_page: string | number | null;
}

export interface BadgeApiResponse<T> {
  status_code: number;
  data: T;
  message: string;
  pagination_data?: BadgePaginationData;
}

export type BadgeStatusFilter = '' | 'earn_badge' | 'claim_badge';

export interface BadgeStatusOption {
  value: BadgeStatusFilter;
  label: string;
}

export const BADGE_STATUS_OPTIONS: readonly BadgeStatusOption[] = [
  { value: '', label: 'All Badges' },
  { value: 'earn_badge', label: 'Earned Badge' },
  { value: 'claim_badge', label: 'Ready to Claim' },
] as const;

// =====================================================================
// Card view-model + action machine
// =====================================================================

export type BadgeAction =
  | 'earn_badge'
  | 'submit_feedback'
  | 'claim_badge'
  | 'download_certificate'
  | 'locked'
  | 'coming_soon';

export interface BadgeCardButton {
  label: string;
  variant: 'primary' | 'outline' | 'disabled';
  action: BadgeAction;
}

/**
 * Flat view-model the `BadgeCard` consumes. The page derives this from
 * the raw `BadgeItem` + selected `courseType` so the card doesn't have to
 * know about either API shape.
 */
export interface BadgeCardData {
  badgeId: number;
  courseType: string;
  courseId: number | null;
  badgeIconUrl: string;
  /** When set, a hover-swap reveals the course thumbnail behind the badge icon. */
  thumbnailUrl: string | null;
  levelRank: number;
  isComingSoon: boolean;
  title: string;
  instructor: string | null;
  category: string | null;
  /** All NASBA fields of study for the course; empty for level/caira badges. */
  fieldsOfStudy: FieldOfStudy[];
  credits: number | null;
  shortOverview: string;
  buttons: BadgeCardButton[];
  /** Raw item kept for the action handler (claim payload, certificate URLs, etc.). */
  raw: BadgeItem;
}

const BUTTON_LABELS: Record<BadgeAction, string> = {
  earn_badge: 'Earn Badge',
  submit_feedback: 'Submit Feedback',
  claim_badge: 'Claim Badge',
  download_certificate: 'Download Certificate',
  locked: 'Locked',
  coming_soon: 'Coming Soon',
};

const BUTTON_VARIANT: Record<BadgeAction, BadgeCardButton['variant']> = {
  earn_badge: 'primary',
  submit_feedback: 'primary',
  claim_badge: 'primary',
  download_certificate: 'outline',
  locked: 'disabled',
  coming_soon: 'disabled',
};

const button = (action: BadgeAction, isComingSoon = false): BadgeCardButton =>
  isComingSoon
    ? {
        action: 'coming_soon',
        label: BUTTON_LABELS.coming_soon,
        variant: BUTTON_VARIANT.coming_soon,
      }
    : { action, label: BUTTON_LABELS[action], variant: BUTTON_VARIANT[action] };

/**
 * Caira / invite-only buttons. Per product, the caira tag exposes only two
 * actions — Claim Badge once progress is complete (or already earned), and
 * Earn Badge otherwise. Locked / download-certificate / coming-soon
 * variants are intentionally suppressed for this tag.
 */
function buttonsForLevelItem(item: BadgeLevelItem): BadgeCardButton[] {
  // `progress_percentage === 100` covers the "ready to claim" case for an
  // unlocked level; an already-earned level keeps Claim Badge so the user
  // can re-open their Credly share URL.
  const completed =
    item.status === 'earned' || (item.status === 'unlocked' && item.progress_percentage === 100);
  return [button(completed ? 'claim_badge' : 'earn_badge')];
}

/**
 * Course-tied buttons (masterclass / nano_learning / webinar). Ported from the
 * old platform's four-scenario state machine:
 *
 *   gate := (webinar)  attendance_status === 'Present'
 *         | (mc / nl)  user_assessment_details.status === 'Exam_Passed'
 *
 *   gate && !feedback_submitted                                → Submit Feedback
 *   gate &&  feedback_submitted && !nasba_certificate_url      → Claim Badge
 *   gate &&  feedback_submitted &&  nasba_certificate_url      → Claim Badge + Download Certificate
 *   otherwise                                                  → Earn Badge
 *
 * `is_coming_soon` short-circuits to the coming-soon pill; missing course
 * payload falls through to a locked variant.
 */
function buttonsForCourseItem(item: BadgeCourseItem, _courseType: string): BadgeCardButton[] {
  if (item.badge.is_coming_soon) return [button('earn_badge', true)];

  // Defensive guard: backend should always ship one of these, but lock the
  // card if all three are null rather than silently rendering "Earn Badge".
  const hasCoursePayload = !!(item.master_class || item.nano_learning || item.webinar);
  if (!hasCoursePayload) return [button('locked')];

  const feedbackSubmitted = item.user_feedback_details?.user_feedback_submitted === true;
  const hasNasbaCertificate = !!item.user_feedback_details?.nasba_certificate_url;

  // Gate condition differs per type: webinars use attendance, course types use
  // assessment outcome. Everything downstream of the gate is identical.
  let gatePassed: boolean;
  if (item.webinar) {
    gatePassed = item.webinar.attendance_status === 'Present';
  } else {
    const course = item.master_class ?? item.nano_learning;
    gatePassed = course?.user_assessment_details?.status === 'Exam_Passed';
  }

  if (!gatePassed) return [button('earn_badge')];
  if (!feedbackSubmitted) return [button('submit_feedback')];
  if (!hasNasbaCertificate) return [button('claim_badge')];
  return [button('claim_badge'), button('download_certificate')];
}

/**
 * Normalize a raw `BadgeItem` into the card view-model. The `courseType`
 * comes from the active tab — caira items always use the level mapping,
 * webinar items follow their own field naming, and everything else uses the
 * masterclass / nano_learning mapping.
 */
export function toBadgeCardData(item: BadgeItem, courseType: string): BadgeCardData {
  if (isBadgeLevelItem(item)) {
    return {
      badgeId: item.id,
      courseType,
      courseId: null,
      badgeIconUrl: item.badge.icon_url,
      thumbnailUrl: null,
      levelRank: item.badge.level_rank,
      isComingSoon: item.badge.is_coming_soon,
      title: item.badge.level_name
        ? `${item.badge.name} ${item.badge.level_name}`
        : item.badge.name,
      instructor: null,
      category: null,
      fieldsOfStudy: [],
      credits: null,
      shortOverview: item.badge.sub_text ?? item.badge.description,
      buttons: buttonsForLevelItem(item),
      raw: item,
    };
  }

  // Webinar path — distinct field names: `webinar_title`,
  // `short_course_overview`, `webinar_credits`, `instructor_details` (no
  // `host_instructor`).
  if (item.webinar) {
    const w = item.webinar;
    return {
      badgeId: item.user_badges?.[0]?.id ?? item.id,
      courseType,
      courseId: w.id,
      badgeIconUrl: item.badge.icon_url,
      thumbnailUrl: w.horizontal_thumbnail ?? null,
      levelRank: item.badge.level_rank,
      isComingSoon: item.badge.is_coming_soon,
      title: w.webinar_title ?? item.badge.name,
      instructor: badgeInstructorName(w.instructor_details),
      category: null,
      fieldsOfStudy: w.fields_of_study ?? [],
      credits: w.webinar_credits ?? null,
      shortOverview: w.short_course_overview ?? item.badge.sub_text ?? item.badge.description,
      buttons: buttonsForCourseItem(item, courseType),
      raw: item,
    };
  }

  const course = item.master_class ?? item.nano_learning;
  return {
    badgeId: item.user_badges?.[0]?.id ?? item.id,
    courseType,
    courseId: course?.id ?? null,
    badgeIconUrl: item.badge.icon_url,
    thumbnailUrl: course?.horizontal_thumbnail ?? null,
    levelRank: item.badge.level_rank,
    isComingSoon: item.badge.is_coming_soon,
    title: course?.title ?? item.badge.name,
    instructor: badgeInstructorName(course?.instructor_details),
    category: course?.course_category ?? null,
    fieldsOfStudy: course?.fields_of_study ?? [],
    credits: course?.class_credits ?? null,
    shortOverview: course?.course_short_overview ?? item.badge.sub_text ?? item.badge.description,
    buttons: buttonsForCourseItem(item, courseType),
    raw: item,
  };
}
