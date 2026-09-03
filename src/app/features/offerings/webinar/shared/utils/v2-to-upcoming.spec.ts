import { ctaFor, needsSubscription, nextSessionOf, webinarTagFor } from './webinar-status';
import { upcomingToContent } from './upcoming-to-content';
import {
  applyV2About,
  v2CardToUpcoming,
  v2DetailsToUpcoming,
  v2EnrollmentToUpcoming,
  WebinarV2About,
  WebinarV2Card,
  WebinarV2Details,
  WebinarV2Enrollment,
} from './v2-to-upcoming';

/**
 * Pure-function checks for the v2 → `UpcomingPremiere` adapters. These cover
 * the parts the browser can't reach on UAT (which currently has a single
 * webinar and therefore no list rows and no enrollment rails).
 */

const SESSION = {
  id: 411,
  session_title: 'Session 1',
  start_date: '2026-11-10T08:30:00Z',
  end_date: '2026-11-10T10:30:00Z',
  total_polls: 0,
};

function card(overrides: Partial<WebinarV2Card> = {}): WebinarV2Card {
  return {
    id: 184,
    webinar_title: 'Build your first AI Agent in 2 hrs',
    short_course_overview: 'Discover how AI-native tech is reshaping accounting',
    horizontal_thumbnail: 'h.png',
    vertical_thumbnail: 'v.png',
    square_thumbnail: 'sq.png',
    webinar_credits: 1,
    awards_cpe: true,
    is_free: true,
    series: null,
    series_name: null,
    // Live payload shape: flat flags, no nested `badge` object.
    has_individual_badge: false,
    caira_level: null,
    no_question_answered: 6,
    fields_of_study: [{ id: 12, name: 'Communication & Marketing', cpe_credits: 1 }],
    next_session: SESSION,
    registration: { is_registered: false },
    ...overrides,
  };
}

function enrollment(overrides: Partial<WebinarV2Enrollment> = {}): WebinarV2Enrollment {
  return {
    id: 90211,
    attendance_status: 'Present',
    join_url: 'https://zoom.us/w/1',
    webinar: {
      id: 184,
      webinar_title: 'Visual Analytics with Power BI',
      short_course_overview: 'Dashboards that explain themselves',
      horizontal_thumbnail: 'h.png',
      vertical_thumbnail: 'v.png',
      square_thumbnail: 'sq.png',
      webinar_credits: 2.5,
      awards_cpe: true,
      series: 'ai-accounting-101',
      series_name: 'AI Accounting 101',
      has_individual_badge: true,
      caira_level: null,
      fields_of_study: [{ id: 43, name: 'Regulatory Ethics', cpe_credits: 2 }],
    },
    session: SESSION,
    instructor_details: {
      id: 3666,
      first_name: 'Varun',
      last_name: 'Bhasin',
      designation: 'Director, Assurance',
      linkedin_link: 'https://www.linkedin.com/in/x',
      other_instructors: [],
    },
    eligibility: {
      attended_minutes: 110,
      total_minutes: 120,
      polls_answered: 7,
      polls_required: 8,
      total_polls: 8,
      is_eligible: true,
      cpe_awarded: true,
      series_already_awarded: false,
    },
    user_badge: null,
    feedback_submitted: false,
    ...overrides,
  };
}

