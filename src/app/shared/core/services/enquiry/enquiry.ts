import { inject, Service, signal } from '@angular/core';
import { catchError, from, map, Observable, throwError } from 'rxjs';
import { Logger } from '../logger/logger';
import { SupabasePublic } from '../supabase/supabase-public';

export interface EnquiryPayload {
  full_name: string;
  email: string;
  firm_name: string;
  help_type: string[];
  enquiry_type: string;
  keep_updated: boolean;
}

export interface EnquiryResponse {
  status: boolean;
  message: string;
  data?: unknown;
}

const TABLE_NAME = 'firm_inquiries';

@Service()
export class EnquiryService {
  // Use the anon-only public client — the enquiry form is for unknown visitors
  // and must never inherit the admin client's persisted session JWT.
  private readonly supabase = inject(SupabasePublic);
  private readonly logger = inject(Logger);

  readonly isLoading = signal(false);

  submitEnquiry(payload: EnquiryPayload): Observable<EnquiryResponse> {
    this.isLoading.set(true);

    const record = {
      full_name: payload.full_name,
      email: payload.email,
      firm_name: payload.firm_name,
      help_type: payload.help_type,
      keep_updated: payload.keep_updated ?? false,
      enquiry_type: payload.enquiry_type || 'General Enquiry',
      status: 'new',
    };

    // No `.select()` chain: anon must not be able to read leads back, and
    // requesting `return=representation` would otherwise trip the SELECT
    // policy. The form only needs success/failure, not the inserted row.
    // `getClient()` is async because `@supabase/supabase-js` is loaded via a
    // dynamic import — `from(promise)` unwraps it transparently.
    const request = this.supabase
      .getClient()
      .then((client) => client.from(TABLE_NAME).insert(record));

    return from(request).pipe(
      map(({ error }) => {
        this.isLoading.set(false);
        if (error) throw error;
        return {
          status: true,
          message: 'Thank you! Our team will reach out to you soon.',
        } satisfies EnquiryResponse;
      }),
      catchError((err) => {
        this.isLoading.set(false);
        this.logger.error('[EnquiryService] submitEnquiry failed', err);
        return throwError(
          () =>
            ({
              status: false,
              message: err?.message || 'Failed to submit inquiry. Please try again.',
            }) satisfies EnquiryResponse,
        );
      }),
    );
  }
}
