import {
  BadgeActionState,
  BadgeCourseType,
  BadgeUserRef,
} from '../../../../shared/core/models/caira-badge.model';
import { TRANSACTION_TO_URL } from '../../../cpe-tracker/shared/utils/course.util';
import { toSlug } from '../../../cpe-tracker/shared/utils/slug.util';

/**
 * What a badge card's CTA should do. Pure — the component performs it, so the
 * mapping stays testable and the two card components stay free of `Router` and
 * `window` calls.
 */
export type BadgeActionTarget =
  | { kind: 'navigate'; commands: unknown[]; queryParams?: Record<string, string> }
  | { kind: 'claim'; userBadgeId: number }
  | { kind: 'external'; url: string }
  | { kind: 'none' };

export interface BadgeActionSource {
  state: BadgeActionState;
  courseType: BadgeCourseType;
  /** Course / webinar id. `null` for a `coming_soon` webinar badge with no session. */
  courseId: number | null;
  courseTitle: string;
  userBadge: BadgeUserRef | null;
}

/**
 * `localePrefix` is `/{country}/{profession}` — read it from `Utils`, never
 * hardcode it. `currentUrl` becomes the feedback page's `?redirect=` so the
 * user lands back here after submitting.
 */
export function badgeActionTarget(
  src: BadgeActionSource,
  localePrefix: string,
  currentUrl: string,
): BadgeActionTarget {
  // Already claimed on Credly: go straight to the certificate. If the server
  // hasn't handed us an accept_url yet, re-run the (idempotent) claim, which
  // returns it.
  if (src.state === 'view_badge') {
    if (src.userBadge?.accept_url) return { kind: 'external', url: src.userBadge.accept_url };
    return src.userBadge ? { kind: 'claim', userBadgeId: src.userBadge.id } : { kind: 'none' };
  }

  if (src.state === 'claim_badge') {
    return src.userBadge ? { kind: 'claim', userBadgeId: src.userBadge.id } : { kind: 'none' };
  }

  // Nothing scheduled in this badge's series — there is no page to open.
  if (src.state === 'coming_soon' || src.courseId === null) return { kind: 'none' };

  const base = [
    localePrefix,
    TRANSACTION_TO_URL[src.courseType] ?? 'masterclass',
    src.courseId,
    toSlug(src.courseTitle),
  ];

  if (src.state === 'submit_feedback') {
    return {
      kind: 'navigate',
      commands: [...base, 'feedback'],
      queryParams: { redirect: currentUrl },
    };
  }

  // register_now / registered / in_progress / locked all land on the course or
  // webinar detail page, which already owns enrolment, purchase and resume.
  return { kind: 'navigate', commands: base };
}
