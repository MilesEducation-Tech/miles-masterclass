import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import {
  IS_EXTERNAL_REQUEST,
  SKIP_AUTH_TOKEN,
  SKIP_ERROR_NOTIFICATION,
} from '../../models/http.model';
import { ApiClient } from '../api-client/api-client';
import { Auth } from '../auth/auth';
import { Logger } from '../logger/logger';

/** What goes on the wire to Miles360's `masterclass-activity` endpoint. */
interface MilesActivityPayload {
  miles_uuid: string;
  event_name: string;
  /** UTC, second precision (`2026-08-25T06:07:17Z`) — the API sample carries no millis. */
  event_time: string;
  event_data: Record<string, unknown>;
}

/**
 * Mirrors every GA4 event to Miles360 (Salesforce), so CRM journeys can be
 * built on the same behavioural signal the web app already emits.
 *
 * There is exactly one caller: {@link Analytics}. It invokes `send()` from the
 * three methods every GA4 hit funnels through — `trackEvent`, `trackPageView`
 * and `emitLifecycle` — so no individual call site knows this exists. Add a new
 * `dataLayer.push` path to Analytics and you must add a `send()` beside it, or
 * that event is silently missing from the CRM.
 *
 * Deliberately NOT consent-gated, unlike the GA4 / Clarity / Netcore hits it
 * rides alongside: this is first-party CRM data, not third-party analytics. It
 * therefore carries its own guards rather than inheriting Analytics'.
 *
 * Strictly fire-and-forget: `send()` returns `void`, never blocks the caller
 * and never surfaces an error. A dropped event is logged and forgotten — the
 * user's own interaction must always succeed on its own terms.
 */
@Injectable({ providedIn: 'root' })
export class MilesActivity {
  private readonly http = inject(ApiClient);
  private readonly auth = inject(Auth);
  private readonly logger = inject(Logger);
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Post one event. No-ops when the environment has no endpoint or key
   * configured (so a local build is inert rather than flooding the live CRM),
   * on the server, on `/admin/**`, and — crucially — for anyone not signed in:
   * without a `miles_user_id` there is no Salesforce contact to attach to.
   */
  send(name: string, params: Record<string, unknown> = {}): void {
    const { url, apiKey } = environment.MILES_ACTIVITY;
    if (!url || !apiKey || !this.isBrowser) return;
    // Production build only — never feed Miles360 from a dev or UAT run. This
    // fires on every video-progress tick and every tagged click, so an
    // unguarded non-prod session would flood the live CRM.
    if (!environment.production) return;
    if (/^\/admin(\/|$)/.test(this.doc.location.pathname)) return; // never mirror the admin panel

    const user = this.auth.currentUser();
    // `miles_user_id` ONLY — not Analytics' `miles_user_id || String(id)`
    // fallback, which yields a numeric string that is not a UUID and would be
    // junk to Miles360. A payload without the real id is simply skipped.
    const uuid = user?.miles_user_id;
    if (!uuid) return;

    const payload: MilesActivityPayload = {
      miles_uuid: uuid,
      event_name: name,
      event_time: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      // Sent as-is, nested arrays included (e.g. GA4 `items[]`) — this is a JSON
      // body, so it needs none of the flattening Netcore's dispatch requires.
      event_data: { email: user.email ?? '', app_source: environment.appType, ...params },
    };

    this.http
      .post(url, payload, {
        headers: { 'x-api-key': apiKey },
        // A fresh HttpContext per call — HttpContext is per-request, so a shared
        // instance would leak flags between requests.
        context: new HttpContext()
          .set(IS_EXTERNAL_REQUEST, true)
          .set(SKIP_AUTH_TOKEN, true)
          .set(SKIP_ERROR_NOTIFICATION, true),
      })
      // Deliberately NOT `takeUntilDestroyed`: events fire on navigation and on
      // flows that immediately route away, and cancelling would drop them
      // exactly when they matter. Same intended exception as `SalesforceLead`.
      .subscribe({
        error: (err) => this.logger.error(`[MilesActivity] ${name} failed`, err),
      });
  }
}
