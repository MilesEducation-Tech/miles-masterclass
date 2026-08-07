
/** Eastern Time short-name abbreviations — DST-aware. */
export type EasternAbbrev = 'EST' | 'EDT';

/**
 * Default timezone used for every webinar-facing `| date` interpolation when a
 * specific date isn't available (e.g. the user hasn't yet selected a session).
 *
 * Angular's `DatePipe` parses the `timezone` arg via `Date.parse(...)`, which
 * accepts UTC-offset strings and three-letter abbreviations like `'EST'` /
 * `'EDT'` / `'+0500'` — but **not** IANA names like `'America/New_York'`
 * (those silently fall back to the local TZ). When a real date is in hand, use
 * `easternAbbrevFor(date)` to derive the live `'EST'` (winter) / `'EDT'`
 * (summer) abbreviation per session — that string is both a valid `DatePipe`
 * timezone arg AND a correct user-facing label.
 */
export const WEBINAR_TIMEZONE: EasternAbbrev = 'EST';

/**
 * Resolves the correct Eastern Time abbreviation (`'EST'` / `'EDT'`) for a
 * given instant using the IANA database. Returns `'EST'` as a safe fallback
 * for invalid inputs.
 *
 * Same value is used as the `DatePipe` timezone arg AND the label suffix, so
 * the rendered time and the badge after it never disagree across DST changes.
 *
 * Example:
 *   easternAbbrevFor('2026-01-10T12:00:00-05:00') → 'EST'
 *   easternAbbrevFor('2026-06-05T12:00:00-04:00') → 'EDT'
 */
export function easternAbbrevFor(date: string | Date | null | undefined): EasternAbbrev {
  if (date == null) return 'EST';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return 'EST';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    }).formatToParts(d);
    const tz = parts.find((p) => p.type === 'timeZoneName')?.value;
    return tz === 'EDT' ? 'EDT' : 'EST';
  } catch {
    return 'EST';
  }
}

/** Lifecycle state of a single session relative to `now`. */
export type WebinarLiveState = 'live' | 'upcoming' | 'ended';

/** CTA derived from auth + registration + session lifecycle + post-webinar state. */
export type WebinarCta =
  | 'book'
  | 'joined'
  | 'join-live'
  | 'submit-feedback'
  | 'download-certificate'
  | 'watch-recording'
  | 'ended';

/** Tags shown in the corner of cards / chips. */
export type WebinarLiveTag = 'live' | 'upcoming' | 'ended';

/**
 * How long before `start_date` the session is treated as "live" so the join
 * window opens early. Matches the Zoom-style join-15-min-prior convention.
 */
export const JOIN_EARLY_WINDOW_MS = 15 * 60 * 1000;

/**
 * Unit of `UpcomingPremiere.webinar_duration`, as a millisecond multiplier.
 *
 * SECONDS. The codebase contradicts itself here — `course-about.ts` calls it
 * minutes — but two independent signals say seconds: `DurationPipe` documents
 * its input as seconds and `course-about.html` pipes `webinar_duration`
 * straight into it, and the webinar fixtures use `3600` for a one-hour
 * session. If it ever turns out to be minutes, change only this constant.
 */
const DURATION_UNIT_MS = 1_000;

/**
 * When the session is actually over.
 *
 * Prefers `start_date + webinar_duration` when a duration is known, because
 * `end_date` is not reliable in practice — the backend has rows whose
 * `end_date` sits weeks after the start, which would keep a one-hour webinar
 * flagged "NOW LIVE" for a month. Takes the EARLIER of the two so a bogus
 * value on either side can't extend the window.
 *
 * Falls back to `end_date` alone when no duration is available — which is the
 * case for every row on the webinar listing, since the v2 card payload has no
 * duration field.
 */
function effectiveEndOf(session: any, durationInUnits = 0): number {
  const start = new Date(session.start_date).getTime();
  const declaredEnd = new Date(session.end_date).getTime();
  const byDuration =
    durationInUnits > 0 && Number.isFinite(start)
      ? start + durationInUnits * DURATION_UNIT_MS
      : NaN;

  if (!Number.isFinite(byDuration)) return declaredEnd;
  if (!Number.isFinite(declaredEnd)) return byDuration;
  return Math.min(declaredEnd, byDuration);
}

/**
 * Returns the lifecycle state of a single session. `is_webinar_ended` from the
 * backend wins over wall-clock if explicitly set, since the host can end early.
 * The "live" window opens 15 minutes before `start_date` so the Join Live CTA
 * appears in advance — and stays open until the session's effective end (see
 * `effectiveEndOf`; pass `durationInUnits` to honour `start + duration`).
 */
export function liveStateOf(
  session: any,
  now: Date = new Date(),
  durationInUnits = 0,
): WebinarLiveState {
  if (session.is_webinar_ended) return 'ended';
  const start = new Date(session.start_date).getTime();
  const end = effectiveEndOf(session, durationInUnits);
  const t = now.getTime();
  if (t < start - JOIN_EARLY_WINDOW_MS) return 'upcoming';
  if (t > end) return 'ended';
  return 'live';
}

