import { CairaStatusEnvelope, CairaUuid } from './envelope.model';

/**
 * Wire shapes for the masterclass catalog — endpoints #1, #2, #3 — and the
 * card view-model the design system consumes.
 *
 * The mappers at the bottom are the only place that knows CAIRA's field names.
 * Nothing above the mapper sees `course_mini_description` or
 * `Masterclass_Course_Name`.
 */

// ---------------------------------------------------------------------------
// #1 · GET Top_Section/ — auth OPTIONAL, so this one server-renders
// ---------------------------------------------------------------------------

export interface TopSectionInstructor {
  id: CairaUuid;
  instructor_name: string | null;
}

/** Exactly 8 keys. `active_in_challenge` is always `false` for anonymous callers. */
export interface TopSectionItem {
  id: CairaUuid;
  course_name: string | null;
  course_mini_description: string | null;
  course_description: string | null;
  course_trailer_url: string | null;
  course_trailer_thumbnail: string | null;
  course_instructors: TopSectionInstructor[] | null;
  active_in_challenge: boolean;
}

export type TopSectionResponse = CairaStatusEnvelope<{
  /** Full pre-slice count, not the length of `data`. */
  total_count: number;
  data: TopSectionItem[];
}>;

// ---------------------------------------------------------------------------
// #2 · GET Masterclass_Course_Section/ — auth OPTIONAL
// ---------------------------------------------------------------------------

/** ⚠️ Carries **only** `name` here — no `id`, unlike #4's `fields_of_study`. */
export interface CourseFieldOfStudy {
  name: string | null;
}

/**
 * `1` not started (Watch Now) · `2` enrolled, in progress (Continue Learning) ·
 * `3` course closed (View Course). **`3` wins over `2`.** Anonymous callers
 * always get `1`.
 */
export const CourseStatus = {
  NOT_STARTED: 1,
  IN_PROGRESS: 2,
  CLOSED: 3,
} as const;
export type CourseStatus = (typeof CourseStatus)[keyof typeof CourseStatus];

export interface CourseSectionItem {
  id: CairaUuid;
  course_name: string | null;
  level: number | null;
  course_description: string | null;
  course_field_of_study: CourseFieldOfStudy[] | null;
  course_has_badge: boolean;
  course_trailer_url: string | null;
  course_trailer_thumbnail: string | null;
  cpe_credit_allocated: number | null;
  active_in_challenge: boolean;
  /** ⚠️ **Absent entirely on #3**, which reuses this item shape. */
  course_status?: CourseStatus;
}

export type CourseSectionResponse = CairaStatusEnvelope<{
  /** Hardcoded server-side; admin PageLayout copy is deliberately ignored. */
  heading: string | null;
  subheading: string | null;
  total_count: number;
  all_courses: CourseSectionItem[];
}>;

/**
 * #3 · GET Completed_Masterclass_Course_Section/ — auth **required**.
 *
 * Same envelope as #2 with different copy, and two behaviours to code around:
 * `course_status` is absent from every item, and `active_in_challenge` is
 * always `false` — even though this is the only list endpoint that mandates a
 * JWT and therefore could compute it.
 */
export type CompletedCourseSectionResponse = CourseSectionResponse;

// ---------------------------------------------------------------------------
// Card view-model — the design system's contract, not CAIRA's
// ---------------------------------------------------------------------------

/**
 * One entry per field of study.
 *
 * ⚠️ `cpe_credits` exists because `TotalCpeCreditsPipe` **sums this array** and
 * only falls back to `class_credits` when it is empty. CAIRA does not break
 * credits down per field of study — it reports one `cpe_credit_allocated` for
 * the whole course — so `toCourseCard` puts the entire allocation on the first
 * entry and zero on the rest. The total is then correct and the chips still
 * render. Mapping `{ name }` alone would make every card read **0 CPE**.
 */
export interface CardFieldOfStudy {
  name: string;
  cpe_credits: number;
}

/**
 * ⚠️ `slider.html` reads `item.instructor_details.first_name` **unguarded**, so
 * this object must always exist. A null here is a crash on the hero rail, not a
 * blank line.
 */
export interface CardInstructor {
  id: CairaUuid | null;
  first_name: string;
  last_name: string;
  other_instructors: { id: CairaUuid | null; first_name: string; last_name: string }[];
}

/**
 * What `app-horizontal`, `app-vertical`, `app-hover` and `app-slider` read.
 *
 * Field names are the design system's, kept as they were so no template
 * changed. `id` is a **UUID string** — the old model typed it `number`.
 */
