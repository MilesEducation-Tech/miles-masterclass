import { environment } from '@env/environment';
import {
  InternalAttemptStatus,
  RegistrationStatus,
  WebinarCard,
  WebinarRegistrationInfo,
} from '../models/webinar.model';
import { parseIso } from './server-clock';

/**
 * The webinar CTA state machine.
 *
 * Unlike every other content type on the platform, what a learner can do with a
 * webinar depends on where "now" sits relative to the session. That makes the
 * CTA a state machine rather than a fixed button.
 *
 * **Never branch on webinar status inline in a template.** Every surface that
 * renders a webinar — hero, card, detail page, live page — goes through
 * `ctaFor`. The moment two surfaces compute their own answer, the five rails
 * start disagreeing with each other, and that disagreement is invisible until a
 * user reports it.
 *
 * Pure by design: no injection, no signals, no clock of its own. `now` is always
 * passed in (from `ServerClock`) so the whole file is trivially unit-testable.
 */

export type WebinarCta =
  /** Not registered, registration open. */
  | 'register'
  /** The 202 handshake is in flight. */
  | 'registering'
  /** Registered; the join window has not opened. Show the countdown. */
  | 'registered-waiting'
  /** Registered and inside the join window. Show Join. */
  | 'join-open'
  /**
   * Registered, but Zoom's host must approve the registrant before a join URL
   * is issued. Terminal, and there is NO action the user can take — a retry
   * here invites a duplicate registration that Zoom answers with a 409.
   */
  | 'join-pending-approval'
  /** The pipeline stopped before a usable registration existed. Offer retry. */
  | 'register-retry'
  /** This user is in a session on another surface right now. */
  | 'live-elsewhere'
  /** Session is over and this user has no booking outcome to show. */
  | 'ended'
  /** Past, attended, CPE earned. */
  | 'attended'
  /** Past, attended, not eligible for CPE. */
  | 'not-eligible'
  /** Past, booked, did not honour it. */
  | 'absent'
  /** Past, never booked at all. */
  | 'missed';

/** Which rail a card came from. The past buckets carry no `registration`. */
export type WebinarBucket = 'highlight' | 'upcoming' | 'completed' | 'absent' | 'missed';

export interface CtaContext {
  /** Server-aligned epoch ms — from `ServerClock.now()`. */
  now: number;
  /** Which bucket this card was rendered from. */
  bucket: WebinarBucket;
  /** True while this surface's own registration request is in flight. */
  isRegistering?: boolean;
  /** True when the single-session lease is held by some other surface. */
  isLockedElsewhere?: boolean;
}

/**
 * Collapse the TEN-state internal status onto the THREE-state client contract.
 *
 * Two of these mappings are the whole reason this function exists rather than a
 * lookup at each call site:
 *
 * - **The four `MF_*` states are `REGISTERED`, not failures.** The Salesforce
 *   forward is an audit hand-off that happens downstream of Zoom accepting the
 *   registrant. Telling the user to register again would be wrong AND would
 *   spend another Zoom registrant slot.
 * - **`ZOOM_PENDING_APPROVAL` is terminal but maps to `PENDING`.** The reason
 *   for the wait travels in `error_message` — show it, and never a retry CTA.
 *
 * An unrecognised status collapses to `PENDING`, which is the safe default: a
 * spinner rather than an invitation to register twice.
 */
export function collapseRegistrationStatus(status: string | null): RegistrationStatus {
  switch (status as InternalAttemptStatus) {
    case 'SUCCESS':
    case 'MF_FAILED':
    case 'MF_PERMANENTLY_FAILED':
    case 'MF_SKIPPED':
      return 'REGISTERED';
    case 'ZOOM_FAILED':
    case 'BOOKING_FAILED':
    case 'INTERRUPTED':
      return 'REGISTER';
    case 'PENDING':
    case 'ZOOM_RETRYING':
    case 'ZOOM_PENDING_APPROVAL':
      return 'PENDING';
    default:
      return 'PENDING';
  }
}

/**
 * Is this user registered?
 *
 * Reads `registration_status`, which is the contract — NOT `attempt_id`. A user
 * who registered before the attempt-row pipeline existed has a booking and no
 * attempt, and comes back as `REGISTERED` with a null `attempt_id` and
 * `zoom_attempts: 0`. Reading "no attempt id" as "not registered" would burn a
 * second Zoom registrant slot on a seat they already hold.
 */
export function isRegistered(registration: WebinarRegistrationInfo | undefined): boolean {
  return registration?.registration_status === 'REGISTERED';
}

/** True when the host has yet to approve the registrant — terminal, no action. */
export function isPendingHostApproval(registration: WebinarRegistrationInfo | undefined): boolean {
  return registration?.status === 'ZOOM_PENDING_APPROVAL';
}

