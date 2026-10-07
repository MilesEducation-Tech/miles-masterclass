import { DatePipe, NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCalendar, lucideClock } from '@ng-icons/lucide';
import { LocalTimeZonePipe } from '@shared/pipes/local-time-zone/local-time-zone-pipe';
import { Button } from '@shared/ui/button/button';
import { HOME_ASSETS } from '../../constants/home-assets';
import { HomeWebinar } from '../../models/home-sections.model';

/**
 * The live-webinar "ticket" (Figma 2175:21750): the highlighted webinar, its
 * next session, and two actions. Presentational — the row comes in through
 * `webinar`, the actions go up as outputs.
 *
 * API flag: the home page has no row to bind yet. v3 read
 * `v2/webinar/home_section/?section=highlight`, which this app does not adopt;
 * the section renders once a web-api highlight endpoint exists
 * (prompts/home-redesign.md). The Storybook story shows the ticket.
 */
@Component({
  selector: 'app-home-webinar-ticket',
  imports: [Button, NgIcon, DatePipe, LocalTimeZonePipe, NgOptimizedImage],
  templateUrl: './home-webinar-ticket.html',
  styleUrl: './home-webinar-ticket.css',
  providers: [provideIcons({ lucideCalendar, lucideClock })],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeWebinarTicket {
  readonly webinar = input.required<HomeWebinar>();

  readonly register = output<void>();
  readonly knowMore = output<void>();

  /**
   * Set by the template when the row's artwork fails to load (UAT's bucket
   * answers 403 for some). A marketing card must never show a broken-image
   * icon, so the design's banner steps in. Idempotent, so a failing fallback
   * cannot loop.
   */
  protected readonly bannerFailed = signal(false);

  protected readonly banner = computed(() =>
    this.bannerFailed()
      ? HOME_ASSETS.webinarBanner
      : (this.webinar().banner ?? HOME_ASSETS.webinarBanner),
  );
}
