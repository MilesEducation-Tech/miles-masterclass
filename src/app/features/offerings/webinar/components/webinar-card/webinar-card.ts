import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { faSolidInfo } from '@ng-icons/font-awesome/solid';
import { RouterLink } from '@angular/router';
import { WebinarCard as WebinarCardModel } from '../../models/webinar.model';
import { BRAND_MARKS } from '../../utils/brand-assets';
import { formatSessionLabel, ServerClock, sessionParts } from '../../utils/server-clock';
import { ctaFor, WebinarBucket } from '../../utils/webinar-status';
import { JoinCta } from '../join-cta/join-cta';

/** How a card presents itself. */
export type WebinarCardLayout =
  /** Stacked card below `md`, row from `md` up. The rails' default. */
  | 'responsive'
  /** Always the stacked card — what a slide in a scrolling strip needs. */
  | 'card';

/**
 * One webinar, in the two shapes the design asks for.
 *
 * Below `md` it is a stacked card: artwork, then copy, then the two buttons.
 * From `md` the SAME DOM becomes a row — date pill | copy | artwork — by way of
 * a three-column grid plus `order` on the artwork. Only the date differs enough
 * to need two renderings ("NOV 12" stacked in a pill versus the full session
 * line), and those are toggled rather than restructured.
 *
 * `layout: 'card'` pins it to the stacked form at every width. A slide in a
 * scrolling strip is ~300px wide however big the viewport is, so the row form's
 * `md:` breakpoint is the wrong signal there — the strip, not the window, is
 * what constrains it.
 *
 * All five buckets carry identical objects, so this renders a
 * `highlight_webinars[0]` and a `missed_webinar[0]` alike — `bucket` is what
 * tells the state machine which affordance is appropriate, not a different shape.
 */
@Component({
  selector: 'app-webinar-card',
  imports: [NgIcon, RouterLink, JoinCta],
  templateUrl: './webinar-card.html',
  providers: [provideIcons({ faSolidInfo })],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebinarCard {
  readonly webinar = input.required<WebinarCardModel>();
  readonly bucket = input.required<WebinarBucket>();
  readonly layout = input<WebinarCardLayout>('responsive');
  readonly isRegistering = input(false);
  readonly isLockedElsewhere = input(false);

  readonly register = output<string>();
  readonly join = output<string>();

  private readonly clock = inject(ServerClock);

  protected readonly cairaMark = BRAND_MARKS.caira;

  /** The round credential badge, when the payload carries one. */
  protected readonly badge = computed(() => this.webinar().badge_icon_url || null);

  protected readonly isRowLayout = computed(() => this.layout() === 'responsive');

  /**
   * Class bundles for the row layout's responsive parts.
   *
   * Only the row form needs these: it changes shape at `md`, and a template
   * cannot conditionally un-apply a `md:grid`. The card form is one fixed
   * presentation, so it is written inline.
   */
  protected readonly articleClass = computed(() =>
    this.isRowLayout()
      ? // Columns are the design's own widths: a 152px date box, the copy, and
        // a 378px artwork box (320px banner + the 58px the round badge hangs
        // off its left edge).
        'flex h-full flex-col gap-4 rounded-2xl border border-border/60 bg-muted/40 p-4 md:grid md:h-auto md:grid-cols-[152px_minmax(0,1fr)_378px] md:items-center md:gap-6 md:rounded-none md:border-0 md:bg-transparent md:p-0 lg:gap-8'
      : 'group/card flex flex-col space-y-2',
  );

  /** Field-of-study names, pipe-separated — the `categories-list` strip. */
  protected readonly categories = computed(() =>
    this.webinar()
      .fields_of_study.map((f) => f.name)
      .join(' | '),
  );

  /**
   * The pill over the artwork on a past card.
   *
   * v2 drew this from `attendance_status`, a four-value field — Absent,
   * Present, Attended, Pending. v1 has no equivalent: `completed_webinar` rows
   * carry a single `eligible` boolean and the other two buckets carry nothing
   * at all. So the pill is derived from the bucket plus that boolean, and the
   * wording follows the new design ("Eligible for credits") rather than v2's.
   *
   * The "Pending" state has no v1 representation and is simply absent — a
   * booking whose attendance has not been ingested yet looks identical to one
   * that was ingested as not eligible. Worth closing with the backend.
   */
  protected readonly statusTag = computed<{ label: string; classes: string } | null>(() => {
    switch (this.bucket()) {
      case 'completed':
        return this.webinar().eligible
          ? { label: 'Eligible', classes: 'bg-success text-white' }
          : { label: 'Not Eligible', classes: 'bg-accent-premium text-black' };
      case 'absent':
        return { label: 'Absent', classes: 'bg-destructive text-destructive-foreground' };
      case 'missed':
        // "Missed", not "Not registered": the CTA underneath already reads
        // "Not registered", and a card that says the same thing twice wastes
        // the one glance a strip gets.
        return { label: 'Missed', classes: 'bg-black/70 text-foreground' };
      default:
        return null;
    }
  });

  /**
   * Heading over the session date.
   *
   * "Upcoming session" is wrong on a webinar that already ran, and all three
   * past buckets reuse this component — so the label follows the bucket rather
   * than being hardcoded in the template.
   */
  protected readonly sessionLineLabel = computed(() =>
    this.bucket() === 'highlight' || this.bucket() === 'upcoming'
      ? 'Upcoming session'
      : 'Session held',
  );

  /**
   * REMOVED, NOT FORGOTTEN — the design's "110/120 Minutes | 7 out of 8 Poll
   * Questions Answered" line under a completed card, which is what tells a
   * `Not Eligible` learner WHAT they missed.
   *
   * Its only source is `attended_webinar_duration`, `total_webinar_duration`,
   * `poll_questions_answered` and `total_poll_questions_available`, which the
   * contract carries on `app-api/v1/events/all-bookings/` alone. This project
   * does not call `app-api/`, and the web twin is not built, so the line could
   * never render. Restore it — component, template block and the map that fed
   * it — the day those four fields appear on `web-api` (the main-page card or
   * `webinar-details-page` would both do).
   */

  protected readonly cta = computed(() =>
    ctaFor(this.webinar(), {
      // Read the tick so a row sitting on screen flips from "Registered" to
      // "Join Now" on its own, without a refresh.
      now: (this.clock.tick(), this.clock.now()),
      bucket: this.bucket(),
      isRegistering: this.isRegistering(),
      isLockedElsewhere: this.isLockedElsewhere(),
    }),
  );

  protected readonly thumbnail = computed(() => {
    const w = this.webinar();
    return w.horizontal_thumbnail || w.square_image || null;
  });

  /** `NOV` / `12` / `7:00 PM` / `EST` for the desktop date pill. */
  protected readonly session = computed(() => sessionParts(this.webinar().start_date_time));

  /** `12th Nov 2026 | 7:00 PM (EST)` for the mobile card. */
  protected readonly sessionLabel = computed(() =>
    formatSessionLabel(this.webinar().start_date_time),
  );

  /**
   * The CAIRA level shown beside the wordmark, as `L1`.
   *
   * Gated on `subject` as well as the level, because the wordmark is a CAIRA
   * claim — a session carrying a level under some other subject must not be
   * badged with it.
   */
  protected readonly cairaLevel = computed<string | null>(() => {
    const w = this.webinar();
    const level = w.level_details?.level_number;
    if (!w.subject || level == null) return null;
    return `L${level}`;
  });
}
