import { isPlatformBrowser } from '@angular/common';
import { effect, inject, PLATFORM_ID, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { Logger } from '@core/services/logger/logger';

/**
 * Send the learner to sign-in if the session disappears while a tracker page is open.
 *
 * A refresh that fails calls `AuthSession.clear()`, which empties the token. `authGuard` is a
 * `CanMatch` guard, so it does NOT re-run on a route that already matched — and the read's
 * request function then returns `undefined`, parking the resource at `idle`. Idle is neither
 * loading nor an error, so every section hides itself and the page goes silently blank with
 * no way out. This sends them where the guard would have.
 *
 * Called by each of the three tracker pages, which is why it is a function rather than
 * something the API service does: the service is root-scoped and would redirect from
 * anywhere in the app, not just from here.
 *
 * Must be called from an injection context.
 */
export function redirectOnSessionLoss(): void {
  const auth = inject(AuthSession);
  const router = inject(Router);
  const logger = inject(Logger);
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  effect(() => {
    if (!isBrowser || auth.isAuthenticated()) return;
    untracked(() => {
      logger.warn('[caira-tracker] session lost while on the tracker; redirecting');
      void router.navigate(['/auth/login'], { queryParams: { redirect: router.url } });
    });
  });
}
