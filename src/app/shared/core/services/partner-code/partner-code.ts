import { inject, Service, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
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
@Service()
export class PartnerCode {
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

    // ponytail: CAIRA has no partner-code endpoint. The stub this replaces
    // returned `EMPTY`, so the observable completed without emitting and the
    // caller's `subscribe` never ran — no toast, no error, a dead button.
    // Failing visibly is the honest state until an endpoint exists.
    this.logger.warn('Partner code endpoint is not bound', { partner_code });
    this.notification.error('Partner Code', 'Partner codes cannot be applied yet.');
    return of(false);
  }
}
