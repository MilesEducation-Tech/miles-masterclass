import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth/auth.guard';
import { environment } from '@env/environment';
import { FeedbackFacade } from '../services/feedback-facade';
import { MeetingSession } from './services/meeting-session';
import { WebinarFacade } from './services/webinar-facade';
import { WebinarRegistration } from './services/webinar-registration';
import { ZoomMeetingClient } from './services/zoom-meeting-client';
import { ServerClock } from './services/server-clock';

/**
 * The webinar feature's routes.
 *
 * Mounted by the learner shell, which owns the locale prefix
 * (`/:country/:profession_type/webinar`). Nothing here hardcodes that prefix,
 * so the module can be mounted anywhere.
 *
 * The componentless parent exists so list and detail share ONE `WebinarFacade`:
 * navigating from a rail into a detail page then renders from the feed that is
 * already in memory instead of refetching it. `ServerClock` is scoped the same
 * way so a single ticker serves every countdown on the page.
 *
 * `MeetingSession` and `ZoomMeetingClient` are scoped one level deeper, to the
 * `/live` route alone. That is deliberate: the session lease must live exactly
 * as long as the page holding the meeting, and no longer. Providing them at the
 * feature root would keep a lease alive while the learner browses the list.
 */
export const webinarRoutes: Routes = [
  {
    path: '',
    providers: [ServerClock, WebinarRegistration, WebinarFacade],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./pages/webinar-list/webinar-list').then((m) => m.WebinarList),
      },
      {
        // Deeper route first is not required by the router (it matches on the
        // full path), but keeping `:id/live` above `:id` keeps the intent
        // obvious to a reader.
        path: ':id/live',
        // Two `CanMatch` guards, so neither the Zoom chunk nor the lease client
        // is ever downloaded by someone who cannot use them.
        //
        // `liveEnabled` is the ship gate: `EVENTS_API_CONTRACT_V1` carries no
        // `attendance-session/*` and no `meeting-sdk-signature` route, so with
        // it off this route must not match at all — `resolveJoinTarget` sends
        // Join to the registrant's `join_url` instead, and a stale deep link
        // falls through to the detail page rather than opening a page whose
        // first two calls 404.
        //
        // `authGuard` handles the redirect. The server refuses a signature
        // without a valid token regardless, so that one is for the redirect,
        // not the security.
        canMatch: [() => environment.WEBINAR.liveEnabled, authGuard],
        providers: [MeetingSession, ZoomMeetingClient],
        loadComponent: () => import('./pages/webinar-live/webinar-live').then((m) => m.WebinarLive),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./pages/webinar-detail/webinar-detail').then((m) => m.WebinarDetail),
      },
      {
        // Every link built before this feature landed points at the OLD detail
        // URL, `webinar/:courseId/:courseTitle` — the CPE tracker and the
        // CAIRA badge actions build it in code (`courseCommands`), and both
        // legacy-redirect layers emit it (`features.routes.ts` and
        // `src/legacy-redirects.ts`, which substitutes a `webinar` placeholder
        // title for id-only links). The new detail page is `:id` alone, so
        // those would all 404.
        //
        // A redirect rather than a second `loadComponent`: one canonical URL,
        // and relative navigation out of the page (`['live']`) keeps working.
        // Two segments, so it cannot shadow `:id/live` above (matched first) or
        // the three-segment feedback route below. Functional `redirectTo`
        // because the static form does not reliably substitute `:params` —
        // the same reason `features.routes.ts` uses it.
        path: ':id/:courseTitle',
        redirectTo: (route) => String(route.params['id']),
      },
      {
        // Course feedback, kept from the page this feature replaced. Three
        // segments, so it cannot collide with `:id` above — and the legacy
        // `premiere/:courseId/feedback/:feedbackType` redirect in
        // `features.routes.ts` still lands here, as do the CPE tracker's
        // feedback actions.
        path: ':courseId/:courseTitle/feedback',
        providers: [FeedbackFacade],
        loadComponent: () =>
          import('../pages/course-feedback/course-feedback').then((m) => m.CourseFeedback),
      },
    ],
  },
];
