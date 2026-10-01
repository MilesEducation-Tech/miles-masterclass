import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FeedCard } from '@features/offerings/webinar/models/webinar.model';
import { ServerClock } from '@features/offerings/webinar/services/server-clock';
import { WebinarFacade } from '@features/offerings/webinar/services/webinar-facade';
import {
  formatSessionLabel,
  formatStartsIn,
  parseIso,
  sessionParts,
} from '@features/offerings/webinar/utils/session-time';
import { TICKET_ICON } from '@features/offerings/webinar/utils/brand-assets';
import {
  ctaFor,
  sessionPhaseOf,
  WebinarBucket,
} from '@features/offerings/webinar/utils/webinar-status';
import { JoinCta } from '@features/offerings/webinar/components/join-cta/join-cta';
import { SeatForm } from '@features/offerings/webinar/components/seat-form/seat-form';
import { WebinarCountdown } from '@features/offerings/webinar/components/webinar-countdown/webinar-countdown';

/**
 * The banner, in the two layouts the v3 design draws.
 *
 * **Member** (`post_login`): the artwork centred over its glow, the LIVE
 * pill, title, chips, the session caption and amber date line, the four-cell
 * countdown once booked, and the CTA row. The CTA is `app-join-cta`, so every
 * state the machine in `webinar-status.ts` produces renders here without this
 * component knowing about any of them.
 *
 * **Guest** (`pre_login`): the same webinar as a white "ticket" over a blurred
 * full-bleed backdrop, beside a "Secure Your Seat" card that signs the visitor
 * in and books the seat (`app-seat-form`). There is no CTA row for a guest —
 * the card IS the call to action — and, as in v3, it shows whatever the
 * session's phase, because the card is also how a guest joins a live one.
 *
 * Which layout renders follows `WebinarFacade.loginType()`, i.e. the session,
 * not the bucket: on the server that is always `pre_login`, so a crawler and
 * the first paint see the guest layout and hydration flips it for a member.
 */
@Component({
  selector: 'app-webinar-hero',
  host: { class: 'block' },
  imports: [JoinCta, RouterLink, SeatForm, WebinarCountdown],
  templateUrl: './webinar-hero.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebinarHero {
  readonly webinar = input.required<FeedCard>();
  /**
   * Make the artwork a link into this webinar's detail page.
   *
   * Off by default, because the DETAIL page renders this same banner — and a
   * relative `[id]` from `/webinar/:id` would resolve to `/webinar/:id/:id`.
   * Only the landing page, which sits at the feature root, turns it on.
   */
  readonly linkToDetail = input(false);
  /**
   * Which feed bucket this webinar sits in. The landing page's banner is the
   * highlight by definition; the detail page passes the real one, because a
   * past webinar's CTA (attended / absent / missed) is decided by its bucket.
   */
  readonly bucket = input<WebinarBucket>('highlight');
  readonly isRegistering = input(false);
  readonly isLockedElsewhere = input(false);

  readonly register = output<string>();
  readonly join = output<string>();

  private readonly clock = inject(ServerClock);
  private readonly facade = inject(WebinarFacade);

  protected readonly ticketIcon = TICKET_ICON;

  protected readonly isGuest = computed(() => this.facade.loginType() === 'pre_login');

  /** Read once per second so every phase-dependent piece below re-evaluates. */
  private readonly now = computed(() => (this.clock.tick(), this.clock.now()));

  protected readonly cta = computed(() =>
    ctaFor(this.webinar(), {
      now: this.now(),
      bucket: this.bucket(),
      isRegistering: this.isRegistering(),
      isLockedElsewhere: this.isLockedElsewhere(),
    }),
  );

  protected readonly phase = computed(() => sessionPhaseOf(this.webinar(), this.now()));

  /** "Upcoming Session" / "Live Now" / "Session Ended" — the caption over the date. */
  protected readonly phaseCaption = computed(() => {
    switch (this.phase()) {
      case 'live':
        return 'Live Now';
      case 'ended':
        return 'Session Ended';
      default:
        return 'Upcoming Session';
    }
  });

  /**
   * Landscape crop, used both for the frame and — blurred and blown up — for
   * the ambient backdrop behind the guest ticket, so the wash picks up whatever
   * colours this webinar's poster actually uses instead of a fixed brand tint.
   */
  protected readonly artwork = computed(() => {
    const w = this.webinar();
    return w.horizontal_thumbnail || w.square_image || w.vertical_thumbnail || null;
  });

  /** `1st Jan 2026 | 7:00 PM (EST)` — the design's exact shape. */
  protected readonly sessionLabel = computed(() =>
    formatSessionLabel(this.webinar().start_date_time),
  );

  /** `NOV` / `12` / `7:00 PM` / `EST`, for the guest ticket's date pill. */
  protected readonly session = computed(() => sessionParts(this.webinar().start_date_time));

  protected readonly startsAt = computed(() => parseIso(this.webinar().start_date_time));

  /** The amber "Webinar starts in 2 hrs" chip on the guest ticket; null once live. */
  protected readonly startsIn = computed(() => {
    const start = this.startsAt();
    if (start === null || this.phase() !== 'upcoming') return null;
    return formatStartsIn(start - this.now());
  });

  /** Field-of-study names, pipe-separated — the categories strip. */
  protected readonly categories = computed(() =>
    this.webinar()
      .fields_of_study.map((f) => f.name)
      .join(' | '),
  );

  /** `L1`, only when the level sits under the CAIRA subject. */
  protected readonly cairaLevel = computed<string | null>(() => {
    const w = this.webinar();
    const level = w.level_details?.level_number;
    if (!w.subject || level == null) return null;
    return `L${level}`;
  });
}
