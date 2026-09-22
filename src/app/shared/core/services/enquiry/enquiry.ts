import { HttpContext } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, Observable, throwError } from 'rxjs';
import { SKIP_AUTH_TOKEN, SKIP_ERROR_NOTIFICATION } from '../../models/http.model';
import { drfErrorMessage } from '../../../utils/drf-error-message';
import { ApiClient } from '../api-client/api-client';
import { Logger } from '../logger/logger';

export interface EnquiryPayload {
  full_name: string;
  email: string;
  firm_name: string;
  job_role: string;
  help_type: string[];
  enquiry_type: string;
  keep_updated: boolean;
}

/** `POST partners/leads/` 201 body. */
export interface EnquiryResponse {
  success: boolean;
  message: string;
  id: number;
}

const LEADS_URL = 'partners/leads/';

@Injectable({ providedIn: 'root' })
export class EnquiryService {
  private readonly api = inject(ApiClient);
  private readonly logger = inject(Logger);

  readonly isLoading = signal(false);

  submitEnquiry(payload: EnquiryPayload): Observable<EnquiryResponse> {
    this.isLoading.set(true);

    return this.api
      .post<EnquiryResponse>(LEADS_URL, payload, {
        // Public endpoint: no learner cookie token, no admin token. The form
        // toasts its own error, and the global toast would only show Angular's
        // generic text instead of the DRF field message.
        context: new HttpContext().set(SKIP_AUTH_TOKEN, true).set(SKIP_ERROR_NOTIFICATION, true),
      })
      .pipe(
        finalize(() => this.isLoading.set(false)),
        catchError((err) => {
          this.logger.error('[EnquiryService] submitEnquiry failed', err);
          return throwError(
            () => new Error(drfErrorMessage(err, 'Failed to submit inquiry. Please try again.')),
          );
        }),
      );
  }
}
