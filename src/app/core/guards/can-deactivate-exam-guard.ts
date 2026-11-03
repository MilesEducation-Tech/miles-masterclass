import { inject } from '@angular/core';
import {
  CanDeactivateFn,
  Event,
  NavigationCancel,
  NavigationCancellationCode,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  Router,
} from '@angular/router';
import { Observable, filter, from, take, tap } from 'rxjs';

export interface CanDeactivateComponent {
  canDeactivate: () => Observable<boolean> | Promise<boolean> | boolean;
}

/**
 * Pages whose learner chose "Leave", until that navigation settles. A guard on the way out can
 * answer with a redirect (`/` → `rootRedirectGuard` → the locale home), and the redirect is a new
 * navigation that runs this guard again while the page is still on screen: without this the
 * learner was asked twice. A `WeakSet`, so it never keeps a page alive.
 */
const leaving = new WeakSet<CanDeactivateComponent>();

/**
 * The learner already confirmed leaving this page. Its `beforeunload` must not ask again: a leave
 * that lands on a missing chunk reloads onto the new build (`recoverFromStaleChunk`).
 */
export const leaveConfirmed = (component: CanDeactivateComponent): boolean =>
  leaving.has(component);

export const canDeactivateExamGuard: CanDeactivateFn<CanDeactivateComponent> = (component) => {
  if (!component.canDeactivate || leaving.has(component)) return true;
  const answer = component.canDeactivate();
  // A plain boolean asked nothing (a clean page, or a refusal), so there is no answer to keep.
  if (typeof answer === 'boolean') return answer;

  const router = inject(Router);
  return from(answer).pipe(
    take(1),
    tap((leave) => {
      if (!leave) return;
      leaving.add(component);
      router.events.pipe(filter(settles), take(1)).subscribe(() => leaving.delete(component));
    }),
  );
};

/**
 * Whether `event` ends the navigations the learner's answer was for. A redirect or a newer
 * navigation carries the answer on; landing, skipping, failing or any other cancel ends it. The
 * router's own rule for "after the next navigation".
 */
function settles(event: Event): boolean {
  if (event instanceof NavigationCancel) {
    return (
      event.code !== NavigationCancellationCode.Redirect &&
      event.code !== NavigationCancellationCode.SupersededByNewNavigation
    );
  }
  return (
    event instanceof NavigationEnd ||
    event instanceof NavigationSkipped ||
    event instanceof NavigationError
  );
}
