import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { MeetingSession } from '@features/offerings/webinar/services/meeting-session';
import { ZoomMeetingClient } from '@features/offerings/webinar/services/zoom-meeting-client';

/**
 * Keep the `/live` room in a document of its own.
 *
 * `vercel.json` sends COOP `same-origin` + COEP `credentialless` on the `/live`
 * URL only. They make the page cross-origin isolated, which is what gives Zoom
 * SharedArrayBuffer (gallery view, HD video). Response headers belong to the
 * document, so they apply only when the browser itself loads that URL:
 *
 * - **In:** an in-app navigation to `/live` (Join, the sign-in redirect, back
 *   and forward) keeps the previous page's document, and with it the previous
 *   page's headers. Turn it into a real page load.
 * - **Out:** an in-app navigation away from `/live` would carry COEP into the
 *   rest of the app, where it blocks cross-origin embeds that don't opt in
 *   (YouTube, Calendly). Turn that into a real page load too.
 *
 * Both are browser-only: `/live` is `RenderMode.Client`, so neither runs on the
 * server.
 */

/** `canActivate` on `/live`: reload into the room unless this IS the page load. */
export const liveDocumentEnterGuard: CanActivateFn = (_route, state) => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;
  // `navigated` is false until the first navigation completes, so the first
  // navigation of a fresh document — the one the headers came with — goes
  // through. Checking `crossOriginIsolated` instead would loop forever in
  // Safari, which ignores `credentialless` and is never isolated.
  if (!inject(Router).navigated) return true;

  inject(DOCUMENT).location.assign(state.url);
  return false;
};

/**
 * `canDeactivate` on `/live`: leave Zoom and give the lease back properly, then
 * load the destination as a fresh page.
 *
 * The leave happens here rather than on destroy, because a page load tears the
 * document down without running `DestroyRef` callbacks: Zoom would only see the
 * socket drop, and the lease would fall back to the tab-close beacon. Both
 * calls are no-ops when there is nothing to leave.
 */
export const liveDocumentLeaveGuard: CanDeactivateFn<unknown> = async (
  _component,
  _route,
  _state,
  next,
) => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;
  const router = inject(Router);
  const zoom = inject(ZoomMeetingClient);
  const session = inject(MeetingSession);
  const location = inject(DOCUMENT).location;
  // Read before the first await: the navigation is only current until then.
  const isBackOrForward = router.currentNavigation()?.trigger === 'popstate';

  await zoom.leave();
  await session.release();

  // Back/forward: the router has already put `/live` back in the history entry
  // it cancelled, so replace that entry rather than stacking a new one —
  // otherwise Back from the destination would land in the room again.
  if (isBackOrForward) location.replace(next.url);
  else location.assign(next.url);
  return false;
};
