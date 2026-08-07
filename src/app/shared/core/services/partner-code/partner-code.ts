import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap, EMPTY } from 'rxjs';
import { Auth } from '../auth/auth';
import { Logger } from '../logger/logger';
import { NotificationService } from '../notification/notification';

/**
 * Centralises the "apply a partner code" flow used in:
 * - The profile page's optional partner-code section.
 * - The partner-code prompt dialog opened from a recommended-plan subscribe.
 *
 * Owns the loading flag, success/error toasts, and the post-success profile
 * refresh so callers don't repeat the recipe.
 */
@Injectable({
  providedIn: 'root',
})
export class PartnerCode {
  // ponytail: ApiClient was deleted with the Django strip. This placeholder
  // keeps the template bindings compiling and renders the empty state.
  // Swap in the new backend's service — the template needs no changes.
  private readonly http: any = {
    post: (..._args: any[]): any => EMPTY,
  };
  private readonly auth = inject(Auth);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);

  readonly loading = signal(false);

  /**
   * POST the trimmed partner code. Refreshes the user profile on success
   * (server-derived flags like `is_existing_user` may flip).
   *
   * Emits `true` on success, `false` on validation/API failure. Never errors —
   * caller can plain-subscribe without `catchError`.
   */
  apply(rawCode: string): Observable<boolean> {
    const partner_code = rawCode.trim();
    if (!partner_code) return of(false);

    this.loading.set(true);
    return this.http.post('', { partner_code }) /* ponytail: applyPartnerCode endpoint removed with the backend */.pipe(
      tap(() => {
        this.auth.fetchMyProfile();
        this.notification.success('Partner Code', 'Partner code applied successfully');
        this.loading.set(false);
      }),
      map(() => true),
      catchError((error: unknown) => {
        this.logger.error('Failed to apply partner code', error);
        this.notification.error('Partner Code', 'Failed to apply partner code');
        this.loading.set(false);
        return of(false);
      }),
    );
  }
}
