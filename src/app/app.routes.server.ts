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
  {
    path: ':country/:profession_type/webinar',
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
