import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { ApiClient } from '../api-client/api-client';
import { Logger } from '../logger/logger';
import { NotificationService } from '../notification/notification';
import { PROFILE_ROUTES } from '../../models/profile.model';

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
  private readonly http = inject(ApiClient);
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
    return this.http.post(PROFILE_ROUTES.applyPartnerCode.path, { partner_code }).pipe(
      tap(() => {
        // ponytail: used to refetch the profile here so server-derived flags
        // (`is_existing_user`) picked up the new code. No profile layer now.
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
