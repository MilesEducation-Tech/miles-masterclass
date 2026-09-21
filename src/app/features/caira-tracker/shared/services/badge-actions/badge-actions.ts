import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  CourseBadgeItem,
  WebinarBadgeItem,
} from '../../../../../shared/core/models/caira-badge.model';
import { Analytics } from '../../../../../shared/core/services/analytics/analytics';
import { Logger } from '../../../../../shared/core/services/logger/logger';
import { NotificationService } from '../../../../../shared/core/services/notification/notification';
import { Utils } from '../../../../../shared/core/services/utils/utils';
import { BadgeActionSource, badgeActionTarget } from '../../utils/badge-action';

/**
 * Performs a badge card's CTA. Stateless — it holds no signals and aggregates
 * nothing; it exists only so the three surfaces that render badge cards (the
 * tracker rail and the two listings) share one claim + navigation path instead
 * of three copies of a money-adjacent flow.
 *
 * The *decision* lives in the pure `badgeActionTarget()`; this only executes it.
 */
@Injectable({ providedIn: 'root' })
export class BadgeActions {
  private readonly router = inject(Router);
  private readonly utils = inject(Utils);
  private readonly analytics = inject(Analytics);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);

  static fromCourse(card: CourseBadgeItem): BadgeActionSource {
    return {
      state: card.action_state,
      courseType: card.course.course_type,
      courseId: card.course.id,
      courseTitle: card.course.title,
      userBadge: card.user_badge,
    };
  }

  static fromWebinar(card: WebinarBadgeItem): BadgeActionSource {
    return {
      state: card.action_state,
      courseType: 'webinar',
      courseId: card.session?.id ?? null,
      courseTitle: card.session?.title ?? card.name,
      userBadge: card.user_badge,
    };
  }

  /**
   * Resolves to `true` when the badge's server-side state changed (a successful
   * claim), so the caller can reload its list rather than leave a stale
   * "Claim Badge" button on a badge that is now claimed.
   */
  async run(source: BadgeActionSource): Promise<boolean> {
    const prefix = `/${this.utils.country()}/${this.utils.profession()}`;
    const target = badgeActionTarget(source, prefix, this.router.url);

    switch (target.kind) {
      case 'navigate':
        await this.router.navigate(target.commands, { queryParams: target.queryParams });
        return false;

      case 'external':
        window.open(target.url, '_blank', 'noopener');
        return false;

      case 'claim':
        return this.claim(target.userBadgeId, source);

      case 'none':
        // The v2 lists can ship `action_state: 'claim_badge'` with `user_badge: null`
        // (no UserBadge row minted yet), and `user-badges/:id/claim/` needs that id.
        // Say so rather than swallow the click. Backend owns the real fix — see
        // `get_course_badge_cards`.
        if (source.state === 'claim_badge') {
          this.logger.warn('[caira-tracker] claim_badge card has no user_badge', {
            course_id: source.courseId,
            course_type: source.courseType,
          });
          this.notification.info(
            'Badge not ready',
            'This badge cannot be claimed yet. Please try again later.',
          );
        }
        return false;
    }
  }

  private async claim(userBadgeId: number, source: BadgeActionSource): Promise<boolean> {
    try {
      const res = await firstValueFrom(this.utils.claimBadge(userBadgeId));
      this.analytics.trackEvent('badge_claim', {
        badge_id: userBadgeId,
        course_id: source.courseId,
        course_name: source.courseTitle,
        course_type: source.courseType,
      });
      const url = this.utils.claimAcceptUrl(res);
      if (url) window.open(url, '_blank', 'noopener');
      return true;
    } catch (err) {
      // ApiClient's interceptor already surfaces the error toast; just don't
      // tell the caller to reload on a claim that never happened.
      this.logger.error('[caira-tracker] badge claim failed', err);
      return false;
    }
  }
}
