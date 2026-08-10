/**
 * L5 · `POST milesone-activity` — the Salesforce activity relay.
 *
 * Four events, each with its own `event_parameters` shape. Modelled as a
 * discriminated union so the compiler, not the caller, guarantees the two halves
 * match: the shipped LMS builds these payloads inline at six call sites and
 * nothing stops a `course_completed` body being sent under a `login` type.
 *
 * The literal `credit_type: 'CPE'`, `video_type: 'Course Video'` and
 * `badge_type: 'Level'` are constants in the LMS, not variables. They are typed
 * as literals here so a future caller cannot quietly widen them — Salesforce
 * reports group on these strings.
 *
 * The relay is **fire-and-forget**: every caller in the LMS ignores the
 * response, and a failure must never block a UI transition. `CairaActivity`
 * enforces that; nothing should call this endpoint directly.
 */
export type CairaActivityEvent =
  /** After a successful login, on both the OTP and QR paths. */
  | { activity_type: 'login' }
  /** When a chapter video reaches the end. */
  | {
      activity_type: 'video_completed';
      event_parameters: {
        video_name: string;
        video_type: 'Course Video';
        course_playlist_name: string;
      };
    }
  /** On a successful course-feedback submit — the last step of the course. */
  | {
      activity_type: 'course_completed';
      event_parameters: {
        credit_amount: number;
        credit_type: 'CPE';
        course_name: string;
        course_instructor: string;
      };
    }
  /** After a level or webinar badge claim returns a Credly accept URL. */
  | {
      activity_type: 'badges_claim';
      event_parameters: {
        badge_type: 'Level';
        badge_name: string;
        credit_amount: number;
        credit_type: 'CPE';
        /** Set for a webinar badge, `''` for a course or level badge. */
        webinar_name: string;
        /** Set for a course badge, `''` otherwise. */
        course_name: string;
      };
    };

export type CairaActivityType = CairaActivityEvent['activity_type'];