describe('v2CardToUpcoming', () => {
  it('exposes next_session through nextSessionOf', () => {
    const w = v2CardToUpcoming(card());
    expect(nextSessionOf(w, new Date('2026-11-01T00:00:00Z'))?.id).toBe(411);
  });

  it('leaves an unregistered card bookable', () => {
    const w = v2CardToUpcoming(card());
    expect(w.registered_webinar.user_enrollments).toBeUndefined();
    expect(ctaFor(w, true, new Date('2026-11-01T00:00:00Z'))).toBe('book');
  });

  it('flips a registered card to Booked and carries the join url', () => {
    const w = v2CardToUpcoming(
      card({
        registration: {
          is_registered: true,
          enrollment_id: 90211,
          webinar_date_id: 411,
          join_url: 'https://zoom.us/w/1',
        },
      }),
    );
    expect(w.registered_webinar.user_enrollments?.id).toBe(90211);
    expect(w.registered_webinar.user_enrollments?.webinar_date).toBe(411);
    expect(ctaFor(w, true, new Date('2026-11-01T00:00:00Z'))).toBe('joined');
    expect(ctaFor(w, true, new Date('2026-11-10T09:00:00Z'))).toBe('join-live');
  });

  // The API moved from a nested `badge` object to flat flags mid-development,
  // and the published doc still shows the old shape. Both must keep working.
  it('reads badge state from the flat flag (current payload)', () => {
    expect(v2CardToUpcoming(card()).has_individual_badge).toBe(false);
    expect(v2CardToUpcoming(card({ has_individual_badge: true })).has_individual_badge).toBe(true);
  });

  it('falls back to the nested badge object (documented legacy payload)', () => {
    const legacy = v2CardToUpcoming(
      card({ has_individual_badge: undefined, badge: { name: 'B', icon_url: 'b.png' } }),
    );
    expect(legacy.has_individual_badge).toBe(true);
    expect(legacy.badge_icon_url).toBe('b.png');
  });

  // Live `filter/` rows carry it, and the card feeds the details dialog's
  // "Answer N poll questions" line — it used to default to 0 on every rail.
  it('carries the poll requirement off the card row', () => {
    expect(v2CardToUpcoming(card()).no_question_answered).toBe(6);
    expect(v2CardToUpcoming(card({ no_question_answered: undefined })).no_question_answered).toBe(
      0,
    );
  });

  it('derives included_for_caira from caira_level', () => {
    expect(v2CardToUpcoming(card()).included_for_caira).toBe(false);
    const caira = v2CardToUpcoming(card({ caira_level: 2 }));
    expect(caira.included_for_caira).toBe(true);
    expect(caira.caira_level).toBe(2);
  });

  it('coerces missing thumbnails to empty strings so templates can guard on them', () => {
    const w = v2CardToUpcoming(
      card({ horizontal_thumbnail: null, vertical_thumbnail: null, square_thumbnail: null }),
    );
    expect(w.horizontal_thumbnail).toBe('');
    expect(w.vertical_thumbnail).toBe('');
    expect(w.square_thumbnail).toBe('');
  });

  // Regression: those empty strings used to reach `ngSrc` through
  // `upcomingToContent`'s `??` chain (which doesn't fall through `''`) and
  // throw NG02952 on the shared cards.
  it('never yields an empty Content thumbnail while any artwork exists', () => {
    const onlySquare = upcomingToContent(
      v2CardToUpcoming(card({ horizontal_thumbnail: null, vertical_thumbnail: null })),
    );
    expect(onlySquare.thumbnail).toBe('sq.png');
    expect(onlySquare.horizontal_thumbnail).toBe('sq.png');

    const none = upcomingToContent(
      v2CardToUpcoming(
        card({ horizontal_thumbnail: null, vertical_thumbnail: null, square_thumbnail: null }),
      ),
    );
    // Nothing to show — falsy so the cards' `@if` skips the <img> entirely.
    expect(none.thumbnail || none.horizontal_thumbnail).toBeFalsy();
  });

  it('survives a webinar with no upcoming session', () => {
    const w = v2CardToUpcoming(card({ next_session: null }));
    expect(w.webinar_dates).toEqual([]);
    expect(nextSessionOf(w)).toBeNull();
  });

  // The stub is what stops `premiere-list-item.html` and `upcomingToContent`
  // from throwing — both dereference `instructor_details` without a guard.
  it('always provides an instructor object so unguarded reads are safe', () => {
    const w = v2CardToUpcoming(card());
    expect(w.instructor_details).toBeTruthy();
    expect(() => upcomingToContent(w)).not.toThrow();
  });

  // Regression: the list payloads DO send the instructor, but the card type
  // didn't declare it, so every "Premiering This Month" row lost its byline.
  it('carries the instructor the list payload sends', () => {
    const w = v2CardToUpcoming(
      card({
        instructor_details: {
          id: 4282,
          first_name: 'Uttam',
          last_name: 'Pai, CPA',
          designation: 'VP - Founder’s Office, Miles Education',
          profile_image: 'uttam.webp',
          linkedin_link: 'https://www.linkedin.com/in/uttampaiumesh/',
          other_instructors: [
            { id: 4274, first_name: 'Varun', last_name: 'Jain, CPA', profile_image: 'varun.webp' },
          ],
        },
      }),
    );
    expect(w.instructor_details.first_name).toBe('Uttam');
    expect(w.instructor_details.linkedin).toBe('https://www.linkedin.com/in/uttampaiumesh/');
    expect(w.instructor_details.other_instructors[0].first_name).toBe('Varun');
  });
});

