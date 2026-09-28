import { ctaFor, effectiveEndAt, isRegistered, joinOpensAt } from './webinar-status';
import {
  CompletedWebinarCard,
  UpcomingWebinarCard,
  WebinarRegistrationInfo,
} from '../models/webinar.model';

const NOW = Date.parse('2026-09-20T12:00:00Z');

/** An upcoming-bucket card; `registration` is its only bucket-specific key. */
function card(overrides: Partial<UpcomingWebinarCard> = {}): UpcomingWebinarCard {
  return {
    id: 'w1',
    slug: null,
    name: 'CAIRA Level 1',
    type: 'webinar',
    short_description: '',
    start_date_time: '2026-09-20T13:00:00Z',
    end_date_time: '2026-09-20T14:00:00Z',
    duration_seconds: 3600,
    webinar_zoom_id: '84123456789',
    is_test_webinar: false,
    webinar_why_attend_points: null,
    webinar_what_will_you_learn_points: null,
    subject: 'CAIRA',
    subject_details: { id: 's1', subject: 'CAIRA' },
    level_details: null,
    horizontal_thumbnail: '',
    vertical_thumbnail: '',
    square_image: '',
    fields_of_study: [],
    total_cpe_credits: null,
    ...overrides,
  };
}

function registration(overrides: Partial<WebinarRegistrationInfo> = {}): WebinarRegistrationInfo {
  return {
    status: 'SUCCESS',
    registration_status: 'REGISTERED',
    attempt_id: 'a1',
    join_url: 'https://us06web.zoom.us/w/84123456789?tk=abc',
    error_code: null,
    error_message: null,
    zoom_attempts: 1,
    completed_at: '2026-09-17T09:14:22.118Z',
    route_to_web_lms: false,
    ...overrides,
  };
}

describe('isRegistered', () => {
  it('reads registration_status, not attempt_id', () => {
    // A user who registered before the attempt-row pipeline existed has a
    // booking and no attempt. Reading "no attempt id" as "not registered" would
    // burn a second Zoom registrant slot.
    const legacy = registration({
      status: null,
      attempt_id: null,
      join_url: null,
      completed_at: null,
      zoom_attempts: 0,
    });
    expect(isRegistered(legacy)).toBe(true);
  });

  it('is false when there is no registration block at all', () => {
    expect(isRegistered(undefined)).toBe(false);
  });
});

describe('joinOpensAt', () => {
  it('is start minus the configured window', () => {
    const w = card();
    // 13:00 start, 15-minute window → 12:45
    expect(joinOpensAt(w)).toBe(Date.parse('2026-09-20T12:45:00Z'));
  });

  it('is null when there is no start time', () => {
    expect(joinOpensAt(card({ start_date_time: null }))).toBeNull();
  });
});

describe('effectiveEndAt', () => {
  it('takes the earlier of end_date_time and start + duration', () => {
    // Rows exist whose end_date_time sits well after the start; trusting it
    // would keep a one-hour webinar joinable for days.
    const w = card({ end_date_time: '2026-10-20T14:00:00Z', duration_seconds: 3600 });
    expect(effectiveEndAt(w)).toBe(Date.parse('2026-09-20T14:00:00Z'));
  });

  it('falls back to whichever one is available', () => {
    expect(effectiveEndAt(card({ duration_seconds: null }))).toBe(
      Date.parse('2026-09-20T14:00:00Z'),
    );
    expect(effectiveEndAt(card({ end_date_time: null }))).toBe(Date.parse('2026-09-20T14:00:00Z'));
  });
});

