import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WebinarCard as WebinarCardModel } from '../../models/webinar.model';
import { formatSessionLabel, ServerClock } from '../../utils/server-clock';
import { TICKET_ICON } from '../../utils/webinar-icons';
import { ctaFor, isLive } from '../../utils/webinar-status';
import { JoinCta } from '../join-cta/join-cta';

/**
 * The banner: one highlighted webinar, centred over its own artwork.
 *
 * Deliberately flat — artwork, status pill, title, description, session time,
 * one call to action. The CTA is `app-join-cta`, so the twelve states the
 * machine in `webinar-status.ts` can produce all render here without this
 * component knowing about any of them.
 */
@Component({
  selector: 'app-webinar-hero',
  host: { class: 'block' },
  imports: [JoinCta, RouterLink],
  templateUrl: './webinar-hero.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebinarHero {
  readonly webinar = input.required<WebinarCardModel>();
  /**
   * Make the artwork a link into this webinar's detail page.
   *
   * Off by default, because the DETAIL page renders this same banner — and a
   * relative `[id]` from `/webinar/:id` would resolve to `/webinar/:id/:id`.
   * Only the landing page, which sits at the feature root, turns it on.
   */
  readonly linkToDetail = input(false);
  readonly isRegistering = input(false);
  readonly isLockedElsewhere = input(false);

  readonly register = output<string>();
  readonly join = output<string>();

  private readonly clock = inject(ServerClock);

  protected readonly ticketIcon = TICKET_ICON;

  protected readonly cta = computed(() =>
    ctaFor(this.webinar(), {
      now: (this.clock.tick(), this.clock.now()),
      bucket: 'highlight',
      isRegistering: this.isRegistering(),
      isLockedElsewhere: this.isLockedElsewhere(),
    }),
  );

  protected readonly live = computed(() => {
    this.clock.tick();
    return isLive(this.webinar(), this.clock.now());
  });

  /**
   * Landscape crop, used both for the frame and — blurred and blown up — for
   * the ambient glow behind it, so the halo picks up whatever colours this
   * webinar's poster actually uses instead of a fixed brand wash.
   */
  protected readonly artwork = computed(() => {
    const w = this.webinar();
    return w.horizontal_thumbnail || w.square_image || w.vertical_thumbnail || null;
  });

  /** `1st Jan 2026 | 7:00 PM (EST)` — the design's exact shape. */
  protected readonly sessionLabel = computed(() =>
    formatSessionLabel(this.webinar().start_date_time),
  );
}
