import { HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import {
  IS_EXTERNAL_REQUEST,
  SKIP_AUTH_TOKEN,
  SKIP_ERROR_NOTIFICATION,
} from '../../models/http.model';
import { ApiClient } from '../api-client/api-client';
import { Logger } from '../logger/logger';

/**
 * The per-user half of the lead payload. `course_id` and `vertical` are
 * constants and are merged in by `create()` — callers never supply them.
 *
 * `phone` / `country_code` are optional because not every form collects them.
 */
export interface SalesforceLeadInput {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  country_code?: string | null;
}

/**
 * What actually goes on the wire — exactly the fields the `/mmc` route
 * documents, built explicitly rather than spread from the input so a field
 * added to `SalesforceLeadInput` can never leak into the request unnoticed.
 */
interface SalesforceLeadPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  country_code?: string;
  course_id: number;
  vertical: string;
}

/** Response body — echoed input plus the two CRM ids. We only log these. */
interface SalesforceLeadResponse {
  statusCode: number;
  body?: { miles_uuid?: string; candidate_id?: string };
}

/**
 * Creates a Salesforce lead in Miles360 when — and only when — a **new user
 * account is created**. Not on returning logins, not on profile saves.
 *
 * The rule, which keeps this honest as flows change:
 *
 *   > Call `create()` exactly where `Analytics.trackAccountCreate()` is called.
 *
 * Both answer the same question ("was an account just created?"), so the two
 * calls live side by side at all three creation points:
 *
 *   1. `AuthFacade.verifyOtp`      — inside the `is_existing_user === false` branch
 *   2. `Faculty.completeAutoLogin` — inside the `isNewAccount` branch
 *   3. `WebinarRegistrationForm.maybeTrackNewAccount` — reached only when the
 *      backend returned a populated `user`, i.e. it just created the account
 *
 * If you add a flow that creates users, add both calls together. If a
 * `trackAccountCreate` ever appears without a `create()` beside it, that flow
 * is silently missing its lead.
 *
 * Strictly fire-and-forget: `create()` returns `void`, never blocks the caller
 * and never surfaces an error. A lead that fails to post is logged and dropped
 * — the user's own submit must always succeed on its own terms.
 */
@Injectable({ providedIn: 'root' })
export class SalesforceLead {
  private readonly http = inject(ApiClient);
  private readonly logger = inject(Logger);

  /**
   * Post one lead. Safe to call from any submit handler.
   *
   * No-ops when the environment has no endpoint configured, so a build without
   * one is inert rather than posting to nowhere — and on any non-production
   * build, so dev and UAT signups never create real Salesforce leads.
   */
  create(lead: SalesforceLeadInput): void {
    const { url, courseId, vertical } = environment.SALESFORCE_LEAD;
    if (!url || !environment.production) return;

    const payload: SalesforceLeadPayload = {
      first_name: lead.first_name?.trim() ?? '',
      last_name: lead.last_name?.trim() ?? '',
      email: lead.email?.trim() ?? '',
      // Drop the phone pair entirely when the form didn't collect it, rather
      // than posting empty strings.
      ...(lead.phone?.trim()
        ? { phone: lead.phone.trim(), country_code: lead.country_code?.trim() || undefined }
        : {}),
      course_id: courseId,
      vertical,
    };

    this.http
      .post<SalesforceLeadResponse>(url, payload, {
        // No `x-api-key`: the `/mmc` route is unauthenticated, so there is no
        // credential to ship in the bundle.
        // A fresh HttpContext per call — HttpContext is per-request, so a shared
        // instance would leak flags between requests.
        context: new HttpContext()
          .set(IS_EXTERNAL_REQUEST, true)
          .set(SKIP_AUTH_TOKEN, true)
          .set(SKIP_ERROR_NOTIFICATION, true),
      })
      // Deliberately NOT `takeUntilDestroyed`: every caller navigates away right
      // after a successful submit, and cancelling on navigation would drop the
      // lead exactly when it matters. This is the intended exception to the
      // repo's usual "always tie a subscription to a destroy scope" rule.
      .subscribe({
        next: (res) =>
          this.logger.log('[SalesforceLead] created', res?.body?.candidate_id ?? '(no id)'),
        error: (err) => this.logger.error('[SalesforceLead] create failed', err),
      });
  }

  /**
   * Split a single free-text name into the first/last pair the API wants.
   * Everything after the first token becomes the last name; a single-token name
   * leaves `last_name` empty. Only the enquiry form needs this — every other
   * form already collects the two fields separately.
   */
  static splitName(fullName: string): { first_name: string; last_name: string } {
    const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
    return { first_name: parts[0] ?? '', last_name: parts.slice(1).join(' ') };
  }
}
