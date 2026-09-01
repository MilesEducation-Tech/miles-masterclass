import { CairaDataEnvelope, CairaUuid } from './envelope.model';

/**
 * Chapter lifecycle — #6 (start) and #18 (progress update).
 *
 * **#17, the progress GET, is deliberately absent.** The shipped CAIRA LMS
 * never calls it: it writes progress with #18 and re-reads it from #4's
 * `user_chapter_progress` on the next course load. That is also why this phase
 * is not blocked on the `_build_full_course_progress` capture — that capture
 * only constrains #17's response.
 */

// ---------------------------------------------------------------------------
// The reset branch — check this before anything else
// ---------------------------------------------------------------------------

/**
 * #6, #10 and #18 can all answer with a **different, two-key body** when the
 * learner's 365-day enrollment window has expired and their progress was wiped.
 *
 * It is not an error — it is a state that needs a dialog and a re-enrollment.
 * Every consumer must test `reset_required` *before* reading any other key,
 * because none of the normal keys are present on this branch.
 */
export interface ResetRequiredResponse {
  reset_required: true;
  message?: string | null;
}

export function isResetRequired(response: unknown): response is ResetRequiredResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    (response as { reset_required?: unknown }).reset_required === true
  );
}

// ---------------------------------------------------------------------------
// #6 · chapter start
// ---------------------------------------------------------------------------

/**
 * `POST chapter/{chapterId}/start/` — **no body**.
 *
 * Creates the 365-day enrollment and the chapter's progress row. Nothing can be
 * written against a chapter that has not been started, so this fires on open.
 *
 * Un-enveloped: the payload is the response. A `409` with
 * `reason: 'already_started_via_7dc'` is a domain state, not an error.
 */
export interface ChapterStartPayload {
  chapter_id?: CairaUuid | null;
  enrollment_expires_at?: string | null;
  is_locked?: boolean | null;
  show_quiz?: boolean | null;
}

export type ChapterStartResponse = ChapterStartPayload | ResetRequiredResponse;

// ---------------------------------------------------------------------------
// #18 · progress update
// ---------------------------------------------------------------------------

/**
 * `POST course-progress/{courseId}/update/` — note the path is keyed on the
 * **course**, while the body names the chapter. The Django-era
 * `myclassactivity` was the other way round and took an event kind; neither
 * survives here.
 *
 * The server decides completion: `Max_Watched >= duration * 0.95` sets both
 * `Is_Video_Completed` and `Is_Video_Seekable`, and
 * `Max_Watched_Duration_Seconds = max(existing, incoming)`. The client reports
 * positions and never computes a completion flag of its own.
 */
export interface ChapterProgressUpdate {
  chapter_id: CairaUuid;
  last_watched_position_seconds: number;
  max_watched_duration_seconds: number;
}

/**
 * #18 accepts a single chapter or a bulk list, normalised server-side by
 * `get_items()`. Only the single form is used here — the LMS never batches.
 */
export type ChapterProgressUpdateBody = ChapterProgressUpdate;

export interface ChapterProgressPayload {
  chapter_id?: CairaUuid | null;
  is_video_completed?: boolean | null;
  is_video_seekable?: boolean | null;
  show_quiz?: boolean | null;
  last_watched_position_seconds?: number | null;
  max_watched_duration_seconds?: number | null;
  /**
   * Omitted **entirely** when empty rather than sent as `[]`. Never index it
   * unguarded.
   */
  skipped?: CairaUuid[];
}

export type ChapterProgressUpdateResponse =
  CairaDataEnvelope<ChapterProgressPayload> | ResetRequiredResponse;

/** Unwrap the success branch. `null` on the reset branch or an empty answer. */
export function toChapterProgress(
  response: ChapterProgressUpdateResponse | undefined,
): ChapterProgressPayload | null {
  if (!response || isResetRequired(response)) return null;
  return response.data ?? null;
}

// ---------------------------------------------------------------------------
// Chapter navigation
// ---------------------------------------------------------------------------

/** Where the learner is in the chapter list, and what sits either side. */
export interface ChapterNavigation<TChapter extends { id: CairaUuid }> {
  current: TChapter | null;
  prev: TChapter | null;
  next: TChapter | null;
  currentIndex: number;
}

/**
 * Build the prev/current/next triple.
 *
 * Returns an all-null navigation rather than throwing when the id is unknown or
 * the list is empty — the chapter page binds `navigation().current` straight
 * into the player, and the placeholder this replaces returned `null` for the
 * whole object, which crashed on `.current`.
 */
export function chapterNavigation<TChapter extends { id: CairaUuid }>(
  chapters: readonly TChapter[],
  chapterId: CairaUuid | null,
): ChapterNavigation<TChapter> {
  const index = chapterId ? chapters.findIndex((c) => c.id === chapterId) : -1;
  if (index === -1) return { current: null, prev: null, next: null, currentIndex: -1 };
  return {
    current: chapters[index],
    prev: index > 0 ? chapters[index - 1] : null,
    next: index < chapters.length - 1 ? chapters[index + 1] : null,
    currentIndex: index,
  };
}