/**
 * The paywall `WebinarFacade.enroll` applies before hitting the register
 * endpoint. `is_free` comes off the card / details payloads.
 */
describe('needsSubscription', () => {
  const paid = () => v2CardToUpcoming(card({ is_free: false }));
  const free = () => v2CardToUpcoming(card({ is_free: true }));

  it('blocks a paid webinar for a user with no active plan', () => {
    expect(needsSubscription(paid(), false)).toBe(true);
  });

  it('lets a subscriber book a paid webinar', () => {
    expect(needsSubscription(paid(), true)).toBe(false);
  });

  it('never blocks a free webinar', () => {
    expect(needsSubscription(free(), false)).toBe(false);
    expect(needsSubscription(free(), true)).toBe(false);
  });
});

describe('v2EnrollmentToUpcoming', () => {
  it('uses the WEBINAR id for the row and the ENROLLMENT id for the enrollment', () => {
    const w = v2EnrollmentToUpcoming(enrollment());
    expect(w.id).toBe(184);
    expect(w.registered_webinar.user_enrollments?.id).toBe(90211);
  });

  it('drives the post-webinar CTA off attendance + feedback state', () => {
    const after = new Date('2026-11-11T00:00:00Z');
    expect(ctaFor(v2EnrollmentToUpcoming(enrollment()), true, after)).toBe('submit-feedback');
    expect(
      ctaFor(v2EnrollmentToUpcoming(enrollment({ feedback_submitted: true })), true, after),
    ).toBe('download-certificate');
  });

  // Recurring series: CPE was granted on a sibling session, so there is no
  // certificate to hand out — the card explains that instead.
  it('swaps the certificate for the series-awarded notice when CPE was already granted', () => {
    const after = new Date('2026-11-11T00:00:00Z');
    const row = enrollment({ feedback_submitted: true });
    const w = v2EnrollmentToUpcoming({
      ...row,
      eligibility: { ...row.eligibility, cpe_awarded: false, series_already_awarded: true },
    });
    expect(ctaFor(w, true, after)).toBe('series-awarded');
  });

  // v2 reports attendance as 'Attended'; 'Present' is the v1 spelling. Gating
  // on 'Present' alone stranded every v2 attendee on an "Ended" button.
  it('treats Attended the same as Present', () => {
    const after = new Date('2026-11-11T00:00:00Z');
    const w = v2EnrollmentToUpcoming(enrollment({ attendance_status: 'Attended' }));
    expect(ctaFor(w, true, after)).toBe('submit-feedback');
    expect(w.registered_webinar.user_enrollments?.has_attended_class).toBe(true);
    expect(
      ctaFor(v2EnrollmentToUpcoming(enrollment({ attendance_status: 'Absent' })), true, after),
    ).toBe('ended');
  });

  // ...but the CERTIFICATE is narrower than the rail: only a credited
  // 'Present' earns one. An 'Attended' row that has already submitted feedback
  // must NOT surface a Download Certificate button on the "Webinars Attended"
  // carousel — it falls through to the recording instead.
  it('withholds the certificate from Attended, grants it to Present', () => {
    const after = new Date('2026-11-11T00:00:00Z');
    const cta = (attendance_status: 'Present' | 'Attended') =>
      ctaFor(
        v2EnrollmentToUpcoming(enrollment({ attendance_status, feedback_submitted: true })),
        true,
        after,
      );
    expect(cta('Attended')).not.toBe('download-certificate');
    expect(cta('Present')).toBe('download-certificate');
  });

  // The certificate dialog claims the Credly badge off `user_badge`; it used to
  // be dropped on the floor, so an earned badge never reached the dialog.
  it('carries the minted badge through', () => {
    const badge = {
      id: 7,
      badge_name: 'AI Agent Builder',
      badge_image: 'b.png',
      sub_text: null,
      description: 'd',
      awarded_at: '2026-11-11T00:00:00Z',
      accept_url: 'https://credly/accept',
    };
    expect(v2EnrollmentToUpcoming(enrollment({ user_badge: badge })).user_badge).toEqual(badge);
    expect(v2EnrollmentToUpcoming(enrollment()).user_badge).toBeNull();
  });

  // The floating claim card reads `user_feedback_details`, not the enrollment flag.
  it('mirrors feedback_submitted onto user_feedback_details', () => {
    const w = v2EnrollmentToUpcoming(enrollment({ feedback_submitted: true }));
    expect(w.user_feedback_details).toEqual({ user_feedback_submitted: true });
  });

  // The enrollment row grew these three; before that the attended / absent
  // rails rendered a card with no byline, no overview and a "0 Credits" badge.
  it('carries the overview, fields of study and row-level instructor', () => {
    const w = v2EnrollmentToUpcoming(enrollment());
    expect(w.short_course_overview).toBe('Dashboards that explain themselves');
    expect(w.fields_of_study).toEqual([{ id: 43, name: 'Regulatory Ethics', cpe_credits: 2 }]);
    // `instructor_details` sits on the ROW here, not under `webinar`.
    expect(w.instructor_details.first_name).toBe('Varun');
    expect(w.instructor_details.linkedin).toBe('https://www.linkedin.com/in/x');
  });

  // Unlike every other payload, an enrollment session can have a null title —
  // and `WebinarDate.session_title` is a non-nullable string downstream.
  it('coerces a null session title', () => {
    const w = v2EnrollmentToUpcoming(enrollment({ session: { ...SESSION, session_title: null } }));
    expect(w.webinar_dates[0].session_title).toBe('');
  });

  it('still renders without the instructor block', () => {
    const w = v2EnrollmentToUpcoming(enrollment({ instructor_details: null }));
    expect(w.instructor_details).toBeTruthy();
    expect(() => upcomingToContent(w)).not.toThrow();
  });

  it('carries series and eligibility through for later use', () => {
    const w = v2EnrollmentToUpcoming(enrollment());
    expect(w.series_name).toBe('AI Accounting 101');
    expect(w.eligibility?.attended_minutes).toBe(110);
  });

  // The facade's `attended` / `absent` computeds narrow by attendance status.
  // Guarding the field they read: the adapter must surface it where they look.
  it('surfaces attendance_status where the rail filters read it', () => {
    for (const status of ['Present', 'Attended', 'Absent', 'Pending'] as const) {
      const w = v2EnrollmentToUpcoming(enrollment({ attendance_status: status }));
      expect(w.registered_webinar.user_enrollments?.attendance_status).toBe(status);
    }
  });
});

