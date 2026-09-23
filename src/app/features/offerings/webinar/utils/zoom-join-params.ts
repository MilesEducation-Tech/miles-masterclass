/**
 * Extracting Zoom join parameters from a registrant `join_url`.
 *
 * This is a FALLBACK. The registrant token and passcode should arrive as their
 * own fields (`registrant_token`, and `password` on the signature response) —
 * parsing a URL for them is fragile, breaks the moment Zoom changes the shape
 * or returns a redirect, and gives no signal when it silently finds nothing.
 *
 * It exists so the module works against the contract as it stands today, and so
 * a feed row written before the new fields landed still joins. Delete the
 * fallbacks once the backend fields ship everywhere (plan A1).
 */

/**
 * A registrant join URL looks like:
 *   https://us06web.zoom.us/w/84123456789?tk=<token>&uuid=<...>&pwd=<...>
 *
 * The webinar number is the last path segment; `tk` and `pwd` are query params.
 */
export interface ParsedJoinUrl {
  meetingNumber: string | null;
  registrantToken: string | null;
  password: string | null;
}

export function parseJoinUrl(joinUrl: string | null | undefined): ParsedJoinUrl {
  const empty: ParsedJoinUrl = { meetingNumber: null, registrantToken: null, password: null };
  if (!joinUrl) return empty;

  let url: URL;
  try {
    url = new URL(joinUrl);
  } catch {
    // A malformed URL is a data problem, not a crash. The caller falls back to
    // the card's own `webinar_zoom_id` and refuses the join if that is missing.
    return empty;
  }

  // Zoom uses /w/<id> for webinars and /j/<id> for meetings; take whichever
  // trailing segment is all digits rather than assuming the prefix.
  const lastSegment = url.pathname.split('/').filter(Boolean).pop() ?? '';
  const meetingNumber = /^\d+$/.test(lastSegment) ? lastSegment : null;

  return {
    meetingNumber,
    registrantToken: url.searchParams.get('tk'),
    password: url.searchParams.get('pwd'),
  };
}

/**
 * The registrant token, preferring the explicit field over the parsed URL.
 */
export function resolveRegistrantToken(
  explicit: string | null | undefined,
  joinUrl: string | null | undefined,
): string | null {
  if (explicit) return explicit;
  return parseJoinUrl(joinUrl).registrantToken;
}

/**
 * The webinar number the SDK joins, preferring the card's own `webinar_zoom_id`
 * over the parsed URL. That field is the id Zoom keys the session on and is
 * distinct from the MF/SF ingest anchor — do not substitute one for the other.
 */
export function resolveMeetingNumber(
  explicit: string | null | undefined,
  joinUrl: string | null | undefined,
): string | null {
  if (explicit) return explicit;
  return parseJoinUrl(joinUrl).meetingNumber;
}
