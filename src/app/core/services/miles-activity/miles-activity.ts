import { DOCUMENT, isPlatformBrowser } from '@angular/common';

import { inject, Service, PLATFORM_ID } from '@angular/core';

import { ApiClient } from '../api-client/api-client';
import { Logger } from '../logger/logger';

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
@Service()
export class MilesActivity {
  private readonly http = inject(ApiClient);
  private readonly logger = inject(Logger);
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Post one event. No-ops when the environment has no endpoint or key
   * configured (so a local build is inert rather than flooding the live CRM),
   * on the server, on `/admin/**`, and — crucially — for anyone not signed in:
   * without a `miles_user_id` there is no Salesforce contact to attach to.
   */
  /**
   * ponytail: inert. Every payload is keyed by the signed-in user's
   * `miles_user_id`, which came from the removed session service — without an
   * identity there is no Salesforce contact to attach an event to, so the
   * method now does nothing at all rather than posting anonymous noise.
   *
   * Re-wire: read the user, rebuild the payload
   * (`{ miles_uuid, event_name, event_time, event_data }`) and POST it to
   * `environment.MILES_ACTIVITY.url` with the `x-api-key` header.
   */
  send(_name: string, _params: Record<string, unknown> = {}): void {
    // ponytail: inert
  }
}
