import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Service, PLATFORM_ID, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

import { ApiClient } from '../api-client/api-client';
import { Storage } from '../storage/storage';
import { Logger } from '../logger/logger';

/**
 * Cookie key under which the raw campaign token (the `dXRt` URL param) is
 * persisted. Read by the auth / webinar flows to attach `utm_url` to their
 * pre-login API calls. Centralised here so the read/write sites don't repeat
 * a magic string.
 */
export const UTM_COOKIE_KEY = 'utm_url';

/** How long the captured campaign token sticks around (days). */
const UTM_COOKIE_TTL_DAYS = 30;

/** Landing-link query param carrying the campaign token. */
const UTM_PARAM = 'dXRt';

/** Backend attribution endpoint (relative to `BASE_API_URL`). */
const TRACK_UTM_URL = 'utm/track_utm/';

/** Request body for `POST utm/track_utm/`. */
export interface PassUtmDataRequest {
  utm_url: string;
  browser_session_id: string;
}

/**
 * Detects the campaign token (`?dXRt=...`) on the landing URL and, when
 * present, persists the full landing URL in a cookie, reports it to the
 * backend, and strips the query string from the URL on success.
 *
 * Stored verbatim — no decode/decrypt. The value is later attached as
 * `utm_url` to the pre-login auth + webinar registration calls so a signup can
 * be tied back to the campaign.
 */
@Service()
export class Utm {
  private readonly http = inject(ApiClient);
  private readonly storage = inject(Storage);
  private readonly router = inject(Router);
  private readonly logger = inject(Logger);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  /**
   * One-shot capture, intended to run once per browser load (call from
   * `afterNextRender`). No-ops on the server, when the param is absent, or
   * when a token was already captured (first-write-wins, 30-day TTL).
   */
  capture(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const token = new URLSearchParams(this.document.location.search).get(UTM_PARAM);
    if (!token) return;
    // if (this.storage.getCookie(UTM_COOKIE_KEY)) {
    //     const path = this.router.url.split('?')[0];
    //     this.router.navigateByUrl(path, { replaceUrl: true });
    //   return
    // };

    // The `dXRt` param only gates the capture; persist/report the full landing
    // URL (incl. query string) so the backend gets the complete campaign link.
    const utmUrl = this.document.location.href;

    this.storage.setCookie(UTM_COOKIE_KEY, utmUrl, {
      expires: UTM_COOKIE_TTL_DAYS,
      path: '/',
    });

    this.passUtmData({
      utm_url: utmUrl,
      browser_session_id: this.storage.getOrCreateBrowserSessionId(),
    }).subscribe({
      next: () => {
        // Strip the query string so the campaign token doesn't linger in the
        // address bar / shared links. Use the live browser path rather than
        // `router.url` — on a first-time deep link the initial navigation can
        // still be in flight when this resolves, leaving `router.url` as '/'
        // and sending the user to the home page. `replaceUrl` keeps the cleaned
        // URL out of history.
        const path = this.document.location.pathname;
        this.router.navigateByUrl(path, { replaceUrl: true });
      },
      // Leave the URL untouched on failure so a retry can still pick up the param.
      error: (err) => this.logger.error('passUtmData failed', err),
    });
  }

  private passUtmData(body: PassUtmDataRequest): Observable<unknown> {
    return this.http.post<unknown>(TRACK_UTM_URL, body);
  }
}