/**
 * Picks the most relevant session: a currently-live one wins; otherwise the
 * soonest upcoming; otherwise the most recently ended (so the UI can still
 * label the card as "Ended" rather than showing nothing).
 */
export function nextSessionOf(
  webinar: any,
  now: Date = new Date(),
): any | null {
  const sessions = webinar.webinar_dates ?? [];
  if (!sessions.length) return null;
  const live = sessions.find((s: any) => liveStateOf(s, now, webinar.webinar_duration) === 'live');
  if (live) return live;
  const t = now.getTime();
  const upcoming = sessions
    .filter((s: any) => new Date(s.start_date).getTime() > t && !s.is_webinar_ended)
    .sort((a: any, b: any) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  if (upcoming.length) return upcoming[0];
  const ended = [...sessions].sort(
    (a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime(),
  );
  return ended[0] ?? null;
}

/** Convenience wrapper: aggregate state for a webinar based on its sessions. */
export function webinarTagFor(webinar: any, now: Date = new Date()): WebinarLiveTag {
  const session = nextSessionOf(webinar, now);
  if (!session) return 'ended';
  return liveStateOf(session, now, webinar.webinar_duration);
}

/** Milliseconds until the start of a session. Negative means it has started. */
export function startsInMs(session: any, now: Date = new Date()): number {
  return new Date(session.start_date).getTime() - now.getTime();
}

/**
 * Human-readable countdown for an upcoming session — "5 min" / "2 hr" /
 * "3 days". Granularity falls back to the largest unit that's > 0, so a
 * 90-minute delta reads "1 hr" rather than "90 min". Returns `null` once the
 * start instant has been reached (use the live/ended tag instead).
 */
export function formatStartsIn(
  session: any | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!session) return null;
  const ms = startsInMs(session, now);
  if (ms <= 0) return null;

  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days === 1 ? '' : 's'}`;
  if (hours > 0) return `${hours} hr${hours === 1 ? '' : 's'}`;
  if (minutes > 0) return `${minutes} min`;
  return 'less than a minute';
}

/**
 * Did the user actually show up? Both values mean yes: v1 sent `'Present'`, v2
 * sends `'Attended'`. One predicate because `ctaFor` and the facade's
 * `attended` rail used to spell this out separately and disagreed — the rail
 * accepted both, the CTA only `'Present'`, so a v2 attendee landed in the
 * Attended carousel with an "Ended" button and no route to feedback.
 */
export function hasAttended(status: any | undefined | null): boolean {
  return status === 'Present' || status === 'Attended';
}

/**
 * Does booking this webinar require a subscription the user doesn't have?
 *
 * A predicate rather than an inline `&&` in the facade so it's testable
 * without a TestBed, and so the rule sits with the other webinar rules.
 *
 * Note `is_free` is absent from the enrollment payload (it defaults to `false`
 * there), which would paywall an already-attended webinar — safe only because
 * `enroll()` returns early on an existing enrollment, before this is reached.
 */
export function needsSubscription(webinar: any, hasActivePlan: boolean): boolean {
  return !webinar.is_free && !hasActivePlan;
}

/**
 * Pick the best CTA for a webinar.
 *
 * Decision tree:
 *   - Not booked (guest or not registered) → `book` (or `watch-recording` if
 *     the session ended and there's a recording, or `ended`).
 *   - Booked + upcoming session → `joined` ("Booked" CTA disabled).
 *   - Booked + live session     → `join-live`.
 *   - Booked + ended session + attended (`'Present'` or `'Attended'` — see
 *     `hasAttended`):
 *       - feedback not yet submitted → `submit-feedback`
 *       - feedback submitted         → `download-certificate`
 *   - Booked + ended session + `'Absent'` / `'Pending'` → `watch-recording`
 *     (if a recording exists) or `ended`.
 */
export function ctaFor(
  webinar: any,
  isAuthed: boolean,
  now: Date = new Date(),
): WebinarCta {
  // Source of truth for "registered": the presence of a `user_enrollments`
  // record. The `added` boolean on the public filter payload can be stale
  // (or appear without an underlying enrollment row), so the CTA only flips
  // to Booked / Join Live once we've seen the enrollment object itself.
  const isBooked = !!webinar.registered_webinar?.user_enrollments;
  const session = nextSessionOf(webinar, now);
  const state = session ? liveStateOf(session, now, webinar.webinar_duration) : 'ended';

  // Not booked path — same regardless of state, with ended-state recording fallback.
  if (!isAuthed || !isBooked) {
    if (state === 'ended') return webinar.video_recording ? 'watch-recording' : 'ended';
    return 'book';
  }

  // Booked path — live / upcoming are simple.
  if (state === 'live') return 'join-live';
  if (state !== 'ended') return 'joined';

  // Booked + ended path — feedback / certificate gated on actual attendance.
  const enrollment = webinar.registered_webinar?.user_enrollments;
  if (hasAttended(enrollment?.attendance_status)) {
    return enrollment?.feedback_submitted ? 'download-certificate' : 'submit-feedback';
  }
  return webinar.video_recording ? 'watch-recording' : 'ended';
}

/**
 * Slugify a title for URL segments — lowercases, replaces non-alphanumerics with
 * `-`, collapses repeats, trims. Mirrors how masterclass routes are built.
 */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
