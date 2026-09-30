import { environment } from '@env/environment';
import {
  eligibleOf,
  FeedCard,
  registrationOf,
  WebinarCard,
  WebinarRegistrationInfo,
} from '../models/webinar.model';
import { parseIso } from './session-time';

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
  /**
   * Upcoming, but a type this page cannot register (`orientation`, `premier`).
   * The contract says those have their own flows and names none, so this is an
   * honest statement with no action — never "Ended", which it is not.
   */
  | 'not-registrable'
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
  /** Epoch ms — from `ServerClock.now()`. */
  now: number;
  /** Which bucket this card was rendered from. */
  bucket: WebinarBucket;
  /** True while this surface's own registration request is in flight. */
  isRegistering?: boolean;
  /** True when the single-session lease is held by some other surface. */
  isLockedElsewhere?: boolean;
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
 * When the Join button appears, as epoch ms, or `null` when unknowable:
 * `start − WEBINAR.joinWindowMinutes`.
 *
 * ponytail: computed client-side because the Events API sends no join time.
 * The window is a business rule and belongs on the server — take the server's
 * value instead once it sends one (WEBINAR_API_QUESTIONS Q5).
 */
export function joinOpensAt(card: WebinarCard): number | null {
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

/** Where "now" sits relative to the session — the v3 `liveStateOf`. */
export type SessionPhase = 'upcoming' | 'live' | 'ended';

/**
 * The session's phase. `live` opens with the join window (`start − 15 min`),
 * as in v3, so the "Live Now" caption and the Join button flip together.
 * No start time reads as `upcoming`: the honest answer is "not yet".
 */
export function sessionPhaseOf(card: WebinarCard, now: number): SessionPhase {
  const end = effectiveEndAt(card);
  if (end !== null && now >= end) return 'ended';
  const opens = joinOpensAt(card);
  if (opens !== null && now >= opens) return 'live';
  return 'upcoming';
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
export function ctaFor(card: FeedCard, ctx: CtaContext): WebinarCta {
  // Past buckets first — they carry no `registration` block at all, because
  // registration is an affordance and a webinar that already happened offers
  // neither register nor join.
  switch (ctx.bucket) {
    case 'completed':
      // `eligible` is authoritative and deliberately NOT recomputed from
      // durations: the thresholds live in the attendance ingest, and a second
      // implementation of that rule is a rule that will disagree with itself.
      return eligibleOf(card) ? 'attended' : 'not-eligible';
    case 'absent':
      return 'absent';
    case 'missed':
      return 'missed';
    default:
      break;
  }

  const registration = registrationOf(card);

  if (ctx.isRegistering) return 'registering';

  // Not registered, or the pipeline failed.
  if (!isRegistered(registration)) {
    const collapsed = registration?.registration_status ?? 'REGISTER';

    if (collapsed === 'PENDING') {
      // Distinguish "still working" from "waiting on a human at Zoom". The
      // second is terminal and must never show a retry.
      return isPendingHostApproval(registration) ? 'join-pending-approval' : 'registering';
    }

    // A session that is over offers nothing, whatever the bucket says. This is
    // the net under the detail page: a deep link to a past webinar the feed has
    // not placed arrives with no bucket to consult, and must never be offered
    // registration.
    const end = effectiveEndAt(card);
    if (end !== null && ctx.now >= end) return 'ended';

    if (!isRegistrable(card)) return 'not-registrable';

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
  registering: 'Booking…',
  'registered-waiting': 'Booked',
  'join-open': 'Join Live',
  'join-pending-approval': 'Awaiting approval',
  'register-retry': 'Try again',
  'live-elsewhere': 'In session elsewhere',
  'not-registrable': 'Registration not open here',
  ended: 'Ended',
  attended: 'CPE earned',
  'not-eligible': 'Not eligible',
  absent: 'Missed this one',
  missed: 'Not registered',
};

/**
 * The guest wording for the one state a signed-out visitor can act on. v3
 * says "Book Now" to a guest and "Register Now" to a member; every other
 * label is shared.
 */
export const GUEST_REGISTER_LABEL = 'Book Now';
