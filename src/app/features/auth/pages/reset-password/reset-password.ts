import { HttpErrorResponse } from '@angular/common/http';
import { Location, isPlatformBrowser } from '@angular/common';
import { Component, Injector, PLATFORM_ID, afterNextRender, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroArrowLeft,
  heroCheck,
  heroClipboardDocument,
  heroKey,
} from '@ng-icons/heroicons/outline';

import { toAuthFailure } from '@core/models/auth.model';
import { ResetCredentials } from '@core/models/password.model';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { PasswordApi } from '@core/services/password-api/password-api';
import { ResetStatus } from '@features/auth/models/sign-in.model';
import { Button } from '@shared/ui/button/button';
import { Spinner } from '@shared/ui/spinner/spinner';

/** How long "Copied" shows before the button offers to copy again. */
const COPIED_MS = 2000;

/** The token from `#token=…`, or `null`. Angular has already `decodeURI`d the fragment. */
function tokenOf(fragment: string | null): string | null {
  const match = /(?:^|&)token=([^&]+)/.exec(fragment ?? '');
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/**
 * `/auth/password/reset#token=…`, the page the set/reset email links to.
 *
 * Redeeming the link issues the account a new six-digit PIN, shown once. It is spent on redemption
 * even when the response is lost, so it is redeemed only when the learner clicks: mail scanners
 * open links before people do, and redeeming on load would hand the PIN to the scanner.
 *
 * No guard: the link works signed in or out. On success the SSO has signed the account out
 * everywhere, and the page clears any local session to match.
 */
@Component({
  selector: 'app-reset-password',
  imports: [RouterLink, NgIcon, Button, Spinner, TranslocoPipe],
  providers: [provideIcons({ heroArrowLeft, heroCheck, heroClipboardDocument, heroKey })],
  templateUrl: './reset-password.html',
})
export class ResetPassword {
  private readonly passwords = inject(PasswordApi);
  private readonly auth = inject(AuthSession);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * The link's token, read once and held here only — never a signal, the URL, storage or a log —
   * and dropped once the link is spent.
   */
  private token: string | null = null;

  protected readonly status = signal<ResetStatus>('MISSING');
  protected readonly credentials = signal<ResetCredentials | null>(null);
  protected readonly error = signal<string | null>(null);
  /** False once the server has refused the link: only a new one can help then. */
  protected readonly canRetry = signal(false);
  protected readonly copied = signal(false);

  constructor() {
    const route = inject(ActivatedRoute);
    const router = inject(Router);
    const location = inject(Location);
    const injector = inject(Injector);

    // Every fragment, not only the first: a newer link pasted into this tab is a same-document
    // navigation, which reuses this page instead of building a new one.
    route.fragment.pipe(takeUntilDestroyed()).subscribe((fragment) => {
      // No fragment at all: nothing to read, and the page stays `MISSING`.
      if (fragment === null) return;
      this.token = tokenOf(fragment);
      this.credentials.set(null);
      this.error.set(null);
      this.status.set(this.token ? 'READY' : 'MISSING');

      // Out of the address bar, so history, a shared screen or a bookmark never carries it: the
      // same entry rewritten without the fragment, after the next render. Rewritten, not navigated:
      // a navigation here would cut the page's view transition short (an AbortError in the console).
      afterNextRender(
        () => {
          const tree = router.createUrlTree([], {
            relativeTo: route,
            queryParamsHandling: 'preserve',
          });
          location.replaceState(router.serializeUrl(tree));
        },
        { injector },
      );
    });
  }

  protected async reveal(): Promise<void> {
    const token = this.token;
    if (!token || this.status() === 'BUSY') return;

    this.status.set('BUSY');
    this.error.set(null);
    try {
      const credentials = await this.passwords.redeem(token);
      this.token = null;
      // Every session of the account is gone at the SSO, so one in these cookies is dead — and
      // "Log in now" leads to a page that sends signed-in visitors away. Unconditional: another tab
      // may have signed in since this one loaded, which this tab's state can't know.
      this.auth.clear();
      this.credentials.set(credentials);
      this.status.set('DONE');
    } catch (err) {
      const failure = toAuthFailure(
        err instanceof HttpErrorResponse ? err : new HttpErrorResponse({ status: 0 }),
      );
      // A 400 is the link itself: invalid, expired, used or ineligible. A 429, 502, 503 or a dropped
      // connection can be tried again with the same link.
      const refused = failure.kind === 'invalid_input';
      if (refused) this.token = null;
      this.canRetry.set(!refused);
      this.error.set(failure.message);
      this.status.set('ERROR');
    }
  }

  protected async copy(): Promise<void> {
    const password = this.credentials()?.password;
    if (!password || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(password);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), COPIED_MS);
    } catch {
      // The clipboard was refused (permissions, an insecure origin). The PIN is on screen and selectable.
    }
  }
}