export interface CourseCard {
  id: CairaUuid;
  title: string;
  course_short_overview: string;
  /** All three are `null` when absent — never `''`. `ngSrc=""` throws NG02952. */
  thumbnail: string | null;
  horizontal_thumbnail: string | null;
  square_thumbnail: string | null;
  thumbnail_gif: string | null;
  mobile_thumbnail_gif: string | null;
  trailer_link: string | null;
  class_credits: number;
  fields_of_study: CardFieldOfStudy[];
  instructor_details: CardInstructor;
  caira_level: number | null;
  included_for_caira: boolean;
  has_individual_badge: boolean;
  added_bookmark: boolean;
  has_additional_resources: boolean;
  /** Drives the CTA label: Watch Now / Continue Learning / View Course. */
  course_status: CourseStatus;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

/** `''` counts as missing — binding `ngSrc=""` throws NG02952 and kills the render. */
function img(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  return v || null;
}

function text(value: string | null | undefined): string {
  return (value ?? '').trim();
}

/** Splits `"Ada Lovelace"` into the first/last pair the cards render. */
function splitName(full: string | null | undefined): { first_name: string; last_name: string } {
  const parts = text(full).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: '', last_name: '' };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

const NO_INSTRUCTOR: CardInstructor = {
  id: null,
  first_name: '',
  last_name: '',
  other_instructors: [],
};

function toCardInstructor(list: TopSectionInstructor[] | null | undefined): CardInstructor {
  const people = (list ?? []).map((i) => ({ id: i.id, ...splitName(i.instructor_name) }));
  if (people.length === 0) return NO_INSTRUCTOR;
  const [lead, ...rest] = people;
  return { ...lead, other_instructors: rest };
}

/**
 * Attach the course's whole CPE allocation to the first field of study.
 * See `CardFieldOfStudy` for why.
 */
function toCardFields(
  names: CourseFieldOfStudy[] | null | undefined,
  totalCredits: number,
): CardFieldOfStudy[] {
  const list = (names ?? []).map((f) => text(f.name)).filter(Boolean);
  if (list.length === 0) return [];
  return list.map((name, i) => ({ name, cpe_credits: i === 0 ? totalCredits : 0 }));
}

/** #1 → card. The pinned rail carries no level, credits or fields of study. */
export function topSectionToCard(item: TopSectionItem): CourseCard {
  const thumb = img(item.course_trailer_thumbnail);
  return {
    id: item.id,
    title: text(item.course_name),
    course_short_overview: text(item.course_mini_description) || text(item.course_description),
    thumbnail: thumb,
    horizontal_thumbnail: thumb,
    square_thumbnail: thumb,
    thumbnail_gif: null,
    mobile_thumbnail_gif: null,
    trailer_link: img(item.course_trailer_url),
    class_credits: 0,
    fields_of_study: [],
    instructor_details: toCardInstructor(item.course_instructors),
    caira_level: null,
    // Every course on this surface is a CAIRA course — the badge is the point.
    included_for_caira: true,
    has_individual_badge: false,
    added_bookmark: false,
    has_additional_resources: false,
    course_status: CourseStatus.NOT_STARTED,
  };
}

/**
 * #2 and #3 → card.
 *
 * #3 omits `course_status`; defaulting to `NOT_STARTED` there would render
 * "Watch Now" on a finished course, so callers pass `CLOSED` explicitly.
 */
export function courseSectionToCard(
  item: CourseSectionItem,
  statusWhenAbsent: CourseStatus = CourseStatus.NOT_STARTED,
): CourseCard {
  const thumb = img(item.course_trailer_thumbnail);
  const credits = item.cpe_credit_allocated ?? 0;
  return {
    id: item.id,
    title: text(item.course_name),
    course_short_overview: text(item.course_description),
    thumbnail: thumb,
    horizontal_thumbnail: thumb,
    square_thumbnail: thumb,
    thumbnail_gif: null,
    mobile_thumbnail_gif: null,
    trailer_link: img(item.course_trailer_url),
    class_credits: credits,
    fields_of_study: toCardFields(item.course_field_of_study, credits),
    // #2 carries no instructor at all — the detail endpoint does.
    instructor_details: NO_INSTRUCTOR,
    caira_level: item.level,
    included_for_caira: true,
    has_individual_badge: item.course_has_badge === true,
    added_bookmark: false,
    has_additional_resources: false,
    course_status: item.course_status ?? statusWhenAbsent,
  };
}

/**
 * Group #2's flat list into the per-level rails the "tracks" section renders.
 *
 * A course attached to several levels **appears once per level** (the server
 * dedups on `(level_id, course_id)`, not on course), so this grouping is the
 * shape the data already has rather than something imposed on it. Ordering is
 * the server's: level ASC, then per-level admin priority.
 */
export interface CourseLevelRail {
  /** `ids[0]` is what the carousel passes back to `loadNextTrackPage`. */
  ids: number[];
  title: string;
  description: string;
  content: CourseCard[];
}

export function groupByLevel(items: CourseSectionItem[]): CourseLevelRail[] {
  const rails = new Map<number, CourseLevelRail>();
  for (const item of items) {
    // Unlevelled courses fold into level 1, matching how the badge endpoints
    // treat unlevelled CAIRA content.
    const level = item.level ?? 1;
    let rail = rails.get(level);
    if (!rail) {
      rail = { ids: [level], title: `Level ${level}`, description: '', content: [] };
      rails.set(level, rail);
    }
    rail.content.push(courseSectionToCard(item));
  }
  return [...rails.values()].sort((a, b) => a.ids[0] - b.ids[0]);
}
