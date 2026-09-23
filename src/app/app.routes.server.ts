import { RenderMode, ServerRoute } from '@angular/ssr';

// FAQ and page-not-found used to be Prerender; switched to Server so admin
// SEO edits in the `seo_pages` table propagate without a rebuild. Prerender
// freezes HTML at build time and the Supabase row is never re-read after.
export const serverRoutes: ServerRoute[] = [
  { path: 'admin/**', renderMode: RenderMode.Client },
  // Auth pages (login/otp/profile) render per-user content gated on
  // the signed-in user, which was empty during SSR — server-rendering them
  // produced a DOM the client couldn't hydrate (NG0500,
  // e.g. the profile form's `@if (isExistingUser())` block). No SEO value here,
  // so render client-side like admin/payment/cpe-tracker.
  { path: 'auth/**', renderMode: RenderMode.Client },
  {
    path: ':country/:profession_type/masterclass/:courseId/:courseTitle/final-assessment/:sessionId/exam',
    renderMode: RenderMode.Client,
  },
  {
    path: ':country/:profession_type/podcast/:courseId/:courseTitle/final-assessment/:session_id/exam',
    renderMode: RenderMode.Client,
  },
  {
    path: ':country/:profession_type/micro-learning/:courseId/:courseTitle/final-assessment/:session_id/exam',
    renderMode: RenderMode.Client,
  },
  {
    path: ':country/:profession_type/cpe-tracker',
    renderMode: RenderMode.Client,
  },
  // Per-user badge progress — nothing to server-render and
  // no SEO to lose. Both entries are needed: the exact path plus the children
  // (`webinar-badges` / `course-badges`), same pairing as `payment/**` below.
  {
    path: ':country/:profession_type/caira-tracker',
    renderMode: RenderMode.Client,
  },
  {
    path: ':country/:profession_type/caira-tracker/**',
    renderMode: RenderMode.Client,
  },
  // The live meeting page, and ONLY it. The Zoom Meeting SDK touches `window`,
  // `document` and WebAssembly at module scope, so there is nothing to render
  // on the server and attempting it throws. A bare path does not cover its
  // children (see `caira-tracker` above), so the wildcard segment is required.
  //
  // The list and detail pages are deliberately absent: they are public,
  // indexable surfaces and `WebinarFacade` is written for exactly that — its
  // feed resource fetches the anonymous `pre_login` page ON THE SERVER and
  // skips only `post_login` (whose token lives in the browser). Listing
  // `webinar` as Client here would hand a crawler "no webinars scheduled".
  // The old entry that did was a leftover from the dead placeholder page this
  // feature replaced, which had no data layer to render.
  {
    path: ':country/:profession_type/webinar/*/live',
    renderMode: RenderMode.Client,
  },
  // Checkout pages (plan / cart / billing / review / invoice) depend on
  // browser-only state (PaymentFacade cart + subscription-plan fetches with no
  // TransferState). Render the whole payment subtree client-side — otherwise
  // `payment/plan` falls through to the `**` Server rule and hydration renders
  // the plan cards twice (server DOM + client re-fetch don't reconcile).
  {
    path: ':country/:profession_type/payment/plan',
    renderMode: RenderMode.Server,
  },
  {
    path: ':country/:profession_type/payment/**',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