/**
 * The facade's rail filters, restated. They're `computed`s over private signals
 * so they can't be called directly without a TestBed — but the predicates are
 * the part worth pinning, and they're one-liners over the adapter's output.
 */
describe('rail filter predicates', () => {
  const attendedRail = (w: ReturnType<typeof v2EnrollmentToUpcoming>) => {
    const s = w.registered_webinar?.user_enrollments?.attendance_status;
    return s === 'Attended' || s === 'Present';
  };
  const absentRail = (w: ReturnType<typeof v2EnrollmentToUpcoming>) =>
    w.registered_webinar?.user_enrollments?.attendance_status === 'Absent';

  it('splits the completed payload into attended vs absent with no overlap', () => {
    const rows = (['Present', 'Attended', 'Absent', 'Pending'] as const).map((s) =>
      v2EnrollmentToUpcoming(enrollment({ attendance_status: s })),
    );
    expect(rows.filter(attendedRail).length).toBe(2);
    expect(rows.filter(absentRail).length).toBe(1);
    // Pending belongs to neither — it must not leak into either rail.
    expect(rows.filter((r) => attendedRail(r) && absentRail(r)).length).toBe(0);
  });

  // The missed rail requires unregistered AND ended. The `ended` half is the
  // guard against `filter/?type=past` silently falling back to `futured`.
  it('missed excludes registered rows and rows that have not ended', () => {
    const missedRail = (w: ReturnType<typeof v2CardToUpcoming>, now: Date) =>
      !w.registered_webinar?.user_enrollments && nextSessionOf(w, now) !== null
        ? new Date(nextSessionOf(w, now)!.end_date).getTime() < now.getTime()
        : false;

    const after = new Date('2026-11-11T00:00:00Z');
    const before = new Date('2026-11-01T00:00:00Z');

    expect(missedRail(v2CardToUpcoming(card()), after)).toBe(true);
    // Same webinar, but the session hasn't happened yet → not missed.
    expect(missedRail(v2CardToUpcoming(card()), before)).toBe(false);
    // Ended, but the user was registered → belongs in attended/absent instead.
    const registered = v2CardToUpcoming(
      card({ registration: { is_registered: true, enrollment_id: 1, webinar_date_id: 411 } }),
    );
    expect(missedRail(registered, after)).toBe(false);
  });
});

