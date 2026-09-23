import {
  collapseRegistrationStatus,
  ctaFor,
  effectiveEndAt,
  isRegistered,
  joinOpensAt,
} from './webinar-status';
import {
  InternalAttemptStatus,
  WebinarCard,
  WebinarRegistrationInfo,
} from '../models/webinar.model';

const NOW = Date.parse('2026-09-20T12:00:00Z');

function card(overrides: Partial<WebinarCard> = {}): WebinarCard {
  return {
    id: 'w1',
    slug: null,
    name: 'CAIRA Level 1',
    type: 'webinar',
    short_description: '',
    start_date_time: '2026-09-20T13:00:00Z',
    end_date_time: '2026-09-20T14:00:00Z',
    duration_minutes: 60,
    webinar_zoom_id: '84123456789',
    is_test_webinar: false,
    webinar_why_attend_points: null,
    webinar_what_will_you_learn_points: null,
    subject: 'CAIRA',
    level_details: null,
    horizontal_thumbnail: '',
    vertical_thumbnail: '',
    square_image: '',
    fields_of_study: [],
    cpe_credits: null,
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

describe('collapseRegistrationStatus', () => {
  it('treats all four MF_* states as REGISTERED', () => {
    // The Salesforce forward is an audit hand-off downstream of Zoom accepting
    // the registrant. Telling the user to register again would spend another
    // Zoom registrant slot on a seat they already hold.
    const mfStates: InternalAttemptStatus[] = ['MF_FAILED', 'MF_PERMANENTLY_FAILED', 'MF_SKIPPED'];
    for (const status of mfStates) {
      expect(collapseRegistrationStatus(status)).toBe('REGISTERED');
    }
  });

  it('maps SUCCESS to REGISTERED', () => {
    expect(collapseRegistrationStatus('SUCCESS')).toBe('REGISTERED');
  });

  it('maps the three terminal failures to REGISTER', () => {
    expect(collapseRegistrationStatus('ZOOM_FAILED')).toBe('REGISTER');
    expect(collapseRegistrationStatus('BOOKING_FAILED')).toBe('REGISTER');
    expect(collapseRegistrationStatus('INTERRUPTED')).toBe('REGISTER');
  });

  it('maps ZOOM_PENDING_APPROVAL to PENDING even though it is terminal', () => {
    // A retry CTA here would invite a duplicate registration that Zoom answers
    // with a 409.
    expect(collapseRegistrationStatus('ZOOM_PENDING_APPROVAL')).toBe('PENDING');
  });

  it('collapses an unrecognised status to PENDING', () => {
    // The safe default: a spinner rather than an invitation to register twice.
    expect(collapseRegistrationStatus('SOMETHING_NEW')).toBe('PENDING');
    expect(collapseRegistrationStatus(null)).toBe('PENDING');
  });
});

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
  it('prefers the server value over the local computation', () => {
    const serverValue = '2026-09-20T12:30:00Z';
    const w = card({ registration: registration({ join_opens_at: serverValue }) });
    expect(joinOpensAt(w)).toBe(Date.parse(serverValue));
  });

  it('falls back to start minus the configured window', () => {
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
    const w = card({ end_date_time: '2026-10-20T14:00:00Z', duration_minutes: 60 });
    expect(effectiveEndAt(w)).toBe(Date.parse('2026-09-20T14:00:00Z'));
  });

  it('falls back to whichever one is available', () => {
    expect(effectiveEndAt(card({ duration_minutes: null }))).toBe(
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
    expect(ctaFor(card({ eligible: true }), { now: NOW, bucket: 'completed' })).toBe('attended');
    expect(ctaFor(card({ eligible: false }), { now: NOW, bucket: 'completed' })).toBe(
      'not-eligible',
    );
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

  it('does not offer registration for a non-registrable type', () => {
    // Orientations and premiers have their own flows.
    const w = card({ type: 'orientation' });
    expect(ctaFor(w, { now: NOW, bucket: 'upcoming' })).toBe('ended');
  });

  it('treats an offline event exactly like a webinar', () => {
    const w = card({ type: 'offline' });
    expect(ctaFor(w, { now: NOW, bucket: 'upcoming' })).toBe('register');
  });
});
