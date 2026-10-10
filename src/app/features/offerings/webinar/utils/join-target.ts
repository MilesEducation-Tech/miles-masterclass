import { environment } from '@env/environment';
import { FeedCard, registrationOf } from '@features/offerings/webinar/models/webinar.model';

/**
 * Where "Join Now" actually sends the learner.
 *
 * There are two join surfaces, and the choice is NOT cosmetic:
 *
 * - `embedded` — the in-app `/live` page, which holds a server session lease and
 *   runs the Zoom Meeting SDK. It is the surface that lets attendance be
 *   measured, which is what CPE credit is computed from.
 * - `external` — the registrant's own `join_url`, opened in Zoom. Attendance is
 *   still recorded by Zoom against the registrant token, so credit still works;
 *   what is lost is the in-app experience and the one-session-at-a-time lease.
 *
 * `embedded` requires BOTH the backend and the row to agree:
 *
 *  1. `environment.WEBINAR.liveEnabled`, the ship gate for the in-app room.
 *     The backend routes it needs (`attendance-session/claim|heartbeat|release`
 *     and `meeting-sdk-signature`) are in the Events v1 contract; the flag is
 *     on in the development and local builds and off in production until QA
 *     signs off.
 *  2. `registration.route_to_web_lms`, the backend's own per-row switch. Even
 *     once the endpoints ship, a row can say "send this one to Zoom".
 */
export type JoinTarget =
  { kind: 'embedded' } | { kind: 'external'; url: string } | { kind: 'unavailable' };

export function resolveJoinTarget(card: FeedCard | null | undefined): JoinTarget {
  const registration = registrationOf(card);
  if (!registration) return { kind: 'unavailable' };

  if (environment.WEBINAR.liveEnabled && registration.route_to_web_lms) {
    return { kind: 'embedded' };
  }

  const url = registration.join_url;
  return url ? { kind: 'external', url } : { kind: 'unavailable' };
}
