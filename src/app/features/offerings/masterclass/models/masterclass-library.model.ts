import { isMasterclassCourse, MasterclassCourse } from '@core/models/masterclass-home.model';
import { contractError, isObject, isStr, isStrOrNull, listOf } from '@core/utils/contract-guards';

/**
 * Types for the masterclass page's signed-in rails (Postman, checked on UAT
 * 2026-10-26):
 * - `GET web-api/v1/masterclass/library/` (`web-masterclass-library-v1`):
 *   every learner rail in one read, each its own pagination block.
 * - `GET web-api/v1/masterclass/completed-course-section/`
 *   (`web-masterclass-completed-course-section-v1`): the courses the learner
 *   has closed.
 *
 * These are the keys the page READS, not a mirror of the payload: `library/`
 * also carries `popular` and `latest` (the hero reads `highlight/` instead),
 * and both carry paging metadata beyond `results`. Every card is the
 * `tracks-page/` card (`MasterclassCourse`), checked with the same guard.
 */

// ---- Rails -----------------------------------------------------------------

/** The `library/` rails the page shows, by their response keys. */
export type LibraryRailKey =
  'in_progress' | 'recommended' | 'complimentary' | 'because_you_watched' | 'bookmarked';

/**
 * A `library/` card: the track rails' card plus its `course_type`, which My
 * List needs because `bookmarked` is not narrowed by the request's
 * `course_type`.
 */
export type LibraryCourse = MasterclassCourse & { course_type: string };

/** One answer of `library/`, unwrapped. */
export interface MasterclassLibrary {
  /** The learner's firm, for the Complimentary heading; `null` when there is none. */
  companyName: string | null;
  rails: Readonly<Record<LibraryRailKey, LibraryCourse[]>>;
}

/** A rail above the tracks: the `library/` rail it reads, its section id and heading. */
export interface LibraryRailConfig {
  key: LibraryRailKey;
  id: string;
  heading: string;
}

// ---- Trust boundary --------------------------------------------------------
//
// Like `masterclass-home.model.ts`: every key the page reads is checked, extra
// keys pass, and a missing or retyped one fails the whole answer in the
// resource's `parse`, so it lands in `error()` rather than half-rendered.

const isLibraryCourse = (v: unknown): v is LibraryCourse =>
  isMasterclassCourse(v) && isObject(v) && isStr(v['course_type']);

/** A pagination block whose `results` all pass `guard`. */
const blockOf =
  <T>(guard: (v: unknown) => v is T) =>
  (v: unknown): v is { results: T[] } =>
    isObject(v) && listOf(guard)(v['results']);

/** `parse` for `library/`: the envelope, the firm and the five learner rails. */
export function parseMasterclassLibrary(raw: unknown): MasterclassLibrary {
  const data = isObject(raw) ? raw['data'] : undefined;
  const companyName = isObject(data) ? data['company_name'] : undefined;
  if (!isObject(data) || !isStrOrNull(companyName)) throw contractError('library');

  const rail = (key: LibraryRailKey): LibraryCourse[] => {
    const block = data[key];
    if (blockOf(isLibraryCourse)(block)) return block.results;
    throw contractError('library');
  };

  return {
    companyName,
    rails: {
      in_progress: rail('in_progress'),
      recommended: rail('recommended'),
      complimentary: rail('complimentary'),
      because_you_watched: rail('because_you_watched'),
      bookmarked: rail('bookmarked'),
    },
  };
}

/** `parse` for `completed-course-section/`: `data.all_courses`, a block of cards. */
export function parseCompletedSection(raw: unknown): MasterclassCourse[] {
  const data = isObject(raw) ? raw['data'] : undefined;
  const block = isObject(data) ? data['all_courses'] : undefined;
  if (blockOf(isMasterclassCourse)(block)) return block.results;
  throw contractError('completed-course-section');
}