/**
 * `start_date + webinar_duration` overrides a too-generous `end_date`, so a
 * one-hour webinar stops advertising itself as live once its hour is up.
 */
describe('effective end (start + webinar_duration)', () => {
  // Mirrors the real UAT row that exposed this: a session whose `end_date`
  // sits a month after `start_date`.
  const longEndDate = () =>
    v2CardToUpcoming(
      card({
        next_session: {
          id: 1,
          session_title: 'S1',
          start_date: '2026-07-31T10:00:00Z',
          end_date: '2026-08-30T10:00:00Z',
        },
      }),
    );

  const duringTheHour = new Date('2026-07-31T10:30:00Z');
  const afterTheHour = new Date('2026-07-31T12:00:00Z');

  it('stays live for the whole window when no duration is known', () => {
    // v2 cards carry no duration, so `end_date` is all we have.
    expect(webinarTagFor(longEndDate(), afterTheHour)).toBe('live');
  });

  it('ends once start + duration has passed', () => {
    const w = { ...longEndDate(), webinar_duration: 3600 }; // one hour, in seconds
    expect(webinarTagFor(w, duringTheHour)).toBe('live');
    expect(webinarTagFor(w, afterTheHour)).toBe('ended');
  });

  it('keeps the CTA in step with the tag', () => {
    const w = { ...longEndDate(), webinar_duration: 3600 };
    expect(ctaFor(w, true, duringTheHour)).toBe('book');
    // Past its effective end and unregistered with no recording → 'ended'.
    expect(ctaFor(w, true, afterTheHour)).toBe('ended');
  });

  it('never extends the window past end_date', () => {
    // Duration far longer than the declared window — the earlier bound wins.
    const w = { ...longEndDate(), webinar_duration: 60 * 60 * 24 * 365 };
    expect(webinarTagFor(w, new Date('2026-09-30T10:00:00Z'))).toBe('ended');
  });
});

