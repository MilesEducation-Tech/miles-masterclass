import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  BADGE_ACTION_UI,
  CourseBadgeItem,
} from '../../../../../shared/core/models/caira-badge.model';
import { Button } from '../../../../../shared/components/ui/button/button';
import { cn } from '../../../../../shared/utils/cn';

/**
 * A course badge (masterclass / podcast / nano-learning), used both in the
 * tracker's horizontal rail and in the Course Badges grid.
 *
 * The single CTA comes straight from the server's `action_state` through
 * `BADGE_ACTION_UI` — v2 computes card state, so there is no client-side
 * state machine here (contrast `toBadgeCardData` in `badge.model.ts`, which is
 * what the v1 surfaces still use).
 */
@Component({
  selector: 'app-course-badge-card',
  imports: [Button, NgOptimizedImage],
  templateUrl: './course-badge-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Fixed height, not `h-full`: stretching only equalised cards *within* one
  // rail, so a masterclass row and a podcast row still disagreed. Every block
  // inside is a fixed box (two-line title, one-line course, no status line), so
  // the card measures 14rem regardless of content or action state. One class to
  // tune if the design moves.
  host: { class: 'block h-56' },
})
export class CourseBadgeCard {
  readonly badge = input.required<CourseBadgeItem>();
  readonly activate = output<CourseBadgeItem>();

  /** Empty strings count as missing — binding `ngSrc=""` throws NG02952. */
  protected readonly iconUrl = computed(() => this.badge().icon_url || null);

  protected readonly ui = computed(() => BADGE_ACTION_UI[this.badge().action_state]);

  protected readonly title = computed(() => this.badge().name ?? this.badge().course.title);

  protected readonly buttonClass = computed(() => cn('w-full', this.ui().class));
}