/**
 * When the Join button appears, as epoch ms, or `null` when unknowable.
 *
 * Prefers the server's `join_opens_at`: the 50-minute policy is a business rule
 * and belongs on one side of the wire. The local computation is a fallback for
 * feeds that predate the field.
 */
export function joinOpensAt(card: WebinarCard): number | null {
  const fromServer = parseIso(card.registration?.join_opens_at);
  if (fromServer !== null) return fromServer;

  const start = parseIso(card.start_date_time);
  if (start === null) return null;
  return start - environment.WEBINAR.joinWindowMinutes * 60_000;
}

/**
 * When the session is over, as epoch ms, or `null` when unknowable.
 *
 * Takes the EARLIER of `end_date_time` and `start + duration`. Rows exist whose
 * `end_date_time` sits well after the start — a bad end date would otherwise
 * keep a one-hour webinar flagged joinable for days.
 */
export function effectiveEndAt(card: WebinarCard): number | null {
  const end = parseIso(card.end_date_time);
  const start = parseIso(card.start_date_time);
  const derived =
    start !== null && card.duration_minutes ? start + card.duration_minutes * 60_000 : null;

  if (end !== null && derived !== null) return Math.min(end, derived);
  return end ?? derived;
}

/** Is the session running right now? */
export function isLive(card: WebinarCard, now: number): boolean {
  const start = parseIso(card.start_date_time);
  const end = effectiveEndAt(card);
  if (start === null) return false;
  return now >= start && (end === null || now < end);
}

/**
 * Can this webinar be registered for at all? Only `webinar` and `offline` go
 * through `register-via-zoom`; orientations and premiers have their own flows.
 *
 * An `offline` event takes the IDENTICAL path — it still writes a Zoom
 * registrant and a join URL, the learner simply does not use them. No branch.
 */
export function isRegistrable(card: WebinarCard): boolean {
  return card.type === 'webinar' || card.type === 'offline';
}

/**
 * The single answer for what a webinar card should offer right now.
 */
export function ctaFor(card: WebinarCard, ctx: CtaContext): WebinarCta {
  // Past buckets first — they carry no `registration` block at all, because
  // registration is an affordance and a webinar that already happened offers
  // neither register nor join.
  switch (ctx.bucket) {
    case 'completed':
      // `eligible` is authoritative and deliberately NOT recomputed from
      // durations: the thresholds live in the attendance ingest, and a second
      // implementation of that rule is a rule that will disagree with itself.
      return card.eligible ? 'attended' : 'not-eligible';
    case 'absent':
      return 'absent';
    case 'missed':
      return 'missed';
    default:
      break;
  }

  const registration = card.registration;

  if (ctx.isRegistering) return 'registering';

  // Not registered, or the pipeline failed.
  if (!isRegistered(registration)) {
    const collapsed = registration?.registration_status ?? 'REGISTER';

    if (collapsed === 'PENDING') {
      // Distinguish "still working" from "waiting on a human at Zoom". The
      // second is terminal and must never show a retry.
      return isPendingHostApproval(registration) ? 'join-pending-approval' : 'registering';
    }

    if (!isRegistrable(card)) return 'ended';

    // An attempt that reached a terminal failure earns a retry; a card that was
    // never attempted earns a first attempt. Both render a button, but the copy
    // differs and `error_message` only belongs on the retry.
    return registration?.attempt_id ? 'register-retry' : 'register';
  }

  // Registered from here on.
  const end = effectiveEndAt(card);
  if (end !== null && ctx.now >= end) return 'ended';

  if (ctx.isLockedElsewhere) return 'live-elsewhere';

  const opensAt = joinOpensAt(card);
  // No start time means no window to compute. Keep the countdown state rather
  // than offering a join that will be refused — `webinar_start_time_missing` is
  // an ops data problem, and the user can only wait.
  if (opensAt === null) return 'registered-waiting';

  return ctx.now >= opensAt ? 'join-open' : 'registered-waiting';
}

/** Does this CTA put a live countdown on screen? Drives ticker subscription. */
export function needsCountdown(cta: WebinarCta): boolean {
  return cta === 'registered-waiting';
}

/** Does this CTA open the embedded meeting? */
export function opensMeeting(cta: WebinarCta): boolean {
  return cta === 'join-open';
}

/** Button copy for each state. One place, so no two surfaces word it differently. */
export const CTA_LABELS: Record<WebinarCta, string> = {
  register: 'Register Now',
  registering: 'Registering…',
  'registered-waiting': 'Registered',
  'join-open': 'Join Now',
  'join-pending-approval': 'Awaiting approval',
  'register-retry': 'Try again',
  'live-elsewhere': 'In session elsewhere',
  ended: 'Ended',
  attended: 'CPE earned',
  'not-eligible': 'Not eligible',
  absent: 'Missed this one',
  missed: 'Not registered',
};