describe('ctaFor', () => {
  it('offers registration when there is no registration block', () => {
    expect(ctaFor(card(), { now: NOW, bucket: 'upcoming' })).toBe('register');
  });

  it('shows a countdown once registered but before the window opens', () => {
    const w = card({ registration: registration() });
    // 11:00 is before the 12:45 join window.
    const early = Date.parse('2026-09-20T11:00:00Z');
    expect(ctaFor(w, { now: early, bucket: 'upcoming' })).toBe('registered-waiting');
  });

  it('opens the join 15 minutes before the start', () => {
    const w = card({ registration: registration() });
    const justBefore = Date.parse('2026-09-20T12:44:59Z');
    const justAfter = Date.parse('2026-09-20T12:45:01Z');
    expect(ctaFor(w, { now: justBefore, bucket: 'upcoming' })).toBe('registered-waiting');
    expect(ctaFor(w, { now: justAfter, bucket: 'upcoming' })).toBe('join-open');
  });

  it('never offers a retry while waiting on host approval', () => {
    const w = card({
      registration: registration({
        status: 'ZOOM_PENDING_APPROVAL',
        registration_status: 'PENDING',
        error_message: 'The host is reviewing your registration.',
      }),
    });
    expect(ctaFor(w, { now: NOW, bucket: 'upcoming' })).toBe('join-pending-approval');
  });

  it('treats a server-side pending attempt as still registering', () => {
    // A PENDING attempt the server is still working on is deliberately the SAME
    // state as a request in flight from this surface: both say "registering",
    // and the spinner keeps running until the attempt resolves one way or the
    // other. Splitting them was tried and rejected.
    const w = card({
      registration: registration({ status: 'ZOOM_RETRYING', registration_status: 'PENDING' }),
    });

    expect(ctaFor(w, { now: NOW, bucket: 'upcoming' })).toBe('registering');
    expect(ctaFor(w, { now: NOW, bucket: 'upcoming', isRegistering: true })).toBe('registering');
  });

  it('offers a retry after a terminal pipeline failure', () => {
    const w = card({
      registration: registration({
        status: 'INTERRUPTED',
        registration_status: 'REGISTER',
        error_code: 'stuck',
      }),
    });
    expect(ctaFor(w, { now: NOW, bucket: 'upcoming' })).toBe('register-retry');
  });

  it('reads eligible on the completed bucket and ignores the clock', () => {
    const completed = (eligible: boolean): CompletedWebinarCard => ({ ...card(), eligible });
    expect(ctaFor(completed(true), { now: NOW, bucket: 'completed' })).toBe('attended');
    expect(ctaFor(completed(false), { now: NOW, bucket: 'completed' })).toBe('not-eligible');
  });

  it('maps the two past buckets without consulting registration', () => {
    expect(ctaFor(card(), { now: NOW, bucket: 'absent' })).toBe('absent');
    expect(ctaFor(card(), { now: NOW, bucket: 'missed' })).toBe('missed');
  });

  it('reports ended once the session is over', () => {
    const w = card({ registration: registration() });
    const after = Date.parse('2026-09-20T15:00:00Z');
    expect(ctaFor(w, { now: after, bucket: 'upcoming' })).toBe('ended');
  });

  it('reports live-elsewhere when the session lease is held by another surface', () => {
    const w = card({ registration: registration() });
    const inWindow = Date.parse('2026-09-20T12:30:00Z');
    expect(ctaFor(w, { now: inWindow, bucket: 'upcoming', isLockedElsewhere: true })).toBe(
      'live-elsewhere',
    );
  });

  it('keeps the countdown rather than offering a join with no start time', () => {
    const w = card({ start_date_time: null, end_date_time: null, registration: registration() });
    expect(ctaFor(w, { now: NOW, bucket: 'upcoming' })).toBe('registered-waiting');
  });

  it('does not offer registration for a non-registrable type — nor call it ended', () => {
    // Orientations and premiers have their own flows; an upcoming one is not over.
    expect(ctaFor(card({ type: 'orientation' }), { now: NOW, bucket: 'upcoming' })).toBe(
      'not-registrable',
    );
    expect(ctaFor(card({ type: 'premier' }), { now: NOW, bucket: 'upcoming' })).toBe(
      'not-registrable',
    );
  });

  it('calls a past non-registrable session ended', () => {
    const after = Date.parse('2026-09-20T15:00:00Z');
    expect(ctaFor(card({ type: 'orientation' }), { now: after, bucket: 'highlight' })).toBe(
      'ended',
    );
  });

  // The detail page on a cold deep link: no bucket to consult, no registration.
  it('never offers registration once an unregistered session is over', () => {
    const after = Date.parse('2026-09-20T15:00:00Z');
    expect(ctaFor(card(), { now: after, bucket: 'highlight' })).toBe('ended');
    // …but an unfinished one still can be.
    expect(ctaFor(card(), { now: NOW, bucket: 'highlight' })).toBe('register');
  });

  it('treats an offline event exactly like a webinar', () => {
    const w = card({ type: 'offline' });
    expect(ctaFor(w, { now: NOW, bucket: 'upcoming' })).toBe('register');
  });
});