describe('v2DetailsToUpcoming + applyV2About', () => {
  const details = (o: Partial<WebinarV2Details> = {}): WebinarV2Details => ({
    id: 160,
    webinar_title: 'InternalWebinar',
    short_course_overview: 'short',
    horizontal_thumbnail: 'h.png',
    vertical_thumbnail: 'v.png',
    square_thumbnail: 'sq.png',
    webinar_credits: 3,
    webinar_duration: 900,
    awards_cpe: true,
    certificate_type: 'both',
    is_free: true,
    series: null,
    series_name: null,
    has_individual_badge: true,
    caira_level: null,
    no_question_answered: 2,
    fields_of_study: [{ id: 39, name: 'Economics', cpe_credits: 3 }],
    next_session: SESSION,
    registration: { is_registered: true, enrollment_id: 77, webinar_date_id: 411 },
    instructor_details: {
      id: 3500,
      first_name: 'Daniel',
      last_name: 'Alberson',
      designation: 'Cofounder',
      linkedin_link: 'https://linkedin.com/in/x',
      other_instructors: [],
    },
    user_feedback_details: { user_feedback_submitted: false },
    user_badge: null,
    active_plan: null,
    ...o,
  });

  const about = (o: Partial<WebinarV2About> = {}): WebinarV2About => ({
    id: 160,
    webinar_title: 'InternalWebinar',
    course_overview: 'Long form overview',
    short_course_overview: 'short',
    learning_objectives: 'Obj A\nObj B',
    topics: ['Agentic AI'],
    horizontal_thumbnail: 'h.png',
    vertical_thumbnail: 'v.png',
    square_thumbnail: 'sq.png',
    int_delivery_method: 'Group Internet Based',
    program_level: 'Basic',
    prerequisite_education: 'None',
    advance_preparation: 'None',
    webinar_credits: 3,
    webinar_duration: 900,
    awards_cpe: true,
    certificate_type: 'both',
    is_free: true,
    series: null,
    series_name: null,
    included_for_caira: false,
    has_individual_badge: true,
    caira_level: null,
    instructor_details: null,
    fields_of_study: [],
    next_session: SESSION,
    ...o,
  });

  it('carries user state and instructor off the details payload', () => {
    const w = v2DetailsToUpcoming(details());
    expect(w.registered_webinar.user_enrollments?.id).toBe(77);
    expect(w.instructor_details.first_name).toBe('Daniel');
    expect(w.instructor_details.linkedin).toBe('https://linkedin.com/in/x');
    expect(w.webinar_duration).toBe(900);
    expect(w.certificate_type).toBe('both');
    // CourseAbout renders "Answer N poll questions during the webinar".
    expect(w.no_question_answered).toBe(2);
  });

  // The attendance trio only exists on `details/`. It used to be discarded, so
  // the detail page showed "Ended" for a session the user had attended.
  it('reads attendance and attended minutes off the registration block', () => {
    const after = new Date('2026-11-11T00:00:00Z');
    const w = v2DetailsToUpcoming(
      details({
        registration: {
          is_registered: true,
          enrollment_id: 600,
          webinar_date_id: 411,
          attendance_status: 'Attended',
          attended_minutes: 12,
          polls_answered: 1,
        },
      }),
    );
    expect(w.registered_webinar.user_enrollments?.attendance_status).toBe('Attended');
    expect(w.registered_webinar.user_enrollments?.time_durations).toBe(12);
    expect(ctaFor(w, true, after)).toBe('submit-feedback');
  });

  // Feedback state lives on `user_feedback_details` here, but `ctaFor` reads the
  // enrollment flag — without the mirror the CTA never reaches the certificate.
  // `'Present'` (not `'Attended'`) because the certificate gate requires a
  // credited attendance — see "withholds the certificate from Attended".
  it('mirrors submitted feedback onto the enrollment so the CTA advances', () => {
    const after = new Date('2026-11-11T00:00:00Z');
    const w = v2DetailsToUpcoming(
      details({
        registration: {
          is_registered: true,
          enrollment_id: 600,
          webinar_date_id: 411,
          attendance_status: 'Present',
        },
        user_feedback_details: { user_feedback_submitted: true, user_rating: 4 },
      }),
    );
    expect(ctaFor(w, true, after)).toBe('download-certificate');
  });

  it('leaves an unregistered detail page bookable', () => {
    const w = v2DetailsToUpcoming(details({ registration: { is_registered: false } }));
    expect(w.registered_webinar.user_enrollments).toBeUndefined();
    expect(ctaFor(w, true, new Date('2026-11-01T00:00:00Z'))).toBe('book');
  });

  it('layers the long-form content on top', () => {
    const w = applyV2About(v2DetailsToUpcoming(details()), about());
    expect(w.course_overview).toBe('Long form overview');
    expect(w.topics).toEqual(['Agentic AI']);
    expect(w.program_level).toBe('Basic');
    expect(w.prerequisite_education).toBe('None');
  });

  // The about payload has NO registration. Spreading it wholesale would wipe
  // the booking and reset every CTA to "Book Now".
  it('never clobbers booking state or sessions', () => {
    const base = v2DetailsToUpcoming(details());
    const merged = applyV2About(base, about());
    expect(merged.registered_webinar.user_enrollments?.id).toBe(77);
    expect(merged.webinar_dates.length).toBe(1);
    // Inside the 15-minute window (08:30 + 900s), a booked user can join.
    expect(ctaFor(merged, true, new Date('2026-11-10T08:35:00Z'))).toBe('join-live');
    // Still booked once it's over — it just isn't joinable any more.
    expect(ctaFor(merged, true, new Date('2026-11-10T09:00:00Z'))).not.toBe('book');
  });

  it('keeps the details instructor when about has none', () => {
    const merged = applyV2About(v2DetailsToUpcoming(details()), about());
    expect(merged.instructor_details.first_name).toBe('Daniel');
  });

  // 900s = 15 min, so the session is over long before its month-long end_date.
  it('uses the details duration for the ended rule', () => {
    const w = applyV2About(v2DetailsToUpcoming(details()), about());
    expect(webinarTagFor(w, new Date('2026-11-10T08:35:00Z'))).toBe('live');
    expect(webinarTagFor(w, new Date('2026-11-10T09:30:00Z'))).toBe('ended');
  });
});
