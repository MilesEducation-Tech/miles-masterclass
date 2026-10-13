import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from '@shared/ui/button/button';
import { cn } from '@shared/utils/cn';
import { badgeCtaUi, MasterclassBadge } from '../../models/caira-badge-page.model';
import { localePrefix } from '../../../utils/tracker-links';
import { toSlug } from '../../../utils/slug.util';

/**
 * A masterclass course badge, used both in the tracker's horizontal rail and in the Course
 * Badges grid.
 *
 * Two click targets, deliberately. The whole card is a link to the course page — not gated on
 * `cta.enabled`, because that flag says whether the CTA does something, not whether the course
 * has a page. The CTA button keeps its own action on top of it: today both open the course, but
 * once a badge is claimable the button goes to Credly while the card still goes to the course.
 *
 * The button is NOT nested inside the link (invalid HTML, and `stopPropagation` is this repo's
 * legacy fallback, used once). Instead the link is a transparent `absolute inset-0 z-0` sibling
 * that paints above the in-flow content and catches a click anywhere, and the CTA row sits
 * above it at `z-10` — the same layering `masterclass-course-card` uses.
 *
 * Both the CTA's wording and whether it does anything come straight from the server's `cta`
 * block; `badgeCtaUi` decides only how the button is painted.
 */
@Component({
  selector: 'app-course-badge-card',
  imports: [Button, NgOptimizedImage, RouterLink],
  templateUrl: './course-badge-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Fixed height, not `h-full`: stretching only equalised cards *within* one rail, so the
  // rail and the grid still disagreed. Every block inside is a fixed box (two-line title,
  // one-line course, no status line), so the card measures 14rem regardless of content or
  // action state. One class to tune if the design moves.
  host: { class: 'block h-56' },
})
export class CourseBadgeCard {
  readonly badge = input.required<MasterclassBadge>();
  readonly activate = output<MasterclassBadge>();

  private readonly prefix = localePrefix();

  /** Empty strings count as missing — binding `ngSrc=""` throws NG02952. */
  protected readonly iconUrl = computed(() => this.badge().badge_image_url || null);

  protected readonly ui = computed(() => badgeCtaUi(this.badge()));

  /** The API already prefixes it ("Course: AI-Empowered Auditing"), so it renders as sent. */
  protected readonly courseLine = computed(() => {
    const badge = this.badge();
    return badge.subtitle || badge.course_name || '';
  });

  /**
   * `/{country}/{profession}/masterclass/{courseId}/{courseTitle}` — id AND slug
   * (`masterclass.routes.ts`). Built from the row's own `course_id`/`course_name` rather than
   * `cta.course_id`, which is only set while the CTA happens to point at the course.
   *
   * `null` when there is no course: `[routerLink]="null"` renders an anchor with no `href`, so
   * it is neither navigable nor focusable.
   */
  protected readonly link = computed(() => {
    const badge = this.badge();
    if (!badge.course_id) return null;
    return [
      this.prefix(),
      'masterclass',
      badge.course_id,
      toSlug(badge.course_name ?? badge.badge_name),
    ];
  });

  protected readonly buttonClass = computed(() => cn('w-full', this.ui().class));
}
