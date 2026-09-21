import { DatePipe, NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  BADGE_ACTION_UI,
  WebinarBadgeItem,
} from '../../../../../shared/core/models/caira-badge.model';
import { cn } from '../../../../../shared/utils/cn';
import { easternAbbrevFor } from '../../../../../shared/utils/eastern-time';

/**
 * A webinar badge, used both in the tracker's horizontal rail and in the
 * Webinar Badges grid — the layout is identical, width comes from the container.
 *
 * The design gives this card no CTA button (unlike the course badge card), so
 * `action_state` shows up as an accent ring and the whole card is the click
 * target. The parent resolves what that click does via `badgeActionTarget()`.
 */
@Component({
  selector: 'app-webinar-badge-card',
  imports: [DatePipe, NgOptimizedImage],
  templateUrl: './webinar-badge-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Fixed height for the same reason as the course card — see its host comment.
  // The horizontal layout needs less room than the vertical one.
  host: { class: 'block h-32' },
})
export class WebinarBadgeCard {
  readonly badge = input.required<WebinarBadgeItem>();
  readonly activate = output<WebinarBadgeItem>();

  /** Empty strings count as missing — binding `ngSrc=""` throws NG02952. */
  protected readonly iconUrl = computed(() => this.badge().icon_url || null);

  protected readonly ui = computed(() => BADGE_ACTION_UI[this.badge().action_state]);

  /**
   * Doubles as the `DatePipe` timezone arg and the visible label, so the
   * rendered time and its suffix can't disagree across a DST boundary.
   */
  protected readonly tz = computed(() => easternAbbrevFor(this.badge().session?.start_time));

  /** `coming_soon` has no session and nowhere to navigate. */
  protected readonly isActionable = computed(() => this.badge().action_state !== 'coming_soon');

  protected readonly cardClass = computed(() =>
    cn(
      'flex h-full w-full items-center gap-4 overflow-hidden rounded-2xl border border-border/50 bg-muted/60 p-4 text-left transition-colors',
      'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      this.ui().ring,
      this.isActionable() ? 'cursor-pointer hover:bg-muted' : 'cursor-default opacity-80',
    ),
  );
}
