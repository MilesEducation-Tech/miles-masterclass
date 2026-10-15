import { inject, Service } from '@angular/core';
import { Router } from '@angular/router';
import { Analytics } from '@core/services/analytics/analytics';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import { Utils } from '@shared/services/utils';
import { BadgeClaim, BadgeCta } from '@features/tracker/caira/models/caira-badge-page.model';
import { toSlug } from '@features/tracker/utils/slug.util';

/** Everything a CTA needs. Every row shape on `badges/page/` satisfies it structurally. */
export interface BadgeActionSource {
  cta: BadgeCta;
  badge_claim: BadgeClaim;
  badge_name: string;
  /** Slug source for a masterclass course URL. Webinar URLs carry no slug. */
  course_name?: string | null;
}

/** `cta.url` is only followed when it is absolute — a relative path is ours to build, not theirs. */
const ABSOLUTE_URL = /^https?:\/\//i;

/**
 * Performs a badge card's CTA. Stateless — it exists only so the three surfaces that render
 * badge cards (the tracker rail and the two listings) share one navigation path.
 *
 * ## There is no claim request any more
 *
 * The v2 flow claimed through `GET user-badges/:id/claim/`, keyed on `user_badge.id`. That
 * route answers **404** and the replacement block, `badge_claim`, carries no id — only
 * `accept_url` and `assertion_id`. So the server now mints the Credly acceptance URL itself
 * and the client's whole job is to open it. Nothing here mutates server state, which is why
 * `run()` returns `void` where the old one returned "should the caller reload?".
 *
 * How a learner claims a badge that has NOT been awarded yet is an open question with the
 * backend — see `docs/MASTERCLASS_API_QUESTIONS.md`. Until it is answered, an enabled CTA
 * with no target says so rather than silently doing nothing.
 */
@Service()
export class BadgeActions {
  private readonly router = inject(Router);
  private readonly utils = inject(Utils);
  private readonly analytics = inject(Analytics);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);

  async run(source: BadgeActionSource): Promise<void> {
    const { cta, badge_claim: claim } = source;

    // `enabled` is the server's own word for "this click does something".
    if (!cta.enabled) return;

    // Awarded on Credly: go straight to the acceptance page.
    if (claim.accept_url) {
      this.analytics.trackEvent('badge_claim', {
        badge_name: source.badge_name,
        course_name: source.course_name ?? null,
      });
      this.openExternal(claim.accept_url);
      return;
    }

    // A destination the server chose — a certificate, or wherever `action` points. Only
    // absolute URLs: a relative path would have to be interpreted against this app's route
    // vocabulary, and the two are not the same namespace.
    if (cta.url && ABSOLUTE_URL.test(cta.url)) {
      this.openExternal(cta.url);
      return;
    }

    const prefix = `/${this.utils.country()}/${this.utils.profession()}`;

    // The course page owns enrolment, purchase and resume, so every "start/continue" action
    // lands there rather than being re-implemented per state.
    if (cta.course_id) {
      await this.router.navigate([
        prefix,
        'masterclass',
        cta.course_id,
        toSlug(source.course_name ?? source.badge_name),
      ]);
      return;
    }

    if (cta.webinar_id) {
      await this.router.navigate([prefix, 'webinar', cta.webinar_id]);
      return;
    }

    this.logger.warn('[caira-tracker] enabled CTA with no target', {
      badge_name: source.badge_name,
      action: cta.action,
    });
    this.notification.info('Not available yet', "This badge doesn't have anything to open yet.");
  }

  /** Click-handler only, so there is no server path to guard. */
  private openExternal(url: string): void {
    window.open(url, '_blank', 'noopener');
  }
}
