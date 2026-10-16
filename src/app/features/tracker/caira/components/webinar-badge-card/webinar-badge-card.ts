import { Component, computed, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { cn } from '@shared/utils/cn';
import { badgeCtaUi, WebinarBadge } from '@features/tracker/caira/models/caira-badge-page.model';
import { localePrefix } from '@features/tracker/utils/tracker-links';

/**
 * A webinar badge, used both in the tracker's horizontal rail and in the Webinar Badges grid
 * — the layout is identical, width comes from the container.
 *
 * The whole card is a link to the webinar's detail page. It is NOT gated on `cta.enabled`:
 * that flag says whether the CTA does something, and every webinar badge in UAT comes back
 * `Coming Soon` or `Locked` with `enabled: false` — which, while this card was a
 * `[disabled]` button, made every card in the rail inert even though `cta.webinar_id` was
 * populated on all of them. Opening a page is not the CTA's decision; the detail page owns
 * its own gating.
 *
 * REMOVED, NOT FORGOTTEN — the session line ("Nov 12, 2026 • 7:00 PM EST"). Its source was
 * v2's `session.start_time`; `badges/page/` replaces that with `next_session`, which is `{}`
 * on every row in UAT, and `upcoming_sessions_count`, which is 0. Restore the line the day
 * `next_session` is populated and its shape is known.
 *
 * ALSO REMOVED — the `activate` output, which ran `BadgeActions` so the card could open a
 * Credly `accept_url`. The card navigates now, and this design has no button to put a claim
 * on. Nothing is lost today (`badge_claim.accept_url` is `null` on every row), but when the
 * backend answers Q11 in `docs/MASTERCLASS_API_QUESTIONS.md` this card needs an explicit
 * claim affordance — it cannot go back on the card itself without taking the link with it.
 */
@Component({
  selector: 'app-webinar-badge-card',
  imports: [NgOptimizedImage, RouterLink],
  templateUrl: './webinar-badge-card.html',
  // Fixed height for the same reason as the course card — see its host comment.
  // The horizontal layout needs less room than the vertical one.
  host: { class: 'block h-32' },
})
export class WebinarBadgeCard {
  readonly badge = input.required<WebinarBadge>();

  private readonly prefix = localePrefix();

  /** Empty strings count as missing — binding `ngSrc=""` throws NG02952. */
  protected readonly iconUrl = computed(() => this.badge().badge_image_url || null);

  protected readonly ui = computed(() => badgeCtaUi(this.badge()));

  /** Pre-formatted by the API ("2.0 Credits"), so the wording matches the rest of the app. */
  protected readonly credits = computed(() => {
    const badge = this.badge();
    return badge.credits_label || `${badge.total_cpe_credits} Credits`;
  });

  /**
   * `/{country}/{profession}/webinar/{id}` — one segment, no slug (`webinar.routes.ts`).
   * `cta.webinar_id` is the only webinar id on the row; there is no top-level one.
   *
   * `null` when it is missing: `[routerLink]="null"` renders an anchor with no `href`, so it
   * is neither navigable nor focusable, which is exactly right for a card with nowhere to go.
   */
  protected readonly link = computed(() => {
    const id = this.badge().cta.webinar_id;
    return id ? [this.prefix(), 'webinar', id] : null;
  });

  protected readonly cardClass = computed(() =>
    cn(
      'group/card flex h-full w-full items-center gap-4 overflow-hidden rounded-2xl border border-border/50 bg-muted/60 p-4 text-start transition-colors',
      'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      this.ui().ring,
      this.link() ? 'cursor-pointer hover:bg-muted' : 'cursor-default opacity-80',
    ),
  );
}
