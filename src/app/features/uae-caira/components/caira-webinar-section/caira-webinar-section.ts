import { DatePipe, DOCUMENT } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';

import { CairaCredlyBadge } from '@shared/components/cards/caira-credly-badge/caira-credly-badge';
import { CategoriesList } from '@shared/components/categories-list/categories-list';
import { TotalCpeCreditsPipe } from '@shared/pipes/total-cpe-credits/total-cpe-credits-pipe';
import { LocalTimeZonePipe } from '@shared/pipes/local-time-zone/local-time-zone-pipe';
import { UpcomingPremiere } from '@core/models/feature.model';

/**
 * Live-webinar details section of the UAE CAIRA page.
 *
 * Surfaces the same details the platform's `WebinarHero` shows — fields of
 * study, title, instructor(s), CPE credits, CAIRA/Credly badge, short overview
 * and session date. The actual registration form lives in the page hero, so
 * this section's CTA scrolls back up to it instead of mounting a second form.
 *
 * ponytail: `webinar()` is inert — it was fed by the removed `WebinarFacade`,
 * so the section renders its empty state until a data source is re-attached.
 */
@Component({
  selector: 'app-caira-webinar-section',
  imports: [DatePipe, CategoriesList, CairaCredlyBadge, TotalCpeCreditsPipe, LocalTimeZonePipe],
  templateUrl: './caira-webinar-section.html',
  styleUrl: './caira-webinar-section.css',
})
export class CairaWebinarSection {
  private readonly document = inject(DOCUMENT);

  /** Live webinar if any, else the soonest upcoming featured webinar. */
  protected readonly webinar = signal<UpcomingPremiere | null>(null);
  protected readonly session = computed(() => this.webinar()?.webinar_dates?.[0] ?? null);

  /** Primary instructor first, then any co-instructors (blanks filtered out). */
  protected readonly instructorNames = computed(() => {
    const lead = this.webinar()?.instructor_details;
    const others = lead?.other_instructors ?? [];
    return [lead, ...others]
      .filter((person) => person?.first_name || person?.last_name)
      .map((person) => `${person?.first_name ?? ''} ${person?.last_name ?? ''}`.trim());
  });

  /** Webinar visual served from the Miles ImageKit CDN. */
  protected readonly webinarImage =
    'https://ik.imagekit.io/mileseducation/miles_website/caira/new/girl-at-right-point.webp';

  /** Scroll up to the hero registration form (instant — reduced-motion safe). */
  protected scrollToForm(): void {
    this.document
      .getElementById('uae-caira-top')
      ?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
}
